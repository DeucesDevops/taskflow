import type { Notification, Project } from "@/lib/types";
import { Icon } from "./icon";

function describe(item: Notification) {
  if (item.type === "task.created") return { action: "Created a task", title: item.message.replace(/^Created task: /, "") };
  const match = /^Moved task to (todo|in_progress|done): (.*)$/.exec(item.message);
  const labels: Record<string, string> = { todo: "To do", in_progress: "In progress", done: "Done" };
  return match ? { action: `Moved to ${labels[match[1]]}`, title: match[2] } : { action: "Updated a task", title: item.message };
}

export function ActivityPanel({ items, projects, error, onClose }: { items: Notification[]; projects: Project[]; error: string; onClose: () => void }) {
  return <aside className="activity-panel" id="activity-panel" aria-labelledby="activity-title">
    <div className="activity-heading"><h2 id="activity-title"><Icon name="activity" size={18} />Activity</h2><button className="icon-button" aria-label="Close activity" onClick={onClose}><Icon name="close" size={18} /></button></div>
    <p className="activity-subtitle">The latest across your workspace.</p>
    {error ? <p className="form-error" role="alert">{error}</p> : items.length === 0 ? <div className="activity-empty"><Icon name="activity" size={28} /><h3>Your story starts here</h3><p>Project updates appear here as you create and complete tasks.</p></div> : <ol className="activity-list">{items.map(item => {
      const { action, title } = describe(item);
      return <li key={item.id}>
        <span className="event-mark"><Icon name={item.type === "task.created" ? "plus" : "check"} size={14} /></span>
        <div><span className="activity-action">{action}</span><p>{title}</p><span className="activity-project">{projects.find(project => project.id === item.projectId)?.name || "Project"}</span><time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>{new Date(item.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div>
      </li>;
    })}</ol>}
  </aside>;
}
