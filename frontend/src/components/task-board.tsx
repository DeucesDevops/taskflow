import type { Task, TaskStatus } from "@/lib/types";
import { taskStatuses } from "@/lib/types";
import { Icon } from "./icon";

export function TaskBoard({ tasks, searching, pending, onStatusChange }: {
  tasks: Task[];
  searching: boolean;
  pending: boolean;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}) {
  return <div className="task-board" aria-label="Task board">
    {taskStatuses.map(status => {
      const column = tasks.filter(task => task.status === status.value);
      return <section className={`task-column column-${status.value}`} key={status.value} aria-labelledby={`status-${status.value}`}>
        <div className="column-heading">
          <h3 id={`status-${status.value}`}><span className={`status-dot status-${status.value}`} />{status.label}<span className="column-count">{column.length}</span></h3>
          <Icon name={status.value === "done" ? "check" : status.value === "in_progress" ? "activity" : "board"} size={16} />
        </div>
        <div className="task-list">
          {column.length === 0 ? <div className="empty-column">
            <span className="empty-column-icon"><Icon name={status.value === "done" ? "check" : status.value === "in_progress" ? "activity" : "plus"} size={22} /></span>
            <p>{searching ? "No matching tasks" : status.value === "todo" ? "A fresh start" : status.value === "in_progress" ? "Ready when you are" : "Good things take a little work"}</p>
            <span>{searching ? "Try a different search." : status.value === "todo" ? "Add your next task above." : status.value === "in_progress" ? "Move a task here to get going." : "Completed tasks will land here."}</span>
          </div> : column.map(task => <article className="task-card" key={task.id}>
            <div className="task-card-heading"><span className="task-short-id">TF–{task.id.slice(0, 6).toUpperCase()}</span><span className={`task-state-icon ${task.status === "done" ? "is-complete" : ""}`}><Icon name={task.status === "done" ? "check" : "board"} size={15} /></span></div>
            <h4>{task.title}</h4>
            <div className="task-card-footer">
              <span className="task-date" title={`Created ${new Date(task.createdAt).toLocaleString()}`}><Icon name="clock" size={13} />{new Date(task.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              <select aria-label={`Status of ${task.title}`} value={task.status} disabled={pending} onChange={event => onStatusChange(task, event.target.value as TaskStatus)}>
                {taskStatuses.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
            </div>
          </article>)}
        </div>
      </section>;
    })}
  </div>;
}
