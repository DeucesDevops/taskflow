"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/client-api";
import type { Notification, Page, Project, Task, TaskStatus, User } from "@/lib/types";
import { ActivityPanel } from "./activity-panel";
import { Icon } from "./icon";
import { Login } from "./login";
import { ProjectDialog } from "./project-dialog";
import { TaskBoard } from "./task-board";
import { ProjectSettings } from "./project-settings";
import { TaskDetail } from "./task-detail";
import { ThemeToggle } from "./theme-toggle";

export function TaskFlowApp() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [activityError, setActivityError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [notice, setNotice] = useState("");
  const [activityOpen, setActivityOpen] = useState(true);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [moreProjects, setMoreProjects] = useState(false);
  const [moreTasks, setMoreTasks] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [search, setSearch] = useState("");
  const taskInput = useRef<HTMLInputElement>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const selectedProject = projects.find(project => project.id === selectedId);
  const completed = tasks.filter(task => task.status === "done").length;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const visibleTasks = tasks.filter(task => task.title.toLowerCase().includes(search.trim().toLowerCase()));

  const handleError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      setUser(null);
      setProjects([]);
      setTasks([]);
      setNotifications([]);
      setSelectedId("");
      setSearch("");
      setNotice("Your session has ended. Please sign in again.");
    } else { setError(error instanceof Error ? error.message : "Unable to reach your workspace. Please try again."); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api<{ user: User }>("/auth/me", { signal: controller.signal }).then(result => setUser(result.user)).catch(error => {
      if (!controller.signal.aborted && !(error instanceof ApiError && error.status === 401)) setNotice("We could not restore your session. Please sign in to continue.");
    }).finally(() => { if (!controller.signal.aborted) setBooting(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setLoadingProjects(true);
    setError("");
    api<Page<Project>>("/projects?limit=100", { signal: controller.signal }).then(result => {
      setProjects(result.items); setMoreProjects(result.hasMore);
      setSelectedId(current => result.items.some(project => project.id === current) ? current : result.items[0]?.id || "");
    }).catch(error => { if (!controller.signal.aborted) handleError(error); }).finally(() => { if (!controller.signal.aborted) setLoadingProjects(false); });
    api<{ items: Notification[] }>("/notifications", { signal: controller.signal }).then(result => {
      setNotifications(result.items);
      setActivityError("");
    }).catch(error => { if (!controller.signal.aborted) setActivityError(error instanceof Error ? error.message : "Activity is unavailable."); });
    return () => controller.abort();
  }, [user, refreshKey, handleError]);

  useEffect(() => {
    if (!user || !selectedId) { setTasks([]); setMoreTasks(false); return; }
    const controller = new AbortController();
    setLoadingTasks(true);
    setTaskError("");
    api<Page<Task>>(`/tasks?projectId=${selectedId}&limit=100`, { signal: controller.signal }).then(result => {
      setTasks(result.items); setMoreTasks(result.hasMore);
      setUpdatedAt(new Date());
    }).catch(error => {
      if (!controller.signal.aborted) {
        if (error instanceof ApiError && error.status === 401) handleError(error);
        else setTaskError(error instanceof Error ? error.message : "Tasks are unavailable.");
      }
    }).finally(() => { if (!controller.signal.aborted) setLoadingTasks(false); });
    return () => controller.abort();
  }, [selectedId, user, refreshKey, handleError]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      api<{items: Notification[]}>("/notifications", { signal: controller.signal })
        .then(result => { setNotifications(result.items); setActivityError(""); })
        .catch(error => { if (!controller.signal.aborted) setActivityError(error.message); });
    }, 4000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [user]);

  async function loadMore(kind: "projects" | "tasks") {
    setSaving(true);
    try {
      if (kind === "projects") {
        const page = await api<Page<Project>>(`/projects?limit=100&offset=${projects.length}`);
        setProjects(current => [...current, ...page.items.filter(item => !current.some(existing => existing.id === item.id))]); setMoreProjects(page.hasMore);
      } else {
        const page = await api<Page<Task>>(`/tasks?projectId=${selectedId}&limit=100&offset=${tasks.length}`);
        setTasks(current => [...current, ...page.items.filter(item => !current.some(existing => existing.id === item.id))]); setMoreTasks(page.hasMore);
      }
    } catch (error) { handleError(error); } finally { setSaving(false); }
  }
  function taskChanged(updated: Task) {
    setTasks(current => current.map(item => item.id === updated.id ? updated : item));
    setDetailTask(updated); setUpdatedAt(new Date());
  }
  async function refreshActivity() {
    try { const result = await api<{ items: Notification[] }>("/notifications"); setNotifications(result.items); setActivityError(""); }
    catch (error) { setActivityError(error instanceof Error ? error.message : "Activity is unavailable."); }
  }
  async function createProject(name: string, description: string) {
    try {
      const project = await api<Project>("/projects", { method: "POST", body: JSON.stringify({ name, description }) });
      setProjects(current => [...current, project]);
      setTasks([]);
      setSelectedId(project.id);
      setSearch("");
      setTaskTitle("");
      setError("");
    } catch (error) { if (error instanceof ApiError && error.status === 401) handleError(error); throw error; }
  }
  async function createTask(event: FormEvent) {
    event.preventDefault();
    if (!taskTitle.trim() || !selectedId) return;
    setSaving(true);
    setError("");
    try {
      const task = await api<Task>("/tasks", { method: "POST", body: JSON.stringify({ title: taskTitle.trim(), projectId: selectedId }) });
      setTasks(current => [task, ...current]);
      setTaskTitle("");
      setSearch("");
      setUpdatedAt(new Date());
      await refreshActivity();
    } catch (error) { handleError(error); }
    finally { setSaving(false); }
  }
  async function updateStatus(task: Task, status: TaskStatus) {
    setSaving(true);
    setError("");
    try {
      const updated = await api<Task>(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setTasks(current => current.map(item => item.id === updated.id ? updated : item));
      setUpdatedAt(new Date());
      await refreshActivity();
    } catch (error) { handleError(error); }
    finally { setSaving(false); }
  }
  async function signOut() {
    setSigningOut(true);
    let message = "";
    try { await api("/auth/logout", { method: "POST" }); }
    catch (error) { message = error instanceof Error ? error.message : "Unable to fully sign out."; }
    finally {
      setUser(null); setProjects([]); setTasks([]); setNotifications([]); setSelectedId(""); setSearch(""); setNotice(message); setError(""); setNewProjectOpen(false); setSettingsOpen(false); setDetailTask(null); setSigningOut(false);
    }
  }
  function selectProject(id: string) {
    if (id === selectedId) return;
    setTasks([]); setMoreTasks(false); setSettingsOpen(false); setDetailTask(null); setSelectedId(id); setTaskTitle(""); setSearch(""); setUpdatedAt(null); setError("");
  }

  if (booting) return <main className="boot-screen"><div className="brand"><span className="brand-mark"><Icon name="mark" /></span>TaskFlow.</div><p className="muted" role="status">Opening your workspace…</p></main>;
  if (!user) return <Login notice={notice} onLogin={user => { setUser(user); setNotice(""); setError(""); }} />;

  return <div className="app-shell">
    <a className="skip-link" href="#workspace">Skip to task board</a>
    <aside className="sidebar" aria-label="Workspace navigation">
      <div className="brand"><span className="brand-mark"><Icon name="mark" /></span>TaskFlow<span className="brand-dot">.</span></div>
      <div className="workspace-label"><span className="workspace-avatar"><Icon name="board" size={20} /></span><div><strong>Team workspace</strong><span>Your work, together</span></div></div>
      <div className="nav-section-heading"><span>PROJECTS <span className="project-count">{projects.length}</span></span><button className="sidebar-icon-button" onClick={() => setNewProjectOpen(true)} aria-label="Create project" disabled={saving || loadingProjects}><Icon name="plus" size={16} /></button></div>
      <nav className="project-nav" aria-label="Projects">{projects.map(project => <button key={project.id} className={`project-nav-item ${selectedId === project.id ? "active" : ""}`} onClick={() => selectProject(project.id)} aria-current={selectedId === project.id ? "page" : undefined} disabled={saving}><span className="project-symbol">{project.name.charAt(0).toUpperCase()}</span><span>{project.name}</span></button>)}{loadingProjects && !projects.length && <p className="sidebar-empty" role="status">Loading projects…</p>}{!loadingProjects && !projects.length && <p className="sidebar-empty">Your projects will appear here.</p>}</nav>
      {moreProjects && <button className="button quiet" disabled={saving || loadingProjects} onClick={() => loadMore("projects")}>Load more projects</button>}
      <button className="new-project-link" onClick={() => setNewProjectOpen(true)} disabled={saving || loadingProjects}><Icon name="plus" size={16} />New project</button>
      <div className="sidebar-bottom"><div className="user-avatar">{user.name.split(" ").map(part => part[0]).slice(0, 2).join("")}</div><div className="user-details"><strong>{user.name}</strong><span>{user.email}</span></div><button className="sidebar-icon-button" aria-label="Sign out" title="Sign out" disabled={signingOut || saving} onClick={signOut}><Icon name="logout" /></button></div>
    </aside>
    <main className="main-workspace" id="workspace">
      <header className="topbar"><div className="breadcrumb"><span>My workspace</span><span aria-hidden="true"><Icon name="chevron" size={13} /></span><strong>{selectedProject?.name || "Projects"}</strong></div><div className="topbar-actions"><ThemeToggle /><button className="button quiet refresh-button" aria-label="Refresh workspace" onClick={() => setRefreshKey(key => key + 1)} disabled={loadingProjects || loadingTasks || saving}><Icon name="refresh" size={16} /><span>Refresh</span></button><button className={`button quiet ${activityOpen ? "selected" : ""}`} onClick={() => setActivityOpen(open => !open)} aria-expanded={activityOpen} aria-controls="activity-panel"><Icon name="activity" size={17} />Activity</button></div></header>
      <div className={`workspace-content ${activityOpen ? "with-activity" : ""}`}>
        <section className="board-workspace" aria-label="Project workspace">
          {error && <div role="alert" className="error-banner"><p>{error}</p><button className="icon-button" aria-label="Dismiss error" onClick={() => setError("")}><Icon name="close" size={16} /></button></div>}
          {selectedProject ? <>
            <div className="project-heading">
              <div className="project-heading-copy"><span className="project-heading-icon"><Icon name="folder" size={26} /></span><span className="eyebrow">PROJECT WORKSPACE</span><h1>{selectedProject.name}</h1><p>{selectedProject.description || "Keep the next step clear. Bring your project forward, one task at a time."}</p></div>
              <button className="button primary new-task-button" disabled={saving || loadingTasks || Boolean(taskError)} onClick={() => taskInput.current?.focus()}><Icon name="plus" size={18} />New task</button>
            </div>
            <div className="project-tools"><button className="button secondary" onClick={() => setSettingsOpen(true)} disabled={saving || loadingProjects}>Project & members</button><span className="muted">{selectedProject.role === "owner" ? "Owner" : "Member"}</span></div>
            <div className="project-summary"><span><strong>{tasks.length}</strong> {tasks.length === 1 ? "task" : "tasks"}{moreTasks ? " loaded" : ""}</span><span className="summary-divider" /><span><strong>{completed}</strong> completed</span><div className="project-progress" role="progressbar" aria-label={moreTasks ? "Loaded task completion" : "Project completion"} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div><span className="progress-label">{progress}%</span></div>
            <div className="board-toolbar"><div className="board-tab"><Icon name="board" size={17} />Board<span>{tasks.length}</span></div><label className="board-search"><Icon name="search" size={16} /><span className="sr-only">Search tasks</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={moreTasks ? "Search loaded tasks…" : "Search tasks…"} /></label></div>
            <form className="add-task-form" onSubmit={createTask}><Icon name="plus" /><label className="sr-only" htmlFor="task-title">New task title</label><input ref={taskInput} id="task-title" value={taskTitle} onChange={event => setTaskTitle(event.target.value)} placeholder="Add a task to this project…" required maxLength={200} disabled={saving || loadingTasks || Boolean(taskError)} /><button className="button primary" disabled={saving || loadingTasks || !taskTitle.trim() || Boolean(taskError)}>{saving ? "Saving…" : "Add task"}<Icon name="plus" size={16} /></button></form>
            {loadingTasks ? <div className="board-loading" role="status"><span className="loading-indicator" />Loading tasks…</div> : taskError ? <div className="board-error" role="alert"><p>{taskError}</p><button className="button secondary" onClick={() => setRefreshKey(key => key + 1)}>Try again</button></div> : <TaskBoard tasks={visibleTasks} searching={Boolean(search.trim())} pending={saving} onStatusChange={updateStatus} onOpen={setDetailTask} />}
            {moreTasks && <button className="button secondary load-more" disabled={saving || loadingTasks} onClick={() => loadMore("tasks")}>Load more tasks</button>}
            <footer className="board-footer"><span><Icon name="check" size={14} />{completed} of {tasks.length} tasks complete</span><span role="status">{saving ? "Saving changes…" : updatedAt ? `Updated ${updatedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : ""}</span></footer>
          </> : <div className="workspace-empty"><span className="empty-project-icon"><Icon name="board" size={27} /></span><h1>{loadingProjects ? "Opening your projects…" : "Start with a project"}</h1><p>{loadingProjects ? "Your workspace will be ready in a moment." : "Create a project, add a few tasks, and take it from there."}</p>{!loadingProjects && <button className="button primary" onClick={() => setNewProjectOpen(true)}><Icon name="plus" size={16} />Create project</button>}</div>}
        </section>
        {activityOpen && <ActivityPanel items={notifications} projects={projects} error={activityError} onClose={() => setActivityOpen(false)} />}
      </div>
    </main>
    {settingsOpen && selectedProject && <ProjectSettings key={selectedProject.id} project={selectedProject} onClose={() => setSettingsOpen(false)} onChange={updated => setProjects(current => current.map(item => item.id === updated.id ? updated : item))} onArchive={() => { setProjects(current => current.filter(item => item.id !== selectedId)); setSelectedId(""); setTasks([]); setRefreshKey(key => key + 1); }} />}
    {detailTask && <TaskDetail key={detailTask.id} task={detailTask} user={user} onClose={() => setDetailTask(null)} onChange={taskChanged} onDelete={id => { setTasks(current => current.filter(item => item.id !== id)); setUpdatedAt(new Date()); }} />}
    {newProjectOpen && <ProjectDialog onClose={() => setNewProjectOpen(false)} onCreate={createProject} />}
  </div>;
}
