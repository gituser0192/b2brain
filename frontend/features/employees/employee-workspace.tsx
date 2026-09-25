"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import { EmployeeDialog } from "./employee-dialog";
import { EmployeeList } from "./employee-list";
import type { Employee, EmployeeForm, Member } from "./employee-types";

interface EmployeesResponse { success: true; data: Employee[] }
interface MembersResponse { success: true; data: { members: Member[] } }
type Section = "all" | "active" | "archived";

const blank: EmployeeForm = { employeeNumber: "", firstName: "", lastName: "", workEmail: "", workPhone: "", jobTitle: "", department: "", employmentType: "FULL_TIME", status: "ACTIVE", startDate: "", endDate: "", linkedMembershipId: null, managerEmployeeId: null };
const apiDate = (value: string) => value ? new Date(`${value}T00:00:00`).toISOString() : null;

export function EmployeeWorkspace() {
  const { session, authorizedRequest } = useAuth();
  const [current, setCurrent] = useState<Employee[]>([]);
  const [archivedEmployees, setArchivedEmployees] = useState<Employee[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const opener = useRef<HTMLElement | null>(null);
  const canManage = session?.membership.permissions.includes("EMPLOYEE_MANAGE") ?? false;
  const canMembers = session?.membership.permissions.includes("MEMBERSHIP_VIEW") ?? false;

  const load = useCallback(async () => {
    setLoading(true);
    const [activeResult, archivedResult, memberResult] = await Promise.allSettled([
      authorizedRequest<EmployeesResponse>("/employees?archived=false"),
      authorizedRequest<EmployeesResponse>("/employees?archived=true"),
      canMembers ? authorizedRequest<MembersResponse>("/memberships") : Promise.resolve(null),
    ]);
    if (activeResult.status === "rejected" || archivedResult.status === "rejected") {
      const reason = activeResult.status === "rejected" ? activeResult.reason : archivedResult.status === "rejected" ? archivedResult.reason : null;
      setError(reason instanceof ApiError ? reason.message : "Unable to load employees.");
    } else {
      setCurrent(activeResult.value.data);
      setArchivedEmployees(archivedResult.value.data);
      setError("");
    }
    if (memberResult.status === "fulfilled" && memberResult.value) setMembers(memberResult.value.data.members.filter((member) => member.status === "ACTIVE"));
    setLoading(false);
  }, [authorizedRequest, canMembers]);

  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);

  const close = useCallback(() => { setOpen(false); setError(""); queueMicrotask(() => opener.current?.focus()); }, []);
  function show(employee?: Employee, source?: HTMLElement) {
    opener.current = source ?? document.activeElement as HTMLElement;
    setEditing(employee ?? null);
    setForm(employee ? { employeeNumber: employee.employeeNumber, firstName: employee.firstName, lastName: employee.lastName ?? "", workEmail: employee.workEmail ?? "", workPhone: employee.workPhone ?? "", jobTitle: employee.jobTitle, department: employee.department ?? "", employmentType: employee.employmentType, status: employee.status, startDate: employee.startDate.slice(0, 10), endDate: employee.endDate?.slice(0, 10) ?? "", linkedMembershipId: members.find((member) => member.user.email === employee.linkedUser?.email)?.id ?? null, managerEmployeeId: employee.manager?.id ?? null } : blank);
    setOpen(true); setError("");
  }
  async function save() {
    if (saving || !canManage) return;
    setSaving(true);
    try {
      await authorizedRequest(editing ? `/employees/${editing.id}` : "/employees", { method: editing ? "PUT" : "POST", body: JSON.stringify({ ...form, startDate: apiDate(form.startDate), endDate: apiDate(form.endDate) }) });
      close(); await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to save employee."); }
    finally { setSaving(false); }
  }
  async function archive(employee: Employee) {
    if (!canManage || !window.confirm(employee.deletedAt ? "Restore this employee record?" : "Archive this employee record?")) return;
    try {
      await authorizedRequest(employee.deletedAt ? `/employees/${employee.id}/restore` : `/employees/${employee.id}`, { method: employee.deletedAt ? "POST" : "DELETE" });
      close(); await load();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to update employee status."); }
  }

  const source = section === "archived" ? archivedEmployees : section === "active" ? current.filter((employee) => employee.status === "ACTIVE") : current;
  const employees = useMemo(() => { const term = search.trim().toLowerCase(); return term ? source.filter((employee) => [employee.firstName, employee.lastName, employee.employeeNumber, employee.jobTitle, employee.department, employee.workEmail, employee.workPhone].some((value) => value?.toLowerCase().includes(term))) : source; }, [search, source]);
  const departments = new Set(current.map((employee) => employee.department).filter(Boolean)).size;
  const pageError = Boolean(error && !open);
  const isEmpty = !loading && !current.length && !archivedEmployees.length;

  return <div className="people-workspace"><header className="people-heading"><div><div className="people-kicker">People service <span>Beta</span></div><h2>Employee records</h2><p>Keep operational employee information organized. Login accounts, invitations and permissions remain in <Link href="/settings?section=team">Team and Access</Link>.</p></div>{canManage && !isEmpty && <button onClick={(event) => show(undefined, event.currentTarget)}>+ Add employee</button>}</header>
    {!canManage && <div className="people-readonly" role="status"><strong>Read-only access</strong><span>You can inspect employee records, but only an employee manager can make changes.</span></div>}
    {pageError ? <div className="dashboard-notice error" role="alert">{error}</div> : isEmpty ? <section className="people-first-run"><div className="people-first-run-art" aria-hidden="true"><span /><span /><span /></div><div className="people-first-run-copy"><span className="people-first-run-label">Your team starts here</span><h3>No employees yet</h3><p>Add your first employee to keep their role, contact details and work information in one place.</p>{canManage && <button onClick={(event) => show(undefined, event.currentTarget)}>+ Add first employee</button>}<small>Need to give someone login access? Use <Link href="/settings?section=team">Team and Access</Link> instead.</small></div></section> : <><section className="people-metrics" aria-label="Employee summary"><article><span>Total employees</span><strong>{current.length}</strong></article><article><span>Active employees</span><strong>{current.filter((employee) => employee.status === "ACTIVE").length}</strong></article><article><span>Archived employees</span><strong>{archivedEmployees.length}</strong></article><article><span>Departments</span><strong>{departments}</strong></article></section>
    <div className="people-toolbar"><div role="tablist" aria-label="Employee record sections">{(["all", "active", "archived"] as const).map((item) => <button role="tab" aria-selected={section === item} className={section === item ? "active" : ""} key={item} onClick={() => setSection(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div><label><span className="sr-only">Search employees</span><input type="search" placeholder="Search employees" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
    {loading ? <section className="people-state"><span className="spinner dark" /> Loading employee records…</section> : <EmployeeList employees={employees} archived={section === "archived"} canManage={canManage} onSelect={(employee) => show(employee)} onCreate={() => show()} />}</>}
    {open && <EmployeeDialog editing={editing} form={form} employees={current} members={members} canManage={canManage} canMembers={canMembers} saving={saving} error={error} onChange={setForm} onClose={close} onSave={() => void save()} onArchive={() => editing && void archive(editing)} />}
  </div>;
}
