import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icon";

export function ProjectDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, description: string) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setError("Give your project a name."); return; }
    setPending(true);
    setError("");
    try { await onCreate(name.trim(), description.trim()); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to create the project."); }
    finally { setPending(false); }
  }
  return <dialog ref={dialog} className="project-dialog" onCancel={event => { if (pending) event.preventDefault(); else onClose(); }} aria-labelledby="new-project-title">
    <form onSubmit={submit}>
      <div className="dialog-heading"><h2 id="new-project-title">Create a project</h2><button type="button" className="icon-button" aria-label="Close create project" onClick={onClose} disabled={pending}><Icon name="close" /></button></div>
      <p className="muted">Give your next set of tasks a place to live.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <label htmlFor="project-name">Project name</label><input id="project-name" autoFocus required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Website launch" />
      <label htmlFor="project-description">Description <span className="muted">(optional)</span></label><textarea id="project-description" maxLength={1000} rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="What are you working toward?" />
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose} disabled={pending}>Cancel</button><button className="button primary" disabled={pending}>{pending ? "Creating…" : "Create project"}</button></div>
    </form>
  </dialog>;
}
