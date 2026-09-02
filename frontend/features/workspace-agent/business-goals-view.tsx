import type { BusinessGoal, GoalDraft } from "./workspace-agent-types";

const goalTypes = ["MONTHLY_REVENUE", "NEW_LEADS", "CUSTOMER_CONVERSION", "EXPENSE_LIMIT", "PROJECT_COMPLETION", "FOLLOW_UP_RESPONSE"];

export function BusinessGoalsView({ goals, goal, open, loading, onToggle, onGoal, onCreate }: {
  goals: BusinessGoal[]; goal: GoalDraft; open: boolean; loading: boolean;
  onToggle: () => void; onGoal: (goal: GoalDraft) => void; onCreate: () => void;
}) {
  return <section className="agent-management-view">
    <header><div><p>Measurable goals</p><h3>Goals and progress</h3><span>Progress is calculated from real organization records.</span></div><button onClick={onToggle}>+ New goal</button></header>
    {open && <div className="agent-goal-form">
      <label><span>Goal type</span><select value={goal.type} onChange={(event) => onGoal({ ...goal, type: event.target.value })}>{goalTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label><span>Title</span><input value={goal.title} onChange={(event) => onGoal({ ...goal, title: event.target.value })} /></label>
      <label><span>Target</span><input type="number" min="0.01" value={goal.targetValue} onChange={(event) => onGoal({ ...goal, targetValue: Number(event.target.value) })} /></label>
      <label><span>Starts</span><input type="date" value={goal.periodStart} onChange={(event) => onGoal({ ...goal, periodStart: event.target.value })} /></label>
      <label><span>Ends</span><input type="date" value={goal.periodEnd} onChange={(event) => onGoal({ ...goal, periodEnd: event.target.value })} /></label>
      <button disabled={loading || goal.targetValue <= 0} onClick={onCreate}>Create goal</button>
    </div>}
    <div className="agent-goal-list">{goals.length ? goals.map((item) => <article key={item.id}>
      <header><div><small>{item.type.replaceAll("_", " ")}</small><strong>{item.title}</strong></div><span className={item.risk === "HIGH" ? "risk" : "track"}>{item.risk.replaceAll("_", " ")}</span></header>
      <div className="goal-progress"><i style={{ width: `${Math.min(100, item.progress ?? 0)}%` }} /></div>
      <footer><span>{item.currentValue === null ? "Restricted" : item.currentValue.toLocaleString("en-IN")} / {item.targetValue.toLocaleString("en-IN")}</span><span>{item.progress === null ? "—" : `${Math.round(item.progress)}%`} · ends {new Date(item.periodEnd).toLocaleDateString("en-IN")}</span></footer>
    </article>) : <p className="agent-empty-copy">No goals have been created. Add the first measurable business goal.</p>}</div>
  </section>;
}
