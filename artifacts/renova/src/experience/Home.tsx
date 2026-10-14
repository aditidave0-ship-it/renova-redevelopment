import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Building2,
  BriefcaseBusiness,
  ClipboardCheck,
  Compass,
  ShieldCheck,
  UsersRound,
  Layers3,
} from "lucide-react";
import { ExperienceHeader, ExperienceFooter } from "./Header";
import { ContactForm } from "./ContactForm";
const steps = [
  {
    title: "Choose Your Role",
    text: "Select Society, Developer, PMC or Professional.",
    detail:
      "Your role determines the workspace and information you can access.",
    icon: UsersRound,
  },
  {
    title: "Create Your Profile",
    text: "Register, verify your email and complete your profile.",
    detail:
      "Public registration is currently closed while production acceptance checks are completed.",
    icon: ClipboardCheck,
  },
  {
    title: "Explore Your Workspace",
    text: "Find the tools relevant to your redevelopment journey.",
    detail:
      "Societies request feasibility and prepare opportunities. Developers and PMCs discover briefs. Professionals manage their supported services.",
    icon: Compass,
  },
  {
    title: "Connect & Move Forward",
    text: "Express interest and review received responses.",
    detail:
      "Keep your opportunity and interest activity together. An expression of interest is not a proposal or a selection.",
    icon: Layers3,
  },
];
const audiences = [
  {
    id: "society",
    title: "For Societies",
    text: "Understand your property. Prepare your society’s next chapter.",
    icon: Building2,
  },
  {
    id: "developer",
    title: "For Developers",
    text: "Discover published society briefs and express interest.",
    icon: BriefcaseBusiness,
  },
  {
    id: "pmc",
    title: "For PMCs",
    text: "Bring project management expertise to redevelopment.",
    icon: ClipboardCheck,
  },
  {
    id: "other",
    title: "For Professionals",
    text: "Introduce your practice and redevelopment specialization.",
    icon: UsersRound,
  },
];
export function RenovaHome() {
  const [step, setStep] = useState(0);
  return (
    <div className="renova-experience">
      <ExperienceHeader />
      <main id="main-content">
        <section
          className="experience-hero experience-container"
          aria-labelledby="home-title"
        >
          <div className="experience-hero-copy">
            <span className="experience-eyebrow">RENOVA · MAKE NEW AGAIN</span>
            <h1 id="home-title">
              Redevelopment,
              <br />
              <em>Reimagined.</em>
            </h1>
            <p>
              One platform connecting housing societies, developers, PMCs and
              redevelopment professionals.
            </p>
            <Link
              className="experience-button"
              href="/platform/live?mode=start"
            >
              Get Started <ArrowRight size={18} />
            </Link>
            <p className="experience-hero-note">
              A clearer beginning. A connected journey.
            </p>
          </div>
          <div
            className="experience-tower"
            role="img"
            aria-label="A premium Mumbai residential tower transforming from blueprint into reality"
          >
            <span className="experience-tower-caption">
              THE SAME PROPERTY.
              <br />
              <strong>A NEW POSSIBILITY.</strong>
            </span>
          </div>
        </section>
        <section
          className="experience-section experience-container"
          id="how-it-works"
        >
          <div className="experience-section-heading">
            <span className="experience-eyebrow">A CLEAR PATH FORWARD</span>
            <h2>How RENOVA Works</h2>
            <p>Four simple steps. One connected ecosystem.</p>
          </div>
          <div className="experience-steps" aria-label="Redevelopment journey">
            {steps.map((item, index) => (
              <button
                key={item.title}
                aria-pressed={step === index}
                aria-controls="step-explanation"
                className={step === index ? "is-active" : ""}
                onClick={() => setStep(index)}
              >
                <span className="experience-step-number">0{index + 1}</span>
                <item.icon size={25} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </button>
            ))}
          </div>
          <p
            className="experience-step-detail"
            id="step-explanation"
            aria-live="polite"
          >
            <strong>{steps[step].title}.</strong> {steps[step].detail}
          </p>
        </section>
        <section
          className="experience-section experience-container"
          id="who-for"
        >
          <div className="experience-section-heading">
            <span className="experience-eyebrow">YOUR ROLE. YOUR JOURNEY.</span>
            <h2>Who Is RENOVA For?</h2>
          </div>
          <div className="experience-audiences">
            {audiences.map((item) => (
              <Link
                key={item.id}
                href={`/platform/live?mode=start&participant=${item.id}`}
                className="experience-audience"
              >
                <span className="experience-icon">
                  <item.icon size={26} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <span>
                  Explore your workspace <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section
          id="feasibility"
          className="experience-feasibility experience-container"
        >
          <div>
            <span className="experience-eyebrow">
              FOR YOUR SOCIETY’S NEXT CHAPTER
            </span>
            <h2>Get Your Society Feasibility</h2>
            <p>
              Start with your society and property information. Request an
              assessment from the RENOVA team to understand the next steps.
            </p>
            <p>
              Feasibility requires professional review. No automated development
              potential or financial projections are promised.
            </p>
            <Link
              className="experience-button"
              href="/platform/live?view=feasibility"
            >
              Get Your Society Feasibility <ArrowRight size={17} />
            </Link>
            <Link
              className="experience-text-link"
              href="/contact?subject=Society%20feasibility"
            >
              Prefer to talk first? Raise an enquiry →
            </Link>
          </div>
          <div className="experience-feasibility-outline" aria-hidden="true">
            <Building2 size={92} strokeWidth={1} />
            <span>INFORMATION → REVIEW → NEXT STEPS</span>
          </div>
        </section>
        <section
          className="experience-section experience-container"
          id="why-renova"
        >
          <div className="experience-section-heading">
            <span className="experience-eyebrow">
              LESS CONFUSION. MORE CLARITY.
            </span>
            <h2>Why RENOVA?</h2>
          </div>
          <div className="experience-benefits">
            {[
              {
                title: "A workspace for your role",
                text: "Focus on the information and actions relevant to your society, organization or practice.",
                icon: UsersRound,
              },
              {
                title: "Structured opportunities",
                text: "Prepare factual society briefs and keep received interests associated with each opportunity.",
                icon: ClipboardCheck,
              },
              {
                title: "Clear boundaries",
                text: "Private organization information stays behind authorized account access. Public profiles remain neutral.",
                icon: ShieldCheck,
              },
            ].map((item) => (
              <article key={item.title}>
                <item.icon size={25} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="experience-about experience-container" id="about">
          <div>
            <span className="experience-eyebrow">ABOUT RENOVA</span>
            <h2>
              Make new again.
              <br />
              Move forward together.
            </h2>
          </div>
          <div>
            <p>
              RENOVA brings housing societies, developers, PMCs and
              redevelopment professionals into one connected platform, with a
              clearer path from discovery to the next step.
            </p>
            <div className="experience-founder">
              <span className="experience-founder-mark" aria-hidden="true">
                AP
              </span>
              <div>
                <strong>Aziz Parihar</strong>
                <span>Founder</span>
              </div>
            </div>
          </div>
        </section>
        <section
          className="experience-section experience-container experience-contact-section"
          id="contact"
        >
          <div className="experience-section-heading">
            <span className="experience-eyebrow">LET’S TALK</span>
            <h2>Start with a conversation.</h2>
            <p>
              Have a society, opportunity or professional service in mind? Send
              the RENOVA team an enquiry.
            </p>
          </div>
          <ContactForm />
        </section>
      </main>
      <ExperienceFooter />
    </div>
  );
}
