import type { Employee } from "./employee-types";

export function EmployeeList({ employees, archived, canManage, onSelect, onCreate }: {
  employees: Employee[]; archived: boolean; canManage: boolean;
  onSelect: (employee: Employee) => void; onCreate: () => void;
}) {
  if (!employees.length) return <section className="project-empty">
    <span>◇</span><h3>{archived ? "No archived employees" : "No employees yet"}</h3>
    <p>A new organization starts with zero employee records.</p>
    {canManage && !archived && <button onClick={onCreate}>Add first employee</button>}
  </section>;
  return <section className="employee-grid">{employees.map((employee) =>
    <article key={employee.id} onClick={() => onSelect(employee)}>
      <div className="employee-avatar">{employee.firstName[0]}{employee.lastName?.[0]}</div>
      <div><span className={`employee-status ${employee.status.toLowerCase()}`}>{employee.status.replace("_", " ")}</span>
        <h3>{employee.firstName} {employee.lastName}</h3><p>{employee.jobTitle}</p>
        <small>{employee.department || "No department"} · {employee.employeeNumber}</small>
        <footer><span>{employee.linkedUser ? "Account linked" : "HR record only"}</span><span>{employee.employmentType.replace("_", " ")}</span></footer>
      </div>
    </article>)}</section>;
}
