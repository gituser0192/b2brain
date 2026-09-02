"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import { EmployeeDialog } from "./employee-dialog";
import { EmployeeList } from "./employee-list";
import type { Employee, EmployeeForm, Member } from "./employee-types";

interface EmployeesResponse { success: true; data: Employee[] }
interface MembersResponse { success: true; data: { members: Member[] } }

const blank: EmployeeForm = {
  employeeNumber: "", firstName: "", lastName: "", workEmail: "",
  workPhone: "", jobTitle: "", department: "", employmentType: "FULL_TIME",
  status: "ACTIVE", startDate: "", endDate: "", linkedMembershipId: null,
  managerEmployeeId: null,
};
const apiDate = (value: string) =>
  value ? new Date(`${value}T00:00:00`).toISOString() : null;

export function EmployeeWorkspace() {
  const { session, authorizedRequest } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState("");
  const canManage = session?.membership.permissions.includes("EMPLOYEE_MANAGE") ?? false;
  const canMembers = session?.membership.permissions.includes("MEMBERSHIP_VIEW") ?? false;

  const load = useCallback(async () => {
    try {
      const response = await authorizedRequest<EmployeesResponse>(`/employees?archived=${archived}`);
      setEmployees(response.data);
      if (canMembers) {
        const memberResponse = await authorizedRequest<MembersResponse>("/memberships");
        setMembers(memberResponse.data.members.filter((member) => member.status === "ACTIVE"));
      }
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Unable to load employees.");
    }
  }, [authorizedRequest, archived, canMembers]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  function show(employee?: Employee) {
    setEditing(employee ?? null);
    setForm(employee ? {
      employeeNumber: employee.employeeNumber, firstName: employee.firstName,
      lastName: employee.lastName ?? "", workEmail: employee.workEmail ?? "",
      workPhone: employee.workPhone ?? "", jobTitle: employee.jobTitle,
      department: employee.department ?? "", employmentType: employee.employmentType,
      status: employee.status, startDate: employee.startDate.slice(0, 10),
      endDate: employee.endDate?.slice(0, 10) ?? "",
      linkedMembershipId: members.find((member) => member.user.email === employee.linkedUser?.email)?.id ?? null,
      managerEmployeeId: employee.manager?.id ?? null,
    } : blank);
    setOpen(true);
    setError("");
  }

  async function save() {
    try {
      await authorizedRequest(editing ? `/employees/${editing.id}` : "/employees", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({ ...form, startDate: apiDate(form.startDate), endDate: apiDate(form.endDate) }),
      });
      setOpen(false);
      await load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Unable to save employee.");
    }
  }

  async function archive(employee: Employee) {
    await authorizedRequest(employee.deletedAt ? `/employees/${employee.id}/restore` : `/employees/${employee.id}`, {
      method: employee.deletedAt ? "POST" : "DELETE",
    });
    setOpen(false);
    await load();
  }

  return <div className="employee-workspace">
    <header className="project-heading"><div><p>People service</p><h2>Employees</h2><span>Company people records remain separate from workspace login access.</span></div>{canManage && !archived && <button onClick={() => show()}>+ Add employee</button>}</header>
    {error && <div className="dashboard-notice error">{error}</div>}
    <div className="project-toolbar"><button className={archived ? "active" : ""} onClick={() => setArchived((value) => !value)}>{archived ? "Current employees" : "Archived employees"}</button><span>{employees.length} employees</span></div>
    <EmployeeList employees={employees} archived={archived} canManage={canManage} onSelect={show} onCreate={() => show()} />
    {open && <EmployeeDialog editing={editing} form={form} employees={employees} members={members} canManage={canManage} canMembers={canMembers} onChange={setForm} onClose={() => setOpen(false)} onSave={() => void save()} onArchive={() => editing && void archive(editing)} />}
  </div>;
}
