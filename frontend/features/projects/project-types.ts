export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELED";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Project {
  id: string; name: string; code: string; description: string | null;
  status: ProjectStatus; priority: Priority; startDate: string | null;
  dueDate: string | null; deletedAt: string | null;
  customer: { id: string; displayName: string } | null;
  _count: { tasks: number };
}
export interface ProjectTask {
  id: string; title: string; description: string | null; status: TaskStatus;
  priority: Priority; dueDate: string | null;
}
export interface ProjectForm {
  name: string; code: string; description: string; customerId: string | null;
  status: ProjectStatus; priority: Priority; startDate: string; dueDate: string;
}
export interface TaskForm {
  title: string; description: string; status: TaskStatus;
  priority: Priority; dueDate: string;
}
