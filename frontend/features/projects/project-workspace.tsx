"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError } from "@/services/api-client";
import { ProjectDialog } from "./project-dialog";
import { ProjectList } from "./project-list";
import { ProjectTaskPanel } from "./project-task-panel";
import { ProjectTeam } from "./project-team";
import type { Project, ProjectForm, ProjectTask, TaskForm, TaskStatus } from "./project-types";
interface ProjectsResponse { success: true; data: Project[] }
interface TasksResponse { success: true; data: ProjectTask[] }
interface CustomersResponse {
  success: true; data: { customers: { id: string; displayName: string }[] };
}

const emptyProject: ProjectForm = {
  name: "", code: "", description: "", customerId: null,
  status: "PLANNING", priority: "MEDIUM",
  startDate: "", dueDate: "",
};
const emptyTask: TaskForm = {
  title: "", description: "", status: "TODO",
  priority: "MEDIUM", dueDate: "",
};
const apiDate = (value: string) =>
  value ? new Date(`${value}T00:00:00`).toISOString() : null;

export function ProjectWorkspace({ selectedProjectId = null }: Readonly<{ selectedProjectId?: string | null }>) {
  const { session, authorizedRequest } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<{ id: string; displayName: string }[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
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
      if (selectedProjectId) {
        const project = response.data.find((item) => item.id === selectedProjectId);
        if (project) {
          setSelected(project);
          const taskResponse = await authorizedRequest<TasksResponse>(`/projects/${project.id}/tasks`);
          setTasks(taskResponse.data);
        }
      }
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Unable to load projects.");
    }
  }, [authorizedRequest, archived, selectedProjectId]);

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
  function openProject(project: Project) { router.push(`/projects/${project.id}`); }
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
  async function taskStatus(current: ProjectTask, status: TaskStatus) {
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
      {!projects.length ? <ProjectList projects={projects} archived={archived} canCreate={canCreate} onSelect={openProject} onCreate={() => show()} /> : (
        <div className="project-layout">
          <ProjectList projects={projects} selectedId={selected?.id} archived={archived} canCreate={canCreate} onSelect={openProject} onCreate={() => show()} />
          {selected && <ProjectTaskPanel project={selected} tasks={tasks} form={task} canUpdate={canUpdate} canArchive={canArchive} canTasks={canTasks} onFormChange={setTask} onAdd={() => void addTask()} onStatus={(current, status) => void taskStatus(current, status)} onEdit={() => show(selected)} onArchive={() => void archive(selected)} />}
        </div>
      )}
      {selected && <ProjectTeam projectId={selected.id} />}
      {open && <ProjectDialog editing={editing} form={form} customers={customers} canReadCrm={canReadCrm} onChange={setForm} onClose={() => setOpen(false)} onSave={() => void save()} />}
    </div>
  );
}
