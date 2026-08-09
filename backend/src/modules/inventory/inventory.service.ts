import { Prisma, type StockMovementType } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { StockAdjustmentInput, WarehouseInput } from "./inventory.validation.js";

export class InventoryService {
  async list(organizationId: string) {
    const [warehouses, levels, movements, items] = await Promise.all([
      prisma.warehouse.findMany({ where: { organizationId, deletedAt: null }, orderBy: { name: "asc" } }),
      prisma.stockLevel.findMany({ where: { organizationId }, include: { warehouse: { select: { id: true, name: true, code: true } }, catalogueItem: { select: { id: true, sku: true, name: true } } }, orderBy: { updatedAt: "desc" } }),
      prisma.stockMovement.findMany({ where: { organizationId }, include: { warehouse: { select: { name: true } }, catalogueItem: { select: { sku: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.catalogueItem.findMany({ where: { organizationId, type: "PRODUCT", trackInventory: true, status: "ACTIVE", deletedAt: null }, select: { id: true, sku: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    const totalOnHand = levels.reduce((sum, level) => sum + Number(level.onHand), 0);
    const totalReserved = levels.reduce((sum, level) => sum + Number(level.reserved), 0);
    return { warehouses, levels, movements, items, metrics: { trackedProducts: items.length, totalOnHand, totalReserved, available: totalOnHand - totalReserved, lowStock: levels.filter((level) => Number(level.onHand) - Number(level.reserved) <= Number(level.reorderPoint)).length } };
  }

  createWarehouse(organizationId: string, userId: string, input: WarehouseInput) {
    return prisma.warehouse.create({ data: { organizationId, code: input.code, name: input.name, address: input.address, createdById: userId, updatedById: userId } });
  }

  async adjust(organizationId: string, userId: string, input: StockAdjustmentInput) {
    const [warehouse, item] = await Promise.all([
      prisma.warehouse.findFirst({ where: { id: input.warehouseId, organizationId, isActive: true, deletedAt: null } }),
      prisma.catalogueItem.findFirst({ where: { id: input.catalogueItemId, organizationId, type: "PRODUCT", trackInventory: true, status: "ACTIVE", deletedAt: null } }),
    ]);
    if (!warehouse) throw new AppError(404, "Warehouse was not found.", "WAREHOUSE_NOT_FOUND");
    if (!item) throw new AppError(404, "Tracked product was not found.", "TRACKED_PRODUCT_NOT_FOUND");
    const quantity = new Prisma.Decimal(input.quantity);
    const incoming = input.type !== "ADJUSTMENT_OUT";
    return prisma.$transaction(async (tx) => {
      const current = await tx.stockLevel.findUnique({ where: { warehouseId_catalogueItemId: { warehouseId: input.warehouseId, catalogueItemId: input.catalogueItemId } } });
      const onHand = current?.onHand ?? new Prisma.Decimal(0);
      const reserved = current?.reserved ?? new Prisma.Decimal(0);
      const next = incoming ? onHand.add(quantity) : onHand.sub(quantity);
      if (next.isNegative() || next.lessThan(reserved)) throw new AppError(409, "This movement would reduce stock below its reserved quantity.", "INSUFFICIENT_AVAILABLE_STOCK");
      const level = await tx.stockLevel.upsert({ where: { warehouseId_catalogueItemId: { warehouseId: input.warehouseId, catalogueItemId: input.catalogueItemId } }, update: { onHand: next, ...(input.reorderPoint === undefined ? {} : { reorderPoint: new Prisma.Decimal(input.reorderPoint) }) }, create: { organizationId, warehouseId: input.warehouseId, catalogueItemId: input.catalogueItemId, onHand: next, reorderPoint: new Prisma.Decimal(input.reorderPoint ?? 0) } });
      await tx.stockMovement.create({ data: { organizationId, warehouseId: input.warehouseId, catalogueItemId: input.catalogueItemId, type: input.type, quantity: incoming ? quantity : quantity.neg(), reason: input.reason, createdById: userId } });
      return level;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  static async orderLifecycle(tx: Prisma.TransactionClient, organizationId: string, userId: string, orderId: string, action: "RESERVE"|"RELEASE"|"FULFIL") {
    const enabled = await tx.organizationService.findFirst({ where: { organizationId, status: "ENABLED", deletedAt: null, service: { code: "INVENTORY", status: "ACTIVE", archivedAt: null } }, select: { id: true } });
    if (!enabled) return;
    if (action === "RESERVE") {
      const order = await tx.order.findFirst({ where: { id: orderId, organizationId }, include: { items: { include: { catalogueItem: true } } } });
      if (!order) throw new AppError(404, "Order was not found.", "ORDER_NOT_FOUND");
      for (const line of order.items.filter((item) => item.catalogueItem?.trackInventory)) {
        const levels = await tx.stockLevel.findMany({ where: { organizationId, catalogueItemId: line.catalogueItemId!, warehouse: { isActive: true, deletedAt: null } }, orderBy: { updatedAt: "asc" } });
        let remaining = line.quantity;
        for (const level of levels) {
          const available = level.onHand.sub(level.reserved);
          if (available.lessThanOrEqualTo(0)) continue;
          const taken = Prisma.Decimal.min(available, remaining);
          await tx.stockLevel.update({ where: { id: level.id }, data: { reserved: { increment: taken } } });
          await tx.stockReservation.create({ data: { organizationId, warehouseId: level.warehouseId, catalogueItemId: line.catalogueItemId!, orderId, orderItemId: line.id, quantity: taken } });
          remaining = remaining.sub(taken);
          if (remaining.lessThanOrEqualTo(0)) break;
        }
        if (remaining.greaterThan(0)) throw new AppError(409, `Insufficient available stock for ${line.nameSnapshot}.`, "INSUFFICIENT_AVAILABLE_STOCK");
      }
    } else {
      const reservations = await tx.stockReservation.findMany({ where: { organizationId, orderId, releasedAt: null, fulfilledAt: null } });
      for (const reservation of reservations) {
        if (action === "RELEASE") {
          await tx.stockLevel.update({ where: { warehouseId_catalogueItemId: { warehouseId: reservation.warehouseId, catalogueItemId: reservation.catalogueItemId } }, data: { reserved: { decrement: reservation.quantity } } });
          await tx.stockReservation.update({ where: { id: reservation.id }, data: { releasedAt: new Date() } });
        } else {
          await tx.stockLevel.update({ where: { warehouseId_catalogueItemId: { warehouseId: reservation.warehouseId, catalogueItemId: reservation.catalogueItemId } }, data: { onHand: { decrement: reservation.quantity }, reserved: { decrement: reservation.quantity } } });
          await tx.stockReservation.update({ where: { id: reservation.id }, data: { fulfilledAt: new Date() } });
          await tx.stockMovement.create({ data: { organizationId, warehouseId: reservation.warehouseId, catalogueItemId: reservation.catalogueItemId, type: "ORDER_FULFILMENT" as StockMovementType, quantity: reservation.quantity.neg(), reason: "Order fulfilled", referenceType: "ORDER", referenceId: orderId, createdById: userId } });
        }
      }
    }
  }
}
