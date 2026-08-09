import { AppError } from "../../shared/errors/app-error.js";
import { OrganizationRepository } from "./organization.repository.js";
import type { UpdateOrganizationInput } from "./organization.validation.js";

function safeOrganization(organization: Awaited<ReturnType<OrganizationRepository["findCurrent"]>>) {
  if (!organization) throw new AppError(404, "Organization not found.", "ORGANIZATION_NOT_FOUND");
  return { id: organization.id, name: organization.name, slug: organization.slug, status: organization.status, timezone: organization.timezone, currency: organization.currency };
}

export class OrganizationService {
  constructor(private readonly repository = new OrganizationRepository()) {}
  async current(organizationId: string) { return safeOrganization(await this.repository.findCurrent(organizationId)); }
  async update(organizationId: string, input: UpdateOrganizationInput) {
    await this.current(organizationId);
    return safeOrganization(await this.repository.updateCurrent(organizationId, input));
  }
}
