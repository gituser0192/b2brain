import type { Employee, EmployeeForm, EmployeeStatus, EmploymentType, Member } from "./employee-types";

export function EmployeeDialog({ editing, form, employees, members, canManage, canMembers, onChange, onClose, onSave, onArchive }: {
  editing: Employee | null; form: EmployeeForm; employees: Employee[]; members: Member[];
  canManage: boolean; canMembers: boolean; onChange: (form: EmployeeForm) => void;
  onClose: () => void; onSave: () => void; onArchive: () => void;
}) {
  return <div className="agent-modal"><div className="agent-dialog">
    <header><div><p>Employee record</p><h3>{editing ? "Update employee" : "Add employee"}</h3></div><button onClick={onClose}>×</button></header>
    <div className="agent-form-grid">
      <label><span>Employee ID</span><input value={form.employeeNumber} onChange={(e) => onChange({ ...form, employeeNumber: e.target.value })} /></label>
      <label><span>First name</span><input value={form.firstName} onChange={(e) => onChange({ ...form, firstName: e.target.value })} /></label>
      <label><span>Last name</span><input value={form.lastName} onChange={(e) => onChange({ ...form, lastName: e.target.value })} /></label>
      <label><span>Job title</span><input value={form.jobTitle} onChange={(e) => onChange({ ...form, jobTitle: e.target.value })} /></label>
      <label><span>Department</span><input value={form.department} onChange={(e) => onChange({ ...form, department: e.target.value })} /></label>
      <label><span>Employment type</span><select value={form.employmentType} onChange={(e) => onChange({ ...form, employmentType: e.target.value as EmploymentType })}><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACTOR">Contractor</option><option value="INTERN">Intern</option><option value="CONSULTANT">Consultant</option></select></label>
      <label><span>Status</span><select value={form.status} onChange={(e) => onChange({ ...form, status: e.target.value as EmployeeStatus })}><option value="ACTIVE">Active</option><option value="ON_LEAVE">On leave</option><option value="SUSPENDED">Suspended</option><option value="EXITED">Exited</option></select></label>
      <label><span>Start date</span><input type="date" value={form.startDate} onChange={(e) => onChange({ ...form, startDate: e.target.value })} /></label>
      <label><span>End date</span><input type="date" value={form.endDate} onChange={(e) => onChange({ ...form, endDate: e.target.value })} /></label>
      <label><span>Work email</span><input type="email" value={form.workEmail} onChange={(e) => onChange({ ...form, workEmail: e.target.value })} /></label>
      <label><span>Work phone</span><input value={form.workPhone} onChange={(e) => onChange({ ...form, workPhone: e.target.value })} /></label>
      <label><span>Manager</span><select value={form.managerEmployeeId ?? ""} onChange={(e) => onChange({ ...form, managerEmployeeId: e.target.value || null })}><option value="">No manager</option>{employees.filter((employee) => employee.id !== editing?.id && !employee.deletedAt).map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select></label>
    </div>
    {canMembers && <label><span>Workspace account (optional)</span><select value={form.linkedMembershipId ?? ""} onChange={(e) => onChange({ ...form, linkedMembershipId: e.target.value || null })}><option value="">HR record only — no login link</option>{members.map((member) => <option key={member.id} value={member.id}>{member.user.firstName} {member.user.lastName} ({member.user.email})</option>)}</select></label>}
    <footer>{editing && canManage && <button onClick={onArchive}>{editing.deletedAt ? "Restore" : "Archive"}</button>}<button onClick={onClose}>Cancel</button><button disabled={!form.employeeNumber || !form.firstName || form.jobTitle.length < 2 || !form.startDate} onClick={onSave}>Save employee</button></footer>
  </div></div>;
}
