import { randomUUID } from "node:crypto";
import { AppError } from "../../shared/errors/app-error.js";
import { RoleRepository } from "./role.repository.js";
import type { CreateRoleInput, UpdateRoleInput } from "./role.validation.js";

function safeRole(role: Awaited<ReturnType<RoleRepository["find"]>>) {
  if (!role) throw new AppError(404, "Role not found.", "ROLE_NOT_FOUND");
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isCustom: !role.isSystem,
    memberCount: role._count.memberships,
    permissions: role.permissions.map((item) => ({ code: item.permission.code, name: item.permission.name, description: item.permission.description })),
  };
}

function roleCode(name: string) {
  const base = name.toUpperCase().normalize("NFKD").replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48) || "ROLE";
  return `CUSTOM_${base}_${randomUUID().slice(0, 6).toUpperCase()}`;
}

export class RoleService {
  constructor(private readonly repository = new RoleRepository()) {}

  async list(organizationId: string) {
    const [roles, permissions] = await Promise.all([this.repository.list(organizationId), this.repository.permissions()]);
    return {
      roles: roles.map((role) => safeRole(role)),
      permissions: permissions.map((permission) => ({ code: permission.code, name: permission.name, description: permission.description })),
    };
  }

  private async resolvePermissions(codes: string[], actorPermissions: string[]) {
    if (codes.some((code) => !actorPermissions.includes(code))) throw new AppError(403, "A role cannot grant permissions you do not hold.", "PERMISSION_ESCALATION_BLOCKED");
    const permissions = await this.repository.findPermissions(codes);
    if (permissions.length !== codes.length) throw new AppError(400, "One or more permissions are invalid.", "INVALID_PERMISSION");
    return permissions;
  }

  async create(organizationId: string, actorPermissions: string[], input: CreateRoleInput) {
    const permissions = await this.resolvePermissions(input.permissionCodes, actorPermissions);
    const role = await this.repository.transaction(async (tx) => {
      const created = await tx.role.create({ data: { organizationId, code: roleCode(input.name), name: input.name, ...(input.description ? { description: input.description } : {}), isSystem: false } });
      await tx.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: created.id, permissionId: permission.id })) });
      return tx.role.findUniqueOrThrow({ where: { id: created.id }, include: { permissions: { include: { permission: true } }, _count: { select: { memberships: { where: { organizationId, status: { not: "REMOVED" } } } } } } });
    });
    return safeRole(role);
  }

  async update(organizationId: string, actorPermissions: string[], id: string, input: UpdateRoleInput) {
    const existing = await this.repository.find(organizationId, id);
    if (!existing) throw new AppError(404, "Role not found.", "ROLE_NOT_FOUND");
    if (existing.isSystem || existing.organizationId !== organizationId) throw new AppError(409, "System roles cannot be modified.", "SYSTEM_ROLE_PROTECTED");
    const permissions = input.permissionCodes ? await this.resolvePermissions(input.permissionCodes, actorPermissions) : undefined;
    const role = await this.repository.transaction(async (tx) => {
      await tx.role.update({ where: { id }, data: { ...(input.name ? { name: input.name } : {}), ...(input.description !== undefined ? { description: input.description } : {}) } });
      if (permissions) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: id, permissionId: permission.id })) });
      }
      return tx.role.findUniqueOrThrow({ where: { id }, include: { permissions: { include: { permission: true } }, _count: { select: { memberships: { where: { organizationId, status: { not: "REMOVED" } } } } } } });
    });
    return safeRole(role);
  }

  async remove(organizationId: string, id: string) {
    const existing = await this.repository.find(organizationId, id);
    if (!existing) throw new AppError(404, "Role not found.", "ROLE_NOT_FOUND");
    if (existing.isSystem || existing.organizationId !== organizationId) throw new AppError(409, "System roles cannot be deleted.", "SYSTEM_ROLE_PROTECTED");
    if (await this.repository.memberCount(organizationId, id)) throw new AppError(409, "Reassign members before deleting this role.", "ROLE_IN_USE");
    await this.repository.delete(id);
  }
}
