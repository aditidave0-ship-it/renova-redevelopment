import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Menu, X } from "lucide-react";
import "./experience.css";
export function ExperienceHeader() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return (
    <header className="experience-header">
      <a className="experience-skip" href="#main-content">
        Skip to content
      </a>
      <div className="experience-header-inner">
        <Link href="/" className="experience-brand" aria-label="RENOVA home">
          RENOVA<small>MAKE NEW AGAIN</small>
        </Link>
        <button
          className="experience-menu"
          aria-expanded={open}
          aria-controls="experience-navigation"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav
          id="experience-navigation"
          className={open ? "is-open" : ""}
          aria-label="Main navigation"
          onClick={() => setOpen(false)}
        >
          <a href="/#how-it-works">How it works</a>
          <Link href="/ecosystem">Ecosystem</Link>
          <Link href="/knowledge-centre">Knowledge centre</Link>
          <a href="/#contact">Contact</a>
          <Link href="/platform/live?mode=login">Log in</Link>
          <Link className="experience-button" href="/platform/live?mode=start">
            Get Started <ArrowRight size={16} />
          </Link>
        </nav>
      </div>
    </header>
  );
}
export function ExperienceFooter() {
  return (
    <footer className="experience-footer">
      <div>
        <Link href="/" className="experience-brand">
          RENOVA<small>MAKE NEW AGAIN</small>
        </Link>
        <p>A clearer path to redevelopment.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/ecosystem">Explore the ecosystem</Link>
        <Link href="/knowledge-centre">Knowledge centre</Link>
        <Link href="/contact">Contact / Enquiry</Link>
        <Link href="/platform/live?mode=login">Account login</Link>
      </nav>
      <p>
        RENOVA connects participants. Public profiles are not endorsements or
        verified registrations.
      </p>
    </footer>
  );
}
