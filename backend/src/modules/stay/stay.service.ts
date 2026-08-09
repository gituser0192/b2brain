import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  PaymentInput,
  PropertyInput,
  ResidentInput,
  RoomInput,
} from "./stay.validation.js";
const propertyInclude = {
  rooms: {
    where: { deletedAt: null },
    include: {
      beds: { where: { deletedAt: null }, orderBy: { label: "asc" } },
    },
    orderBy: { number: "asc" },
  },
} satisfies Prisma.StayPropertyInclude;
export class StayService {
  async list(org: string) {
    const now = new Date();
    const [properties, residents, occupancies, charges] = await Promise.all([
      prisma.stayProperty.findMany({
        where: { organizationId: org, deletedAt: null },
        include: propertyInclude,
        orderBy: { name: "asc" },
      }),
      prisma.stayResident.findMany({
        where: { organizationId: org, deletedAt: null },
        include: {
          property: { select: { name: true } },
          occupancies: {
            where: { status: { in: ["ACTIVE", "NOTICE_PERIOD", "RESERVED"] } },
            include: {
              bed: {
                include: { room: { select: { number: true, floor: true } } },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.stayOccupancy.findMany({
        where: {
          organizationId: org,
          status: { in: ["ACTIVE", "NOTICE_PERIOD", "RESERVED"] },
        },
      }),
      prisma.stayRentCharge.findMany({
        where: { organizationId: org },
        include: {
          resident: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              whatsappOptIn: true,
            },
          },
          property: { select: { name: true } },
          occupancy: {
            include: {
              bed: { include: { room: { select: { number: true } } } },
            },
          },
          payments: { orderBy: { paidAt: "desc" } },
        },
        orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
        take: 500,
      }),
    ]);
    const beds = properties.flatMap((p) => p.rooms.flatMap((r) => r.beds)),
      expected = charges.reduce((s, c) => s + c.total.toNumber(), 0),
      collected = charges.reduce((s, c) => s + c.paidAmount.toNumber(), 0);
    return {
      properties,
      residents,
      occupancies,
      charges: charges.map((c) => ({
        ...c,
        displayStatus:
          c.status === "PENDING" && c.dueDate < now ? "OVERDUE" : c.status,
      })),
      metrics: {
        properties: properties.length,
        totalBeds: beds.length,
        occupiedBeds: beds.filter((b) => b.status === "OCCUPIED").length,
        availableBeds: beds.filter((b) => b.status === "AVAILABLE").length,
        occupancyRate: beds.length
          ? (occupancies.filter(
              (o) => o.status === "ACTIVE" || o.status === "NOTICE_PERIOD",
            ).length /
              beds.length) *
            100
          : 0,
        activeResidents: residents.filter(
          (r) => r.status === "ACTIVE" || r.status === "NOTICE_PERIOD",
        ).length,
        expected,
        collected,
        outstanding: Math.max(0, expected - collected),
        overdue: charges.filter(
          (c) =>
            c.dueDate < now && ["PENDING", "PARTIALLY_PAID"].includes(c.status),
        ).length,
      },
    };
  }
  async property(org: string, user: string, input: PropertyInput) {
    return prisma.stayProperty.create({
      data: {
        ...input,
        organizationId: org,
        status: "ACTIVE",
        createdById: user,
        updatedById: user,
      },
      include: propertyInclude,
    });
  }
  async room(org: string, input: RoomInput) {
    const property = await prisma.stayProperty.findFirst({
      where: {
        id: input.propertyId,
        organizationId: org,
        status: "ACTIVE",
        deletedAt: null,
      },
    });
    if (!property)
      throw new AppError(404, "Property was not found.", "PROPERTY_NOT_FOUND");
    return prisma.stayRoom.create({
      data: {
        organizationId: org,
        propertyId: input.propertyId,
        number: input.number,
        floor: input.floor,
        roomType: input.roomType,
        monthlyRent: input.monthlyRent,
        securityDeposit: input.securityDeposit,
        beds: {
          create: input.bedLabels.map((label) => ({
            organizationId: org,
            label,
            status: "AVAILABLE",
          })),
        },
      },
      include: { beds: true },
    });
  }
  async resident(org: string, user: string, input: ResidentInput) {
    return prisma.$transaction(
      async (tx) => {
        const [property, bed] = await Promise.all([
          tx.stayProperty.findFirst({
            where: {
              id: input.propertyId,
              organizationId: org,
              status: "ACTIVE",
              deletedAt: null,
            },
          }),
          tx.stayBed.findFirst({
            where: {
              id: input.bedId,
              organizationId: org,
              status: "AVAILABLE",
              deletedAt: null,
            },
            include: { room: true },
          }),
        ]);
        if (!property)
          throw new AppError(
            404,
            "Property was not found.",
            "PROPERTY_NOT_FOUND",
          );
        if (!bed || bed.room.propertyId !== input.propertyId)
          throw new AppError(
            409,
            "The selected bed is unavailable.",
            "BED_UNAVAILABLE",
          );
        const residentNumber = `RES-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
          resident = await tx.stayResident.create({
            data: {
              organizationId: org,
              propertyId: input.propertyId,
              residentNumber,
              firstName: input.firstName,
              lastName: input.lastName,
              phone: input.phone,
              email: input.email,
              emergencyName: input.emergencyName,
              emergencyPhone: input.emergencyPhone,
              status: "ACTIVE",
              whatsappOptIn: input.whatsappOptIn,
              whatsappOptInAt: input.whatsappOptIn ? new Date() : null,
              createdById: user,
              updatedById: user,
            },
          });
        await tx.stayOccupancy.create({
          data: {
            organizationId: org,
            propertyId: input.propertyId,
            residentId: resident.id,
            bedId: input.bedId,
            status: "ACTIVE",
            startDate: input.startDate,
            endDate: input.endDate,
            monthlyRent: input.monthlyRent,
            securityDeposit: input.securityDeposit,
            depositReceived: input.depositReceived,
            dueDay: input.dueDay,
            createdById: user,
          },
        });
        await tx.stayBed.update({
          where: { id: input.bedId },
          data: { status: "OCCUPIED" },
        });
        return resident;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async generate(org: string, user: string, period: string) {
    const parts=period.split("-"),y=Number(parts[0]),m=Number(parts[1]),occupancies = await prisma.stayOccupancy.findMany({
        where: {
          organizationId: org,
          status: { in: ["ACTIVE", "NOTICE_PERIOD"] },
          startDate: { lte: new Date(Date.UTC(y, m, 0, 23, 59, 59)) },
          OR: [
            { endDate: null },
            { endDate: { gte: new Date(Date.UTC(y, m - 1, 1)) } },
          ],
        },
      });
    let created = 0;
    for (const o of occupancies) {
      const dueDate = new Date(Date.UTC(y, m - 1, o.dueDay)),
        rentAmount = o.monthlyRent;
      try {
        await prisma.stayRentCharge.create({
          data: {
            organizationId: org,
            propertyId: o.propertyId,
            residentId: o.residentId,
            occupancyId: o.id,
            period,
            dueDate,
            rentAmount,
            total: rentAmount,
            createdById: user,
          },
        });
        created++;
      } catch (error) {
        if (!(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ))
          throw error;
      }
    }
    return { created, skipped: occupancies.length - created, period };
  }
  async payment(org: string, user: string, id: string, input: PaymentInput) {
    return prisma.$transaction(
      async (tx) => {
        const charge = await tx.stayRentCharge.findFirst({
          where: {
            id,
            organizationId: org,
            status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] },
          },
        });
        if (!charge)
          throw new AppError(
            404,
            "Open rent charge was not found.",
            "RENT_CHARGE_NOT_FOUND",
          );
        const remaining = charge.total.sub(charge.paidAmount),
          amount = new Prisma.Decimal(input.amount);
        if (amount.greaterThan(remaining))
          throw new AppError(
            409,
            "Payment exceeds the outstanding rent balance.",
            "PAYMENT_EXCEEDS_BALANCE",
          );
        const payment = await tx.stayRentPayment.create({
            data: {
              organizationId: org,
              chargeId: id,
              ...input,
              amount,
              createdById: user,
            },
          }),
          paid = charge.paidAmount.add(amount);
        await tx.stayRentCharge.update({
          where: { id },
          data: {
            paidAmount: paid,
            status: paid.greaterThanOrEqualTo(charge.total)
              ? "PAID"
              : "PARTIALLY_PAID",
          },
        });
        return payment;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async checkout(org: string, id: string, endDate: Date) {
    return prisma.$transaction(async (tx) => {
      const occupancy = await tx.stayOccupancy.findFirst({
        where: {
          id,
          organizationId: org,
          status: { in: ["ACTIVE", "NOTICE_PERIOD"] },
        },
      });
      if (!occupancy)
        throw new AppError(
          404,
          "Active occupancy was not found.",
          "OCCUPANCY_NOT_FOUND",
        );
      await tx.stayOccupancy.update({
        where: { id },
        data: { status: "COMPLETED", endDate },
      });
      await tx.stayBed.updateMany({
        where: { id: occupancy.bedId, organizationId: org },
        data: { status: "AVAILABLE" },
      });
      await tx.stayResident.updateMany({
        where: { id: occupancy.residentId, organizationId: org },
        data: { status: "CHECKED_OUT" },
      });
    });
  }
}
