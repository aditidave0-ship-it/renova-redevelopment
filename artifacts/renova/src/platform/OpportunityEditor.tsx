import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import {
  workspaceApi as api,
  WorkspaceApiError,
  errorMessage,
} from "./workspace-api";
type Opportunity = {
  id: string;
  title: string;
  location: string;
  description: string;
  memberCount: number | null;
  buildingAge: number | null;
  siteArea: string | null;
  status: string;
};
export function OpportunityEditor({
  selected,
  onSaved,
  onCancel,
}: {
  selected: Opportunity | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(Boolean(selected)),
    [editable, setEditable] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({
    title: selected?.title ?? "",
    location: selected?.location ?? "",
    description: selected?.description ?? "",
    memberCount: selected?.memberCount?.toString() ?? "",
    buildingAge: selected?.buildingAge?.toString() ?? "",
    siteArea: selected?.siteArea ?? "",
  });
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    void api<{ opportunity: Opportunity }>(
      `/societies/me/opportunities/${selected.id}`,
    )
      .then(({ opportunity }) => {
        if (cancelled) return;
        setEditable(opportunity.status === "DRAFT");
        setDraft({
          title: opportunity.title,
          location: opportunity.location,
          description: opportunity.description,
          memberCount: opportunity.memberCount?.toString() ?? "",
          buildingAge: opportunity.buildingAge?.toString() ?? "",
          siteArea: opportunity.siteArea ?? "",
        });
      })
      .catch((cause) => {
        if (cancelled) return;
        if (cause instanceof WorkspaceApiError && cause.status === 404)
          setEditable(false);
        else setError(errorMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);
  async function save(publish: boolean) {
    if (!editable || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (
        draft.title.trim().length < 3 ||
        draft.location.trim().length < 2 ||
        draft.description.trim().length < 20
      )
        throw new Error(
          "Add a title, location and a description of at least 20 characters.",
        );
      await api(
        selected
          ? `/societies/me/opportunities/${selected.id}`
          : "/opportunities",
        {
          method: selected ? "PATCH" : "POST",
          body: JSON.stringify({
            ...draft,
            memberCount: draft.memberCount
              ? Number(draft.memberCount)
              : undefined,
            buildingAge: draft.buildingAge
              ? Number(draft.buildingAge)
              : undefined,
            siteArea: draft.siteArea || undefined,
            publish,
          }),
        },
      );
      setNotice(
        publish
          ? "Opportunity published. Developers and PMCs can discover this brief."
          : "Private draft saved to your society.",
      );
      if (!selected) {
        setDraft({
          title: "",
          location: "",
          description: "",
          memberCount: "",
          buildingAge: "",
          siteArea: "",
        });
        setStep(0);
      }
      onSaved();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStep(1);
  }
  return (
    <section className="live-panel">
      <div className="live-panel-intro">
        <span>
          {selected ? "Your society’s saved draft" : "Society opportunity"}
        </span>
        <h2>
          {selected
            ? "Review & edit your draft"
            : "Create a redevelopment opportunity"}
        </h2>
        <p>
          Share factual details. Publishing makes this brief available to
          authorized Developer and PMC accounts.
        </p>
      </div>
      {loading && <p role="status">Checking draft access…</p>}
      {!loading && !editable && (
        <div className="workspace-unavailable" role="status">
          <strong>
            Editing or publishing this saved draft is not available.
          </strong>
          <p>
            The draft may no longer be editable, or this deployment does not yet
            include the draft workflow. Your saved record is retained.
          </p>
          <Link href="/contact?subject=Opportunity%20draft">
            Contact RENOVA →
          </Link>
        </div>
      )}
      {step === 0 ? (
        <form className="live-form" onSubmit={review}>
          {[
            {
              key: "title",
              label: "Opportunity title",
              max: 220,
              min: 3,
              placeholder: "Society redevelopment opportunity",
            },
            {
              key: "location",
              label: "Location",
              max: 180,
              min: 2,
              placeholder: "Locality and city",
            },
          ].map((item) => (
            <label className="live-field" key={item.key}>
              <span>{item.label}</span>
              <input
                required
                minLength={item.min}
                maxLength={item.max}
                placeholder={item.placeholder}
                value={draft[item.key as "title" | "location"]}
                onChange={(e) =>
                  setDraft({ ...draft, [item.key]: e.target.value })
                }
              />
            </label>
          ))}
          <label className="live-field">
            <span>Description / Society requirement</span>
            <textarea
              required
              minLength={20}
              maxLength={5000}
              rows={5}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              placeholder="Property information, current redevelopment stage and the support your society seeks."
            />
          </label>
          <div className="live-field-row">
            <label className="live-field">
              <span>Members (optional)</span>
              <input
                type="number"
                min={1}
                max={100000}
                value={draft.memberCount}
                onChange={(e) =>
                  setDraft({ ...draft, memberCount: e.target.value })
                }
              />
            </label>
            <label className="live-field">
              <span>Building age in years (optional)</span>
              <input
                type="number"
                min={0}
                max={200}
                value={draft.buildingAge}
                onChange={(e) =>
                  setDraft({ ...draft, buildingAge: e.target.value })
                }
              />
            </label>
          </div>
          <label className="live-field">
            <span>Site area, including unit (optional)</span>
            <input
              maxLength={80}
              value={draft.siteArea}
              onChange={(e) => setDraft({ ...draft, siteArea: e.target.value })}
            />
          </label>
          <div className="live-actions">
            <button type="submit" className="live-primary">
              Review your brief <ArrowRight size={16} />
            </button>
            {selected && (
              <button type="button" onClick={onCancel}>
                Cancel editing
              </button>
            )}
          </div>
        </form>
      ) : (
        <>
          <h3>Review before saving</h3>
          <dl className="workspace-review">
            {Object.entries(draft).map(([key, value]) => (
              <div key={key}>
                <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
                <dd>{value || "Information not yet provided"}</dd>
              </div>
            ))}
          </dl>
          <p>
            A draft stays private. Publish only information your society is
            ready to share.
          </p>
          <div className="live-actions">
            <button disabled={busy} type="button" onClick={() => setStep(0)}>
              Edit details
            </button>
            <button
              disabled={busy || loading || !editable}
              type="button"
              onClick={() => void save(false)}
            >
              {busy ? "Saving…" : "Save draft"}
            </button>
            <button
              className="live-primary"
              disabled={busy || loading || !editable}
              type="button"
              onClick={() => void save(true)}
            >
              {busy ? "Saving…" : "Publish opportunity"}
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="live-success">
          {notice}
        </p>
      )}
    </section>
  );
}
