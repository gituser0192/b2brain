"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import { ProjectTeam } from "./project-team";

type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELED";
type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELED";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface Project {
  id: string; name: string; code: string; description: string | null;
  status: ProjectStatus; priority: Priority; startDate: string | null;
  dueDate: string | null; deletedAt: string | null;
  customer: { id: string; displayName: string } | null;
  _count: { tasks: number };
}
interface Task {
  id: string; title: string; description: string | null; status: TaskStatus;
  priority: Priority; dueDate: string | null;
}
interface ProjectsResponse { success: true; data: Project[] }
interface TasksResponse { success: true; data: Task[] }
interface CustomersResponse {
  success: true; data: { customers: { id: string; displayName: string }[] };
}

const emptyProject = {
  name: "", code: "", description: "", customerId: null as string | null,
  status: "PLANNING" as ProjectStatus, priority: "MEDIUM" as Priority,
  startDate: "", dueDate: "",
};
const emptyTask = {
  title: "", description: "", status: "TODO" as TaskStatus,
  priority: "MEDIUM" as Priority, dueDate: "",
};
const apiDate = (value: string) =>
  value ? new Date(`${value}T00:00:00`).toISOString() : null;

export function ProjectWorkspace() {
  const { session, authorizedRequest } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<{ id: string; displayName: string }[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState(emptyProject);
  const [task, setTask] = useState(emptyTask);
  const [editing, setEditing] = useState<Project | null>(null);
  const [open, setOpen] = useState(false);
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState("");
  const canCreate = session?.membership.permissions.includes("PROJECT_CREATE") ?? false;
  const canUpdate = session?.membership.permissions.includes("PROJECT_UPDATE") ?? false;
  const canArchive = session?.membership.permissions.includes("PROJECT_ARCHIVE") ?? false;
  const canTasks = session?.membership.permissions.includes("TASK_MANAGE") ?? false;
  const canReadCrm = session?.membership.permissions.includes("CRM_VIEW") ?? false;

  const load = useCallback(async () => {
    try {
      const response = await authorizedRequest<ProjectsResponse>(`/projects?archived=${archived}`);
      setProjects(response.data);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Unable to load projects.");
    }
  }, [authorizedRequest, archived]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
      if (canReadCrm) {
        void authorizedRequest<CustomersResponse>("/customers?pageSize=100&archived=false")
          .then((response) => setCustomers(response.data.customers))
          .catch(() => setCustomers([]));
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [load, authorizedRequest, canReadCrm]);

  async function loadTasks(project: Project) {
    setSelected(project);
    const response = await authorizedRequest<TasksResponse>(`/projects/${project.id}/tasks`);
    setTasks(response.data);
  }
  function show(project?: Project) {
    setEditing(project ?? null);
    setForm(project ? {
      name: project.name, code: project.code, description: project.description ?? "",
      customerId: project.customer?.id ?? null, status: project.status,
      priority: project.priority, startDate: project.startDate?.slice(0, 10) ?? "",
      dueDate: project.dueDate?.slice(0, 10) ?? "",
    } : emptyProject);
    setOpen(true);
  }
  async function save() {
    try {
      await authorizedRequest(editing ? `/projects/${editing.id}` : "/projects", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({ ...form, startDate: apiDate(form.startDate), dueDate: apiDate(form.dueDate) }),
      });
      setOpen(false);
      await load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Unable to save project.");
    }
  }
  async function archive(project: Project) {
    await authorizedRequest(project.deletedAt ? `/projects/${project.id}/restore` : `/projects/${project.id}`, {
      method: project.deletedAt ? "POST" : "DELETE",
    });
    setSelected(null);
    await load();
  }
  async function addTask() {
    if (!selected) return;
    await authorizedRequest(`/projects/${selected.id}/tasks`, {
      method: "POST", body: JSON.stringify({ ...task, dueDate: apiDate(task.dueDate) }),
    });
    setTask(emptyTask);
    await loadTasks(selected);
    await load();
  }
  async function taskStatus(current: Task, status: TaskStatus) {
    if (!selected) return;
    await authorizedRequest(`/projects/${selected.id}/tasks/${current.id}`, {
      method: "PUT",
      body: JSON.stringify({
        title: current.title, description: current.description, status,
        priority: current.priority, dueDate: current.dueDate,
      }),
    });
    await loadTasks(selected);
  }

  return (
    <div className="project-workspace">
      <header className="project-heading">
        <div><p>Operations service</p><h2>Projects & tasks</h2><span>Plan delivery and connect work to real business outcomes.</span></div>
        {canCreate && !archived && <button onClick={() => show()}>+ New project</button>}
      </header>
      {error && <div className="dashboard-notice error">{error}</div>}
      <div className="project-toolbar">
        <button className={archived ? "active" : ""} onClick={() => { setArchived((value) => !value); setSelected(null); }}>
          {archived ? "Current projects" : "Archived projects"}
        </button>
        <span>{projects.length} projects</span>
      </div>
      {projects.length === 0 ? (
        <section className="project-empty">
          <span>◇</span><h3>{archived ? "No archived projects" : "No projects yet"}</h3>
          <p>This organization begins with zero project and task data.</p>
          {canCreate && !archived && <button onClick={() => show()}>Create first project</button>}
        </section>
      ) : (
        <div className="project-layout">
          <section className="project-cards">
            {projects.map((project) => (
              <article key={project.id} className={selected?.id === project.id ? "selected" : ""} onClick={() => void loadTasks(project)}>
                <div><span className={`project-priority ${project.priority.toLowerCase()}`}>{project.priority}</span><small>{project.code}</small></div>
                <h3>{project.name}</h3><p>{project.description || "No description"}</p>
                <footer><span>{project.status.replace("_", " ")}</span><span>{project._count.tasks} tasks</span><span>{project.dueDate ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(project.dueDate)) : "No deadline"}</span></footer>
              </article>
            ))}
          </section>
          {selected && (
            <aside className="task-panel">
              <header><div><small>{selected.code}</small><h3>{selected.name}</h3></div><div>{canUpdate && <button onClick={() => show(selected)}>Edit</button>}{canArchive && <button onClick={() => void archive(selected)}>{selected.deletedAt ? "Restore" : "Archive"}</button>}</div></header>
              {canTasks && !selected.deletedAt && (
                <div className="task-create">
                  <input value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })} placeholder="Add a task" />
                  <select value={task.priority} onChange={(event) => setTask({ ...task, priority: event.target.value as Priority })}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select>
                  <input type="date" value={task.dueDate} onChange={(event) => setTask({ ...task, dueDate: event.target.value })} />
                  <button disabled={!task.title.trim()} onClick={() => void addTask()}>Add</button>
                </div>
              )}
              <div className="task-list">
                {tasks.length === 0 ? <p>No tasks in this project.</p> : tasks.map((current) => (
                  <article key={current.id}><span className={`task-dot ${current.status.toLowerCase()}`} /><div><strong>{current.title}</strong><small>{current.priority} · {current.dueDate ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(current.dueDate)) : "No deadline"}</small></div>{canTasks && <select value={current.status} onChange={(event) => void taskStatus(current, event.target.value as TaskStatus)}><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="BLOCKED">Blocked</option><option value="COMPLETED">Completed</option><option value="CANCELED">Canceled</option></select>}</article>
                ))}
              </div>
            </aside>
          )}
        </div>
      )}
      {selected && <ProjectTeam projectId={selected.id} />}
      {open && (
        <div className="agent-modal"><div className="agent-dialog">
          <header><div><p>Project record</p><h3>{editing ? "Update project" : "Create project"}</h3></div><button onClick={() => setOpen(false)}>×</button></header>
          <label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label><span>Project code</span><input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="PRJ-001" /></label>
          {canReadCrm && <label><span>Customer (optional)</span><select value={form.customerId ?? ""} onChange={(event) => setForm({ ...form, customerId: event.target.value || null })}><option value="">Internal project / no customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName}</option>)}</select></label>}
          <label><span>Description</span><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <div className="agent-form-grid">
            <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProjectStatus })}><option value="PLANNING">Planning</option><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="COMPLETED">Completed</option><option value="CANCELED">Canceled</option></select></label>
            <label><span>Priority</span><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></label>
            <label><span>Start</span><input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
            <label><span>Due</span><input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label>
          </div>
          <footer><button onClick={() => setOpen(false)}>Cancel</button><button disabled={form.name.trim().length < 2 || form.code.trim().length < 2} onClick={() => void save()}>Save project</button></footer>
        </div></div>
      )}
    </div>
  );
}
