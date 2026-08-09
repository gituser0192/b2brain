import { ServiceRepository } from "./service.repository.js";

function serviceSummary(service: Awaited<ReturnType<ServiceRepository["catalog"]>>[number]) {
  return {
    id: service.id,
    code: service.code,
    name: service.name,
    description: service.description,
    iconKey: service.iconKey,
    routePath: service.routePath,
    featureFlags: service.featureFlags.map((flag) => ({ code: flag.code, name: flag.name, description: flag.description, defaultOn: flag.defaultOn })),
  };
}

export class ServiceCatalogueService {
  constructor(private readonly repository = new ServiceRepository()) {}

  async context(organizationId: string) {
    const [catalog, enabledRecords] = await Promise.all([this.repository.catalog(), this.repository.enabledForOrganization(organizationId)]);
    return {
      catalog: catalog.map(serviceSummary),
      enabledServices: enabledRecords.map((record) => ({
        id: record.id,
        enabledAt: record.enabledAt,
        service: {
          id: record.service.id,
          code: record.service.code,
          name: record.service.name,
          description: record.service.description,
          iconKey: record.service.iconKey,
          routePath: record.service.routePath,
          featureFlags: record.service.featureFlags.map((flag) => ({
            code: flag.code,
            name: flag.name,
            enabled: flag.entitlements.length ? flag.entitlements.some((entitlement) => entitlement.enabled) : flag.defaultOn,
            entitlements: flag.entitlements,
          })),
        },
      })),
    };
  }

  async enabled(organizationId: string) {
    const records = await this.repository.enabledForOrganization(organizationId);
    return records.map((record) => ({
      id: record.id,
      code: record.service.code,
      name: record.service.name,
      description: record.service.description,
      iconKey: record.service.iconKey,
      routePath: record.service.routePath,
    }));
  }
}
