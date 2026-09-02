import type { Priority, Project, ProjectTask, TaskForm, TaskStatus } from "./project-types";

export function ProjectTaskPanel({ project, tasks, form, canUpdate, canArchive, canTasks, onFormChange, onAdd, onStatus, onEdit, onArchive }: {
  project: Project; tasks: ProjectTask[]; form: TaskForm; canUpdate: boolean;
  canArchive: boolean; canTasks: boolean; onFormChange: (form: TaskForm) => void;
  onAdd: () => void; onStatus: (task: ProjectTask, status: TaskStatus) => void;
  onEdit: () => void; onArchive: () => void;
}) {
  return <aside className="task-panel">
    <header><div><small>{project.code}</small><h3>{project.name}</h3></div><div>{canUpdate && <button onClick={onEdit}>Edit</button>}{canArchive && <button onClick={onArchive}>{project.deletedAt ? "Restore" : "Archive"}</button>}</div></header>
    {canTasks && !project.deletedAt && <div className="task-create">
      <input value={form.title} onChange={(event) => onFormChange({ ...form, title: event.target.value })} placeholder="Add a task" />
      <select value={form.priority} onChange={(event) => onFormChange({ ...form, priority: event.target.value as Priority })}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select>
      <input type="date" value={form.dueDate} onChange={(event) => onFormChange({ ...form, dueDate: event.target.value })} />
      <button disabled={!form.title.trim()} onClick={onAdd}>Add</button>
    </div>}
    <div className="task-list">{!tasks.length ? <p>No tasks in this project.</p> : tasks.map((task) =>
      <article key={task.id}><span className={`task-dot ${task.status.toLowerCase()}`} /><div><strong>{task.title}</strong><small>{task.priority} · {task.dueDate ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(task.dueDate)) : "No deadline"}</small></div>{canTasks && <select value={task.status} onChange={(event) => onStatus(task, event.target.value as TaskStatus)}><option value="TODO">To do</option><option value="IN_PROGRESS">In progress</option><option value="BLOCKED">Blocked</option><option value="COMPLETED">Completed</option><option value="CANCELED">Canceled</option></select>}</article>)}</div>
  </aside>;
}
