import { useEffect, useState, type FormEvent } from "react";
type Role = "SOCIETY" | "DEVELOPER" | "PMC" | "PROFESSIONAL" | "ADMIN";
type Organization = {
  name: string;
  location: string | null;
  website: string | null;
  description: string | null;
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
      if (kind === "feasibility") form.reset();
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
            {field(
              "Organization name",
              "name",
              profile.organization.name,
              "text",
              true,
            )}
            {field("Location", "location", profile.organization.location)}
            {field("Website", "website", profile.organization.website, "url")}
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
          onSubmit={(e) =>
            void submit(e, "/societies/me/feasibility", "POST", "feasibility")
          }
        >
          <h3>Get Your Society Feasibility</h3>
          <p>
            Submit property information for professional/admin assessment. This
            request does not establish FSI, permissible height, costs, returns
            or regulatory eligibility.
          </p>
          {field("Property address", "propertyAddress", "", "text", true)}
          {field("Site area (include unit; optional)", "siteArea")}
          {field("Members (optional)", "memberCount", null, "number")}
          {field("Building age (optional)", "buildingAge", null, "number")}
          <label className="live-field">
            <span>Requirement</span>
            <textarea
              name="requirement"
              required
              minLength={20}
              maxLength={5000}
              rows={4}
            />
          </label>
          <button className="live-primary" disabled={busy}>
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
                  <option>NEEDS_INFORMATION</option>
                  <option>ASSESSED</option>
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
