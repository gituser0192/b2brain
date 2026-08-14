"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
interface Ref {
  id: string;
  displayName?: string;
  firstName?: string;
  lastName?: string | null;
  jobTitle?: string;
  code?: string;
  name?: string;
}
interface Deployment {
  id: string;
  environment: string;
  status: string;
  summary: string;
  version: string | null;
  createdAt: string;
}
interface Request {
  id: string;
  websiteId: string;
  projectId: string | null;
  requestNumber: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  risk: string;
  status: string;
  deadline: string | null;
  approvalNotes: string | null;
  submittedToProviderAt: string | null;
  providerStatus: string | null;
  providerCustomerUpdate: string | null;
  providerUpdatedAt: string | null;
  deployments: Deployment[];
}
interface Website {
  id: string;
  customerId: string | null;
  assignedEmployeeId: string | null;
  name: string;
  domain: string;
  platform: string;
  status: string;
  adminUrl: string | null;
  repositoryUrl: string | null;
  hostingProvider: string | null;
  notes: string | null;
  deletedAt: string | null;
  customer: Ref | null;
  assignedEmployee: Ref | null;
  requests: Request[];
  deployments: Deployment[];
}
interface Payload {
  success: true;
  data: {
    websites: Website[];
    customers: Ref[];
    employees: Ref[];
    projects: Ref[];
    metrics: {
      websites: number;
      active: number;
      pendingApproval: number;
      overdue: number;
      failedDeployments: number;
    };
  };
}
const websiteBlank = {
  customerId: "",
  assignedEmployeeId: "",
  name: "",
  domain: "",
  platform: "CUSTOM",
  status: "ACTIVE",
  adminUrl: "",
  repositoryUrl: "",
  hostingProvider: "",
  notes: "",
};
const requestBlank = {
  websiteId: "",
  projectId: "",
  title: "",
  description: "",
  type: "CONTENT",
  priority: "MEDIUM",
  risk: "LOW",
  status: "REQUESTED",
  deadline: "",
};
const deploymentBlank = {
  requestId: "",
  environment: "PREVIEW",
  status: "PLANNED",
  version: "",
  deploymentUrl: "",
  summary: "",
  verification: "",
  rollbackPlan: "",
  failureReason: "",
};
export function WebsiteWorkspace() {
  const { session, authorizedRequest } = useAuth();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [customers, setCustomers] = useState<Ref[]>([]);
  const [employees, setEmployees] = useState<Ref[]>([]);
  const [projects, setProjects] = useState<Ref[]>([]);
  const [metrics, setMetrics] = useState({
    websites: 0,
    active: 0,
    pendingApproval: 0,
    overdue: 0,
    failedDeployments: 0,
  });
  const [selected, setSelected] = useState<Website | null>(null);
  const [mode, setMode] = useState<"website" | "request" | "deployment" | null>(
    null,
  );
  const [website, setWebsite] = useState(websiteBlank);
  const [request, setRequest] = useState(requestBlank);
  const [deployment, setDeployment] = useState(deploymentBlank);
  const [editing, setEditing] = useState<Website | null>(null);
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState("");
  const canManage =
    session?.membership.permissions.includes("WEBSITE_MANAGE") ?? false;
  const canApprove =
    session?.membership.permissions.includes("WEBSITE_APPROVE") ?? false;
  const canDeploy =
    session?.membership.permissions.includes("WEBSITE_DEPLOY") ?? false;
  const load = useCallback(async () => {
    try {
      const response = await authorizedRequest<Payload>(
        `/websites?archived=${archived}`,
      );
      setWebsites(response.data.websites);
      setCustomers(response.data.customers);
      setEmployees(response.data.employees);
      setProjects(response.data.projects);
      setMetrics(response.data.metrics);
      setSelected((current) =>
        current
          ? (response.data.websites.find((item) => item.id === current.id) ??
            response.data.websites[0] ??
            null)
          : (response.data.websites[0] ?? null),
      );
      setError("");
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to load websites.",
      );
    }
  }, [authorizedRequest, archived]);
  useEffect(() => {
    const task = setTimeout(() => void load(), 0);
    return () => clearTimeout(task);
  }, [load]);
  function showWebsite(item?: Website) {
    setEditing(item ?? null);
    setWebsite(
      item
        ? {
            customerId: item.customerId ?? "",
            assignedEmployeeId: item.assignedEmployeeId ?? "",
            name: item.name,
            domain: item.domain,
            platform: item.platform,
            status: item.status,
            adminUrl: item.adminUrl ?? "",
            repositoryUrl: item.repositoryUrl ?? "",
            hostingProvider: item.hostingProvider ?? "",
            notes: item.notes ?? "",
          }
        : websiteBlank,
    );
    setMode("website");
  }
  function showRequest(item: Website) {
    setRequest({ ...requestBlank, websiteId: item.id });
    setMode("request");
  }
  function showDeployment(item: Request) {
    setDeployment({
      ...deploymentBlank,
      requestId: item.id,
      environment: item.status === "APPROVED" ? "PRODUCTION" : "PREVIEW",
    });
    setMode("deployment");
  }
  async function saveWebsite() {
    try {
      await authorizedRequest(
        editing ? `/websites/${editing.id}` : "/websites",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify({
            ...website,
            customerId: website.customerId || null,
            assignedEmployeeId: website.assignedEmployeeId || null,
          }),
        },
      );
      setMode(null);
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError ? reason.message : "Unable to save website.",
      );
    }
  }
  async function saveRequest() {
    try {
      await authorizedRequest("/websites/requests", {
        method: "POST",
        body: JSON.stringify({
          ...request,
          projectId: request.projectId || null,
          deadline: request.deadline
            ? new Date(request.deadline).toISOString()
            : null,
        }),
      });
      setMode(null);
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to create request.",
      );
    }
  }
  async function approve(item: Request, approved: boolean) {
    try {
      await authorizedRequest(`/websites/requests/${item.id}/approval`, {
        method: "POST",
        body: JSON.stringify({
          approved,
          notes: approved
            ? "Approved for controlled deployment."
            : "Rejected for revision.",
        }),
      });
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to record approval.",
      );
    }
  }
  async function submitToB2Brain(item: Request) {
    if (!window.confirm("Send this request and its website scope to B² Brain Operations?")) return;
    try {
      await authorizedRequest(`/websites/requests/${item.id}/submit-to-provider`, {
        method: "POST",
        body: JSON.stringify({ confirmation: true }),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Unable to submit this request to B² Brain.");
    }
  }
  async function deploy() {
    if (!selected) return;
    try {
      await authorizedRequest(`/websites/${selected.id}/deployments`, {
        method: "POST",
        body: JSON.stringify(deployment),
      });
      setMode(null);
      await load();
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to record deployment.",
      );
    }
  }
  async function archive(item: Website) {
    await authorizedRequest(
      item.deletedAt ? `/websites/${item.id}/restore` : `/websites/${item.id}`,
      { method: item.deletedAt ? "POST" : "DELETE" },
    );
    await load();
  }
  return (
    <div className="website-workspace">
      <header className="project-heading">
        <div>
          <p>Digital operations</p>
          <h2>Websites & development</h2>
          <span>
            Control requests, approvals and deployments without storing website
            credentials in plain text.
          </span>
        </div>
        {canManage && !archived && (
          <button onClick={() => showWebsite()}>+ Register website</button>
        )}
      </header>
      {error && <div className="dashboard-notice error">{error}</div>}
      <section className="website-metrics">
        <article>
          <span>Websites</span>
          <strong>{metrics.websites}</strong>
        </article>
        <article>
          <span>Active</span>
          <strong>{metrics.active}</strong>
        </article>
        <article>
          <span>Pending approval</span>
          <strong>{metrics.pendingApproval}</strong>
        </article>
        <article>
          <span>Overdue requests</span>
          <strong>{metrics.overdue}</strong>
        </article>
        <article>
          <span>Failed deployments</span>
          <strong>{metrics.failedDeployments}</strong>
        </article>
      </section>
      <div className="catalogue-toolbar">
        <div>
          <span>{websites.length} websites</span>
        </div>
        <button
          className={archived ? "active" : ""}
          onClick={() => setArchived((value) => !value)}
        >
          {archived ? "Current websites" : "Archived"}
        </button>
      </div>
      {websites.length === 0 ? (
        <section className="project-empty">
          <span>◇</span>
          <h3>{archived ? "No archived websites" : "No managed websites"}</h3>
          <p>
            Register a real organization or customer website when it is ready to
            be managed.
          </p>
        </section>
      ) : (
        <section className="website-layout">
          <aside className="website-list">
            {websites.map((item) => (
              <button
                key={item.id}
                className={selected?.id === item.id ? "active" : ""}
                onClick={() => setSelected(item)}
              >
                <span>{item.platform}</span>
                <strong>{item.name}</strong>
                <small>{item.domain}</small>
                <footer>
                  <i>{item.status}</i>
                  <b>{item.requests.length} requests</b>
                </footer>
              </button>
            ))}
          </aside>
          {selected && (
            <article className="website-detail">
              <header>
                <div>
                  <p>
                    {selected.platform} · {selected.status}
                  </p>
                  <h3>{selected.name}</h3>
                  <a
                    href={`https://${selected.domain}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {selected.domain} ↗
                  </a>
                </div>
                <div>
                  {canManage && (
                    <button onClick={() => showRequest(selected)}>
                      + Change request
                    </button>
                  )}
                  <button onClick={() => showWebsite(selected)}>Edit</button>
                  <button onClick={() => void archive(selected)}>
                    {selected.deletedAt ? "Restore" : "Archive"}
                  </button>
                </div>
              </header>
              <div className="website-meta">
                <span>
                  <small>Owner</small>
                  <strong>
                    {selected.customer?.displayName ?? "Organization website"}
                  </strong>
                </span>
                <span>
                  <small>Responsible employee</small>
                  <strong>
                    {selected.assignedEmployee
                      ? `${selected.assignedEmployee.firstName} ${selected.assignedEmployee.lastName ?? ""}`
                      : "Unassigned"}
                  </strong>
                </span>
                <span>
                  <small>Hosting</small>
                  <strong>{selected.hostingProvider ?? "Not recorded"}</strong>
                </span>
                <span>
                  <small>Repository</small>
                  <strong>
                    {selected.repositoryUrl
                      ? "Connected metadata"
                      : "Not recorded"}
                  </strong>
                </span>
              </div>
              <section className="change-requests">
                <header>
                  <strong>Change requests</strong>
                  <span>{selected.requests.length}</span>
                </header>
                {selected.requests.length === 0 ? (
                  <div className="inventory-empty compact">
                    <p>No changes requested.</p>
                  </div>
                ) : (
                  selected.requests.map((item) => (
                    <article key={item.id}>
                      <header>
                        <div>
                          {canManage && !item.submittedToProviderAt && !["REJECTED", "CANCELED", "DEPLOYED"].includes(item.status) && (
                            <button onClick={() => void submitToB2Brain(item)}>Submit to B² Brain</button>
                          )}
                          <small>
                            {item.requestNumber} · {item.type}
                          </small>
                          <strong>{item.title}</strong>
                        </div>
                        <i className={item.risk.toLowerCase()}>
                          {item.risk} RISK
                        </i>
                      </header>
                      <p>{item.description}</p>
                      <footer>
                        <span>
                          {item.status.replaceAll("_", " ")} · {item.priority}
                        </span>
                        <div>
                          {canApprove &&
                            item.status === "AWAITING_APPROVAL" && (
                              <>
                                <button
                                  onClick={() => void approve(item, false)}
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => void approve(item, true)}
                                >
                                  Approve
                                </button>
                              </>
                            )}
                          {canDeploy &&
                            ["AWAITING_APPROVAL", "APPROVED"].includes(
                              item.status,
                            ) && (
                              <button onClick={() => showDeployment(item)}>
                                Deployment
                              </button>
                            )}
                        </div>
                      </footer>
                      {item.submittedToProviderAt && (
                        <div className="provider-progress">
                          <small>B² BRAIN OPERATIONS · {(item.providerStatus ?? "SUBMITTED").replaceAll("_", " ")}</small>
                          <strong>{item.providerCustomerUpdate ?? "Your request has been received."}</strong>
                          {item.providerUpdatedAt && <span>Updated {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.providerUpdatedAt))}</span>}
                        </div>
                      )}
                      {item.deployments.length > 0 && (
                        <div className="deployment-history">
                          {item.deployments.map((value) => (
                            <span key={value.id}>
                              <b>{value.environment}</b> {value.status} ·{" "}
                              {value.summary}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  ))
                )}
              </section>
            </article>
          )}
        </section>
      )}
      {mode && (
        <div className="agent-modal">
          <div className="agent-dialog website-dialog">
            <header>
              <div>
                <p>Website control</p>
                <h3>
                  {mode === "website"
                    ? editing
                      ? "Update website"
                      : "Register website"
                    : mode === "request"
                      ? "Create change request"
                      : "Record deployment"}
                </h3>
              </div>
              <button onClick={() => setMode(null)}>×</button>
            </header>
            {mode === "website" ? (
              <>
                <div className="agent-form-grid">
                  <label>
                    <span>Name</span>
                    <input
                      value={website.name}
                      onChange={(e) =>
                        setWebsite({ ...website, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Domain</span>
                    <input
                      placeholder="example.com"
                      value={website.domain}
                      onChange={(e) =>
                        setWebsite({ ...website, domain: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Platform</span>
                    <select
                      value={website.platform}
                      onChange={(e) =>
                        setWebsite({ ...website, platform: e.target.value })
                      }
                    >
                      <option>WORDPRESS</option>
                      <option>SHOPIFY</option>
                      <option>WIX</option>
                      <option>CUSTOM</option>
                      <option>OTHER</option>
                    </select>
                  </label>
                  <label>
                    <span>Status</span>
                    <select
                      value={website.status}
                      onChange={(e) =>
                        setWebsite({ ...website, status: e.target.value })
                      }
                    >
                      <option>ACTIVE</option>
                      <option>MAINTENANCE</option>
                      <option>PAUSED</option>
                      <option>DISCONNECTED</option>
                    </select>
                  </label>
                  <label>
                    <span>Customer (optional)</span>
                    <select
                      value={website.customerId}
                      onChange={(e) =>
                        setWebsite({ ...website, customerId: e.target.value })
                      }
                    >
                      <option value="">Organization website</option>
                      {customers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Responsible employee</span>
                    <select
                      value={website.assignedEmployeeId}
                      onChange={(e) =>
                        setWebsite({
                          ...website,
                          assignedEmployeeId: e.target.value,
                        })
                      }
                    >
                      <option value="">Unassigned</option>
                      {employees.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.firstName} {item.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Admin URL metadata</span>
                    <input
                      value={website.adminUrl}
                      onChange={(e) =>
                        setWebsite({ ...website, adminUrl: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Repository URL</span>
                    <input
                      value={website.repositoryUrl}
                      onChange={(e) =>
                        setWebsite({
                          ...website,
                          repositoryUrl: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Hosting provider</span>
                    <input
                      value={website.hostingProvider}
                      onChange={(e) =>
                        setWebsite({
                          ...website,
                          hostingProvider: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  <span>Notes (never enter passwords)</span>
                  <textarea
                    rows={2}
                    value={website.notes}
                    onChange={(e) =>
                      setWebsite({ ...website, notes: e.target.value })
                    }
                  />
                </label>
                <footer>
                  <button onClick={() => setMode(null)}>Cancel</button>
                  <button
                    disabled={!website.name || !website.domain}
                    onClick={() => void saveWebsite()}
                  >
                    Save website
                  </button>
                </footer>
              </>
            ) : mode === "request" ? (
              <>
                <div className="agent-form-grid">
                  <label>
                    <span>Type</span>
                    <select
                      value={request.type}
                      onChange={(e) =>
                        setRequest({ ...request, type: e.target.value })
                      }
                    >
                      {[
                        "BANNER",
                        "CONTENT",
                        "PRODUCT",
                        "BUG_FIX",
                        "SEO",
                        "NEW_PAGE",
                        "DESIGN",
                        "OTHER",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Project</span>
                    <select
                      value={request.projectId}
                      onChange={(e) =>
                        setRequest({ ...request, projectId: e.target.value })
                      }
                    >
                      <option value="">No linked project</option>
                      {projects.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} — {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Priority</span>
                    <select
                      value={request.priority}
                      onChange={(e) =>
                        setRequest({ ...request, priority: e.target.value })
                      }
                    >
                      <option>LOW</option>
                      <option>MEDIUM</option>
                      <option>HIGH</option>
                      <option>URGENT</option>
                    </select>
                  </label>
                  <label>
                    <span>Risk</span>
                    <select
                      value={request.risk}
                      onChange={(e) =>
                        setRequest({ ...request, risk: e.target.value })
                      }
                    >
                      <option>LOW</option>
                      <option>MEDIUM</option>
                      <option>HIGH</option>
                      <option>CRITICAL</option>
                    </select>
                  </label>
                  <label>
                    <span>Status</span>
                    <select
                      value={request.status}
                      onChange={(e) =>
                        setRequest({ ...request, status: e.target.value })
                      }
                    >
                      <option>REQUESTED</option>
                      <option>CLARIFICATION</option>
                      <option>PLANNED</option>
                      <option>IN_PROGRESS</option>
                      <option>AWAITING_APPROVAL</option>
                      <option>REJECTED</option>
                      <option>CANCELED</option>
                    </select>
                  </label>
                  <label>
                    <span>Deadline</span>
                    <input
                      type="datetime-local"
                      value={request.deadline}
                      onChange={(e) =>
                        setRequest({ ...request, deadline: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  <span>Title</span>
                  <input
                    value={request.title}
                    onChange={(e) =>
                      setRequest({ ...request, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Customer instructions</span>
                  <textarea
                    rows={4}
                    value={request.description}
                    onChange={(e) =>
                      setRequest({ ...request, description: e.target.value })
                    }
                  />
                </label>
                <footer>
                  <button onClick={() => setMode(null)}>Cancel</button>
                  <button
                    disabled={!request.title || !request.description}
                    onClick={() => void saveRequest()}
                  >
                    Create request
                  </button>
                </footer>
              </>
            ) : (
              <>
                <div className="approval-warning">
                  <strong>
                    {deployment.environment === "PRODUCTION"
                      ? "Production approval gate"
                      : "Non-production deployment"}
                  </strong>
                  <p>
                    Production is accepted only for an explicitly approved
                    request and always requires a rollback plan.
                  </p>
                </div>
                <div className="agent-form-grid">
                  <label>
                    <span>Environment</span>
                    <select
                      value={deployment.environment}
                      onChange={(e) =>
                        setDeployment({
                          ...deployment,
                          environment: e.target.value,
                        })
                      }
                    >
                      <option>PREVIEW</option>
                      <option>STAGING</option>
                      <option>PRODUCTION</option>
                    </select>
                  </label>
                  <label>
                    <span>Status</span>
                    <select
                      value={deployment.status}
                      onChange={(e) =>
                        setDeployment({ ...deployment, status: e.target.value })
                      }
                    >
                      <option>PLANNED</option>
                      <option>IN_PROGRESS</option>
                      <option>SUCCEEDED</option>
                      <option>FAILED</option>
                      <option>ROLLED_BACK</option>
                    </select>
                  </label>
                  <label>
                    <span>Version</span>
                    <input
                      value={deployment.version}
                      onChange={(e) =>
                        setDeployment({
                          ...deployment,
                          version: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Deployment URL</span>
                    <input
                      value={deployment.deploymentUrl}
                      onChange={(e) =>
                        setDeployment({
                          ...deployment,
                          deploymentUrl: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  <span>Summary</span>
                  <textarea
                    rows={2}
                    value={deployment.summary}
                    onChange={(e) =>
                      setDeployment({ ...deployment, summary: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Verification result</span>
                  <textarea
                    rows={2}
                    value={deployment.verification}
                    onChange={(e) =>
                      setDeployment({
                        ...deployment,
                        verification: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  <span>Rollback plan</span>
                  <textarea
                    rows={2}
                    value={deployment.rollbackPlan}
                    onChange={(e) =>
                      setDeployment({
                        ...deployment,
                        rollbackPlan: e.target.value,
                      })
                    }
                  />
                </label>
                {deployment.status === "FAILED" && (
                  <label>
                    <span>Failure reason</span>
                    <textarea
                      rows={2}
                      value={deployment.failureReason}
                      onChange={(e) =>
                        setDeployment({
                          ...deployment,
                          failureReason: e.target.value,
                        })
                      }
                    />
                  </label>
                )}
                <footer>
                  <button onClick={() => setMode(null)}>Cancel</button>
                  <button
                    disabled={
                      !deployment.summary ||
                      (deployment.environment === "PRODUCTION" &&
                        !deployment.rollbackPlan) ||
                      (deployment.status === "FAILED" &&
                        !deployment.failureReason)
                    }
                    onClick={() => void deploy()}
                  >
                    Record deployment
                  </button>
                </footer>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
