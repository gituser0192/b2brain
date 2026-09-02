import type { Project } from "./project-types";

export function ProjectList({ projects, selectedId, archived, canCreate, onSelect, onCreate }: {
  projects: Project[]; selectedId?: string; archived: boolean; canCreate: boolean;
  onSelect: (project: Project) => void; onCreate: () => void;
}) {
  if (!projects.length) return <section className="project-empty">
    <span>◇</span><h3>{archived ? "No archived projects" : "No projects yet"}</h3>
    <p>This organization begins with zero project and task data.</p>
    {canCreate && !archived && <button onClick={onCreate}>Create first project</button>}
  </section>;
  return <section className="project-cards">{projects.map((project) =>
    <article key={project.id} className={selectedId === project.id ? "selected" : ""} onClick={() => onSelect(project)}>
      <div><span className={`project-priority ${project.priority.toLowerCase()}`}>{project.priority}</span><small>{project.code}</small></div>
      <h3>{project.name}</h3><p>{project.description || "No description"}</p>
      <footer><span>{project.status.replace("_", " ")}</span><span>{project._count.tasks} tasks</span><span>{project.dueDate ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(project.dueDate)) : "No deadline"}</span></footer>
    </article>)}</section>;
}
