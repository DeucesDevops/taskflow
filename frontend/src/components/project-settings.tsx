import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import type { Member, Project } from "@/lib/types";
import { Icon } from "./icon";

export function ProjectSettings({ project, onClose, onChange, onArchive }: {
  project: Project; onClose: () => void; onChange: (project: Project) => void; onArchive: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const owner = project.role === "owner";
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    api<{items: Member[]}>(`/projects/${project.id}/members`, { signal: controller.signal })
      .then(result => setMembers(result.items))
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [project.id]);
  async function run(action: () => Promise<void>) {
    setPending(true); setError(""); setNotice("");
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : "Unable to save changes."); }
    finally { setPending(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const updated = await api<Project>(`/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ name: name.trim(), description: description.trim() }) });
      onChange(updated); setNotice("Project details saved.");
    });
  }
  async function addMember(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await api(`/projects/${project.id}/members`, { method: "POST", body: JSON.stringify({ email: email.trim() }) });
      const result = await api<{items: Member[]}>(`/projects/${project.id}/members`);
      setMembers(result.items); setEmail(""); setNotice("Member added. They can now open this project.");
    });
  }
  return <dialog ref={dialog} className="project-dialog detail-dialog" aria-labelledby="settings-title" onCancel={event => { if (pending) event.preventDefault(); else onClose(); }}>
    <div className="dialog-heading"><h2 id="settings-title">Project & members</h2><button className="icon-button" aria-label="Close project settings" disabled={pending} onClick={onClose}><Icon name="close" /></button></div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="save-notice" role="status">{notice}</p>}
    <form onSubmit={save}>
      <label htmlFor="edit-project-name">Project name</label><input id="edit-project-name" value={name} onChange={event => setName(event.target.value)} required maxLength={120} disabled={!owner || pending} />
      <label htmlFor="edit-project-description">Description</label><textarea id="edit-project-description" rows={3} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} disabled={!owner || pending} />
      {owner && <div className="compact-actions"><button className="button primary" disabled={pending || !name.trim()}>Save details</button></div>}
    </form>
    <section className="dialog-section" aria-labelledby="members-title"><h3 id="members-title">Members</h3><p className="muted">Members can create, edit and comment on tasks.</p>
      {loading ? <p role="status">Loading members…</p> : <ul className="member-list">{members.map(member => <li key={member.userId}><span className="member-profile"><strong>{member.name}</strong><span className="muted">{member.email}</span></span><span className="member-role">{member.role}</span>{owner && member.role !== "owner" && <button className="button quiet" disabled={pending} aria-label={`Remove ${member.name}`} onClick={() => run(async () => { await api(`/projects/${project.id}/members/${member.userId}`, { method: "DELETE" }); setMembers(current => current.filter(item => item.userId !== member.userId)); })}>Remove</button>}</li>)}</ul>}
      {owner && <form onSubmit={addMember}><label htmlFor="member-email">Add by email</label><p className="muted field-hint">They need a TaskFlow account first.</p><div className="inline-form"><input id="member-email" type="email" placeholder="teammate@example.com" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={pending} /><button className="button secondary" disabled={pending || !email.trim()}>Add member</button></div></form>}
    </section>
    {owner && <section className="dialog-section archive-section"><h3>Archive project</h3><p className="muted">Hides the project and its tasks from all members. Data is retained.</p>{confirmArchive ? <div className="compact-actions"><button className="button secondary" disabled={pending} onClick={() => setConfirmArchive(false)}>Cancel</button><button className="button danger" disabled={pending} onClick={() => run(async () => { await api(`/projects/${project.id}`, { method: "DELETE" }); onArchive(); onClose(); })}>Confirm archive</button></div> : <button className="button quiet danger" disabled={pending} onClick={() => setConfirmArchive(true)}>Archive project</button>}</section>}
  </dialog>;
}
