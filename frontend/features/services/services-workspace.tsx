"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";

interface MaturityMetadata {
  maturity: "AVAILABLE" | "BETA" | "TEST_MODE" | "FOUNDATION_ONLY" | "PLANNED";
  maturityLabel: string;
  availabilityNote: string;
  sellability: "GENERAL" | "BETA_ONLY" | "NOT_SELLABLE";
  hasCustomerNavigation: boolean;
}

interface CatalogueService {
  id: string;
  code: string;
  name: string;
  description: string | null;
  iconKey: string | null;
  routePath: string | null;
  maturity: MaturityMetadata | null;
  featureFlags: { code: string; name: string; description: string | null; defaultOn: boolean }[];
}
interface EnabledService {
  id: string;
  enabledAt: string;
  service: Omit<CatalogueService, "featureFlags"> & {
    featureFlags: { code: string; name: string; enabled: boolean }[];
  };
}
interface ServiceResponse { success: true; data: { catalog: CatalogueService[]; enabledServices: EnabledService[] }; }

export function ServicesWorkspace() {
  const { authorizedRequest } = useAuth();
  const [catalog, setCatalog] = useState<CatalogueService[]>([]);
  const [enabled, setEnabled] = useState<EnabledService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await authorizedRequest<ServiceResponse>("/services/context");
      setCatalog(response.data.catalog);
      setEnabled(response.data.enabledServices);
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to load service access."); }
    finally { setLoading(false); }
  }, [authorizedRequest]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  return (
    <div className="services-workspace">
      <div className="services-heading"><div><p>Capability access</p><h2>Services</h2><span>Enabled controls your organization&apos;s access. Maturity describes how complete and production-ready each service is.</span></div><div className="enabled-count"><strong>{enabled.length}</strong><small>enabled</small></div></div>
      {error && <div className="dashboard-notice error">{error}</div>}
      <section className="service-rule"><span>✓</span><div><strong>No automatic access</strong><p>Creating an organization never enables business modules. Service access must come from an explicit platform entitlement.</p></div></section>

      <section className="enabled-services-panel">
        <div className="panel-title"><div><p>Your workspace</p><h3>Enabled services</h3></div><span>{loading ? "Checking…" : `${enabled.length} active`}</span></div>
        {loading ? <div className="roles-loading"><span className="spinner dark" /> Checking service access…</div> : enabled.length === 0 ? <div className="service-empty"><div className="service-empty-icon"><span /><span /><span /></div><h3>No services enabled</h3><p>This organization starts completely empty. When a real module is built and assigned, it will appear here.</p><div><span>Zero inherited access</span><span>No demo modules</span><span>Entitlement controlled</span></div></div> : <div className="service-grid">{enabled.map((record) => <article className="service-card enabled" key={record.id}><span className="service-icon">{record.service.iconKey ?? record.service.name[0]}</span><div><span>Enabled</span><h3>{record.service.name}</h3>{record.service.maturity && <span className={`maturity-badge ${record.service.maturity.maturity.toLowerCase()}`}>{record.service.maturity.maturityLabel}</span>}<p>{record.service.maturity?.availabilityNote ?? record.service.description}</p>{record.service.maturity && !record.service.maturity.hasCustomerNavigation && <p className="maturity-navigation-note">Enabled for Beta access. A primary workspace shortcut is not available yet.</p>}</div><small>{record.service.featureFlags.filter((flag) => flag.enabled).length} features available</small></article>)}</div>}
      </section>

      <section className="catalog-panel">
        <div className="panel-title"><div><p>Platform catalogue</p><h3>Available services</h3></div><span>{catalog.length}</span></div>
        {catalog.length === 0 ? <div className="catalog-empty"><span>◇</span><div><strong>The platform catalogue is intentionally empty.</strong><p>A service will be registered only after its software module exists. A database record never generates application code.</p></div></div> : <div className="service-grid">{catalog.map((service) => <article className="service-card" key={service.id}><span className="service-icon">{service.iconKey ?? service.name[0]}</span><div><span>Catalogue</span><h3>{service.name}</h3>{service.maturity && <span className={`maturity-badge ${service.maturity.maturity.toLowerCase()}`}>{service.maturity.maturityLabel}</span>}<p>{service.maturity?.availabilityNote ?? service.description}</p></div><small>{service.featureFlags.length} feature definitions</small></article>)}</div>}
      </section>
    </div>
  );
}
