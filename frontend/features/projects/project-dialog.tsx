import type { Priority, Project, ProjectForm, ProjectStatus } from "./project-types";

export function ProjectDialog({ editing, form, customers, canReadCrm, onChange, onClose, onSave }: {
  editing: Project | null; form: ProjectForm; customers: { id: string; displayName: string }[];
  canReadCrm: boolean; onChange: (form: ProjectForm) => void; onClose: () => void; onSave: () => void;
}) {
  return <div className="agent-modal"><div className="agent-dialog">
    <header><div><p>Project record</p><h3>{editing ? "Update project" : "Create project"}</h3></div><button onClick={onClose}>×</button></header>
    <label><span>Name</span><input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} /></label>
    <label><span>Project code</span><input value={form.code} onChange={(event) => onChange({ ...form, code: event.target.value })} placeholder="PRJ-001" /></label>
    {canReadCrm && <label><span>Customer (optional)</span><select value={form.customerId ?? ""} onChange={(event) => onChange({ ...form, customerId: event.target.value || null })}><option value="">Internal project / no customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName}</option>)}</select></label>}
    <label><span>Description</span><textarea rows={3} value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} /></label>
    <div className="agent-form-grid">
      <label><span>Status</span><select value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as ProjectStatus })}><option value="PLANNING">Planning</option><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="COMPLETED">Completed</option><option value="CANCELED">Canceled</option></select></label>
      <label><span>Priority</span><select value={form.priority} onChange={(event) => onChange({ ...form, priority: event.target.value as Priority })}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label>
      <label><span>Start</span><input type="date" value={form.startDate} onChange={(event) => onChange({ ...form, startDate: event.target.value })} /></label>
      <label><span>Due</span><input type="date" value={form.dueDate} onChange={(event) => onChange({ ...form, dueDate: event.target.value })} /></label>
    </div>
    <footer><button onClick={onClose}>Cancel</button><button disabled={form.name.trim().length < 2 || form.code.trim().length < 2} onClick={onSave}>Save project</button></footer>
  </div></div>;
}
