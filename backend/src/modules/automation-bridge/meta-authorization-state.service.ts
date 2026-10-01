import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../database/prisma.js";
import { verifyServiceAccess } from "../../middleware/auth.js";
import { AppError } from "../../shared/errors/app-error.js";
import { AuthRepository } from "../auth/auth.repository.js";
import { metaConnectionReturnPath } from "./meta-lead-connection.validation.js";
import { type MetaCapability, metaProviderFor } from "./meta-assets.service.js";

type Context = { organizationId: string; membershipId: string; userId: string };
type Variant = "INSTAGRAM_LOGIN" | "FACEBOOK_LOGIN";
const digest = (state: string) => createHash("sha256").update(state).digest("hex");
const relevantService = (capability: MetaCapability) => capability === "META_ADVERTISING" ? "MARKETING" : "LEADS";

async function requireCurrentAccess(context: Context, capability: MetaCapability) {
  const membership = await new AuthRepository().findActiveContextByMembership(context.membershipId);
  if (!membership || membership.organizationId !== context.organizationId || membership.userId !== context.userId)
    throw new AppError(403, "Meta connection is unavailable.", "META_CONNECTION_UNAVAILABLE");
  const activeContext = {
    ...context,
    roleCode: membership.role.code,
    permissions: membership.role.permissions.map(item => item.permission.code),
    isPlatformAdmin: membership.user.isPlatformAdmin,
  };
  await verifyServiceAccess(activeContext, "AUTOMATION", "AUTOMATION_MANAGE");
  const mode = await verifyServiceAccess(activeContext, relevantService(capability));
  if (mode === "READ_ONLY") throw new AppError(403, "Meta connection is unavailable.", "META_CONNECTION_UNAVAILABLE");
}

export class MetaAuthorizationStateService {
  async issue(context: Context, connectorId: string, capability: MetaCapability, loginVariant: Variant, requestedReturnPath: string) {
    const returnPath = metaConnectionReturnPath.parse(requestedReturnPath);
    await requireCurrentAccess(context, capability);
    const connector = await prisma.integrationConnector.findFirst({ where: { id: connectorId, organizationId: context.organizationId, provider: metaProviderFor(capability), type: "SOCIAL", status: "DRAFT", deletedAt: null }, select: { id: true } });
    if (!connector) throw new AppError(404, "Meta connection is unavailable.", "META_CONNECTION_UNAVAILABLE");
    const state = randomBytes(32).toString("base64url"), expiresAt = new Date(Date.now() + 10 * 60_000);
    await prisma.integrationAuthorizationState.create({ data: { stateHash: digest(state), provider: "META", capability, loginVariant, connectorId, ...context, returnPath, expiresAt } });
    return { state, expiresAt };
  }

  async consume(context: Context, connectorId: string, capability: MetaCapability, loginVariant: Variant, state: string, expectedReturnPath: string) {
    const returnPath = metaConnectionReturnPath.parse(expectedReturnPath);
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(state)) throw new AppError(400, "Authorization state is invalid or expired.", "META_STATE_INVALID");
    await requireCurrentAccess(context, capability);
    const stateHash = digest(state), now = new Date();
    const count = await prisma.integrationAuthorizationState.updateMany({ where: {
      stateHash, provider: "META", capability, loginVariant, ...context, connectorId, returnPath, consumedAt: null, expiresAt: { gt: now },
      organization: { status: "ACTIVE", deletedAt: null }, user: { status: "ACTIVE", deletedAt: null },
      membership: { organizationId: context.organizationId, userId: context.userId, status: "ACTIVE" },
      connector: { id: connectorId, organizationId: context.organizationId, provider: metaProviderFor(capability), type: "SOCIAL", status: "DRAFT", deletedAt: null },
    }, data: { consumedAt: now } });
    if (count.count !== 1) throw new AppError(400, "Authorization state is invalid or expired.", "META_STATE_INVALID");
    return { returnPath };
  }
}
