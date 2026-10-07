import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { ArrowRight, CheckCircle2, FileText, Upload } from "lucide-react";
import { Link } from "wouter";

type Status =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "MORE_INFORMATION_REQUIRED"
  | "ASSESSMENT_READY"
  | "CLOSED";
type Summary = {
  id: string;
  reference: string;
  societyName: string;
  locality: string;
  city: string;
  status: Status;
  updatedAt: string;
};
type History = {
  id: string;
  fromStatus: Status | null;
  toStatus: Status;
  note: string | null;
  createdAt: string;
};
type DocumentItem = {
  id: string;
  category: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
};
type Assessment = Record<string, string | string[] | null> & {
  assumptions?: string[];
  publishedAt?: string | null;
};
type Detail = Summary & {
  propertyAddress: string;
  pinCode: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  missingInformation: string | null;
  propertyData: Record<string, unknown> | null;
  history: History[];
  documents: DocumentItem[];
  assessment: Assessment | null;
  documentUploadsEnabled: boolean;
};

const statusLabel: Record<Status, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In review",
  MORE_INFORMATION_REQUIRED: "More information required",
  ASSESSMENT_READY: "Assessment ready",
  CLOSED: "Closed",
};
const technicalFields = [
  ["plotArea", "Plot area"],
  ["numberBuildings", "Number of buildings"],
  ["numberWings", "Number of wings"],
  ["existingFloors", "Existing floors"],
  ["residentialUnits", "Residential units"],
  ["commercialUnits", "Commercial units"],
  ["existingBuiltUpInformation", "Existing built-up information"],
  ["approximateBuildingAge", "Approximate building age"],
  ["existingParking", "Existing parking"],
  ["existingAmenities", "Existing amenities"],
] as const;
const regulatoryFields = [
  ["ctsSurveyInformation", "CTS / survey information"],
  ["existingApprovedPlans", "Existing approved plans"],
  ["propertyCardInformation", "Property card information"],
  ["conveyanceInformation", "Conveyance information"],
  ["existingFsiInformation", "Existing FSI information"],
  ["roadWidth", "Road width"],
  ["reservationsRestrictions", "Reservations or restrictions"],
  ["otherPropertyInformation", "Other property information"],
] as const;
const emptyForm: Record<string, string> = {
  societyName: "",
  propertyAddress: "",
  locality: "",
  city: "Mumbai",
  pinCode: "",
  contactPerson: "",
  contactEmail: "",
  contactPhone: "",
  ...Object.fromEntries(
    [...technicalFields, ...regulatoryFields].map(([key]) => [key, ""]),
  ),
};

async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "Unable to complete this request.",
    );
  return body as T;
}

function InputField({
  label,
  name,
  value,
  onChange,
  required,
  type = "text",
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  required?: boolean;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="live-field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={name}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        required={required}
        type={type}
        disabled={disabled}
      />
    </label>
  );
}

function TextField({
  label,
  name,
  value,
  onChange,
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="live-field">
      <span>{label}</span>
      <textarea
        name={name}
        rows={3}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        disabled={disabled}
      />
    </label>
  );
}

function toForm(detail: Detail): Record<string, string> {
  const data = detail.propertyData ?? {};
  return {
    ...emptyForm,
    societyName: detail.societyName,
    propertyAddress: detail.propertyAddress,
    locality: detail.locality,
    city: detail.city,
    pinCode: detail.pinCode,
    contactPerson: detail.contactPerson,
    contactEmail: detail.contactEmail,
    contactPhone: detail.contactPhone,
    ...Object.fromEntries(
      [...technicalFields, ...regulatoryFields].map(([key]) => [
        key,
        data[key] == null ? "" : String(data[key]),
      ]),
    ),
  };
}

function payload(form: Record<string, string>, unknownFields: string[]) {
  const nullableNumber = (key: string) =>
    form[key] ? Number(form[key]) : null;
  const nullableText = (key: string) => form[key].trim() || null;
  return {
    societyName: form.societyName,
    propertyAddress: form.propertyAddress,
    locality: form.locality,
    city: form.city,
    pinCode: form.pinCode,
    contactPerson: form.contactPerson,
    contactEmail: form.contactEmail,
    contactPhone: form.contactPhone,
    propertyData: {
      plotArea: nullableText("plotArea"),
      numberBuildings: nullableNumber("numberBuildings"),
      numberWings: nullableNumber("numberWings"),
      existingFloors: nullableText("existingFloors"),
      residentialUnits: nullableNumber("residentialUnits"),
      commercialUnits: nullableNumber("commercialUnits"),
      existingBuiltUpInformation: nullableText("existingBuiltUpInformation"),
      approximateBuildingAge: nullableNumber("approximateBuildingAge"),
      existingParking: nullableText("existingParking"),
      existingAmenities: nullableText("existingAmenities"),
      ctsSurveyInformation: nullableText("ctsSurveyInformation"),
      existingApprovedPlans: nullableText("existingApprovedPlans"),
      propertyCardInformation: nullableText("propertyCardInformation"),
      conveyanceInformation: nullableText("conveyanceInformation"),
      existingFsiInformation: nullableText("existingFsiInformation"),
      roadWidth: nullableText("roadWidth"),
      reservationsRestrictions: nullableText("reservationsRestrictions"),
      otherPropertyInformation: nullableText("otherPropertyInformation"),
      unknownFields,
    },
  };
}

export function SocietyFeasibility() {
  const [items, setItems] = useState<Summary[]>([]);
  const [active, setActive] = useState<Detail | null>(null);
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [unknownFields, setUnknownFields] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploadsEnabled, setUploadsEnabled] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await requestApi<{
        requests: Summary[];
        documentUploadsEnabled: boolean;
      }>("/feasibility/me");
      setItems(result.requests);
      setUploadsEnabled(result.documentUploadsEnabled);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load feasibility requests.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function open(id: string) {
    setBusy(true);
    setError("");
    try {
      const result = await requestApi<{ request: Detail }>(
        `/feasibility/${id}`,
      );
      setActive(result.request);
      setForm(toForm(result.request));
      setUnknownFields(
        Array.isArray(result.request.propertyData?.unknownFields)
          ? (result.request.propertyData?.unknownFields as string[])
          : [],
      );
      setUploadsEnabled(result.request.documentUploadsEnabled);
      setStep(1);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to open this request.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function begin() {
    setActive(null);
    setForm(emptyForm);
    setUnknownFields([]);
    setStep(1);
    setError("");
    setNotice("");
    try {
      const result = await requestApi<{
        profile: Record<string, unknown> | null;
      }>("/feasibility-context/society");
      const profile = result.profile;
      if (profile)
        setForm((current) => ({
          ...current,
          ...Object.fromEntries(
            Object.entries(profile).map(([key, value]) => [
              key,
              value == null ? "" : String(value),
            ]),
          ),
        }));
    } catch {
      /* Profile prefill is optional. */
    }
  }

  const setField = (name: string, value: string) =>
    setForm((current) => ({ ...current, [name]: value }));
  const toggleUnknown = (name: string, checked: boolean) => {
    setUnknownFields((current) =>
      checked
        ? [...new Set([...current, name])]
        : current.filter((item) => item !== name),
    );
    if (checked) setField(name, "");
  };

  async function save(submit: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await requestApi<{ request: Detail }>(
        active ? `/feasibility/${active.id}` : "/feasibility",
        {
          method: active ? "PUT" : "POST",
          body: JSON.stringify(payload(form, unknownFields)),
        },
      );
      let saved = result.request;
      if (submit)
        saved = (
          await requestApi<{ request: Detail }>(
            `/feasibility/${saved.id}/submit`,
            { method: "POST", body: "{}" },
          )
        ).request;
      setActive(saved);
      setForm(toForm(saved));
      setNotice(
        submit
          ? "Submitted for a professional feasibility review."
          : "Draft saved privately.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save this request.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return setError("Save the draft before uploading documents.");
    const data = new FormData(event.currentTarget);
    const file = data.get("document");
    const category = String(data.get("category") ?? "OTHER");
    if (!(file instanceof File) || !file.size)
      return setError("Choose a document first.");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/feasibility/${active.id}/documents?fileName=${encodeURIComponent(file.name)}&category=${encodeURIComponent(category)}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": file.type },
          body: file,
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.error || "Unable to upload document.");
      await open(active.id);
      setStep(4);
      setNotice("Document uploaded securely.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to upload document.",
      );
    } finally {
      setBusy(false);
    }
  }

  const editable =
    !active ||
    active.status === "DRAFT" ||
    active.status === "MORE_INFORMATION_REQUIRED";
  const stepNames = [
    "Society details",
    "Existing property",
    "Property / regulatory",
    "Documents",
    "Review & submit",
  ];
  const fieldsForReview = useMemo(
    () => Object.entries(form).filter(([, value]) => value),
    [form],
  );

  return (
    <section
      className="live-panel feasibility-workspace"
      id="get-your-society-feasibility"
    >
      <div className="live-panel-intro">
        <span>My Feasibility</span>
        <h2>Get Your Society Feasibility</h2>
        <p>
          Understand the redevelopment potential of your society before taking
          the next step. RENOVA structures the information for professional
          review; it does not generate unverified regulatory or financial
          conclusions.
        </p>
      </div>
      <div className="feasibility-list-header">
        <strong>Your requests</strong>
        <button type="button" onClick={() => void begin()}>
          New feasibility request
        </button>
      </div>
      {loading && <p className="live-muted">Loading feasibility requests…</p>}
      {!loading && !items.length && !active && (
        <p className="live-muted">
          No feasibility request has been started yet.
        </p>
      )}
      <div className="feasibility-summary-list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={active?.id === item.id ? "active" : ""}
            onClick={() => void open(item.id)}
          >
            <span>{item.reference}</span>
            <strong>{item.societyName}</strong>
            <small>
              {statusLabel[item.status]} · {item.locality}, {item.city}
            </small>
          </button>
        ))}
      </div>

      {(active || !items.length || Object.values(form).some(Boolean)) && (
        <div className="feasibility-editor">
          {active && (
            <div className="feasibility-status">
              <span>{active.reference}</span>
              <strong>{statusLabel[active.status]}</strong>
            </div>
          )}
          {active?.missingInformation && (
            <div className="feasibility-warning">
              <strong>
                Additional information is required to complete this assessment.
              </strong>
              <p>{active.missingInformation}</p>
            </div>
          )}
          <ol className="feasibility-steps">
            {stepNames.map((name, index) => (
              <li
                key={name}
                className={
                  step === index + 1
                    ? "active"
                    : step > index + 1
                      ? "complete"
                      : ""
                }
              >
                <button type="button" onClick={() => setStep(index + 1)}>
                  <span>{index + 1}</span>
                  {name}
                </button>
              </li>
            ))}
          </ol>
          {editable ? (
            <>
              {step === 1 && (
                <div className="live-form">
                  <div className="live-field-row">
                    <InputField
                      label="Society name"
                      name="societyName"
                      value={form.societyName}
                      onChange={setField}
                      required
                    />
                    <InputField
                      label="Locality"
                      name="locality"
                      value={form.locality}
                      onChange={setField}
                      required
                    />
                  </div>
                  <TextField
                    label="Property address"
                    name="propertyAddress"
                    value={form.propertyAddress}
                    onChange={setField}
                  />
                  <div className="live-field-row">
                    <InputField
                      label="City"
                      name="city"
                      value={form.city}
                      onChange={setField}
                      required
                    />
                    <InputField
                      label="PIN code"
                      name="pinCode"
                      value={form.pinCode}
                      onChange={setField}
                      required
                    />
                  </div>
                  <div className="live-field-row">
                    <InputField
                      label="Contact person"
                      name="contactPerson"
                      value={form.contactPerson}
                      onChange={setField}
                      required
                    />
                    <InputField
                      label="Email"
                      name="contactEmail"
                      value={form.contactEmail}
                      onChange={setField}
                      type="email"
                      required
                    />
                  </div>
                  <InputField
                    label="Phone"
                    name="contactPhone"
                    value={form.contactPhone}
                    onChange={setField}
                    required
                  />
                </div>
              )}
              {step === 2 && (
                <div className="feasibility-fields">
                  {technicalFields.map(([name, label]) => (
                    <div key={name}>
                      <InputField
                        label={label}
                        name={name}
                        value={form[name]}
                        onChange={setField}
                        type={
                          [
                            "numberBuildings",
                            "numberWings",
                            "residentialUnits",
                            "commercialUnits",
                            "approximateBuildingAge",
                          ].includes(name)
                            ? "number"
                            : "text"
                        }
                        disabled={unknownFields.includes(name)}
                      />
                      <label className="live-check">
                        <input
                          type="checkbox"
                          checked={unknownFields.includes(name)}
                          onChange={(event) =>
                            toggleUnknown(name, event.target.checked)
                          }
                        />
                        <span>I don&apos;t know</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
              {step === 3 && (
                <div className="feasibility-fields">
                  {regulatoryFields.map(([name, label]) => (
                    <div key={name}>
                      <TextField
                        label={label}
                        name={name}
                        value={form[name]}
                        onChange={setField}
                        disabled={unknownFields.includes(name)}
                      />
                      <label className="live-check">
                        <input
                          type="checkbox"
                          checked={unknownFields.includes(name)}
                          onChange={(event) =>
                            toggleUnknown(name, event.target.checked)
                          }
                        />
                        <span>I don&apos;t know</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
              {step === 4 && (
                <div className="feasibility-upload">
                  <p>
                    Optional documents such as approved plans, a property card,
                    conveyance records or survey material can help an authorized
                    reviewer understand the property. They remain private to
                    your Society and authorized RENOVA reviewers.
                  </p>
                  {uploadsEnabled ? (
                    <form onSubmit={uploadDocument}>
                      <label className="live-field">
                        <span>Document type</span>
                        <select name="category">
                          <option value="PROPERTY_CARD">Property card</option>
                          <option value="APPROVED_PLAN">Approved plan</option>
                          <option value="CONVEYANCE">Conveyance</option>
                          <option value="CTS_SURVEY">
                            CTS / survey record
                          </option>
                          <option value="OTHER">Other property document</option>
                        </select>
                      </label>
                      <label className="live-field">
                        <span>PDF, JPG or PNG · maximum 10 MB</span>
                        <input
                          type="file"
                          name="document"
                          accept="application/pdf,image/jpeg,image/png"
                        />
                      </label>
                      <button
                        className="live-primary"
                        type="submit"
                        disabled={busy || !active}
                      >
                        <Upload size={16} /> Upload securely
                      </button>
                      {!active && (
                        <small>Save the draft once before uploading.</small>
                      )}
                    </form>
                  ) : (
                    <div className="feasibility-storage-note">
                      <FileText size={20} />
                      <p>
                        Secure document storage is not configured in this
                        environment yet. You can submit the request without
                        documents; document upload will remain unavailable until
                        an approved private store is connected.
                      </p>
                    </div>
                  )}
                  <div>
                    {active?.documents.map((document) => (
                      <a
                        key={document.id}
                        href={`/api/feasibility/${active.id}/documents/${document.id}`}
                      >
                        <FileText size={15} /> {document.fileName} ·{" "}
                        {Math.ceil(document.sizeBytes / 1024)} KB
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {step === 5 && (
                <div className="feasibility-review">
                  <p>
                    Review the information below. Unknown or optional fields may
                    remain blank.
                  </p>
                  {fieldsForReview.map(([key, value]) => (
                    <div key={key}>
                      <span>{key.replace(/([A-Z])/g, " $1")}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                  {unknownFields.length > 0 && (
                    <div>
                      <span>Marked “I don&apos;t know”</span>
                      <strong>{unknownFields.join(", ")}</strong>
                    </div>
                  )}
                  <div className="feasibility-guardrail">
                    <strong>Professional review required</strong>
                    <p>
                      RENOVA will not invent FSI, TDR, permissible height, rehab
                      or sale area, cost, corpus, rent, entitlement, profit,
                      project value, premiums, or regulatory eligibility.
                    </p>
                  </div>
                </div>
              )}
              <div className="feasibility-actions">
                <button
                  type="button"
                  disabled={step === 1}
                  onClick={() => setStep((current) => Math.max(1, current - 1))}
                >
                  Back
                </button>
                {step < 5 ? (
                  <button
                    type="button"
                    className="live-primary"
                    onClick={() =>
                      setStep((current) => Math.min(5, current + 1))
                    }
                  >
                    Continue <ArrowRight size={16} />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void save(false)}
                    >
                      Save draft
                    </button>
                    <button
                      type="button"
                      className="live-primary"
                      disabled={busy}
                      onClick={() => void save(true)}
                    >
                      {busy ? "Submitting…" : "SUBMIT FOR FEASIBILITY"}
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="feasibility-readonly">
              <p>
                This request is read-only while it is under professional review.
              </p>
            </div>
          )}

          {error && (
            <p className="live-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="live-success" role="status">
              <CheckCircle2 size={16} /> {notice}
            </p>
          )}
          {active && (
            <div className="feasibility-timeline">
              <h3>Status timeline</h3>
              {active.history.map((item) => (
                <article key={item.id}>
                  <i />
                  <div>
                    <strong>{statusLabel[item.toStatus]}</strong>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                    {item.note && <p>{item.note}</p>}
                  </div>
                </article>
              ))}
            </div>
          )}
          {active?.assessment && (
            <div className="feasibility-assessment">
              <span>Published professional assessment</span>
              <h3>Feasibility assessment</h3>
              {Object.entries(active.assessment).map(([key, value]) =>
                !value ||
                [
                  "id",
                  "requestId",
                  "preparedByUserId",
                  "createdAt",
                  "updatedAt",
                  "publishedAt",
                ].includes(key) ? null : (
                  <article key={key}>
                    <strong>{key.replace(/([A-Z])/g, " $1")}</strong>
                    <p>{Array.isArray(value) ? value.join(" · ") : value}</p>
                  </article>
                ),
              )}
              <Link href="/dashboard/society#redevelopment-opportunity">
                Create Redevelopment Opportunity <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const assessmentFields = [
  "existingProperty",
  "plotInformation",
  "existingBuiltUpArea",
  "applicablePlanningInputs",
  "potentialDevelopmentInputs",
  "rehabilitationRequirement",
  "potentialSaleComponent",
  "parkingAmenityConsiderations",
  "keyConstraints",
  "professionalNotes",
];

export function AdminFeasibility() {
  const [items, setItems] = useState<Summary[]>([]);
  const [active, setActive] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setItems(
        (await requestApi<{ requests: Summary[] }>("/admin/feasibility"))
          .requests,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load feasibility requests.",
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function open(id: string) {
    setBusy(true);
    try {
      setActive(
        (await requestApi<{ request: Detail }>(`/admin/feasibility/${id}`))
          .request,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to open request.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      setActive(
        (
          await requestApi<{ request: Detail }>(
            `/admin/feasibility/${active.id}/status`,
            {
              method: "PATCH",
              body: JSON.stringify({
                status: data.get("status"),
                note: data.get("note") || null,
                missingInformation: data.get("missingInformation") || null,
              }),
            },
          )
        ).request,
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update status.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    const data = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      assessmentFields.map((field) => [field, data.get(field) || null]),
    );
    setBusy(true);
    try {
      setActive(
        (
          await requestApi<{ request: Detail }>(
            `/admin/feasibility/${active.id}/assessment`,
            {
              method: "PUT",
              body: JSON.stringify({
                ...body,
                assumptions: String(data.get("assumptions") || "")
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean),
                documentsReviewed: active.documents.map((item) => item.id),
                assessmentDate: new Date().toISOString(),
              }),
            },
          )
        ).request,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save assessment.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!active) return;
    setBusy(true);
    try {
      setActive(
        (
          await requestApi<{ request: Detail }>(
            `/admin/feasibility/${active.id}/publish`,
            { method: "POST", body: "{}" },
          )
        ).request,
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to publish assessment.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="live-panel feasibility-admin">
      <div className="live-panel-intro">
        <span>Authorized review</span>
        <h2>Society feasibility requests</h2>
        <p>
          Review factual property information, request missing information and
          record a professional assessment. The system does not calculate or
          infer conclusions.
        </p>
      </div>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      <div className="feasibility-admin-grid">
        <div>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void open(item.id)}
            >
              <small>
                {item.reference} · {statusLabel[item.status]}
              </small>
              <strong>{item.societyName}</strong>
              <span>
                {item.locality}, {item.city}
              </span>
            </button>
          ))}
        </div>
        {active && (
          <div>
            <div className="feasibility-status">
              <span>{active.reference}</span>
              <strong>{statusLabel[active.status]}</strong>
            </div>
            <h3>{active.societyName}</h3>
            <p>
              {active.propertyAddress}, {active.locality}, {active.city}{" "}
              {active.pinCode}
            </p>
            <form className="live-form" onSubmit={changeStatus}>
              <label className="live-field">
                <span>Status</span>
                <select name="status" defaultValue={active.status}>
                  <option value="IN_REVIEW">In review</option>
                  <option value="MORE_INFORMATION_REQUIRED">
                    More information required
                  </option>
                  <option value="CLOSED">Closed</option>
                </select>
              </label>
              <label className="live-field">
                <span>Information required (mandatory for that status)</span>
                <textarea
                  name="missingInformation"
                  rows={3}
                  defaultValue={active.missingInformation ?? ""}
                />
              </label>
              <label className="live-field">
                <span>Review note</span>
                <textarea name="note" rows={2} />
              </label>
              <button className="live-primary" disabled={busy}>
                Update status
              </button>
            </form>
            <form
              className="live-form feasibility-assessment-form"
              onSubmit={saveAssessment}
            >
              {assessmentFields.map((field) => (
                <label className="live-field" key={field}>
                  <span>{field.replace(/([A-Z])/g, " $1")}</span>
                  <textarea
                    name={field}
                    rows={2}
                    defaultValue={String(active.assessment?.[field] ?? "")}
                  />
                </label>
              ))}
              <label className="live-field">
                <span>Assumptions · one per line</span>
                <textarea
                  name="assumptions"
                  rows={4}
                  defaultValue={(active.assessment?.assumptions ?? []).join(
                    "\n",
                  )}
                />
              </label>
              <button disabled={busy}>
                Save professional assessment draft
              </button>
              <button
                type="button"
                className="live-primary"
                disabled={busy || active.status !== "IN_REVIEW"}
                onClick={() => void publish()}
              >
                Publish assessment to Society
              </button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
