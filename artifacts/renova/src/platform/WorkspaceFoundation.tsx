import { useEffect, useState, type FormEvent } from "react";
type Role = "SOCIETY" | "DEVELOPER" | "PMC" | "PROFESSIONAL" | "ADMIN";
type Organization = {
  name: string;
  location: string | null;
  website: string | null;
  description: string | null;
  specialization: string | null;
  services: string | null;
  credentials: string | null;
  portfolio: string | null;
};
type Society = {
  address: string | null;
  city: string;
  memberCount: number | null;
  buildingAge: number | null;
  redevelopmentStatus: string | null;
};
type Request = {
  id: string;
  propertyAddress: string;
  requirement: string;
  status: string;
  assessmentNotes: string | null;
  siteArea?: string | null;
  memberCount?: number | null;
  buildingAge?: number | null;
  propertyInformation?: string | null;
  regulatoryInformation?: string | null;
};
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to complete request");
  return data;
}
function field(
  label: string,
  name: string,
  value: string | number | null = "",
  type = "text",
  required = false,
) {
  return (
    <label className="live-field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={value ?? ""}
        required={required}
        maxLength={type === "number" ? undefined : 2000}
        min={type === "number" ? 0 : undefined}
      />
    </label>
  );
}
export function WorkspaceFoundation({ role }: { role: Role }) {
  const [profile, setProfile] = useState<{
    organization: Organization;
    society: Society | null;
    completion: { provided: number; total: number };
  } | null>(null);
  const [metrics, setMetrics] = useState<Record<string, number | string>>({});
  const [requests, setRequests] = useState<Request[]>([]);
  const [editing, setEditing] = useState<Request | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    try {
      if (role !== "ADMIN") {
        const [p, m] = await Promise.all([
          request<typeof profile>("/organizations/me"),
          request<typeof metrics>("/workspace/metrics"),
        ]);
        setProfile(p);
        setMetrics(m);
      }
      if (role === "SOCIETY" || role === "ADMIN") {
        const data = await request<{ requests: Request[] }>(
          role === "ADMIN" ? "/admin/feasibility" : "/societies/me/feasibility",
        );
        setRequests(data.requests);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load workspace",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [role]);
  async function submit(
    event: FormEvent<HTMLFormElement>,
    path: string,
    method: string,
    kind: "organization" | "society" | "feasibility" | "review",
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload: Record<string, unknown> = Object.fromEntries(data.entries());
    if (kind === "feasibility") payload.submit = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") !== "draft";
    if (kind === "society" || kind === "feasibility")
      for (const key of ["memberCount", "buildingAge"]) {
        if (payload[key] === "") delete payload[key];
        else if (payload[key] !== undefined)
          payload[key] = Number(payload[key]);
      }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(path, method, payload);
      setMessage(
        kind === "feasibility"
          ? "Feasibility request saved for review. No assessment has been made yet."
          : "Saved successfully.",
      );
      if (kind === "feasibility") { form.reset(); setEditing(null); }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="live-panel">
      <div className="live-panel-intro">
        <span>
          {role === "ADMIN"
            ? "Admin feasibility review"
            : `${role.toLowerCase()} profile`}
        </span>
        <h2>
          {role === "ADMIN"
            ? "Professional assessment queue"
            : "Your organization and saved activity"}
        </h2>
      </div>
      {loading && <p role="status">Loading profile…</p>}
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="live-success">
          {message}
        </p>
      )}
      {profile && (
        <>
          <p>
            Organization profile: {profile.completion.provided}/
            {profile.completion.total} fields provided. Completion is not
            verification.
          </p>
          <p>
            Published opportunities: {metrics.published ?? 0} ·{" "}
            {role === "SOCIETY"
              ? `Drafts: ${metrics.drafts ?? 0} · Incoming interests`
              : "Your interests"}
            : {metrics.interests ?? 0}
          </p>
          <form
            className="live-form"
            key={JSON.stringify(profile.organization)}
            onSubmit={(e) =>
              void submit(e, "/organizations/me", "PUT", "organization")
            }
          >
            <h3>{role === "PROFESSIONAL" ? "Professional onboarding" : `${role.toLowerCase()} onboarding`}</h3>
            {role === "PROFESSIONAL" && <label className="live-field"><span>Specialization</span><select name="specialization" defaultValue={profile.organization.specialization || "OTHER"}><option value="LEGAL">Advocate / Legal</option><option value="ARCHITECT">Architect</option><option value="STRUCTURAL">Structural Consultant</option><option value="FINANCE_VALUATION">Finance / Valuation</option><option value="OTHER">Other Professional</option></select></label>}
            {field(
              "Organization name",
              "name",
              profile.organization.name,
              "text",
              true,
            )}
            {field("Location", "location", profile.organization.location)}
            {field("Website", "website", profile.organization.website, "url")}
            {role !== "SOCIETY" && <>{field("Services", "services", profile.organization.services)}{field("Credentials (self-reported; not verified)", "credentials", profile.organization.credentials)}{field("Portfolio information (self-reported)", "portfolio", profile.organization.portfolio)}</>}
            {field(
              role === "PMC"
                ? "PMC services and practice description"
                : "Organization description",
              "description",
              profile.organization.description,
            )}
            <button className="live-primary" disabled={busy}>
              Save organization profile
            </button>
          </form>
          {role === "SOCIETY" && profile.society && (
            <form
              className="live-form"
              key={JSON.stringify(profile.society)}
              onSubmit={(e) =>
                void submit(e, "/societies/me/profile", "PUT", "society")
              }
            >
              <h3>Society profile</h3>
              {field(
                "Address",
                "address",
                profile.society.address,
                "text",
                true,
              )}
              {field("City", "city", profile.society.city, "text", true)}
              {field(
                "Members",
                "memberCount",
                profile.society.memberCount,
                "number",
                true,
              )}
              {field(
                "Building age (years)",
                "buildingAge",
                profile.society.buildingAge,
                "number",
                true,
              )}
              {field(
                "Redevelopment stage",
                "redevelopmentStatus",
                profile.society.redevelopmentStatus,
                "text",
                true,
              )}
              <button className="live-primary" disabled={busy}>
                Save society profile
              </button>
            </form>
          )}
        </>
      )}
      {role === "SOCIETY" && (
        <form
          className="live-form"
          key={editing?.id || "new-feasibility"}
          onSubmit={(e) =>
            void submit(e, editing ? `/societies/me/feasibility/${editing.id}` : "/societies/me/feasibility", editing ? "PATCH" : "POST", "feasibility")
          }
        >
          <h3>Get Your Society Feasibility</h3>
          <p>
            Submit property information for professional/admin assessment. This
            request does not establish FSI, permissible height, costs, returns
            or regulatory eligibility.
          </p>
          {field("Property address", "propertyAddress", editing?.propertyAddress)}
          {field("Site area (include unit; optional)", "siteArea", editing?.siteArea)}
          {field("Members (optional)", "memberCount", editing?.memberCount, "number")}
          {field("Building age (optional)", "buildingAge", editing?.buildingAge, "number")}
          {field("Available property information (optional)", "propertyInformation", editing?.propertyInformation)}
          {field("Available regulatory information (unverified; optional)", "regulatoryInformation", editing?.regulatoryInformation)}
          <p>Document uploads are not yet supported. Review the details below before submitting; regulatory information requires professional assessment.</p>
          <label className="live-field">
            <span>Requirement</span>
            <textarea
              name="requirement"
              defaultValue={editing?.requirement || ""}
              maxLength={5000}
              rows={4}
            />
          </label>
          <button className="live-secondary" value="draft" disabled={busy}>Save draft</button>
          {editing && <button type="button" onClick={() => setEditing(null)}>Cancel editing</button>}
          <button className="live-primary" value="submit" disabled={busy}>
            Submit feasibility request
          </button>
        </form>
      )}
      {(role === "SOCIETY" || role === "ADMIN") &&
        !loading &&
        !requests.length && <p>No feasibility requests yet.</p>}
      {requests.map((item) => (
        <article className="live-list-card" key={item.id}>
          <small>{item.status}</small>
          <h3>{item.propertyAddress}</h3>
          <p>{item.requirement}</p>
          <p>{item.assessmentNotes || "Assessment not yet provided."}</p>
          {role === "SOCIETY" && ["DRAFT", "MORE_INFORMATION_REQUIRED"].includes(item.status) && <button onClick={() => { setEditing(item); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit / review request</button>}
          {role === "ADMIN" && (
            <form
              className="live-form"
              onSubmit={(e) =>
                void submit(
                  e,
                  `/admin/feasibility/${item.id}`,
                  "PATCH",
                  "review",
                )
              }
            >
              <label className="live-field">
                <span>Review status</span>
                <select
                  name="status"
                  defaultValue={
                    item.status === "SUBMITTED" ? "IN_REVIEW" : item.status
                  }
                >
                  <option>IN_REVIEW</option>
                  <option>MORE_INFORMATION_REQUIRED</option>
                  <option>ASSESSMENT_READY</option>
                  <option>CLOSED</option>
                </select>
              </label>
              <label className="live-field">
                <span>Professional assessment notes</span>
                <textarea
                  name="assessmentNotes"
                  defaultValue={item.assessmentNotes || ""}
                  required
                  minLength={20}
                  maxLength={10000}
                  rows={4}
                />
              </label>
              <p>
                Record evidence and limitations. Do not present unsupported
                regulatory conclusions.
              </p>
              <button disabled={busy}>Save assessment</button>
            </form>
          )}
        </article>
      ))}
    </section>
  );
}
