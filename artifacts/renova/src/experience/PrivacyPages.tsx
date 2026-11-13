import { ExperienceFooter, ExperienceHeader } from "./Header";

type PageName = "privacy" | "terms" | "grievance";

const pageContent: Record<
  PageName,
  { eyebrow: string; title: string; intro: string }
> = {
  privacy: {
    eyebrow: "PRIVACY · DRAFT",
    title: "Privacy information",
    intro:
      "This page is a draft framework for review. It is not a final privacy notice and should not be treated as legal advice.",
  },
  terms: {
    eyebrow: "TERMS · DRAFT",
    title: "Terms of use",
    intro:
      "These terms are placeholders for owner and Indian privacy counsel review. They do not yet define the final terms for using NIRMAQ.",
  },
  grievance: {
    eyebrow: "GRIEVANCE CONTACT · DRAFT",
    title: "Contact NIRMAQ about a concern",
    intro:
      "The contact details below must be completed by the owner before this page is presented as an official grievance channel.",
  },
};

export function PrivacyPage({ page }: { page: PageName }) {
  const content = pageContent[page];
  return (
    <div className="renova-experience">
      <ExperienceHeader />
      <main
        id="main-content"
        className="experience-container experience-info-page"
      >
        <span className="experience-eyebrow">{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p>{content.intro}</p>
        {page === "privacy" && <PrivacyDraft />}
        {page === "terms" && <TermsDraft />}
        {page === "grievance" && <GrievanceDraft />}
      </main>
      <ExperienceFooter />
    </div>
  );
}

function PrivacyDraft() {
  return (
    <div className="experience-benefits">
      <article>
        <h3>Information NIRMAQ may receive</h3>
        <p>
          Depending on how you use the current site, this can include contact
          details and enquiry messages, account and organization details,
          Society property information, professional profile information and
          documents you choose to provide.
        </p>
      </article>
      <article>
        <h3>Why it is used and who may access it</h3>
        <p>
          Enquiry details are submitted so NIRMAQ can respond to the enquiry.
          Account, profile and property details support the platform features
          you use. Access depends on the relevant feature and account role; the
          final purposes, recipients and disclosures need owner and counsel
          review.
        </p>
      </article>
      <article>
        <h3>Storage and retention</h3>
        <p>
          Enquiries and platform records are designed to use NIRMAQ&apos;s API
          and PostgreSQL database. Do not submit sensitive documents through a
          feature unless it explicitly confirms that secure upload is enabled.
        </p>
        <p>
          <strong>Retention period:</strong> [OWNER: specify periods by data
          type and purpose]
        </p>
      </article>
      <article>
        <h3>Privacy contact</h3>
        <p>
          <strong>Legal entity:</strong> [OWNER: provide the responsible legal
          entity name]
        </p>
        <p>
          <strong>Grievance officer:</strong> [OWNER: provide the appointed
          officer&apos;s name and contact email]
        </p>
      </article>
      <article>
        <h3>Before publication</h3>
        <p>
          [INDIAN PRIVACY COUNSEL: review the purposes, legal basis, notice,
          recipients, retention, rights process, security disclosures and
          applicable commencement requirements.]
        </p>
      </article>
    </div>
  );
}

function TermsDraft() {
  return (
    <div className="experience-benefits">
      <article>
        <h3>Draft status</h3>
        <p>
          This placeholder does not establish final service terms, eligibility,
          professional responsibilities, fees, dispute resolution or liability
          arrangements.
        </p>
      </article>
      <article>
        <h3>Owner details to provide</h3>
        <p>
          <strong>Legal entity:</strong> [OWNER: provide the entity name and
          registered address]
        </p>
        <p>
          <strong>Contact:</strong> [OWNER: provide the official support
          contact]
        </p>
      </article>
      <article>
        <h3>Review required</h3>
        <p>
          [INDIAN COUNSEL: prepare and review terms covering platform roles,
          user submissions, third-party professionals, fees if any, account
          closure, complaints, governing law and dispute handling.]
        </p>
      </article>
    </div>
  );
}

function GrievanceDraft() {
  return (
    <div className="experience-benefits">
      <article>
        <h3>Details required before this is active</h3>
        <p>
          <strong>Responsible legal entity:</strong> [OWNER: provide entity
          name]
        </p>
        <p>
          <strong>Grievance officer:</strong> [OWNER: provide full name]
        </p>
        <p>
          <strong>Email address:</strong> [OWNER: provide monitored official
          email]
        </p>
        <p>
          <strong>Postal address:</strong> [OWNER: provide business
          correspondence address, if applicable]
        </p>
      </article>
      <article>
        <h3>Review required</h3>
        <p>
          [INDIAN PRIVACY COUNSEL: confirm the applicable grievance process,
          response periods, escalation details and required public disclosures.]
        </p>
      </article>
    </div>
  );
}
