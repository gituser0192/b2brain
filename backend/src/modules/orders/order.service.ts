import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { OrderInput } from "./order.validation.js";
import { InventoryService } from "../inventory/inventory.service.js";

const transitions: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELED"],
  CONFIRMED: ["PROCESSING", "CANCELED"],
  PROCESSING: ["FULFILLED", "CANCELED"],
  FULFILLED: ["REFUNDED"],
  CANCELED: [],
  REFUNDED: [],
};

export class OrderService {
  async list(organizationId: string, archived: boolean) {
    const orders = await prisma.order.findMany({
      where: { organizationId, deletedAt: archived ? { not: null } : null },
      include: { customer: { select: { id: true, displayName: true } }, items: true },
      orderBy: { createdAt: "desc" },
    });
    const active = orders.filter((order) => !["CANCELED", "REFUNDED"].includes(order.status));
    const [customers, catalogueItems] = await Promise.all([
      prisma.customer.findMany({ where: { organizationId, deletedAt: null }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" } }),
      prisma.catalogueItem.findMany({ where: { organizationId, status: "ACTIVE", deletedAt: null }, select: { id: true, sku: true, name: true, sellingPrice: true, currency: true, taxRate: true }, orderBy: { name: "asc" } }),
    ]);
    return { orders, customers, catalogueItems, metrics: {
      totalOrders: orders.length,
      activeOrders: active.filter((order) => order.status !== "FULFILLED").length,
      confirmedValue: active.filter((order) => order.status !== "DRAFT").reduce((sum, order) => sum + Number(order.total), 0),
      fulfilledValue: orders.filter((order) => order.status === "FULFILLED").reduce((sum, order) => sum + Number(order.total), 0),
    } };
  }

  private async build(organizationId: string, input: OrderInput) {
    const customer = await prisma.customer.findFirst({ where: { id: input.customerId, organizationId, deletedAt: null }, select: { id: true } });
    if (!customer) throw new AppError(404, "Customer was not found.", "CUSTOMER_NOT_FOUND");
    const ids = [...new Set(input.items.map((item) => item.catalogueItemId))];
    const catalogue = await prisma.catalogueItem.findMany({ where: { id: { in: ids }, organizationId, status: "ACTIVE", deletedAt: null } });
    if (catalogue.length !== ids.length) throw new AppError(400, "One or more catalogue items are unavailable.", "CATALOGUE_ITEM_UNAVAILABLE");
    const byId = new Map(catalogue.map((item) => [item.id, item]));
    const items = input.items.map((line) => {
      const item = byId.get(line.catalogueItemId)!;
      if (item.currency !== input.currency) throw new AppError(400, "All order items must use the order currency.", "ORDER_CURRENCY_MISMATCH");
      const quantity = new Prisma.Decimal(line.quantity);
      const unitPrice = item.sellingPrice;
      const lineSubtotal = quantity.mul(unitPrice).toDecimalPlaces(2);
      const lineTax = lineSubtotal.mul(item.taxRate).div(100).toDecimalPlaces(2);
      return { organizationId, catalogueItemId: item.id, skuSnapshot: item.sku, nameSnapshot: item.name, description: item.description, quantity, unitPrice, taxRate: item.taxRate, lineSubtotal, lineTax, lineTotal: lineSubtotal.add(lineTax) };
    });
    const subtotal = items.reduce((sum, item) => sum.add(item.lineSubtotal), new Prisma.Decimal(0));
    const tax = items.reduce((sum, item) => sum.add(item.lineTax), new Prisma.Decimal(0));
    const discount = new Prisma.Decimal(input.discount);
    const shipping = new Prisma.Decimal(input.shipping);
    const total = subtotal.sub(discount).add(tax).add(shipping);
    if (total.isNegative()) throw new AppError(400, "Discount cannot exceed the order value.", "INVALID_ORDER_TOTAL");
    return { items, subtotal, tax, discount, shipping, total };
  }

  async create(organizationId: string, userId: string, input: OrderInput) {
    const totals = await this.build(organizationId, input);
    return prisma.order.create({ data: { organizationId, customerId: input.customerId, orderNumber: input.orderNumber, currency: input.currency, source: input.source, notes: input.notes, shippingAddress: input.shippingAddress, subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, shipping: totals.shipping, total: totals.total, createdById: userId, updatedById: userId, items: { create: totals.items } }, include: { customer: true, items: true } });
  }

  async update(organizationId: string, userId: string, id: string, input: OrderInput) {
    const current = await prisma.order.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!current) throw new AppError(404, "Order was not found.", "ORDER_NOT_FOUND");
    if (current.status !== "DRAFT") throw new AppError(409, "Only draft orders can be edited.", "ORDER_NOT_EDITABLE");
    const totals = await this.build(organizationId, input);
    return prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: id, organizationId } });
      return tx.order.update({ where: { id }, data: { customerId: input.customerId, orderNumber: input.orderNumber, currency: input.currency, source: input.source, notes: input.notes, shippingAddress: input.shippingAddress, subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, shipping: totals.shipping, total: totals.total, updatedById: userId, items: { create: totals.items } }, include: { customer: true, items: true } });
    });
  }

  async setStatus(organizationId: string, userId: string, id: string, status: OrderStatus) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.order.findFirst({ where: { id, organizationId, deletedAt: null } });
      if (!current) throw new AppError(404, "Order was not found.", "ORDER_NOT_FOUND");
      if (!transitions[current.status].includes(status)) throw new AppError(409, `Order cannot move from ${current.status} to ${status}.`, "INVALID_ORDER_TRANSITION");
      if (status === "CONFIRMED") await InventoryService.orderLifecycle(tx, organizationId, userId, id, "RESERVE");
      if (status === "FULFILLED") await InventoryService.orderLifecycle(tx, organizationId, userId, id, "FULFIL");
      if (status === "CANCELED") await InventoryService.orderLifecycle(tx, organizationId, userId, id, "RELEASE");
      const now = new Date();
      return tx.order.update({ where: { id }, data: { status, fulfilmentStatus: status === "FULFILLED" ? "FULFILLED" : current.fulfilmentStatus, confirmedAt: status === "CONFIRMED" ? now : current.confirmedAt, fulfilledAt: status === "FULFILLED" ? now : current.fulfilledAt, canceledAt: status === "CANCELED" ? now : current.canceledAt, updatedById: userId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async archive(organizationId: string, userId: string, id: string) {
    if ((await prisma.order.updateMany({ where: { id, organizationId, deletedAt: null }, data: { deletedAt: new Date(), updatedById: userId } })).count !== 1) throw new AppError(404, "Order was not found.", "ORDER_NOT_FOUND");
  }

  async restore(organizationId: string, userId: string, id: string) {
    if ((await prisma.order.updateMany({ where: { id, organizationId, deletedAt: { not: null } }, data: { deletedAt: null, updatedById: userId } })).count !== 1) throw new AppError(404, "Archived order was not found.", "ORDER_NOT_FOUND");
  }
}
