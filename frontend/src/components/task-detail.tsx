import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import { taskStatuses, type Comment, type Member, type Page, type Task, type TaskStatus, type User } from "@/lib/types";
import { Icon } from "./icon";

export function TaskDetail({ task, user, onClose, onChange, onDelete }: {
  task: Task; user: User; onClose: () => void; onChange: (task: Task) => void; onDelete: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [assignee, setAssignee] = useState(task.assigneeId || "");
  const [members, setMembers] = useState<Member[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    Promise.all([
      api<{items: Member[]}>(`/projects/${task.projectId}/members`, { signal: controller.signal }),
      api<Page<Comment>>(`/tasks/${task.id}/comments`, { signal: controller.signal }),
    ]).then(([team, page]) => { setMembers(team.items); setComments(page.items); setHasMore(page.hasMore); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [task.id, task.projectId]);
  async function run(action: () => Promise<void>) {
    setPending(true); setError(""); setNotice("");
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : "Unable to save changes."); }
    finally { setPending(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const updated = await api<Task>(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ title: title.trim(), description: description.trim(), status, ...(assignee !== (task.assigneeId || "") ? { assigneeId: assignee || null } : {}) }) });
      onChange(updated); setNotice("Task saved.");
    });
  }
  async function comment(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await api<Comment>(`/tasks/${task.id}/comments`, { method: "POST", body: JSON.stringify({ body: body.trim() }) });
      const page = await api<Page<Comment>>(`/tasks/${task.id}/comments`);
      setComments(page.items); setHasMore(page.hasMore); setBody(""); setNotice("Comment added.");
    });
  }
  return <dialog ref={dialog} className="project-dialog detail-dialog" aria-labelledby="task-detail-title" onCancel={event => { if (pending) event.preventDefault(); else onClose(); }}>
    <div className="dialog-heading"><h2 id="task-detail-title">Task details</h2><button className="icon-button" aria-label="Close task details" disabled={pending} onClick={onClose}><Icon name="close" /></button></div><p className="muted task-reference">TF–{task.id.slice(0, 6).toUpperCase()}</p>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="save-notice" role="status">{notice}</p>}
    <form onSubmit={save}>
      <label htmlFor="edit-task-title">Title</label><input id="edit-task-title" required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} disabled={pending} />
      <label htmlFor="task-description">Description</label><textarea id="task-description" rows={4} maxLength={10000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Add context for your team…" disabled={pending} />
      <div className="field-pair"><div><label htmlFor="task-status">Status</label><select id="task-status" value={status} onChange={event => setStatus(event.target.value as TaskStatus)} disabled={pending}>{taskStatuses.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div><label htmlFor="task-assignee">Assignee</label><select id="task-assignee" value={assignee} onChange={event => setAssignee(event.target.value)} disabled={pending || loading}><option value="">Unassigned</option>{assignee && !members.some(member => member.userId === assignee) && <option value={assignee}>{task.assigneeName || "Former member"} (no longer a member)</option>}{members.map(member => <option value={member.userId} key={member.userId}>{member.name}</option>)}</select></div></div>
      <div className="compact-actions"><button className="button primary" disabled={pending || loading || !title.trim()}>Save task</button></div>
    </form>
    <section className="dialog-section" aria-labelledby="comments-title"><h3 id="comments-title">Comments</h3>{loading ? <p role="status">Loading comments…</p> : !comments.length ? <p className="muted">Start the conversation.</p> : <ol className="comment-list">{comments.map(comment => <li key={comment.id}><div className="comment-meta"><strong>{comment.userId === user.id ? user.name : members.find(member => member.userId === comment.userId)?.name || "Former member"}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></div><p>{comment.body}</p></li>)}</ol>}
      {hasMore && <button className="button quiet" disabled={pending} onClick={() => run(async () => { const page = await api<Page<Comment>>(`/tasks/${task.id}/comments?offset=${comments.length}`); setComments(current => [...current, ...page.items]); setHasMore(page.hasMore); })}>Load more comments</button>}
      <form onSubmit={comment}><label htmlFor="comment-body">Add a comment</label><textarea id="comment-body" required maxLength={5000} rows={3} value={body} onChange={event => setBody(event.target.value)} disabled={pending || loading} placeholder="Share an update…" /><div className="compact-actions"><button className="button secondary" disabled={pending || loading || !body.trim()}>Post comment</button></div></form>
    </section>
    <div className="dialog-section compact-actions">{confirmDelete ? <><span className="muted">Delete this task and its comments?</span><button className="button secondary" disabled={pending} onClick={() => setConfirmDelete(false)}>Cancel</button><button className="button danger" disabled={pending} onClick={() => run(async () => { await api(`/tasks/${task.id}`, { method: "DELETE" }); onDelete(task.id); onClose(); })}>Confirm delete</button></> : <button className="button quiet danger" disabled={pending} onClick={() => setConfirmDelete(true)}>Delete task</button>}</div>
  </dialog>;
}
