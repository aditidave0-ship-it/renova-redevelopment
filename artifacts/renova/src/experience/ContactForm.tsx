import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { ExperienceHeader, ExperienceFooter } from "./Header";
export function ContactForm() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reference, setReference] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          organizationName: data.get("organizationName"),
          email: data.get("email"),
          phone: data.get("phone"),
          city: data.get("city"),
          actorType: data.get("actorType"),
          message: `${data.get("subject")}\n\n${data.get("message")}`,
          consent: data.get("consent") === "on",
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.reference !== "string")
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Your enquiry could not be saved. Please try again.",
        );
      setReference(result.reference);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to send enquiry.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (reference)
    return (
      <div className="experience-confirmation" role="status">
        <CheckCircle2 size={32} />
        <h3>Your enquiry is with RENOVA.</h3>
        <p>
          Reference: <strong>{reference}</strong>. Keep this for your records.
        </p>
        <p>Your request has been saved for the RENOVA team to review.</p>
        <button className="experience-button" onClick={() => setReference("")}>
          Send another enquiry
        </button>
      </div>
    );
  return (
    <form className="experience-contact-form" onSubmit={submit}>
      <div className="experience-form-row">
        <label>
          Name
          <input
            name="name"
            required
            minLength={2}
            maxLength={160}
            autoComplete="name"
          />
        </label>
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            maxLength={320}
            autoComplete="email"
          />
        </label>
      </div>
      <div className="experience-form-row">
        <label>
          Phone
          <input
            name="phone"
            type="tel"
            required
            minLength={10}
            maxLength={40}
            autoComplete="tel"
          />
        </label>
        <label>
          Society / organization / practice
          <input
            name="organizationName"
            required
            minLength={2}
            maxLength={220}
            autoComplete="organization"
          />
        </label>
      </div>
      <div className="experience-form-row">
        <label>
          I am a
          <select name="actorType" defaultValue="Housing Society">
            <option>Housing Society</option>
            <option>Developer</option>
            <option>PMC</option>
            <option>Architect</option>
            <option>Legal / Other Professional</option>
            <option value="Contact">Other</option>
          </select>
        </label>
        <label>
          City
          <input
            name="city"
            required
            minLength={2}
            maxLength={160}
            defaultValue="Mumbai"
            autoComplete="address-level2"
          />
        </label>
      </div>
      <label>
        Subject / Requirement
        <input
          name="subject"
          required
          minLength={3}
          maxLength={160}
          defaultValue={
            new URLSearchParams(window.location.search).get("subject") ?? ""
          }
        />
      </label>
      <label>
        Message
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={4800}
          rows={4}
          placeholder="Tell us about your society, requirement or question."
        />
      </label>
      <label className="experience-consent">
        <input name="consent" type="checkbox" required />I agree that RENOVA may
        contact me about this enquiry.
      </label>
      {error && (
        <p role="alert" className="experience-error">
          {error}
        </p>
      )}
      <button className="experience-button" disabled={busy} type="submit">
        {busy ? "Sending enquiry…" : "Send enquiry"}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
export function ContactPage() {
  return (
    <div className="renova-experience">
      <ExperienceHeader />
      <main
        id="main-content"
        className="experience-container experience-contact-page"
      >
        <span className="experience-eyebrow">LET’S TALK</span>
        <h1>Start with a conversation.</h1>
        <p>Ask about feasibility, your organization, or the RENOVA platform.</p>
        <ContactForm />
      </main>
      <ExperienceFooter />
    </div>
  );
}
