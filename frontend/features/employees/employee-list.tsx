import type { Employee } from "./employee-types";

const name = (employee: Employee) => `${employee.firstName} ${employee.lastName ?? ""}`.trim();

export function EmployeeList({ employees, archived, canManage, onSelect, onCreate }: {
  employees: Employee[]; archived: boolean; canManage: boolean;
  onSelect: (employee: Employee) => void; onCreate: () => void;
}) {
  if (!employees.length) return <section className="people-empty">
    <span aria-hidden="true">◇</span><h3>{archived ? "No archived employees" : "No employees found"}</h3>
    <p>{archived ? "Archived employee records will appear here." : "Try another search, or create the first employee record."}</p>
    {canManage && !archived && <button onClick={onCreate}>Add employee</button>}
  </section>;
  return <><div className="people-table-wrap"><table className="people-table"><thead><tr><th>Employee</th><th>Role</th><th>Contact</th><th>Status</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id}>
    <td><strong>{name(employee)}</strong><small>{employee.employeeNumber}</small></td><td>{employee.jobTitle}<small>{employee.department || "No department"}</small></td><td>{employee.workEmail || employee.workPhone || "Not provided"}</td><td><span className={`employee-status ${employee.status.toLowerCase()}`}>{employee.status.replaceAll("_", " ")}</span></td><td>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(employee.updatedAt ?? employee.startDate))}</td><td><button onClick={() => onSelect(employee)}>{canManage ? "View or edit" : "View"}</button></td>
  </tr>)}</tbody></table></div><section className="people-cards">{employees.map((employee) => <article key={employee.id}><header><div className="employee-avatar">{employee.firstName[0]}{employee.lastName?.[0]}</div><div><strong>{name(employee)}</strong><small>{employee.employeeNumber}</small></div><span className={`employee-status ${employee.status.toLowerCase()}`}>{employee.status.replaceAll("_", " ")}</span></header><dl><div><dt>Role</dt><dd>{employee.jobTitle}</dd></div><div><dt>Department</dt><dd>{employee.department || "Not set"}</dd></div><div><dt>Contact</dt><dd>{employee.workEmail || employee.workPhone || "Not provided"}</dd></div></dl><button onClick={() => onSelect(employee)}>{canManage ? "View or edit" : "View employee"}</button></article>)}</section></>;
}
