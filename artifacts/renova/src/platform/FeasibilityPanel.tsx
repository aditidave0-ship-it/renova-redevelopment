import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, FileText } from "lucide-react";
import {
  workspaceApi as api,
  WorkspaceApiError,
  errorMessage,
} from "./workspace-api";
type FeasibilityRequest = {
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
const statuses = [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "MORE_INFORMATION_REQUIRED",
  "ASSESSMENT_READY",
  "CLOSED",
];
export const statusLabel = (status: string) =>
  status.toLowerCase().replaceAll("_", " ");
const blank = {
  propertyAddress: "",
  requirement: "",
  siteArea: "",
  memberCount: "",
  buildingAge: "",
  propertyInformation: "",
  regulatoryInformation: "",
};
export function FeasibilityPanel({ admin = false }: { admin?: boolean }) {
  const [requests, setRequests] = useState<FeasibilityRequest[]>([]),
    [loading, setLoading] = useState(true),
    [available, setAvailable] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [step, setStep] = useState(0),
    [editing, setEditing] = useState<FeasibilityRequest | null>(null),
    [draft, setDraft] = useState(blank),
    [history, setHistory] = useState<
      Record<string, { status: string; createdAt: string }[]>
    >({});
  const heading = useRef<HTMLHeadingElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ requests: FeasibilityRequest[] }>(
        admin ? "/admin/feasibility" : "/societies/me/feasibility",
      );
      setRequests(data.requests);
      setAvailable(true);
      setError("");
    } catch (cause) {
      if (cause instanceof WorkspaceApiError && cause.status === 404)
        setAvailable(false);
      else setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [admin]);
  useEffect(() => {
    void load();
  }, [load]);
  function move(next: number) {
    setStep(next);
    window.setTimeout(() => heading.current?.focus(), 0);
  }
  async function save(submit: boolean) {
    if (!available || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (
        submit &&
        (draft.propertyAddress.trim().length < 5 ||
          draft.requirement.trim().length < 20)
      )
        throw new Error(
          "Add your property address (at least 5 characters) and requirement (at least 20 characters) before submitting.",
        );
      const body = {
        ...draft,
        memberCount: draft.memberCount ? Number(draft.memberCount) : undefined,
        buildingAge: draft.buildingAge ? Number(draft.buildingAge) : undefined,
        submit,
      };
      await api(
        editing
          ? `/societies/me/feasibility/${editing.id}`
          : "/societies/me/feasibility",
        { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      setNotice(
        submit
          ? "Your request has been submitted for professional review."
          : "Your draft has been saved.",
      );
      setEditing(null);
      setDraft(blank);
      setStep(0);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  async function viewHistory(id: string) {
    try {
      const data = await api<{
        history: { status: string; createdAt: string }[];
      }>(`/societies/me/feasibility/${id}/history`);
      setHistory((current) => ({ ...current, [id]: data.history }));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }
  return (
    <section className="live-panel">
      <div className="live-panel-intro">
        <span>
          {admin
            ? "Private admin review"
            : "A professional assessment begins here"}
        </span>
        <h2>{admin ? "Feasibility review" : "Get Your Society Feasibility"}</h2>
        <p>
          Share what you know. Technical information is optional. RENOVA does
          not automatically calculate development potential or financial
          returns.
        </p>
      </div>
      {loading && <p role="status">Loading feasibility requests…</p>}
      {!available && (
        <div className="workspace-unavailable" role="status">
          <strong>
            Online feasibility requests are not yet available on this
            deployment.
          </strong>
          <p>
            You can enquire with the RENOVA team now. The form below shows the
            information needed; it will not save or submit while the service is
            unavailable.
          </p>
          <Link
            href="/contact?subject=Society%20feasibility"
            className="live-primary"
          >
            Raise a feasibility enquiry <ArrowRight size={16} />
          </Link>
        </div>
      )}
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="live-success" role="status">
          {notice}
        </p>
      )}
      {!admin && (
        <>
          <ol className="workspace-stepper" aria-label="Feasibility form steps">
            {[
              "Society Information",
              "Property Details",
              "Documents (Optional)",
              "Review & Submit",
            ].map((label, i) => (
              <li key={label}>
                <button
                  type="button"
                  aria-current={step === i ? "step" : undefined}
                  onClick={() => move(i)}
                >
                  <span>{i + 1}</span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
          <h3 ref={heading} tabIndex={-1}>
            {
              [
                "Society Information",
                "Property Details",
                "Documents (Optional)",
                "Review & Submit",
              ][step]
            }
          </h3>
          <form
            className="live-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 3) move(step + 1);
              else void save(true);
            }}
          >
            {step === 0 && (
              <>
                <p>
                  Your request belongs to your signed-in society.{" "}
                  <Link href="/platform/live?view=profile">
                    Review My Society profile →
                  </Link>
                </p>
                <label className="live-field">
                  <span>Property address</span>
                  <textarea
                    maxLength={2000}
                    rows={3}
                    value={draft.propertyAddress}
                    onChange={(e) =>
                      setDraft({ ...draft, propertyAddress: e.target.value })
                    }
                    placeholder="Building, street, locality and city"
                  />
                </label>
                <label className="live-field">
                  <span>What would you like assessed?</span>
                  <textarea
                    maxLength={5000}
                    rows={4}
                    value={draft.requirement}
                    onChange={(e) =>
                      setDraft({ ...draft, requirement: e.target.value })
                    }
                    placeholder="Describe your society’s questions and redevelopment requirements."
                  />
                </label>
              </>
            )}
            {step === 1 && (
              <>
                <p>
                  Leave any field blank if you don’t know. You can ask a
                  professional to help later.
                </p>
                <div className="live-field-row">
                  {[
                    {
                      key: "memberCount",
                      label: "Number of members (optional)",
                      max: 100000,
                    },
                    {
                      key: "buildingAge",
                      label: "Building age in years (optional)",
                      max: 200,
                    },
                  ].map((item) => (
                    <label key={item.key} className="live-field">
                      <span>{item.label}</span>
                      <input
                        type="number"
                        min={item.key === "memberCount" ? 1 : 0}
                        max={item.max}
                        value={draft[item.key as "memberCount" | "buildingAge"]}
                        onChange={(e) =>
                          setDraft({ ...draft, [item.key]: e.target.value })
                        }
                        placeholder="I don’t know"
                      />
                    </label>
                  ))}
                </div>
                <label className="live-field">
                  <span>Site area, including unit (optional)</span>
                  <input
                    maxLength={80}
                    value={draft.siteArea}
                    onChange={(e) =>
                      setDraft({ ...draft, siteArea: e.target.value })
                    }
                    placeholder="e.g. 1,200 sq m — or leave blank"
                  />
                </label>
                {[
                  {
                    key: "propertyInformation",
                    label: "Available property information (optional)",
                  },
                  {
                    key: "regulatoryInformation",
                    label:
                      "Regulatory information you have (optional, requires review)",
                  },
                ].map((item) => (
                  <label key={item.key} className="live-field">
                    <span>{item.label}</span>
                    <textarea
                      maxLength={5000}
                      rows={3}
                      value={
                        draft[
                          item.key as
                            "propertyInformation" | "regulatoryInformation"
                        ]
                      }
                      onChange={(e) =>
                        setDraft({ ...draft, [item.key]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </>
            )}
            {step === 2 && (
              <div className="workspace-unavailable">
                <FileText size={30} />
                <h3>Document uploads are not yet supported.</h3>
                <p>
                  You can continue without documents. Mention what you have in
                  your property information; RENOVA can discuss a suitable way
                  to provide it after review.
                </p>
              </div>
            )}
            {step === 3 && (
              <dl className="workspace-review">
                {Object.entries(draft).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
                    <dd>{value || "Information not yet provided"}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="live-actions">
              {step > 0 && (
                <button type="button" onClick={() => move(step - 1)}>
                  Back
                </button>
              )}
              <button
                type="button"
                disabled={busy || loading || !available}
                onClick={() => void save(false)}
              >
                {busy ? "Saving…" : "Save draft"}
              </button>
              <button
                className="live-primary"
                type="submit"
                disabled={busy || (step === 3 && (loading || !available))}
              >
                {step < 3
                  ? "Continue"
                  : busy
                    ? "Submitting…"
                    : "Submit for review"}
                <ArrowRight size={16} />
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setDraft(blank);
                    setStep(0);
                  }}
                >
                  Cancel editing
                </button>
              )}
            </div>
          </form>
        </>
      )}
      <div className="live-section-spacer">
        <h3>
          {admin ? "Requests awaiting review" : "Your feasibility requests"}
        </h3>
        <p className="live-muted">
          Statuses reflect the review process. More information may be
          requested; an assessment is not guaranteed.
        </p>
        <div
          className="workspace-status-legend"
          aria-label="Possible feasibility statuses"
        >
          {statuses.map((status) => (
            <span key={status}>{statusLabel(status)}</span>
          ))}
        </div>
      </div>
      {!loading && available && !error && requests.length === 0 && (
        <p>No feasibility requests yet.</p>
      )}
      {requests.map((item) => (
        <article className="live-list-card" key={item.id}>
          <small>{statusLabel(item.status)}</small>
          <h3>{item.propertyAddress || "Draft request"}</h3>
          <p>{item.requirement || "Requirement not yet provided"}</p>
          <p>{item.assessmentNotes || "Assessment not yet provided."}</p>
          {!admin && (
            <div className="live-actions">
              <button type="button" onClick={() => void viewHistory(item.id)}>
                View status history
              </button>
              {["DRAFT", "MORE_INFORMATION_REQUIRED"].includes(item.status) && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(item);
                    setDraft(
                      Object.fromEntries(
                        Object.keys(blank).map((key) => [
                          key,
                          String(item[key as keyof FeasibilityRequest] ?? ""),
                        ]),
                      ) as typeof blank,
                    );
                    move(0);
                  }}
                >
                  Edit / review request
                </button>
              )}
            </div>
          )}
          {history[item.id] && (
            <ol>
              {history[item.id].map((entry, i) => (
                <li key={i}>
                  {statusLabel(entry.status)} ·{" "}
                  {new Date(entry.createdAt).toLocaleString()}
                </li>
              ))}
            </ol>
          )}
          {admin && (
            <form
              className="live-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                setBusy(true);
                try {
                  await api(`/admin/feasibility/${item.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      status: form.get("status"),
                      assessmentNotes: form.get("assessmentNotes"),
                    }),
                  });
                  await load();
                  setNotice("Review saved.");
                } catch (cause) {
                  setError(errorMessage(cause));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="live-field">
                <span>Review status</span>
                <select
                  name="status"
                  defaultValue={
                    item.status === "SUBMITTED" ? "IN_REVIEW" : item.status
                  }
                >
                  {[
                    "IN_REVIEW",
                    "MORE_INFORMATION_REQUIRED",
                    "ASSESSMENT_READY",
                    "CLOSED",
                  ].map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="live-field">
                <span>Professional assessment / information request</span>
                <textarea
                  name="assessmentNotes"
                  rows={4}
                  required
                  minLength={20}
                  maxLength={10000}
                  defaultValue={item.assessmentNotes ?? ""}
                />
              </label>
              <button className="live-primary" disabled={busy}>
                Save review
              </button>
            </form>
          )}
        </article>
      ))}
    </section>
  );
}
