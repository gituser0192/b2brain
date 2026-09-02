export type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "SUSPENDED" | "EXITED";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACTOR" | "INTERN" | "CONSULTANT";

export interface Employee {
  id: string; employeeNumber: string; firstName: string; lastName: string | null;
  workEmail: string | null; workPhone: string | null; jobTitle: string;
  department: string | null; employmentType: EmploymentType; status: EmployeeStatus;
  startDate: string; endDate: string | null; deletedAt: string | null;
  linkedUser: { id: string; email: string } | null;
  manager: { id: string; firstName: string; lastName: string | null } | null;
}
export interface Member {
  id: string; status: string;
  user: { firstName: string; lastName: string | null; email: string };
}
export interface EmployeeForm {
  employeeNumber: string; firstName: string; lastName: string; workEmail: string;
  workPhone: string; jobTitle: string; department: string;
  employmentType: EmploymentType; status: EmployeeStatus; startDate: string;
  endDate: string; linkedMembershipId: string | null; managerEmployeeId: string | null;
}
