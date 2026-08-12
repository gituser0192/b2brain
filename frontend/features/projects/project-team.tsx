"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";

interface Employee { id: string; employeeNumber: string; firstName: string; lastName: string | null; jobTitle: string; department: string | null; status: string; linkedUser: { id: string } | null; }
interface Employees { success: true; data: Employee[]; }
interface Assignment { id: string; role: "MANAGER" | "CONTRIBUTOR" | "VIEWER"; roleLabel: string | null; employee: Employee | null; }
interface Assignments { success: true; data: Assignment[]; }

export function ProjectTeam({ projectId }: Readonly<{ projectId: string }>) {
  const { session, authorizedRequest } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assigned, setAssigned] = useState<Assignment[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState<Assignment["role"]>("CONTRIBUTOR");
  const [roleLabel, setRoleLabel] = useState("");
  const [peopleUnavailable, setPeopleUnavailable] = useState(false);
  const [error, setError] = useState("");
  const canManage = session?.membership.permissions.includes("PROJECT_UPDATE") ?? false;
  const canEmployees = session?.membership.permissions.includes("EMPLOYEE_VIEW") ?? false;

  const load = useCallback(async () => {
    try {
      const response = await authorizedRequest<Assignments>(`/projects/${projectId}/members`);
      setAssigned(response.data);
      setError("");
      if (canEmployees && !peopleUnavailable) {
        try {
          const employeeResponse = await authorizedRequest<Employees>("/employees?archived=false");
          setEmployees(employeeResponse.data.filter((employee) => employee.status !== "EXITED"));
        } catch (reason) {
          if (reason instanceof ApiError && reason.code === "SERVICE_NOT_ENABLED") {
            setPeopleUnavailable(true);
            setEmployees([]);
          } else throw reason;
        }
      }
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Unable to load the project team.");
    }
  }, [authorizedRequest, projectId, canEmployees, peopleUnavailable]);

  useEffect(() => { const task = setTimeout(() => void load(), 0); return () => clearTimeout(task); }, [load]);

  async function add() {
    if (!employeeId || roleLabel.trim().length < 2) return;
    try {
      await authorizedRequest(`/projects/${projectId}/members`, { method: "POST", body: JSON.stringify({ employeeId, role, roleLabel }) });
      setEmployeeId(""); setRoleLabel(""); await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to assign the employee."); }
  }
  async function remove(id: string) {
    try { await authorizedRequest(`/projects/${projectId}/members/${id}`, { method: "DELETE" }); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to remove the team member."); }
  }

  return <section className="project-team">
    <div className="engagement-subtitle"><strong>Project team</strong><span>{assigned.length} employees</span></div>
    {error && <div className="dashboard-notice error">{error}</div>}
    {canManage && canEmployees && peopleUnavailable && <div className="project-team-service-note"><strong>Team assignment unavailable</strong><span>Enable the People service for this organization to select and assign employees. Existing project work remains available.</span></div>}
    {canManage && canEmployees && !peopleUnavailable && <div className="project-team-add"><select value={employeeId} onChange={(event) => { const id = event.target.value; setEmployeeId(id); const employee = employees.find((item) => item.id === id); if (employee && !roleLabel) setRoleLabel(employee.jobTitle); }}><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} — {employee.jobTitle}</option>)}</select><input value={roleLabel} onChange={(event) => setRoleLabel(event.target.value)} placeholder="Custom project role"/><select value={role} onChange={(event) => setRole(event.target.value as Assignment["role"])}><option value="MANAGER">Manager access</option><option value="CONTRIBUTOR">Contributor access</option><option value="VIEWER">Viewer access</option></select><button disabled={!employeeId || roleLabel.trim().length < 2} onClick={() => void add()}>Assign</button></div>}
    <div className="project-team-list">{assigned.length === 0 ? <p>No employees assigned to this project.</p> : assigned.map((assignment) => { const employee = assignment.employee; return <article key={assignment.id}><span>{employee?.firstName[0] ?? "?"}</span><div><strong>{employee ? `${employee.firstName} ${employee.lastName ?? ""}` : "Legacy team member"}</strong><small>{assignment.roleLabel ?? assignment.role}{employee && !employee.linkedUser ? " · No login account" : ""}</small></div>{canManage && <button onClick={() => void remove(assignment.id)}>Remove</button>}</article>; })}</div>
  </section>;
}
