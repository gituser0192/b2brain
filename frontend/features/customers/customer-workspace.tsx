"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/services/api-client";
import { useAuth } from "@/features/auth/auth-context";
import { CustomerEngagement } from "./customer-engagement";

type CustomerType = "PERSON" | "COMPANY";
type CustomerStatus = "LEAD" | "ACTIVE" | "INACTIVE";
interface Customer {
  id: string; type: CustomerType; displayName: string; firstName: string | null; lastName: string | null; companyName: string | null;
  email: string | null; phone: string | null; website: string | null; addressLine1: string | null; addressLine2: string | null;
  city: string | null; state: string | null; postalCode: string | null; country: string | null; status: CustomerStatus; notes: string | null;
  createdAt: string; updatedAt: string; deletedAt: string | null;
}
interface ListResponse { success: true; data: { customers: Customer[]; pagination: { page: number; pageSize: number; total: number; pages: number } }; }
const emptyForm = { type: "PERSON" as CustomerType, firstName: "", lastName: "", companyName: "", email: "", phone: "", website: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "", status: "LEAD" as CustomerStatus, notes: "" };

export function CustomerWorkspace() {
  const { session, authorizedRequest } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canCreate = session?.membership.permissions.includes("CRM_CREATE") ?? false;
  const canUpdate = session?.membership.permissions.includes("CRM_UPDATE") ?? false;
  const canArchive = session?.membership.permissions.includes("CRM_ARCHIVE") ?? false;
  const canDelete = session?.membership.permissions.includes("CRM_DELETE") ?? false;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ archived: String(archived), pageSize: "50" });
      if (query.trim()) params.set("q", query.trim());
      if (status) params.set("status", status);
      const response = await authorizedRequest<ListResponse>(`/customers?${params}`);
      setCustomers(response.data.customers); setTotal(response.data.pagination.total);
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to load customers."); }
    finally { setLoading(false); }
  }, [authorizedRequest, archived, query, status]);
  useEffect(() => { const task = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(task); }, [load]);

  function openCreate() { setEditing(null); setForm(emptyForm); setEditorOpen(true); setError(""); }
  function openEdit(customer: Customer) {
    setEditing(customer);
    setForm({ type: customer.type, firstName: customer.firstName ?? "", lastName: customer.lastName ?? "", companyName: customer.companyName ?? "", email: customer.email ?? "", phone: customer.phone ?? "", website: customer.website ?? "", addressLine1: customer.addressLine1 ?? "", addressLine2: customer.addressLine2 ?? "", city: customer.city ?? "", state: customer.state ?? "", postalCode: customer.postalCode ?? "", country: customer.country ?? "", status: customer.status, notes: customer.notes ?? "" });
    setEditorOpen(true); setError("");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      await authorizedRequest(editing ? `/customers/${editing.id}` : "/customers", { method: editing ? "PUT" : "POST", body: JSON.stringify(form) });
      setEditorOpen(false); setNotice(editing ? "Customer updated." : "Customer created."); await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to save customer."); }
    finally { setSaving(false); }
  }
  async function changeArchive(customer: Customer) {
    setError(""); setNotice("");
    try {
      await authorizedRequest(customer.deletedAt ? `/customers/${customer.id}/restore` : `/customers/${customer.id}`, { method: customer.deletedAt ? "POST" : "DELETE" });
      setEditorOpen(false); setNotice(customer.deletedAt ? "Customer restored." : "Customer archived."); await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to update customer."); }
  }
  async function permanentlyDelete(customer: Customer) {
    if (!customer.deletedAt || !window.confirm(`Permanently delete ${customer.displayName}? This cannot be undone.`)) return;
    setError(""); setNotice("");
    try { await authorizedRequest(`/customers/${customer.id}/permanent`, { method: "DELETE" }); setEditorOpen(false); setNotice("Customer permanently deleted."); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to permanently delete customer."); }
  }

  return <div className="crm-workspace">
    <div className="crm-heading"><div><p>CRM service</p><h2>Customers</h2><span>Keep every customer relationship organized within this workspace.</span></div>{canCreate && !archived && <button onClick={openCreate}>+ Add customer</button>}</div>
    {notice && <div className="dashboard-notice success">{notice}</div>}{error && !editorOpen && <div className="dashboard-notice error">{error}</div>}
    <section className="crm-toolbar"><div className="crm-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, phone or company" /></div><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="LEAD">Lead</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select><button className={archived ? "active" : ""} onClick={() => setArchived((value) => !value)}>{archived ? "Current customers" : "Archived"}</button><span>{total} {archived ? "archived" : "customers"}</span></section>
    <section className="crm-list-panel">
      {loading ? <div className="roles-loading"><span className="spinner dark" /> Loading customers…</div> : customers.length === 0 ? <div className="crm-empty"><div><span>+</span></div><h3>{archived ? "No archived customers" : query || status ? "No customers match your filters" : "Your CRM is ready"}</h3><p>{archived ? "Archived customer records will appear here." : query || status ? "Try a different search or status." : "This organization starts with zero customer data. Add the first real customer when you are ready."}</p>{canCreate && !archived && !query && !status && <button onClick={openCreate}>Add first customer</button>}</div> : <div className="customer-table"><div className="customer-table-head"><span>Customer</span><span>Contact</span><span>Status</span><span>Updated</span><span>Actions</span></div>{customers.map((customer) => <article key={customer.id}><button className="customer-main" onClick={() => openEdit(customer)}><span>{customer.displayName.slice(0, 2).toUpperCase()}</span><div><strong>{customer.displayName}</strong><small>{customer.type === "COMPANY" ? "Company" : customer.companyName || "Person"}</small></div></button><div className="customer-contact"><span>{customer.email || "No email"}</span><small>{customer.phone || "No phone"}</small></div><span className={`customer-status ${customer.status.toLowerCase()}`}>{customer.status}</span><time>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(customer.updatedAt))}</time><div className="customer-row-actions">{customer.phone && <a href={`tel:${customer.phone}`} title={`Call ${customer.displayName}`}>Call</a>}{customer.email && <a href={`mailto:${customer.email}`} title={`Email ${customer.displayName}`}>Email</a>}<button className="row-action" onClick={() => openEdit(customer)}>View</button></div></article>)}</div>}
    </section>
      {editorOpen && <div className="customer-editor-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false); }}><form className="customer-editor" onSubmit={save}><div className="customer-editor-title"><div><p>{editing ? "Customer profile" : "New customer"}</p><h3>{editing?.displayName ?? "Add a customer"}</h3>{editing && <div className="profile-contact-actions">{editing.phone && <a href={`tel:${editing.phone}`}>Call customer</a>}{editing.email && <a href={`mailto:${editing.email}`}>Send email</a>}</div>}</div><button type="button" onClick={() => setEditorOpen(false)}>×</button></div>{error && <div className="form-alert">{error}</div>}<div className="customer-type"><button type="button" className={form.type === "PERSON" ? "active" : ""} onClick={() => setForm({ ...form, type: "PERSON" })}>Person</button><button type="button" className={form.type === "COMPANY" ? "active" : ""} onClick={() => setForm({ ...form, type: "COMPANY" })}>Company</button></div>{form.type === "PERSON" ? <div className="customer-form-grid"><label><span>First name</span><input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required /></label><label><span>Last name</span><input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label></div> : <label><span>Company name</span><input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} required /></label>}<div className="customer-form-grid"><label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label><span>Phone</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label><span>Website</span><input type="url" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="https://" /></label><label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CustomerStatus })}><option value="LEAD">Lead</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div><fieldset><legend>Address</legend><label><span>Address line 1</span><input value={form.addressLine1} onChange={(event) => setForm({ ...form, addressLine1: event.target.value })} /></label><label><span>Address line 2</span><input value={form.addressLine2} onChange={(event) => setForm({ ...form, addressLine2: event.target.value })} /></label><div className="customer-form-grid"><label><span>City</span><input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label><label><span>State</span><input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} /></label><label><span>Postal code</span><input value={form.postalCode} onChange={(event) => setForm({ ...form, postalCode: event.target.value })} /></label><label><span>Country</span><input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></label></div></fieldset><label><span>Notes</span><textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>{editing && !editing.deletedAt && <CustomerEngagement customerId={editing.id} />}<div className="customer-editor-actions">{editing && canDelete && editing.deletedAt && <button type="button" className="delete-customer" onClick={() => void permanentlyDelete(editing)}>Delete permanently</button>}{editing && canArchive && <button type="button" className="archive-customer" onClick={() => void changeArchive(editing)}>{editing.deletedAt ? "Restore customer" : "Archive customer"}</button>}<button type="submit" disabled={saving || (editing ? !canUpdate || Boolean(editing.deletedAt) : !canCreate)}>{saving ? "Saving…" : editing ? "Save changes" : "Create customer"}</button></div></form></div>}
  </div>;
}
