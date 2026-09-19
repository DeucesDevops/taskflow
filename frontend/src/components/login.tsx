import { useState, type FormEvent } from "react";
import { api } from "@/lib/client-api";
import type { User } from "@/lib/types";
import { Icon } from "./icon";
import { ThemeToggle } from "./theme-toggle";

export function Login({ onLogin, notice }: { onLogin: (user: User) => void; notice: string }) {
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("alex@taskflow.local");
  const [password, setPassword] = useState("taskflow-local-demo");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const message = error || notice;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const { user } = await api<{ user: User }>(registering ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, ...(registering ? { name } : {}) }),
      });
      onLogin(user);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <main className="login-page">
    <ThemeToggle className="login-theme-toggle" />
    <section className="login-brand-panel" aria-label="TaskFlow">
      <div className="brand brand-large">
        <span className="brand-mark"><Icon name="mark" size={29} /></span>
        TaskFlow<span className="brand-dot">.</span>
      </div>

      <div className="login-brand-content">
        <div className="login-intro">
          <span className="eyebrow">A CLEARER WAY TO WORK</span>
          <h1>Good work.<br /><span className="login-headline-accent">Clear direction.</span></h1>
          <p>Bring your projects into focus.<br />Move forward, one task at a time.</p>
        </div>

        <div className="workflow-art" aria-hidden="true">
          <div className="workflow-art-grid" />
          <div className="workflow-connector" />
          <div className="workflow-card workflow-card-plan">
            <div className="workflow-card-heading"><span className="workflow-status-dot" /><span>TO DO</span></div>
            <div className="workflow-card-title">Set the direction</div>
            <div className="workflow-card-line" /><div className="workflow-card-line short" />
          </div>
          <div className="workflow-card workflow-card-active">
            <div className="workflow-card-heading"><span className="workflow-status-dot" /><span>IN PROGRESS</span></div>
            <div className="workflow-card-title">Make it happen</div>
            <div className="workflow-card-line" /><div className="workflow-card-line short" />
          </div>
          <div className="workflow-card workflow-card-done">
            <div className="workflow-card-heading"><span className="workflow-status-dot" /><span>DONE</span></div>
            <div className="workflow-card-title">A step forward</div>
            <span className="workflow-check"><Icon name="check" size={20} /></span>
          </div>
          <span className="workflow-art-caption">FROM FIRST IDEA TO FINISHED WORK</span>
        </div>
      </div>

      <div className="login-brand-footer"><span className="small-dot" />A little structure. More progress.</div>
    </section>

    <section className="login-form-panel" aria-labelledby="signin-title">
      <form className="login-form" onSubmit={submit} aria-busy={pending}>
        <div className="login-form-heading">
          <span className="login-form-icon"><Icon name="mark" size={26} /></span>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h2 id="signin-title">{registering ? "Create your account" : "Welcome back"}</h2>
          <p className="muted">{registering ? "Join your team and start organizing work." : "Sign in to pick up where you left off."}</p>
        </div>

        {message && <div id="login-error" role="alert" className="form-error login-error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 3v1" /></svg>
          <p>{message}</p>
        </div>}

        {registering && <><label htmlFor="name">Full name</label><input id="name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" required maxLength={100} disabled={pending} /></>}
        <label htmlFor="email">Email address</label>
        <input
          id="email" name="email" type="email" value={email}
          onChange={event => setEmail(event.target.value)}
          autoComplete="username" spellCheck={false} autoCapitalize="none"
          required maxLength={254} disabled={pending}
          aria-describedby={message ? "login-error" : undefined}
        />

        <label htmlFor="password">Password</label>
        <div className="login-input-wrap">
          <input
            id="password" name="password" type={passwordVisible ? "text" : "password"} value={password}
            onChange={event => setPassword(event.target.value)}
            autoComplete={registering ? "new-password" : "current-password"} minLength={registering ? 12 : 1} required maxLength={256} disabled={pending}
            aria-describedby={message ? "login-error" : undefined}
          />
          <button
            type="button" className="password-toggle" disabled={pending}
            aria-label={passwordVisible ? "Hide password" : "Show password"}
            aria-controls="password" onClick={() => setPasswordVisible(visible => !visible)}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {passwordVisible && <path d="m3 3 18 18" />}
            </svg>
          </button>
        </div>

        <button className="button primary login-submit" disabled={pending}>
          <span className="login-submit-label">{pending ? <><span className="login-spinner" aria-hidden="true" />Please wait…</> : registering ? "Create account" : "Sign in to TaskFlow"}</span>
          {!pending && <Icon name="arrow" size={18} />}
        </button>

        <button type="button" className="button quiet auth-switch" disabled={pending} onClick={() => { setRegistering(!registering); setEmail(""); setPassword(""); setError(""); }}>
          {registering ? "Already have an account? Sign in" : "New to TaskFlow? Create an account"}
        </button>
        {registering && <p className="muted password-hint">Use at least 12 characters for your password.</p>}
        {!registering && <div className="demo-note">
          <div className="demo-note-heading"><span className="eyebrow">EXPLORE THE LOCAL DEMO</span><span className="demo-ready">Ready to try</span></div>
          <p className="muted">Your demo details are already filled in.</p>
          <dl className="demo-credentials">
            <div><dt>Email</dt><dd><code>alex@taskflow.local</code></dd></div>
            <div><dt>Password</dt><dd><code>taskflow-local-demo</code></dd></div>
          </dl>
          <p className="demo-custom-note">Changed these during setup? Enter your own details above.</p>
        </div>}

        <p className="login-form-footer"><Icon name="board" size={14} />Projects, tasks, and progress. Together.</p>
      </form>
    </section>
  </main>;
}
