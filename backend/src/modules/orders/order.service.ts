import { createHash } from "node:crypto";
import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { OrderInput } from "./order.validation.js";
import { InventoryService } from "../inventory/inventory.service.js";
import type { WebsiteOrderInput } from "../automation-bridge/website-order.validation.js";

const transitions: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELED"],
  CONFIRMED: ["PROCESSING", "CANCELED"],
  PROCESSING: ["FULFILLED", "CANCELED"],
  FULFILLED: ["REFUNDED"],
  CANCELED: [],
  REFUNDED: [],
};

export class OrderService {
  async createWebsiteDraft(organizationId: string, userId: string, connectorId: string, correlationId: string, input: WebsiteOrderInput) {
    const orderNumber = `WEB-${createHash("sha256").update(`${connectorId}:${input.externalOrderId}`).digest("hex").slice(0, 24).toUpperCase()}`;
    try {
      return await prisma.$transaction(async (tx) => {
        const duplicate = await tx.integrationEvent.findFirst({ where: { organizationId, connectorId, OR: [{ externalEventId: input.eventId }, { eventName: `website.order.${orderNumber}` }] }, select: { id: true, resultId: true, status: true } });
        if (duplicate) return { duplicate: true, eventId: duplicate.id, orderId: duplicate.resultId, status: duplicate.status, reviewRequired: true, correlationId };
        const enabled = await tx.organizationService.findMany({ where: { organizationId, status: "ENABLED", deletedAt: null, service: { code: { in: ["ORDERS", "CATALOGUE"] }, status: "ACTIVE", archivedAt: null } }, select: { service: { select: { code: true } } } });
        if (!new Set(enabled.map(item => item.service.code)).has("ORDERS") || !new Set(enabled.map(item => item.service.code)).has("CATALOGUE"))
          throw new AppError(403, "Website order intake is unavailable.", "WEBSITE_ORDER_UNAVAILABLE");
        const phone = input.customer.phone ?? null, email = input.customer.email ?? null;
        const candidates = await tx.customer.findMany({ where: { organizationId, deletedAt: null, OR: [...(phone ? [{ phone: { not: null } }] : []), ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : [])] }, select: { id: true, phone: true, email: true } });
        const byPhone = candidates.filter(item => item.phone?.replace(/\D/g, "") === phone), byEmail = candidates.filter(item => item.email?.toLowerCase() === email);
        if (byPhone.length > 1 || byEmail.length > 1 || (byPhone[0] && byEmail[0] && byPhone[0].id !== byEmail[0].id))
          throw new AppError(409, "Customer identity requires human review.", "AMBIGUOUS_CUSTOMER_IDENTITY");
        const customer = byPhone[0] ?? byEmail[0] ?? await tx.customer.create({ data: { organizationId, type: "PERSON", displayName: input.customer.name ?? phone ?? email!, firstName: input.customer.name ?? null, phone, email, status: "LEAD", notes: "Created from a verified website order draft.", createdById: userId, updatedById: userId }, select: { id: true } });
        const skus = input.items.map(item => item.sku), catalogue = await tx.catalogueItem.findMany({ where: { organizationId, sku: { in: skus }, status: "ACTIVE", deletedAt: null } });
        if (catalogue.length !== skus.length) throw new AppError(400, "One or more catalogue items are unavailable.", "CATALOGUE_ITEM_UNAVAILABLE");
        const bySku = new Map(catalogue.map(item => [item.sku, item]));
        const items = input.items.map(line => {
          const item = bySku.get(line.sku);
          if (!item || item.currency !== input.currency) throw new AppError(400, "Order item currency is unavailable.", "ORDER_CURRENCY_MISMATCH");
          const quantity = new Prisma.Decimal(line.quantity), lineSubtotal = quantity.mul(item.sellingPrice).toDecimalPlaces(2), lineTax = lineSubtotal.mul(item.taxRate).div(100).toDecimalPlaces(2);
          return { organizationId, catalogueItemId: item.id, skuSnapshot: item.sku, nameSnapshot: item.name, description: line.notes ?? item.description, quantity, unitPrice: item.sellingPrice, taxRate: item.taxRate, lineSubtotal, lineTax, lineTotal: lineSubtotal.add(lineTax) };
        });
        const subtotal = items.reduce((sum, item) => sum.add(item.lineSubtotal), new Prisma.Decimal(0)), tax = items.reduce((sum, item) => sum.add(item.lineTax), new Prisma.Decimal(0)), total = subtotal.add(tax);
        const mismatch = input.submittedTotal !== undefined && !total.equals(new Prisma.Decimal(input.submittedTotal));
        const order = await tx.order.create({ data: { organizationId, customerId: customer.id, orderNumber, status: "DRAFT", paymentStatus: "UNPAID", fulfilmentStatus: "UNFULFILLED", currency: input.currency, subtotal, discount: 0, tax, shipping: 0, total, source: "VERIFIED_WEBSITE_WEBHOOK", notes: input.customerNotes ?? null, shippingAddress: input.shippingAddress ?? null, createdById: userId, updatedById: userId, items: { create: items } }, select: { id: true } });
        const event = await tx.integrationEvent.create({ data: { organizationId, connectorId, externalEventId: input.eventId, eventName: `website.order.${orderNumber}`, kind: "ORDER", status: "AWAITING_APPROVAL", signatureVerified: true, payload: { correlationId, externalOrderIdHash: createHash("sha256").update(input.externalOrderId).digest("hex"), orderNumber, calculatedTotal: total.toString(), currency: input.currency, submittedTotalMismatch: mismatch }, payloadHash: createHash("sha256").update(`${input.eventId}:${orderNumber}`).digest("hex"), processedAt: new Date(), resultType: "ORDER", resultId: order.id, createdById: userId, updatedById: userId } });
        await tx.customerActivity.create({ data: { organizationId, customerId: customer.id, type: "NOTE", summary: "Verified website order received", details: `Draft order ${orderNumber} requires review.`, createdById: userId, updatedById: userId } });
        await tx.notification.create({ data: { organizationId, recipientId: userId, type: "APPROVAL_REQUIRED", title: "Website order requires review", message: `Draft order ${orderNumber} was calculated from approved catalogue prices.`, sourceType: "ORDER", sourceId: order.id, actionPath: "/orders", createdById: userId, updatedById: userId } });
        await tx.auditEvent.create({ data: { organizationId, actorType: "SYSTEM", serviceCode: "ORDERS", actionCode: "WEBSITE_ORDER_DRAFT_CREATED", sourceType: "ORDER", sourceId: order.id, summary: "A verified website order was stored as an unpaid draft requiring review.", metadata: { connectorId, correlationId, eventIdHash: createHash("sha256").update(input.eventId).digest("hex"), submittedTotalMismatch: mismatch } } });
        return { duplicate: false, eventId: event.id, orderId: order.id, status: "AWAITING_APPROVAL", reviewRequired: true, correlationId, calculatedTotal: total.toString(), currency: input.currency };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicate = await prisma.integrationEvent.findFirst({ where: { organizationId, connectorId, OR: [{ externalEventId: input.eventId }, { eventName: `website.order.${orderNumber}` }] }, select: { id: true, resultId: true, status: true } });
        if (duplicate) return { duplicate: true, eventId: duplicate.id, orderId: duplicate.resultId, status: duplicate.status, reviewRequired: true, correlationId };
      }
      throw error;
    }
  }
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
