import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  LoaderCircle,
  LogOut,
  MapPin,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import "./live-workspace.css";
import { AdminFeasibility, SocietyFeasibility } from "./FeasibilityWorkspace";

type Role = "SOCIETY" | "DEVELOPER" | "PMC" | "PROFESSIONAL" | "ADMIN";
type Account = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  organizationId: string | null;
  dashboardPath?: string;
};
type ParticipantType =
  | "SOCIETY"
  | "DEVELOPER"
  | "PMC"
  | "ADVOCATE_LEGAL"
  | "ARCHITECT"
  | "STRUCTURAL_CONSULTANT"
  | "VALUATION_FINANCE"
  | "OTHER_PROFESSIONAL";
const participantOptions: Array<{
  value: ParticipantType;
  title: string;
  detail: string;
}> = [
  {
    value: "SOCIETY",
    title: "Society / Property Owner",
    detail:
      "Structure your property, feasibility and redevelopment opportunity.",
  },
  {
    value: "DEVELOPER",
    title: "Developer",
    detail:
      "Build a company profile and discover published society opportunities.",
  },
  {
    value: "PMC",
    title: "PMC",
    detail:
      "Present PMC services and discover society opportunities in a dedicated workspace.",
  },
  {
    value: "ADVOCATE_LEGAL",
    title: "Advocate / Legal Professional",
    detail: "Create a professional workspace for redevelopment legal services.",
  },
  {
    value: "ARCHITECT",
    title: "Architect",
    detail:
      "Create a professional workspace for planning and design expertise.",
  },
  {
    value: "STRUCTURAL_CONSULTANT",
    title: "Structural Consultant",
    detail: "Create a professional workspace for structural review services.",
  },
  {
    value: "VALUATION_FINANCE",
    title: "Financial / Valuation Professional",
    detail:
      "Create a professional workspace for valuation and financial expertise.",
  },
  {
    value: "OTHER_PROFESSIONAL",
    title: "Other Redevelopment Professional",
    detail: "Join through the extensible professional workspace.",
  },
];
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
  interestStatus?: string | null;
  society?: Record<string, unknown> | null;
};
type Interest = {
  id: string;
  opportunityTitle: string;
  organizationName: string;
  message: string | null;
  reviewStatus: string;
  organizationId?: string;
  role?: string;
  organizationLocation?: string | null;
  opportunityId?: string;
  location?: string;
  createdAt: string;
};
type Completion = { completed: number; total: number; percent: number };
type PortfolioEntry = {
  title: string;
  location?: string | null;
  description?: string | null;
  completionYear?: number | null;
  projectType?: string | null;
};
type Credential = {
  name: string;
  issuer?: string | null;
  reference?: string | null;
  isPublic?: boolean;
};
type Profile = Record<string, unknown> & {
  role: Role;
  organizationName: string;
  location?: string | null;
  portfolio?: PortfolioEntry[];
  credentials?: Credential[];
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
  source: string;
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
  const [, navigate] = useLocation();
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
  const [participantType, setParticipantType] =
    useState<ParticipantType>("SOCIETY");
  const [registrationStep, setRegistrationStep] = useState<1 | 2>(1);
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
        if (result.user.dashboardPath)
          navigate(result.user.dashboardPath, { replace: true });
      } else if (mode === "register") {
        const result = await api<{ message: string }>("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email: form.get("email"),
            password: form.get("password"),
            displayName: form.get("displayName"),
            participantType,
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
            setRegistrationStep(1);
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
            <fieldset className="live-role-picker">
              <legend>How will you use RENOVA?</legend>
              <div>
                {participantOptions.map((option) => (
                  <label
                    key={option.value}
                    className={
                      participantType === option.value ? "selected" : ""
                    }
                  >
                    <input
                      type="radio"
                      name="participantType"
                      value={option.value}
                      checked={participantType === option.value}
                      onChange={() => setParticipantType(option.value)}
                    />
                    <strong>{option.title}</strong>
                    <span>{option.detail}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {registrationStep === 2 && (
              <>
                <p className="live-registration-gate">
                  Public registration is currently closed. This flow is ready
                  for controlled beta access after approval.
                </p>
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
          </>
        )}
        {mode !== "reset" &&
          mode !== "verify" &&
          (mode !== "register" || registrationStep === 2) && (
            <Field label="Email address">
              <input name="email" type="email" required autoComplete="email" />
            </Field>
          )}
        {((mode === "register" && registrationStep === 2) ||
          mode === "login" ||
          mode === "reset") && (
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
        {mode === "register" && registrationStep === 1 ? (
          <button
            className="live-primary"
            type="button"
            onClick={() => setRegistrationStep(2)}
          >
            Continue with{" "}
            {
              participantOptions.find(
                (option) => option.value === participantType,
              )?.title
            }{" "}
            <ArrowRight size={17} />
          </button>
        ) : (
          mode !== "verify" && (
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
          )
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

function listValue(value: unknown): string {
  return Array.isArray(value) ? value.join(", ") : "";
}

function parseList(value: FormDataEntryValue | null): string[] {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function nullableNumber(value: FormDataEntryValue | null): number | null {
  return value === null || value === "" ? null : Number(value);
}

function ProfileEditor({ role }: { role: "SOCIETY" | "DEVELOPER" | "PMC" }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioEntry[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void api<{ profile: Profile; completion: Completion }>("/profiles/me")
      .then((result) => {
        setProfile(result.profile);
        setCompletion(result.completion);
        setPortfolio(result.profile.portfolio ?? []);
        setCredentials(result.profile.credentials ?? []);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load your profile.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  function updatePortfolio(
    index: number,
    field: keyof PortfolioEntry,
    value: string,
  ) {
    setPortfolio((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]:
                field === "completionYear"
                  ? value
                    ? Number(value)
                    : null
                  : value,
            }
          : item,
      ),
    );
  }

  function updateCredential(
    index: number,
    field: keyof Credential,
    value: string | boolean,
  ) {
    setCredentials((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const common = {
      organizationName: form.get("organizationName"),
      location: form.get("location") || null,
      marketplaceVisible: form.get("marketplaceVisible") === "on",
    };
    const payload =
      role === "SOCIETY"
        ? {
            ...common,
            address: form.get("address") || null,
            city: form.get("city") || "Mumbai",
            contactName: form.get("contactName") || null,
            contactEmail: form.get("contactEmail") || null,
            contactPhone: form.get("contactPhone") || null,
            numberBuildings: nullableNumber(form.get("numberBuildings")),
            numberWings: nullableNumber(form.get("numberWings")),
            unitCount: nullableNumber(form.get("unitCount")),
            memberCount: nullableNumber(form.get("memberCount")),
            buildingAge: nullableNumber(form.get("buildingAge")),
            propertyType: form.get("propertyType") || null,
            landArea: form.get("landArea") || null,
            redevelopmentStatus: form.get("redevelopmentStatus") || null,
            description: form.get("description") || null,
          }
        : {
            ...common,
            logoUrl: form.get("logoUrl") || null,
            description: form.get("description") || null,
            website: form.get("website") || null,
            publicEmail: form.get("publicEmail") || null,
            publicPhone: form.get("publicPhone") || null,
            officeLocation: form.get("officeLocation") || null,
            specializations: parseList(form.get("specializations")),
            teamInformation: form.get("teamInformation") || null,
            portfolio: portfolio.filter((item) => item.title.trim()),
            credentials: credentials.filter((item) => item.name.trim()),
            ...(role === "DEVELOPER"
              ? { areasServed: parseList(form.get("areasServed")) }
              : {
                  locationsServed: parseList(form.get("locationsServed")),
                  services: parseList(form.get("services")),
                }),
          };
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ profile: Profile; completion: Completion }>(
        "/profiles/me",
        { method: "PUT", body: JSON.stringify(payload) },
      );
      setProfile(result.profile);
      setCompletion(result.completion);
      setNotice("Profile draft saved.");
      setPreview(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save your profile.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function showPreview() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ profile: Record<string, unknown> | null }>(
        "/profiles/me/preview",
      );
      if (result.profile) setPreview(result.profile);
      else
        setNotice(
          "Marketplace visibility is off. Enable it and save before previewing public fields.",
        );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to preview your profile.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <section className="live-panel">
        <p className="live-muted">Loading your profile…</p>
      </section>
    );
  if (!profile)
    return (
      <section className="live-panel">
        <p role="alert" className="live-error">
          {error || "Profile not found."}
        </p>
      </section>
    );

  return (
    <section
      className="live-panel live-profile-panel"
      id={
        role === "SOCIETY"
          ? "my-society"
          : role === "PMC"
            ? "pmc-profile"
            : "company-profile"
      }
    >
      <div className="live-panel-intro">
        <span>{role.toLowerCase()} profile</span>
        <h2>Complete your factual organization profile</h2>
        <p>
          Save a draft at any time. Only fields in Preview are visible to
          permitted marketplace participants.
        </p>
      </div>
      <div className="live-completion">
        <div>
          <strong>{completion?.percent ?? 0}% complete</strong>
          <span>
            {completion?.completed ?? 0} of {completion?.total ?? 0} core fields
          </span>
        </div>
        <i>
          <span style={{ width: `${completion?.percent ?? 0}%` }} />
        </i>
      </div>
      <form
        className="live-form"
        onSubmit={save}
        key={`${role}-${profile.organizationName}`}
      >
        <div className="live-field-row">
          <Field
            label={role === "SOCIETY" ? "Society name" : "Organization name"}
          >
            <input
              name="organizationName"
              required
              minLength={2}
              maxLength={220}
              defaultValue={profile.organizationName}
            />
          </Field>
          <Field label="Primary location">
            <input
              name="location"
              maxLength={160}
              defaultValue={String(profile.location ?? "")}
            />
          </Field>
        </div>
        {role === "SOCIETY" ? (
          <>
            <Field label="Address (private)">
              <textarea
                name="address"
                rows={2}
                maxLength={1000}
                defaultValue={String(profile.address ?? "")}
              />
            </Field>
            <div className="live-field-row">
              <Field label="City">
                <input
                  name="city"
                  required
                  defaultValue={String(profile.city ?? "Mumbai")}
                />
              </Field>
              <Field label="Redevelopment status">
                <input
                  name="redevelopmentStatus"
                  defaultValue={String(profile.redevelopmentStatus ?? "")}
                  placeholder="Exploring / committee review"
                />
              </Field>
            </div>
            <div className="live-field-row">
              <Field label="Contact name (private)">
                <input
                  name="contactName"
                  defaultValue={String(profile.contactName ?? "")}
                />
              </Field>
              <Field label="Contact email (private)">
                <input
                  name="contactEmail"
                  type="email"
                  defaultValue={String(profile.contactEmail ?? "")}
                />
              </Field>
            </div>
            <Field label="Contact phone (private)">
              <input
                name="contactPhone"
                defaultValue={String(profile.contactPhone ?? "")}
              />
            </Field>
            <div className="live-field-row">
              <Field label="Buildings">
                <input
                  name="numberBuildings"
                  type="number"
                  min={1}
                  defaultValue={String(profile.numberBuildings ?? "")}
                />
              </Field>
              <Field label="Wings">
                <input
                  name="numberWings"
                  type="number"
                  min={1}
                  defaultValue={String(profile.numberWings ?? "")}
                />
              </Field>
            </div>
            <div className="live-field-row">
              <Field label="Units">
                <input
                  name="unitCount"
                  type="number"
                  min={1}
                  defaultValue={String(profile.unitCount ?? "")}
                />
              </Field>
              <Field label="Members">
                <input
                  name="memberCount"
                  type="number"
                  min={1}
                  defaultValue={String(profile.memberCount ?? "")}
                />
              </Field>
            </div>
            <div className="live-field-row">
              <Field label="Building age">
                <input
                  name="buildingAge"
                  type="number"
                  min={0}
                  defaultValue={String(profile.buildingAge ?? "")}
                />
              </Field>
              <Field label="Property type">
                <input
                  name="propertyType"
                  defaultValue={String(profile.propertyType ?? "")}
                />
              </Field>
            </div>
            <Field label="Land / site area">
              <input
                name="landArea"
                defaultValue={String(profile.landArea ?? "")}
              />
            </Field>
          </>
        ) : (
          <>
            <div className="live-field-row">
              <Field label="Website">
                <input
                  name="website"
                  type="url"
                  defaultValue={String(profile.website ?? "")}
                />
              </Field>
              <Field label="Logo URL">
                <input
                  name="logoUrl"
                  type="url"
                  defaultValue={String(profile.logoUrl ?? "")}
                />
              </Field>
            </div>
            <div className="live-field-row">
              <Field label="Public contact email">
                <input
                  name="publicEmail"
                  type="email"
                  defaultValue={String(profile.publicEmail ?? "")}
                />
              </Field>
              <Field label="Public contact phone">
                <input
                  name="publicPhone"
                  defaultValue={String(profile.publicPhone ?? "")}
                />
              </Field>
            </div>
            <Field label="Office location">
              <input
                name="officeLocation"
                defaultValue={String(profile.officeLocation ?? "")}
              />
            </Field>
            {role === "DEVELOPER" ? (
              <Field label="Areas served (comma separated)">
                <input
                  name="areasServed"
                  defaultValue={listValue(profile.areasServed)}
                />
              </Field>
            ) : (
              <>
                <Field label="Locations served (comma separated)">
                  <input
                    name="locationsServed"
                    defaultValue={listValue(profile.locationsServed)}
                  />
                </Field>
                <Field label="Services (comma separated)">
                  <input
                    name="services"
                    defaultValue={listValue(profile.services)}
                  />
                </Field>
              </>
            )}
            <Field label="Specializations (comma separated)">
              <input
                name="specializations"
                defaultValue={listValue(profile.specializations)}
              />
            </Field>
            <Field label="Team / company information">
              <textarea
                name="teamInformation"
                rows={3}
                defaultValue={String(profile.teamInformation ?? "")}
              />
            </Field>
            <div className="live-nested-heading">
              <div>
                <strong>Project portfolio</strong>
                <span>Factual entries supplied by your organization</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setPortfolio((items) => [...items, { title: "" }])
                }
              >
                <Plus size={15} /> Add project
              </button>
            </div>
            {portfolio.map((item, index) => (
              <div className="live-nested-card" key={`portfolio-${index}`}>
                <div className="live-field-row">
                  <Field label="Project title">
                    <input
                      value={item.title}
                      onChange={(event) =>
                        updatePortfolio(index, "title", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Location">
                    <input
                      value={item.location ?? ""}
                      onChange={(event) =>
                        updatePortfolio(index, "location", event.target.value)
                      }
                    />
                  </Field>
                </div>
                <Field label="Description">
                  <textarea
                    rows={2}
                    value={item.description ?? ""}
                    onChange={(event) =>
                      updatePortfolio(index, "description", event.target.value)
                    }
                  />
                </Field>
                <button
                  type="button"
                  className="live-remove"
                  onClick={() =>
                    setPortfolio((items) =>
                      items.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            ))}
            <div className="live-nested-heading">
              <div>
                <strong>Credentials</strong>
                <span>Choose explicitly which entries may be public</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCredentials((items) => [
                    ...items,
                    { name: "", isPublic: false },
                  ])
                }
              >
                <Plus size={15} /> Add credential
              </button>
            </div>
            {credentials.map((item, index) => (
              <div className="live-nested-card" key={`credential-${index}`}>
                <div className="live-field-row">
                  <Field label="Credential name">
                    <input
                      value={item.name}
                      onChange={(event) =>
                        updateCredential(index, "name", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Issuer">
                    <input
                      value={item.issuer ?? ""}
                      onChange={(event) =>
                        updateCredential(index, "issuer", event.target.value)
                      }
                    />
                  </Field>
                </div>
                <label className="live-check">
                  <input
                    type="checkbox"
                    checked={Boolean(item.isPublic)}
                    onChange={(event) =>
                      updateCredential(index, "isPublic", event.target.checked)
                    }
                  />
                  <span>Show this credential in marketplace preview</span>
                </label>
                <button
                  type="button"
                  className="live-remove"
                  onClick={() =>
                    setCredentials((items) =>
                      items.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            ))}
          </>
        )}
        <Field
          label={
            role === "SOCIETY"
              ? "Property / society description"
              : "Organization description"
          }
        >
          <textarea
            name="description"
            rows={4}
            maxLength={5000}
            defaultValue={String(profile.description ?? "")}
          />
        </Field>
        <label className="live-check">
          <input
            name="marketplaceVisible"
            type="checkbox"
            defaultChecked={profile.marketplaceVisible !== false}
          />
          <span>Include approved public fields in marketplace views</span>
        </label>
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
        <div className="live-actions">
          <button className="live-primary" disabled={busy} type="submit">
            {busy ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void showPreview()}
          >
            Preview marketplace profile
          </button>
        </div>
      </form>
      {preview && (
        <div className="live-profile-preview">
          <div>
            <UserRound size={20} />
            <strong>Marketplace preview</strong>
            <button type="button" onClick={() => setPreview(null)}>
              Close
            </button>
          </div>
          {Object.entries(preview).map(([key, value]) =>
            value === null ||
            value === "" ||
            (Array.isArray(value) && !value.length) ? null : (
              <p key={key}>
                <span>{key.replace(/([A-Z])/g, " $1")}</span>
                <strong>
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)}
                </strong>
              </p>
            ),
          )}
        </div>
      )}
    </section>
  );
}

function SocietyView() {
  const [interests, setInterests] = useState<Interest[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [profileLoadingId, setProfileLoadingId] = useState<string | null>(null);
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
      await api("/opportunities", {
        method: "POST",
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
      });
      setMessage(
        form.get("publish") === "on"
          ? "Opportunity published. Developers and PMCs can now discover it."
          : "Draft saved privately.",
      );
      formElement.reset();
      void load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save opportunity.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function openOrganizationProfile(interest: Interest) {
    if (!interest.organizationId) return;
    setProfileLoadingId(interest.id);
    setError("");
    try {
      const result = await api<{ profile: Record<string, unknown> }>(
        `/marketplace/organizations/${interest.organizationId}`,
      );
      setSelectedProfile(result.profile);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load organization profile.",
      );
    } finally {
      setProfileLoadingId(null);
    }
  }

  async function updateInterest(interestId: string, status: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/societies/me/interests/${interestId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update interest.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <RoleNavigation
        items={[
          "Overview",
          "My Society",
          "Get Your Society Feasibility",
          "Redevelopment Opportunity",
          "Developer & PMC Discovery",
          "Received Interests",
          "Documents",
          "Settings",
        ]}
      />
      <ProfileEditor role="SOCIETY" />
      <SocietyFeasibility />
      <div className="live-metrics">
        <article>
          <span>Opportunities</span>
          <strong>{opportunities.length}</strong>
        </article>
        <article>
          <span>Published</span>
          <strong>
            {opportunities.filter((item) => item.status === "PUBLISHED").length}
          </strong>
        </article>
        <article>
          <span>Incoming interests</span>
          <strong>{interests.length}</strong>
        </article>
      </div>
      <div className="live-grid">
        <section className="live-panel" id="redevelopment-opportunity">
          <div className="live-panel-intro">
            <span>Society workspace</span>
            <h2>Create a redevelopment opportunity</h2>
            <p>
              Share a clear, factual brief. Publishing makes these details
              visible to developers and PMCs.
            </p>
          </div>
          <form className="live-form" onSubmit={create}>
            <Field label="Opportunity title">
              <input
                name="title"
                required
                minLength={3}
                maxLength={220}
                placeholder="ABC CHS redevelopment"
              />
            </Field>
            <Field label="Location">
              <input
                name="location"
                required
                minLength={2}
                maxLength={180}
                placeholder="Andheri West, Mumbai"
              />
            </Field>
            <Field label="Description">
              <textarea
                name="description"
                required
                minLength={20}
                maxLength={5000}
                rows={5}
                placeholder="Describe the property, current stage and what your society is seeking."
              />
            </Field>
            <div className="live-field-row">
              <Field label="Number of members">
                <input name="memberCount" type="number" min={1} max={100000} />
              </Field>
              <Field label="Building age (years)">
                <input name="buildingAge" type="number" min={0} max={200} />
              </Field>
            </div>
            <Field label="Approximate site area">
              <input
                name="siteArea"
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
          </form>
        </section>
        <div className="live-aside">
          <section className="live-panel">
            <div className="live-panel-intro">
              <span>Your opportunities</span>
              <h2>Society briefs</h2>
              <p>
                Drafts are private. Published briefs are available for
                discovery.
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
                <h3>
                  {interest.organizationName} · {interest.role}
                </h3>
                {interest.organizationLocation && (
                  <span>
                    <MapPin size={14} /> {interest.organizationLocation}
                  </span>
                )}
                <p>{interest.message || "No message provided."}</p>
                <span>
                  {interest.reviewStatus} ·{" "}
                  {new Date(interest.createdAt).toLocaleDateString()}
                </span>
                <div className="live-card-actions">
                  <button
                    type="button"
                    disabled={profileLoadingId === interest.id}
                    onClick={() => void openOrganizationProfile(interest)}
                  >
                    {profileLoadingId === interest.id
                      ? "Loading…"
                      : "View profile"}
                  </button>
                  <select
                    aria-label={`Review status for ${interest.organizationName}`}
                    value={interest.reviewStatus}
                    disabled={busy}
                    onChange={(event) =>
                      void updateInterest(interest.id, event.target.value)
                    }
                  >
                    <option value="RECEIVED">Received</option>
                    <option value="REVIEWING">Reviewing</option>
                    <option value="SHORTLISTED">Shortlisted</option>
                    <option value="DECLINED">Declined</option>
                  </select>
                </div>
              </article>
            ))}
            {selectedProfile && (
              <div className="live-profile-preview">
                <div>
                  <UserRound size={20} />
                  <strong>Organization profile</strong>
                  <button
                    type="button"
                    onClick={() => setSelectedProfile(null)}
                  >
                    Close
                  </button>
                </div>
                {Object.entries(selectedProfile).map(([key, value]) =>
                  value === null ||
                  value === "" ||
                  (Array.isArray(value) && !value.length) ? null : (
                    <p key={key}>
                      <span>{key.replace(/([A-Z])/g, " $1")}</span>
                      <strong>
                        {typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value)}
                      </strong>
                    </p>
                  ),
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function DiscoveryView({ role }: { role: Role }) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (query = "", place = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (place.trim()) params.set("location", place.trim());
      const [opportunityData, interestData] = await Promise.all([
        api<{ opportunities: Opportunity[] }>(
          `/opportunities${params.size ? `?${params}` : ""}`,
        ),
        api<{ interests: Interest[] }>("/organizations/me/interests"),
      ]);
      setOpportunities(opportunityData.opportunities);
      setInterests(interestData.interests);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load opportunities.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function expressInterest(id: string) {
    setBusyId(id);
    setError("");
    try {
      await api(`/opportunities/${id}/interests`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await load(search, location);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to submit interest.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function openOpportunity(id: string) {
    setBusyId(id);
    setError("");
    try {
      const result = await api<{ opportunity: Opportunity }>(
        `/opportunities/${id}`,
      );
      setSelected(result.opportunity);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to open opportunity.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <ProfileEditor role={role as "DEVELOPER" | "PMC"} />
      <div className="live-metrics">
        <article>
          <span>Available opportunities</span>
          <strong>{opportunities.length}</strong>
        </article>
        <article>
          <span>Interests submitted</span>
          <strong>{interests.length}</strong>
        </article>
        <article>
          <span>Under review / shortlisted</span>
          <strong>
            {
              interests.filter((item) =>
                ["REVIEWING", "SHORTLISTED"].includes(item.reviewStatus),
              ).length
            }
          </strong>
        </article>
      </div>
      <section className="live-panel">
        <div className="live-panel-intro">
          <span>
            {role === "PMC" ? "PMC discovery" : "Developer discovery"}
          </span>
          <h2>Published society opportunities</h2>
          <p>
            Browse factual briefs shared by societies. Express interest to
            request a connection.
          </p>
        </div>
        <form
          className="live-filter-row"
          onSubmit={(event) => {
            event.preventDefault();
            void load(search, location);
          }}
        >
          <Field label="Search opportunities">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Society, project or description"
            />
          </Field>
          <Field label="Location filter">
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="e.g. Andheri"
            />
          </Field>
          <button className="live-primary" type="submit">
            Apply filters
          </button>
        </form>
        {error && (
          <p role="alert" className="live-error">
            {error}
          </p>
        )}
        {loading && <p className="live-muted">Loading opportunities…</p>}
        {!loading && opportunities.length === 0 && (
          <p className="live-muted">
            No published opportunities match your search yet.
          </p>
        )}
        <div className="live-opportunities">
          {opportunities.map((item) => (
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
              <div className="live-card-actions">
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => void openOpportunity(item.id)}
                >
                  View details
                </button>
                <button
                  type="button"
                  disabled={busyId === item.id || Boolean(item.interestStatus)}
                  onClick={() => void expressInterest(item.id)}
                >
                  {item.interestStatus ? (
                    <>
                      <CheckCircle2 size={16} /> {item.interestStatus}
                    </>
                  ) : busyId === item.id ? (
                    "Submitting…"
                  ) : (
                    <>
                      <Send size={16} /> Express interest
                    </>
                  )}
                </button>
              </div>
            </article>
          ))}
        </div>
        {selected && (
          <div className="live-profile-preview">
            <div>
              <Building2 size={20} />
              <strong>{selected.title}</strong>
              <button type="button" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <p>
              <span>Location</span>
              <strong>{selected.location}</strong>
            </p>
            <p>
              <span>Description</span>
              <strong>{selected.description}</strong>
            </p>
            {selected.society &&
              Object.entries(selected.society).map(([key, value]) =>
                value === null || value === "" ? null : (
                  <p key={key}>
                    <span>{key.replace(/([A-Z])/g, " $1")}</span>
                    <strong>{String(value)}</strong>
                  </p>
                ),
              )}
          </div>
        )}
        <div className="live-panel-intro live-section-spacer">
          <span>Your activity</span>
          <h2>Interest tracking</h2>
        </div>
        {!interests.length && !loading && (
          <p className="live-muted">
            You have not expressed interest in an opportunity yet.
          </p>
        )}
        {interests.map((interest) => (
          <article className="live-list-card" key={interest.id}>
            <small>{interest.reviewStatus}</small>
            <h3>{interest.opportunityTitle}</h3>
            <span>
              <MapPin size={14} /> {interest.location}
            </span>
            <p>{interest.message || "No message supplied."}</p>
            <span>
              Submitted {new Date(interest.createdAt).toLocaleDateString()}
            </span>
          </article>
        ))}
      </section>
    </>
  );
}

function RoleNavigation({ items }: { items: string[] }) {
  return (
    <nav className="live-role-navigation" aria-label="Workspace sections">
      {items.map((item) => (
        <a
          key={item}
          href={`#${item.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        >
          {item}
        </a>
      ))}
    </nav>
  );
}

function DeveloperView() {
  return (
    <>
      <RoleNavigation
        items={[
          "Overview",
          "Company Profile",
          "Opportunity Marketplace",
          "My Interests",
          "Connections",
          "Portfolio / Credentials",
          "Settings",
        ]}
      />
      <DiscoveryView role="DEVELOPER" />
    </>
  );
}

function PmcView() {
  return (
    <>
      <section className="live-panel live-role-welcome">
        <span>PMC workspace</span>
        <h2>Guide societies with structured professional oversight.</h2>
        <p>
          Your PMC profile, services and credentials remain distinct from
          Developer organizations.
        </p>
      </section>
      <RoleNavigation
        items={[
          "Overview",
          "PMC Profile",
          "Society Opportunities",
          "My Interests / Requests",
          "Projects / Connections",
          "Services / Credentials",
          "Settings",
        ]}
      />
      <DiscoveryView role="PMC" />
    </>
  );
}

function ProfessionalView() {
  return (
    <>
      <section className="live-panel live-role-welcome">
        <span>Professional workspace</span>
        <h2>Your redevelopment professional workspace</h2>
        <p>
          Your account is verified as a Professional. Dedicated Advocate,
          Architect, Structural Consultant and Valuation workflows are being
          introduced without routing you into Society, Developer or PMC
          functionality.
        </p>
      </section>
      <RoleNavigation
        items={[
          "Overview",
          "Professional Profile",
          "Services / Credentials",
          "Connections",
          "Settings",
        ]}
      />
      <section className="live-panel">
        <h3>Complete your professional profile</h3>
        <p className="live-muted">
          Role-specific profile tools and permitted opportunities will appear
          here as the controlled beta expands.
        </p>
      </section>
    </>
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
    <>
      <AdminFeasibility />
      <section className="live-panel">
        <div className="live-panel-intro">
          <span>Admin intake</span>
          <h2>Website enquiries</h2>
          <p>
            Requests submitted through the public contact, organization and
            feasibility forms are stored in PostgreSQL and visible only to
            administrators.
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
              {item.reference} · {item.status} · {item.source}
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
    </>
  );
}

export function LiveWorkspace() {
  const [location, navigate] = useLocation();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void api<{ user: Account }>("/auth/me")
      .then((data) => {
        setAccount(data.user);
        if (
          location.startsWith("/dashboard/") &&
          data.user.dashboardPath &&
          location !== data.user.dashboardPath
        ) {
          navigate(data.user.dashboardPath, { replace: true });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [location, navigate]);
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
        {loading ? (
          <p className="live-muted">Opening your workspace…</p>
        ) : account ? (
          account.role === "SOCIETY" ? (
            <SocietyView />
          ) : account.role === "DEVELOPER" ? (
            <DeveloperView />
          ) : account.role === "PMC" ? (
            <PmcView />
          ) : account.role === "ADMIN" ? (
            <AdminView />
          ) : (
            <ProfessionalView />
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
