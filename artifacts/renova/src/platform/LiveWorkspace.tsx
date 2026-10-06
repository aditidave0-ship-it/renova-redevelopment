import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  LoaderCircle,
  LogOut,
  MapPin,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import "./live-workspace.css";
import { WorkspaceFoundation } from "./WorkspaceFoundation";

type Role = "SOCIETY" | "DEVELOPER" | "PMC" | "PROFESSIONAL" | "ADMIN";
type Account = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  organizationId: string | null;
};
type Opportunity = {
  id: string;
  title: string;
  location: string;
  description: string;
  memberCount: number | null;
  buildingAge: number | null;
  siteArea: string | null;
  status: string;
  publishedAt: string | null;
};
type Interest = {
  id: string;
  opportunityTitle: string;
  organizationName: string;
  message: string | null;
  status: string;
  createdAt: string;
};
type Enquiry = {
  id: string;
  reference: string;
  name: string;
  organizationName: string;
  email: string;
  phone: string;
  city: string;
  actorType: string;
  experienceYears: number | null;
  message: string;
  status: string;
  createdAt: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      credentials: "same-origin",
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new Error(
      "The RENOVA service is unavailable. Please try again shortly.",
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(
      "The RENOVA account service is not connected to this website yet.",
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : `Request failed (${response.status}).`,
    );
  }
  return body as T;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="live-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function AccountForm({ onSignedIn }: { onSignedIn: (user: Account) => void }) {
  const [{ verificationToken, resetToken }] = useState(() => {
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    return {
      verificationToken: parameters.get("verify"),
      resetToken: parameters.get("reset"),
    };
  });
  const [mode, setMode] = useState<
    "register" | "login" | "forgot" | "resend" | "reset" | "verify"
  >(verificationToken ? "verify" : resetToken ? "reset" : "register");
  const [role, setRole] = useState<Role>("SOCIETY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!verificationToken) return;
    setBusy(true);
    void api<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token: verificationToken }),
    })
      .then((result) => {
        setNotice(result.message);
        setMode("login");
        window.history.replaceState(null, "", window.location.pathname);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to verify this email.",
        ),
      )
      .finally(() => setBusy(false));
  }, [verificationToken]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "login") {
        const result = await api<{ user: Account }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: form.get("email"),
            password: form.get("password"),
          }),
        });
        onSignedIn(result.user);
      } else if (mode === "register") {
        const result = await api<{ message: string }>("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email: form.get("email"),
            password: form.get("password"),
            displayName: form.get("displayName"),
            role,
            organizationName: form.get("organizationName"),
            location: form.get("location"),
          }),
        });
        setNotice(result.message);
        setMode("login");
      } else if (mode === "forgot") {
        const result = await api<{ message: string }>("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: form.get("email") }),
        });
        setNotice(result.message);
      } else if (mode === "resend") {
        const result = await api<{ message: string }>(
          "/auth/resend-verification",
          {
            method: "POST",
            body: JSON.stringify({ email: form.get("email") }),
          },
        );
        setNotice(result.message);
      } else if (mode === "reset" && resetToken) {
        const password = String(form.get("password") || "");
        if (password !== form.get("confirmPassword"))
          throw new Error("Passwords do not match.");
        const result = await api<{ message: string }>("/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({ token: resetToken, password }),
        });
        setNotice(result.message);
        setMode("login");
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="live-panel live-auth">
      <div className="live-panel-intro">
        <span>RENOVA account</span>
        <h2>
          {mode === "register"
            ? "Start your redevelopment workspace."
            : mode === "reset"
              ? "Choose a new password."
              : mode === "forgot"
                ? "Reset your password."
                : mode === "resend"
                  ? "Resend verification."
                  : mode === "verify"
                    ? "Verifying your email…"
                    : "Welcome back."}
        </h2>
        <p>
          Email verification protects every organization workspace and keeps
          account access private.
        </p>
      </div>
      <div className="live-tabs" role="tablist" aria-label="Account action">
        <button
          type="button"
          className={mode === "register" ? "active" : ""}
          onClick={() => {
            setMode("register");
            setError("");
            setNotice("");
          }}
        >
          Create account
        </button>
        <button
          type="button"
          className={mode === "login" ? "active" : ""}
          onClick={() => {
            setMode("login");
            setError("");
            setNotice("");
          }}
        >
          Sign in
        </button>
      </div>
      <form onSubmit={submit} className="live-form">
        {mode === "register" && (
          <>
            <Field label="I represent">
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
              >
                <option value="SOCIETY">Housing society</option>
                <option value="DEVELOPER">Developer</option>
                <option value="PMC">PMC</option>
                <option value="PROFESSIONAL">Other professional</option>
              </select>
            </Field>
            <Field label="Your name">
              <input
                name="displayName"
                minLength={2}
                maxLength={160}
                required
                autoComplete="name"
              />
            </Field>
            <Field label="Organization / society name">
              <input
                name="organizationName"
                minLength={2}
                maxLength={220}
                required
                autoComplete="organization"
              />
            </Field>
            <Field label="Location">
              <input name="location" maxLength={160} placeholder="Mumbai" />
            </Field>
          </>
        )}
        {mode !== "reset" && mode !== "verify" && (
          <Field label="Email address">
            <input name="email" type="email" required autoComplete="email" />
          </Field>
        )}
        {(mode === "register" || mode === "login" || mode === "reset") && (
          <Field label="Password">
            <input
              name="password"
              type="password"
              minLength={mode === "login" ? 1 : 8}
              maxLength={128}
              required
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </Field>
        )}
        {mode === "reset" && (
          <Field label="Confirm new password">
            <input
              name="confirmPassword"
              type="password"
              minLength={8}
              maxLength={128}
              required
              autoComplete="new-password"
            />
          </Field>
        )}
        {error && (
          <p role="alert" className="live-error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="live-success">
            <CheckCircle2 size={17} /> {notice}
          </p>
        )}
        {mode !== "verify" && (
          <button className="live-primary" disabled={busy} type="submit">
            {busy ? (
              <LoaderCircle className="live-spin" size={18} />
            ) : mode === "register" ? (
              "Create account"
            ) : mode === "login" ? (
              "Sign in"
            ) : mode === "forgot" ? (
              "Send reset link"
            ) : mode === "resend" ? (
              "Resend verification"
            ) : (
              "Change password"
            )}{" "}
            <ArrowRight size={17} />
          </button>
        )}
        {mode === "login" && (
          <div className="live-auth-links">
            <button type="button" onClick={() => setMode("forgot")}>
              Forgot password?
            </button>
            <button type="button" onClick={() => setMode("resend")}>
              Resend verification
            </button>
          </div>
        )}
        {(mode === "forgot" || mode === "resend") && (
          <div className="live-auth-links">
            <button type="button" onClick={() => setMode("login")}>
              Back to sign in
            </button>
          </div>
        )}
      </form>
      <p className="live-note">
        <ShieldCheck size={16} /> Organization profiles begin unverified. RENOVA
        does not endorse or rank registrants.
      </p>
    </section>
  );
}

function SocietyView() {
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [preview, setPreview] = useState(false);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [interestData, opportunityData] = await Promise.all([
        api<{ interests: Interest[] }>("/societies/me/interests"),
        api<{ opportunities: Opportunity[] }>("/societies/me/opportunities"),
      ]);
      setInterests(interestData.interests);
      setOpportunities(opportunityData.opportunities);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load interest.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(
        editing
          ? `/societies/me/opportunities/${editing.id}`
          : "/opportunities",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({
            title: form.get("title"),
            location: form.get("location"),
            description: form.get("description"),
            memberCount: form.get("memberCount")
              ? Number(form.get("memberCount"))
              : undefined,
            buildingAge: form.get("buildingAge")
              ? Number(form.get("buildingAge"))
              : undefined,
            siteArea: form.get("siteArea") || undefined,
            publish: form.get("publish") === "on",
          }),
        },
      );
      setMessage(
        form.get("publish") === "on"
          ? "Opportunity published. Developers and PMCs can now discover it."
          : "Draft saved privately.",
      );
      formElement.reset();
      setEditing(null);
      setPreview(false);
      void load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save opportunity.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="live-grid">
      <section className="live-panel">
        <div className="live-panel-intro">
          <span>Society workspace</span>
          <h2>
            {editing
              ? "Edit society draft"
              : "Create a redevelopment opportunity"}
          </h2>
          <p>
            Share a clear, factual brief. Publishing makes these details visible
            to developers and PMCs.
          </p>
        </div>
        {preview && editing && (
          <article className="live-list-card" aria-label="Saved draft preview">
            <h3>{editing.title}</h3>
            <p>{editing.location}</p>
            <p>{editing.description}</p>
            <p>
              {editing.memberCount ?? "Not provided"} members · Site area:{" "}
              {editing.siteArea || "Not provided"}
            </p>
            <p>
              Private saved draft. Changes below must be saved before previewing
              them.
            </p>
          </article>
        )}
        <form
          key={editing?.id || "new"}
          className="live-form"
          onSubmit={create}
        >
          <Field label="Opportunity title">
            <input
              name="title"
              defaultValue={editing?.title || ""}
              required
              minLength={3}
              maxLength={220}
              placeholder="ABC CHS redevelopment"
            />
          </Field>
          <Field label="Location">
            <input
              name="location"
              defaultValue={editing?.location || ""}
              required
              minLength={2}
              maxLength={180}
              placeholder="Andheri West, Mumbai"
            />
          </Field>
          <Field label="Description">
            <textarea
              name="description"
              defaultValue={editing?.description || ""}
              required
              minLength={20}
              maxLength={5000}
              rows={5}
              placeholder="Describe the property, current stage and what your society is seeking."
            />
          </Field>
          <div className="live-field-row">
            <Field label="Number of members">
              <input
                name="memberCount"
                defaultValue={editing?.memberCount ?? ""}
                type="number"
                min={1}
                max={100000}
              />
            </Field>
            <Field label="Building age (years)">
              <input
                name="buildingAge"
                defaultValue={editing?.buildingAge ?? ""}
                type="number"
                min={0}
                max={200}
              />
            </Field>
          </div>
          <Field label="Approximate site area">
            <input
              name="siteArea"
              defaultValue={editing?.siteArea || ""}
              maxLength={80}
              placeholder="e.g. 1,200 sq m"
            />
          </Field>
          <label className="live-check">
            <input name="publish" type="checkbox" />
            <span>Publish this opportunity now</span>
          </label>
          {error && (
            <p role="alert" className="live-error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="live-success">
              <CheckCircle2 size={17} /> {message}
            </p>
          )}
          <button className="live-primary" disabled={busy} type="submit">
            {busy ? "Saving…" : "Save opportunity"} <ArrowRight size={16} />
          </button>
          {editing && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setPreview(false);
              }}
            >
              Cancel editing
            </button>
          )}
        </form>
      </section>
      <div className="live-aside">
        <section className="live-panel">
          <div className="live-panel-intro">
            <span>Your opportunities</span>
            <h2>Society briefs</h2>
            <p>
              Drafts are private. Published briefs are available for discovery.
            </p>
          </div>
          {loading && <p className="live-muted">Loading…</p>}
          {!loading && opportunities.length === 0 && (
            <p className="live-muted">
              Your first opportunity will appear here.
            </p>
          )}
          {opportunities.map((opportunity) => (
            <article className="live-list-card" key={opportunity.id}>
              <small>{opportunity.status}</small>
              <h3>{opportunity.title}</h3>
              <span>
                <MapPin size={14} /> {opportunity.location}
              </span>
              {opportunity.status === "DRAFT" && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(opportunity);
                      setPreview(false);
                      setMessage("");
                    }}
                  >
                    Edit saved draft
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(opportunity);
                      setPreview(true);
                    }}
                  >
                    Preview saved draft
                  </button>
                </>
              )}
            </article>
          ))}
        </section>
        <section className="live-panel">
          <div className="live-panel-intro">
            <span>Incoming interest</span>
            <h2>Organizations responding to your opportunities</h2>
            <p>
              Interest is a request to connect, not a proposal or endorsement.
            </p>
          </div>
          {loading && <p className="live-muted">Loading…</p>}
          {!loading && interests.length === 0 && (
            <p className="live-muted">
              No organizations have expressed interest yet.
            </p>
          )}
          {interests.map((interest) => (
            <article className="live-list-card" key={interest.id}>
              <small>{interest.opportunityTitle}</small>
              <h3>{interest.organizationName}</h3>
              <p>{interest.message || "No message provided."}</p>
              <span>
                {interest.status} ·{" "}
                {new Date(interest.createdAt).toLocaleDateString()}
              </span>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

function DiscoveryView({ role }: { role: Role }) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  useEffect(() => {
    void Promise.all([
      api<{ opportunities: Opportunity[] }>("/opportunities"),
      api<{ interests: { opportunityId: string }[] }>(
        "/organizations/me/interests",
      ),
    ])
      .then(([data, interests]) => {
        setOpportunities(data.opportunities);
        setSubmitted(interests.interests.map((item) => item.opportunityId));
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load opportunities.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  const visible = opportunities.filter((opportunity) =>
    `${opportunity.title} ${opportunity.location} ${opportunity.description}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  async function expressInterest(id: string) {
    setBusyId(id);
    setError("");
    try {
      await api(`/opportunities/${id}/interests`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setSubmitted((current) => [...current, id]);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to submit interest.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="live-panel">
      <div className="live-panel-intro">
        <span>{role === "PMC" ? "PMC discovery" : "Developer discovery"}</span>
        <h2>Published society opportunities</h2>
        <p>
          Browse factual briefs shared by societies. Express interest to request
          a connection.
        </p>
      </div>
      <Field label="Search opportunities">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search location or project"
        />
      </Field>
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
      {loading && <p className="live-muted">Loading opportunities…</p>}
      {!loading && visible.length === 0 && (
        <p className="live-muted">
          No published opportunities match your search yet.
        </p>
      )}
      <div className="live-opportunities">
        {visible.map((item) => (
          <article key={item.id} className="live-list-card">
            <small>{item.status}</small>
            <h3>{item.title}</h3>
            <span>
              <MapPin size={14} /> {item.location}
            </span>
            <p>{item.description}</p>
            <div className="live-facts">
              {item.memberCount && <span>{item.memberCount} members</span>}
              {item.buildingAge !== null && (
                <span>{item.buildingAge} year building</span>
              )}
              {item.siteArea && <span>{item.siteArea}</span>}
            </div>
            <button
              type="button"
              disabled={busyId === item.id || submitted.includes(item.id)}
              onClick={() => void expressInterest(item.id)}
            >
              {submitted.includes(item.id) ? (
                <>
                  <CheckCircle2 size={16} /> Interest submitted
                </>
              ) : busyId === item.id ? (
                "Submitting…"
              ) : (
                <>
                  <Send size={16} /> Express interest
                </>
              )}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminView() {
  const [items, setItems] = useState<Enquiry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void api<{ enquiries: Enquiry[] }>("/admin/enquiries")
      .then((result) => setItems(result.enquiries))
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Unable to load enquiries.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  return (
    <section className="live-panel">
      <div className="live-panel-intro">
        <span>Admin intake</span>
        <h2>Website enquiries</h2>
        <p>
          Requests submitted through the public contact and organization forms
          are stored in PostgreSQL and visible only to administrators.
        </p>
      </div>
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
      {loading && <p className="live-muted">Loading enquiries…</p>}
      {!loading && !items.length && (
        <p className="live-muted">No enquiries have been submitted yet.</p>
      )}
      {items.map((item) => (
        <article className="live-list-card" key={item.id}>
          <small>
            {item.reference} · {item.status}
          </small>
          <h3>
            {item.name} · {item.organizationName}
          </h3>
          <span>
            {item.actorType} · {item.city} ·{" "}
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
          <p>{item.message}</p>
          <a href={`mailto:${item.email}`}>{item.email}</a> ·{" "}
          <a href={`tel:${item.phone}`}>{item.phone}</a>
        </article>
      ))}
    </section>
  );
}

export function LiveWorkspace() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void api<{ user: Account }>("/auth/me")
      .then((data) => setAccount(data.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST", body: "{}" });
      setAccount(null);
    } catch {
      /* Keep the current session visible if sign out failed. */
    }
  }
  return (
    <div className="live-workspace">
      <header className="live-header">
        <Link href="/platform">
          <ArrowLeft size={16} /> Platform overview
        </Link>
        <Link href="/" className="live-logo">
          RENOVA
        </Link>
        {account ? (
          <button type="button" onClick={() => void logout()}>
            <LogOut size={16} /> Sign out
          </button>
        ) : (
          <span>Early access</span>
        )}
      </header>
      <main>
        <div className="live-hero">
          <span>
            <Building2 size={17} /> RENOVA workspace
          </span>
          <h1>
            {account
              ? `Welcome, ${account.displayName}.`
              : "Build the next chapter of redevelopment."}
          </h1>
          <p>
            {account
              ? `Signed in as ${account.role.toLowerCase()} · Your organization has its own workspace.`
              : "Create a secure account to publish an opportunity or discover a society brief."}
          </p>
        </div>
        {!loading && account && <WorkspaceFoundation role={account.role} />}
        {loading ? (
          <p className="live-muted">Opening your workspace…</p>
        ) : account ? (
          account.role === "SOCIETY" ? (
            <SocietyView />
          ) : account.role === "DEVELOPER" || account.role === "PMC" ? (
            <DiscoveryView role={account.role} />
          ) : account.role === "ADMIN" ? (
            <AdminView />
          ) : (
            <section className="live-panel">
              <h2>Your profile is ready</h2>
              <p>
                Professional opportunities and workspaces will be available as
                RENOVA expands.
              </p>
            </section>
          )
        ) : (
          <AccountForm onSignedIn={setAccount} />
        )}
      </main>
      <footer>
        RENOVA · A structured path from opportunity to connection.
      </footer>
    </div>
  );
}
