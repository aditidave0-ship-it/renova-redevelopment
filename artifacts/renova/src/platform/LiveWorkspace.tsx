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
import { Link, useLocation, useSearch } from "wouter";
import {
  participantRoles,
  participantFor,
  publicSignupEnabled,
} from "../experience/roles";
import { workspaceApi as api, WorkspaceApiError } from "./workspace-api";
import { OpportunityEditor } from "./OpportunityEditor";
import { FeasibilityPanel } from "./FeasibilityPanel";
import "./workspace-experience.css";
import "./live-workspace.css";

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
  status: string;
  createdAt: string;
};

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
    "roles" | "register" | "login" | "forgot" | "resend" | "reset" | "verify"
  >(
    verificationToken
      ? "verify"
      : resetToken
        ? "reset"
        : new URLSearchParams(window.location.search).get("mode") === "start"
          ? "roles"
          : "login",
  );
  const [participant, setParticipant] = useState(() =>
    participantFor(
      new URLSearchParams(window.location.search).get("participant"),
    ),
  );
  const role = participant.role;
  const search = useSearch();
  useEffect(() => {
    if (verificationToken || resetToken) return;
    const params = new URLSearchParams(search);
    if (params.get("mode") === "start") {
      setParticipant(participantFor(params.get("participant")));
      setMode("roles");
    } else if (params.get("mode") === "login") setMode("login");
  }, [search, verificationToken, resetToken]);
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
        if (!publicSignupEnabled)
          throw new Error(
            "Public registration is currently closed. Please raise an enquiry for access.",
          );
        if (form.get("password") !== form.get("confirmPassword"))
          throw new Error("Passwords do not match.");
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
          {mode === "roles"
            ? "How will you use RENOVA?"
            : mode === "register"
              ? "Create your account."
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
      <div className="live-tabs" aria-label="Account action">
        <button
          type="button"
          className={mode === "register" || mode === "roles" ? "active" : ""}
          onClick={() => {
            setMode("roles");
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
        {(mode === "roles" || mode === "register") && (
          <div className="workspace-registration-closed" role="status">
            <strong>Public registration is currently closed.</strong>
            <p>
              Choose your role to see the account journey. Account creation will
              open after release approval. Existing users can sign in.
            </p>
            <Link href="/contact?subject=Platform%20access">
              Enquire about access →
            </Link>
          </div>
        )}
        {mode === "roles" && (
          <>
            <fieldset className="workspace-role-options">
              <legend>Choose your role</legend>
              {participantRoles.map((item) => (
                <label
                  key={item.id}
                  className={participant.id === item.id ? "is-selected" : ""}
                >
                  <input
                    type="radio"
                    name="participant"
                    value={item.id}
                    checked={participant.id === item.id}
                    onChange={() => setParticipant(item)}
                  />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <ArrowRight size={16} />
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              className="live-primary"
              onClick={() => setMode("register")}
            >
              Continue <ArrowRight size={17} />
            </button>
          </>
        )}
        {mode === "register" && (
          <>
            <div className="workspace-selected-role">
              <strong>{participant.label}</strong>
              <button type="button" onClick={() => setMode("roles")}>
                Change role
              </button>
            </div>
            <Field label="Your name">
              <input
                name="displayName"
                minLength={2}
                maxLength={160}
                required
                autoComplete="name"
              />
            </Field>
            <Field label={participant.profileLabel}>
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
        {mode !== "reset" && mode !== "verify" && mode !== "roles" && (
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
        {(mode === "reset" || mode === "register") && (
          <Field
            label={
              mode === "reset" ? "Confirm new password" : "Confirm password"
            }
          >
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
        {mode !== "verify" && mode !== "roles" && (
          <button
            className="live-primary"
            disabled={busy || (mode === "register" && !publicSignupEnabled)}
            type="submit"
          >
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
    <section className="live-panel live-profile-panel">
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
            {busy ? "Saving…" : "Save profile"}
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

function SocietyView({ view }: { view: string }) {
  const [editingOpportunity, setEditingOpportunity] =
    useState<Opportunity | null>(null);
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
      {view === "overview" && (
        <div className="live-metrics">
          <article>
            <span>Opportunities</span>
            <strong>{loading || error ? "—" : opportunities.length}</strong>
          </article>
          <article>
            <span>Published</span>
            <strong>
              {loading || error
                ? "—"
                : opportunities.filter((item) => item.status === "PUBLISHED")
                    .length}
            </strong>
          </article>
          <article>
            <span>Incoming interests</span>
            <strong>{loading || error ? "—" : interests.length}</strong>
          </article>
        </div>
      )}
      {view === "overview" && error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {view === "opportunities" && (
        <div className="live-grid">
          <OpportunityEditor
            key={editingOpportunity?.id || "new"}
            selected={editingOpportunity}
            onSaved={() => void load()}
            onCancel={() => setEditingOpportunity(null)}
          />
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
              {!loading && !error && opportunities.length === 0 && (
                <p className="live-muted">
                  Your first opportunity will appear here.
                </p>
              )}
              {error && (
                <p className="live-error" role="alert">
                  {error}
                </p>
              )}
              {opportunities.map((opportunity) => (
                <article className="live-list-card" key={opportunity.id}>
                  <small>{opportunity.status}</small>
                  <h3>{opportunity.title}</h3>
                  <span>
                    <MapPin size={14} /> {opportunity.location}
                  </span>
                  <p>{opportunity.description}</p>
                  {opportunity.status === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => setEditingOpportunity(opportunity)}
                    >
                      Review saved draft / Check editing availability
                    </button>
                  )}
                </article>
              ))}
            </section>
          </div>
        </div>
      )}
      {view === "interests" && (
        <div className="live-aside">
          <section className="live-panel">
            <div className="live-panel-intro">
              <span>Incoming interest</span>
              <h2>Organizations responding to your opportunities</h2>
              <p>
                Interest is a request to connect, not a proposal or endorsement.
              </p>
            </div>
            {loading && <p className="live-muted">Loading…</p>}
            {!loading && !error && interests.length === 0 && (
              <p className="live-muted">
                No organizations have expressed interest yet.
              </p>
            )}
            {error && (
              <p className="live-error" role="alert">
                {error}
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
      )}
    </>
  );
}

function DiscoveryView({
  role,
  view,
}: {
  role: "DEVELOPER" | "PMC";
  view: string;
}) {
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
      {view === "overview" && (
        <>
          <div className="live-metrics">
            <article>
              <span>Available opportunities</span>
              <strong>{loading || error ? "—" : opportunities.length}</strong>
            </article>
            <article>
              <span>Interests submitted</span>
              <strong>{loading || error ? "—" : interests.length}</strong>
            </article>
            <article>
              <span>Under review / shortlisted</span>
              <strong>
                {loading || error
                  ? "—"
                  : interests.filter((item) =>
                      ["REVIEWING", "SHORTLISTED"].includes(item.reviewStatus),
                    ).length}
              </strong>
            </article>
          </div>
          {error && (
            <p role="alert" className="live-error">
              {error}
            </p>
          )}
        </>
      )}
      {view === "opportunities" && (
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
          {!loading && !error && opportunities.length === 0 && (
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
                    disabled={
                      busyId === item.id || Boolean(item.interestStatus)
                    }
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
        </section>
      )}
      {view === "interests" && (
        <section className="live-panel">
          {error && (
            <p role="alert" className="live-error">
              {error}
            </p>
          )}
          {loading && <p role="status">Loading your interests…</p>}
          <div className="live-panel-intro live-section-spacer">
            <span>Your activity</span>
            <h2>Interest tracking</h2>
          </div>
          {!interests.length && !loading && !error && (
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
      )}
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

type WorkspaceItem = { id: string; title: string; description: string };
const itemsFor = (role: Role): WorkspaceItem[] =>
  role === "SOCIETY"
    ? [
        {
          id: "profile",
          title: "My Society",
          description: "Society and property information",
        },
        {
          id: "feasibility",
          title: "Feasibility",
          description: "Request a professional assessment",
        },
        {
          id: "opportunities",
          title: "Redevelopment Opportunity",
          description: "Prepare and publish a society brief",
        },
        {
          id: "directory",
          title: "Explore Developers & PMCs",
          description: "Explore public organization profiles",
        },
        {
          id: "interests",
          title: "Received Interests",
          description: "Review responses to your briefs",
        },
        {
          id: "documents",
          title: "Documents",
          description: "Document storage is not yet available",
        },
        {
          id: "settings",
          title: "Settings",
          description: "Account and access information",
        },
      ]
    : role === "DEVELOPER"
      ? [
          {
            id: "opportunities",
            title: "Opportunity Marketplace",
            description: "Browse published society briefs",
          },
          {
            id: "interests",
            title: "My Interests",
            description: "Track your submitted interests",
          },
          {
            id: "profile",
            title: "Company Profile",
            description: "Update company information",
          },
          {
            id: "portfolio",
            title: "Portfolio",
            description: "Manage projects in your profile",
          },
          {
            id: "saved",
            title: "Saved Opportunities",
            description: "Saving opportunities is not yet available",
          },
          {
            id: "settings",
            title: "Settings",
            description: "Account and access information",
          },
        ]
      : role === "PMC"
        ? [
            {
              id: "opportunities",
              title: "Opportunities",
              description: "Discover society requirements",
            },
            {
              id: "interests",
              title: "My Interests",
              description: "Track your submitted interests",
            },
            {
              id: "profile",
              title: "PMC Profile",
              description: "Update your practice and credentials",
            },
            {
              id: "services",
              title: "Services",
              description: "Manage services in your PMC profile",
            },
            {
              id: "connections",
              title: "Connections",
              description: "Connection approval is not yet available",
            },
            {
              id: "settings",
              title: "Settings",
              description: "Account and access information",
            },
          ]
        : role === "ADMIN"
          ? [
              {
                id: "enquiries",
                title: "Enquiries",
                description: "Review submitted website enquiries",
              },
              {
                id: "feasibility",
                title: "Feasibility Review",
                description: "Review society assessment requests",
              },
              {
                id: "settings",
                title: "Settings",
                description: "Account and access information",
              },
            ]
          : [
              {
                id: "profile",
                title: "Professional Profile",
                description: "Practice and specialization",
              },
              {
                id: "services",
                title: "Services",
                description: "Professional services and credentials",
              },
              {
                id: "opportunities",
                title: "Opportunities",
                description: "Professional discovery is not yet available",
              },
              {
                id: "settings",
                title: "Settings",
                description: "Account and access information",
              },
            ];
function UnavailableFeature({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="live-panel workspace-unavailable">
      <span>Not yet available</span>
      <h2>{title}</h2>
      <p>{children}</p>
      <Link
        className="live-primary"
        href={`/contact?subject=${encodeURIComponent(title)}`}
      >
        Contact RENOVA <ArrowRight size={16} />
      </Link>
    </section>
  );
}
function ProfessionalProfile() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null),
    [loading, setLoading] = useState(true),
    [unavailable, setUnavailable] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<{ organization: Record<string, unknown> }>("/organizations/me")
      .then((data) => setProfile(data.organization))
      .catch((cause) => {
        if (cause instanceof WorkspaceApiError && cause.status === 404)
          setUnavailable(true);
        else
          setError(
            cause instanceof Error ? cause.message : "Unable to load profile.",
          );
      })
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <p role="status">Loading professional profile…</p>;
  if (unavailable)
    return (
      <UnavailableFeature title="Professional Profile">
        Your Professional role is retained. Profile management and
        specialization onboarding require the pending backend release. This
        account is not a Developer or PMC account.
      </UnavailableFeature>
    );
  return (
    <section className="live-panel">
      <div className="live-panel-intro">
        <span>Professional workspace</span>
        <h2>Practice & specialization</h2>
        <p>
          Your specialization personalizes your practice profile. It does not
          grant another role’s permissions.
        </p>
      </div>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {profile && (
        <form
          className="live-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.currentTarget));
            setBusy(true);
            setError("");
            setNotice("");
            try {
              const result = await api<{
                organization: Record<string, unknown>;
              }>("/organizations/me", {
                method: "PUT",
                body: JSON.stringify(data),
              });
              setProfile(result.organization);
              setNotice("Professional profile saved.");
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Unable to save profile.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Practice / organization name">
            <input
              name="name"
              minLength={2}
              maxLength={220}
              required
              defaultValue={String(profile.name ?? "")}
            />
          </Field>
          <Field label="Specialization">
            <select
              name="specialization"
              defaultValue={String(profile.specialization ?? "OTHER")}
            >
              {participantRoles
                .filter((item) => item.role === "PROFESSIONAL")
                .map((item) => (
                  <option
                    key={item.id}
                    value={
                      {
                        legal: "LEGAL",
                        architect: "ARCHITECT",
                        structural: "STRUCTURAL",
                        finance: "FINANCE_VALUATION",
                        other: "OTHER",
                      }[
                        item.id as
                          | "legal"
                          | "architect"
                          | "structural"
                          | "finance"
                          | "other"
                      ]
                    }
                  >
                    {item.label}
                  </option>
                ))}
            </select>
          </Field>
          {[
            { name: "location", label: "Location" },
            { name: "website", label: "Website" },
            { name: "description", label: "About your practice" },
            { name: "services", label: "Services" },
            { name: "credentials", label: "Credentials" },
          ].map((item) => (
            <Field key={item.name} label={item.label}>
              <input
                name={item.name}
                maxLength={
                  item.name === "location"
                    ? 160
                    : item.name === "website"
                      ? 500
                      : 5000
                }
                defaultValue={String(profile[item.name] ?? "")}
              />
            </Field>
          ))}
          {notice && (
            <p className="live-success" role="status">
              {notice}
            </p>
          )}
          <button className="live-primary" disabled={busy}>
            {busy ? "Saving…" : "Save professional profile"}
          </button>
        </form>
      )}
    </section>
  );
}
export function LiveWorkspace() {
  const [account, setAccount] = useState<Account | null>(null),
    [loading, setLoading] = useState(true),
    [serviceError, setServiceError] = useState(""),
    [signingOut, setSigningOut] = useState(false);
  const search = useSearch();
  const [, navigate] = useLocation();
  const requestedView = new URLSearchParams(search).get("view") || "overview";
  const items = account ? itemsFor(account.role) : [];
  const view =
    requestedView === "overview" ||
    items.some((item) => item.id === requestedView)
      ? requestedView
      : "overview";
  useEffect(() => {
    void api<{ user: Account }>("/auth/me")
      .then((data) => setAccount(data.user))
      .catch((cause) => {
        if (!(cause instanceof WorkspaceApiError && cause.status === 401))
          setServiceError(
            cause instanceof Error
              ? cause.message
              : "Account service is unavailable.",
          );
      })
      .finally(() => setLoading(false));
    const expired = () => {
      setAccount(null);
      setServiceError("Your session has expired. Please sign in again.");
    };
    window.addEventListener("renova-session-expired", expired);
    return () => window.removeEventListener("renova-session-expired", expired);
  }, []);
  async function logout() {
    setSigningOut(true);
    setServiceError("");
    try {
      await api("/auth/logout", { method: "POST", body: "{}" });
      setAccount(null);
      navigate("/platform/live?mode=login");
    } catch (cause) {
      setServiceError(
        cause instanceof Error
          ? cause.message
          : "Sign out failed. Please try again.",
      );
    } finally {
      setSigningOut(false);
    }
  }
  const heading =
    account?.role === "SOCIETY"
      ? "Take the first step towards a better tomorrow."
      : account?.role === "DEVELOPER"
        ? "Discover Redevelopment Opportunities."
        : account?.role === "PMC"
          ? "Partner in Better Redevelopment."
          : account?.role === "ADMIN"
            ? "Manage the RENOVA intake."
            : "Bring your expertise to redevelopment.";
  const workspaceBody = !account ? null : view === "settings" ? (
    <section className="live-panel">
      <h2>Account settings</h2>
      <dl className="workspace-review">
        <div>
          <dt>Name</dt>
          <dd>{account.displayName}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{account.email}</dd>
        </div>
        <div>
          <dt>Authorized role</dt>
          <dd>{account.role}</dd>
        </div>
      </dl>
      <p>Role and organization access are assigned by the server.</p>
      <button
        type="button"
        className="live-primary"
        onClick={() => {
          void logout();
        }}
      >
        Sign out to manage password recovery
      </button>
    </section>
  ) : view === "directory" ? (
    <section className="live-panel">
      <h2>Explore Developers & PMCs</h2>
      <p>
        Discover public organization profiles. A public listing is not a RENOVA
        verification or endorsement.
      </p>
      <Link className="live-primary" href="/ecosystem">
        Open ecosystem directory <ArrowRight size={16} />
      </Link>
    </section>
  ) : view === "documents" || view === "saved" || view === "connections" ? (
    <UnavailableFeature
      title={items.find((item) => item.id === view)?.title ?? "Feature"}
    >
      This feature is not implemented yet. No records are being stored or
      implied here. You can contact the RENOVA team about your requirement.
    </UnavailableFeature>
  ) : view === "feasibility" &&
    (account.role === "SOCIETY" || account.role === "ADMIN") ? (
    <FeasibilityPanel admin={account.role === "ADMIN"} />
  ) : ["profile", "portfolio", "services"].includes(view) ? (
    account.role === "PROFESSIONAL" ? (
      <ProfessionalProfile />
    ) : account.role === "SOCIETY" ||
      account.role === "DEVELOPER" ||
      account.role === "PMC" ? (
      <ProfileEditor role={account.role} />
    ) : null
  ) : account.role === "SOCIETY" ? (
    <SocietyView view={view} />
  ) : account.role === "DEVELOPER" || account.role === "PMC" ? (
    <DiscoveryView role={account.role} view={view} />
  ) : account.role === "ADMIN" && view === "enquiries" ? (
    <AdminView />
  ) : account.role === "PROFESSIONAL" && view === "opportunities" ? (
    <UnavailableFeature title="Professional Opportunities">
      Opportunity discovery for this role is not yet supported. Your
      Professional permissions are preserved.
    </UnavailableFeature>
  ) : null;
  return (
    <div className="live-workspace workspace-experience">
      <header className="live-header">
        <Link href="/" className="live-logo">
          RENOVA<small>MAKE NEW AGAIN</small>
        </Link>
        {account ? (
          <>
            <span>
              {account.displayName} ·{" "}
              {account.role === "PROFESSIONAL"
                ? "Professional"
                : account.role.toLowerCase()}
            </span>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void logout()}
            >
              <LogOut size={16} />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </>
        ) : (
          <Link href="/">
            Back to website <ArrowLeft size={16} />
          </Link>
        )}
      </header>
      {serviceError && (
        <p role="alert" className="live-error workspace-service-error">
          {serviceError}
        </p>
      )}
      <div
        className={account ? "workspace-layout" : "workspace-account-layout"}
      >
        {account && (
          <nav
            className="workspace-sidebar"
            aria-label={`${account.role.toLowerCase()} workspace navigation`}
          >
            <span>Your workspace</span>
            <Link
              href="/platform/live"
              aria-current={view === "overview" ? "page" : undefined}
            >
              Overview
            </Link>
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/platform/live?view=${item.id}`}
                aria-current={view === item.id ? "page" : undefined}
              >
                {item.title}
              </Link>
            ))}
            <Link href="/contact">Help & enquiry</Link>
          </nav>
        )}
        <main id="main-content">
          {loading ? (
            <p role="status">Opening your secure workspace…</p>
          ) : !account ? (
            <>
              {requestedView !== "overview" && (
                <div className="workspace-registration-closed">
                  <strong>
                    {requestedView === "feasibility"
                      ? "Get Your Society Feasibility"
                      : "Your authorized workspace"}
                  </strong>
                  <p>
                    Existing account holders can sign in below. Public
                    registration remains closed.
                  </p>
                  <Link
                    href={
                      requestedView === "feasibility"
                        ? "/contact?subject=Society%20feasibility"
                        : "/contact?subject=Platform%20access"
                    }
                  >
                    Raise an enquiry →
                  </Link>
                </div>
              )}
              <AccountForm
                onSignedIn={(user) => {
                  setAccount(user);
                  setServiceError("");
                  navigate(
                    `/platform/live${requestedView !== "overview" ? `?view=${requestedView}` : ""}`,
                  );
                }}
              />
            </>
          ) : (
            <>
              {view === "overview" && (
                <>
                  <div className="workspace-welcome">
                    <span>
                      {account.role === "PROFESSIONAL"
                        ? "Professional"
                        : account.role.toLowerCase()}{" "}
                      workspace
                    </span>
                    <h1>{heading}</h1>
                    <p>
                      {account.role === "SOCIETY"
                        ? "Start with your society profile, then prepare your feasibility request or redevelopment opportunity."
                        : account.role === "PMC"
                          ? "Manage your PMC services, discover published society briefs and track your interests."
                          : account.role === "DEVELOPER"
                            ? "Keep your company profile, published opportunities and submitted interests together."
                            : "Your authorized role determines the tools available here."}
                    </p>
                    <Link
                      className="live-primary"
                      href={`/platform/live?view=${account.role === "SOCIETY" ? "feasibility" : account.role === "ADMIN" ? "enquiries" : account.role === "PROFESSIONAL" ? "profile" : "opportunities"}`}
                    >
                      {account.role === "SOCIETY"
                        ? "Get Your Society Feasibility"
                        : account.role === "PROFESSIONAL"
                          ? "Manage professional profile"
                          : account.role === "ADMIN"
                            ? "Review enquiries"
                            : "Explore opportunities"}
                      <ArrowRight size={17} />
                    </Link>
                  </div>
                  <div className="workspace-feature-grid">
                    {items.map((item, index) => (
                      <Link
                        key={item.id}
                        href={`/platform/live?view=${item.id}`}
                      >
                        <span className="workspace-feature-icon">
                          {index % 3 === 0 ? (
                            <Building2 size={23} />
                          ) : index % 3 === 1 ? (
                            <ClipboardCheckIcon />
                          ) : (
                            <UserRound size={23} />
                          )}
                        </span>
                        <strong>{item.title}</strong>
                        <small>{item.description}</small>
                        <ArrowRight size={15} />
                      </Link>
                    ))}
                  </div>
                </>
              )}
              {workspaceBody}
            </>
          )}
        </main>
      </div>
      {account && (
        <nav
          className="workspace-bottom-nav"
          aria-label="Quick workspace navigation"
        >
          <Link
            href="/platform/live"
            aria-current={view === "overview" ? "page" : undefined}
          >
            <Building2 size={19} />
            Home
          </Link>
          {items.slice(0, 3).map((item) => (
            <Link
              key={item.id}
              href={`/platform/live?view=${item.id}`}
              aria-current={view === item.id ? "page" : undefined}
            >
              <CompassIcon />
              {item.title}
            </Link>
          ))}
          <Link
            href="/platform/live?view=settings"
            aria-current={view === "settings" ? "page" : undefined}
          >
            <UserRound size={19} />
            Account
          </Link>
        </nav>
      )}
      <footer>RENOVA · A clearer path from opportunity to connection.</footer>
    </div>
  );
}
function ClipboardCheckIcon() {
  return <CheckCircle2 size={23} />;
}
function CompassIcon() {
  return <MapPin size={19} />;
}
