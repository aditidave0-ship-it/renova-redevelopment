import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BookOpenText,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Compass,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  HardHat,
  Handshake,
  Home,
  LayoutDashboard,
  Landmark,
  ListFilter,
  LoaderCircle,
  MapPin,
  Menu,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Scale,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  UsersRound,
  X,
  Zap,
} from 'lucide-react';
import {
  getGetProjectQueryKey,
  getListProfessionalsQueryKey,
  useGetDashboard,
  useGetProject,
  useHealthCheck,
  useListProfessionals,
  useListProjects,
  useListRegulations,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { ErrorBoundary, type ErrorFallbackProps } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import './index.css';
import './marketing.css';
import './requirement.css';

const queryClient = new QueryClient();

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function readStoredArray<T>(key: string): T[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function Logo() {
  return (
    <Link href="/" className="brand-lockup" data-testid="link-home" aria-label="RENOVA home">
      <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
        <path className="brand-renewal-arc" d="M8.5 37.5A19 19 0 1 1 38.8 13" />
        <path className="brand-r-stem" d="M15 38V14h10.5c6 0 10 3.2 10 8.5S31.5 31 25.5 31H15" />
        <path className="brand-r-leg" d="m26 30 11 9" />
        <path className="brand-building" d="M20 38V23l5-3v18" />
      </svg>
      <span className="brand-name" aria-hidden="true">
        {'RENOVA'.split('').map((letter, index) => (
          <span key={`${letter}-${index}`} style={{ '--brand-letter': index } as React.CSSProperties}>{letter}</span>
        ))}
      </span>
    </Link>
  );
}

const navItems = [
  { href: '/workspace', label: 'Overview', icon: LayoutDashboard },
  { href: '/assessment', label: 'Post requirement', icon: ClipboardCheck },
  { href: '/professionals', label: 'Professionals', icon: UsersRound },
  { href: '/regulations', label: 'Regulation centre', icon: BookOpenText },
];

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [utilityPanel, setUtilityPanel] = useState<'help' | 'notifications' | null>(null);
  const health = useHealthCheck();
  const current = navItems.find((item) => item.href === location);

  return (
    <div className="app-shell">
      <aside className={cn('sidebar', mobileOpen && 'sidebar-open')}>
        <div className="sidebar-top">
          <Logo />
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation"><X size={19} /></button>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-avatar">KH</span>
          <span className="workspace-copy"><strong>Kirti Heights CHS</strong><small>Society workspace</small></span>
          <ChevronDown size={15} />
        </div>
        <p className="nav-caption">Workspace</p>
        <nav className="main-nav" aria-label="Primary navigation">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link href={href} key={href} onClick={() => setMobileOpen(false)} className={cn('nav-link', location === href && 'active')} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {label === 'Post requirement' && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <p className="nav-caption nav-caption-lower">Reference</p>
        <div className="reference-card">
          <div className="reference-icon"><CircleHelp size={17} /></div>
          <div><strong>Need a second opinion?</strong><span>Talk to our redevelopment desk.</span></div>
          <ArrowUpRight size={15} />
        </div>
        <div className="sidebar-bottom">
          <div className={cn('system-status', health.isError && 'status-error')} data-testid="status-system">
            <span className="status-pulse" /> {health.isError ? 'Connection issue' : 'All systems operational'}
          </div>
          <div className="user-row">
            <span className="user-avatar">AR</span>
            <span><strong>Aditya Rao</strong><small>Committee secretary</small></span>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" data-testid="button-navigation-overlay" />}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={20} /></button>
            <span className="eyebrow">{current?.label || 'Workspace'}</span>
            <span className="breadcrumb-divider">/</span>
            <span className="breadcrumb-current">{location === '/workspace' ? 'Kirti Heights CHS' : current?.label}</span>
          </div>
          <div className="topbar-right">
            <button className="topbar-help" onClick={() => setUtilityPanel('help')} data-testid="button-help"><CircleHelp size={17} /> Help desk</button>
            <button className="notification-button" onClick={() => setUtilityPanel('notifications')} aria-label="Notifications" data-testid="button-notifications"><ActivityIcon size={18} /><span /></button>
            <span className="topbar-user">AR</span>
          </div>
        </header>
        <div className="page-wrap">
          <ErrorBoundary resetKey={location} FallbackComponent={WorkspaceErrorFallback}>{children}</ErrorBoundary>
        </div>
      </main>
      <ExperienceDrawer open={utilityPanel === 'help'} onClose={() => setUtilityPanel(null)} eyebrow="RENOVA support" title="How can we help your committee?">
        <div className="utility-intro"><span><Handshake size={22} /></span><div><strong>Redevelopment desk</strong><p>Get practical guidance on requirements, professionals, documents and your next committee step.</p></div></div>
        <div className="utility-action-list">
          <Link href="/assessment" onClick={() => setUtilityPanel(null)}><ClipboardCheck size={18} /><span><strong>Post a society requirement</strong><small>Share your brief with RENOVA</small></span><ChevronRight size={17} /></Link>
          <Link href="/professionals" onClick={() => setUtilityPanel(null)}><UsersRound size={18} /><span><strong>Find a verified professional</strong><small>Explore developers, PMCs and architects</small></span><ChevronRight size={17} /></Link>
          <Link href="/regulations" onClick={() => setUtilityPanel(null)}><BookOpenText size={18} /><span><strong>Understand the process</strong><small>Read plain-language guidance</small></span><ChevronRight size={17} /></Link>
        </div>
        <div className="utility-contact"><span>Need personal assistance?</span><Link href="/assessment" onClick={() => setUtilityPanel(null)}>Send your requirement to the redevelopment desk <ArrowUpRight size={14} /></Link></div>
      </ExperienceDrawer>
      <ExperienceDrawer open={utilityPanel === 'notifications'} onClose={() => setUtilityPanel(null)} eyebrow="Project pulse" title="Your latest updates">
        <div className="drawer-feed">
          <article><span className="drawer-feed-icon"><BadgeCheck size={18} /></span><div><strong>New verified PMC match</strong><p>UrbanFrame Consultants is a 96% match for your active project.</p><small>Today · 10:42 AM</small></div></article>
          <article><span className="drawer-feed-icon"><AlertTriangle size={18} /></span><div><strong>Document action needed</strong><p>Your conveyance status still needs committee confirmation.</p><small>Yesterday</small></div></article>
          <article><span className="drawer-feed-icon"><BookOpenText size={18} /></span><div><strong>Guidance updated</strong><p>The MHADA redevelopment overview has new committee notes.</p><small>2 days ago</small></div></article>
        </div>
      </ExperienceDrawer>
    </div>
  );
}

function LoadingPage({ label = 'Preparing your workspace' }: { label?: string }) {
  return (
    <div className="state-page" data-testid="state-loading">
      <div className="skeleton-mark"><LoaderCircle size={22} /></div>
      <div className="skeleton-line skeleton-wide" />
      <div className="skeleton-line skeleton-mid" />
      <p>{label}</p>
    </div>
  );
}

function ErrorState({ onRetry, label = 'We could not load this view.' }: { onRetry: () => void; label?: string }) {
  return (
    <div className="state-page error-state" data-testid="state-error">
      <div className="state-icon state-icon-red"><AlertTriangle size={23} /></div>
      <h2>Something got in the way</h2>
      <p>{label} Your work is safe. Try again in a moment.</p>
      <button className="button button-dark" onClick={onRetry} data-testid="button-retry"><RotateCcw size={16} /> Try again</button>
    </div>
  );
}

function WorkspaceErrorFallback({ resetError }: ErrorFallbackProps) {
  return (
    <div className="state-page workspace-error" data-testid="state-workspace-error">
      <div className="state-icon state-icon-red"><AlertTriangle size={23} /></div>
      <p className="section-kicker">Workspace recovery</p>
      <h2>We could not open this view.</h2>
      <p>Your information is safe. Refresh the workspace connection and continue where you left off.</p>
      <button className="button button-dark" onClick={resetError} data-testid="button-recover-workspace"><RotateCcw size={16} /> Reload workspace</button>
    </div>
  );
}

function EmptyState({ icon: Icon, title, detail, action }: { icon: typeof Building2; title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="empty-state" data-testid="state-empty">
      <div className="state-icon"><Icon size={23} /></div>
      <h3>{title}</h3><p>{detail}</p>{action}
    </div>
  );
}

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'orange' | 'green' | 'red' }) {
  return <span className={`status-pill status-${tone}`} data-testid={`status-${String(children).toLowerCase().replaceAll(' ', '-')}`}>{children}</span>;
}

function ExperienceDrawer({ open, onClose, eyebrow, title, children }: { open: boolean; onClose: () => void; eyebrow: string; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="experience-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="experience-drawer" role="dialog" aria-modal="true" aria-labelledby="experience-drawer-title">
        <div className="experience-drawer-head"><div><p>{eyebrow}</p><h2 id="experience-drawer-title">{title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close" autoFocus><X size={20} /></button></div>
        <div className="experience-drawer-body">{children}</div>
      </section>
    </div>
  );
}

function ProgressRing({ value, size = 86 }: { value: number; size?: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="progress-ring" style={{ width: size, height: size }} data-testid="display-readiness">
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle className="ring-track" cx="40" cy="40" r={radius} />
        <circle className="ring-value" cx="40" cy="40" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference - (circumference * value) / 100} />
      </svg>
      <strong>{value}<small>%</small></strong>
    </div>
  );
}

function PageIntro({ kicker, title, detail, action }: { kicker: string; title: ReactNode; detail: string; action?: ReactNode }) {
  return (
    <div className="page-intro">
      <div><p className="section-kicker">{kicker}</p><h1>{title}</h1><p className="page-description">{detail}</p></div>
      {action}
    </div>
  );
}

function Overview() {
  const dashboard = useGetDashboard();
  const projects = useListProjects();
  if (dashboard.isLoading) return <LoadingPage label="Loading your society workspace" />;
  if (dashboard.isError || !dashboard.data) return <ErrorState onRetry={() => dashboard.refetch()} />;
  const activeProject = dashboard.data.activeProject ?? projects.data?.[0];
  if (!activeProject) {
    if (projects.isLoading) return <LoadingPage label="Finding your active project" />;
    return <ErrorState onRetry={() => { void dashboard.refetch(); void projects.refetch(); }} label="We could not find an active society project." />;
  }
  const { recentActivity } = dashboard.data;

  return (
    <div className="content-stack">
      <PageIntro
        kicker="Monday, 06 May 2024 · Committee workspace"
        title={<>Good morning, Aditya.<br /><em>Let’s move this forward.</em></>}
        detail="A clear view of your society’s redevelopment, from first assessment to possession."
        action={<Link href="/assessment" className="button button-accent" data-testid="link-start-assessment"><Plus size={17} /> Start an assessment</Link>}
      />
      <section className="hero-project" data-testid="card-active-project">
        <div className="hero-project-info">
          <div className="label-row"><span className="section-kicker">Active project</span><StatusPill tone="orange">{activeProject.stage || 'Assessment in progress'}</StatusPill></div>
          <h2>{activeProject.name}</h2>
          <div className="meta-row"><span><MapPin size={14} /> {activeProject.location}</span><span><Building2 size={14} /> {activeProject.societyType}</span><span><UsersRound size={14} /> {activeProject.memberCount || '—'} members</span></div>
          <div className="hero-project-bottom">
            <div><span className="tiny-label">Next best step</span><strong>{activeProject.nextStep}</strong></div>
            <Link href={`/project/${activeProject.id}`} className="text-link" data-testid={`link-project-${activeProject.id}`}>Open project <ArrowUpRight size={15} /></Link>
          </div>
        </div>
        <div className="hero-project-image"><img src="/renova-hero.png" alt="Architectural vision of a redeveloped Mumbai housing society" /><span className="image-caption">The building ahead, made visible.</span></div>
      </section>
      <section className="metric-grid" aria-label="Project summary">
        <div className="metric-card metric-primary"><div className="metric-card-top"><span>Readiness score</span><TrendingUp size={17} /></div><div className="metric-value">{dashboard.data.totalReadiness}<small>%</small></div><div className="metric-bar"><i style={{ width: `${dashboard.data.totalReadiness}%` }} /></div><p>Up 8 points this month</p></div>
        <div className="metric-card"><div className="metric-card-top"><span>Open red flags</span><AlertTriangle size={17} /></div><div className="metric-value">{dashboard.data.openRedFlags}</div><p className="metric-note"><span className="dot dot-red" /> Needs committee attention</p><Link href={`/project/${activeProject.id}`} className="metric-link" data-testid="link-view-red-flags">Review flags <ChevronRight size={14} /></Link></div>
        <div className="metric-card"><div className="metric-card-top"><span>Steps completed</span><CheckCircle2 size={17} /></div><div className="metric-value">{dashboard.data.completedSteps}<small>/ 12</small></div><p className="metric-note"><span className="dot dot-green" /> Good pace for this stage</p><Link href={`/project/${activeProject.id}`} className="metric-link" data-testid="link-view-progress">View progress <ChevronRight size={14} /></Link></div>
      </section>
      <section className="overview-lower">
        <div className="panel activity-panel">
          <div className="panel-heading"><div><p className="section-kicker">The paper trail</p><h3>Recent activity</h3></div><button className="subtle-button" data-testid="button-view-all-activity">View all <ArrowUpRight size={14} /></button></div>
          {recentActivity?.length ? <div className="activity-list">{recentActivity.map((item, index) => <div className="activity-item" key={item.id} data-testid={`activity-${item.id}`}><span className={`activity-icon activity-${item.kind}`}><ActivityIcon size={16} /></span><div><strong>{item.title}</strong><p>{item.detail}</p></div><time>{index === 0 ? 'Today' : item.date}</time></div>)}</div> : <EmptyState icon={ActivityIcon} title="Your paper trail starts here" detail="Actions and decisions will appear as your committee moves through the process." /> }
        </div>
        <div className="panel focus-panel">
          <div className="panel-heading"><div><p className="section-kicker">In focus</p><h3>Project health</h3></div><ShieldCheck size={20} className="panel-heading-icon" /></div>
          <div className="health-score"><ProgressRing value={dashboard.data.totalReadiness} size={96} /><div><strong>On the right track</strong><p>Your readiness is ahead of the average for societies at this stage.</p></div></div>
          <div className="focus-divider" />
          <div className="focus-row"><span><Zap size={15} /> Recommended this week</span><strong>Resolve {dashboard.data.openRedFlags} open flags</strong></div>
          <Link href="/professionals" className="button button-outline button-full" data-testid="link-find-professionals">Find a professional <ArrowUpRight size={15} /></Link>
        </div>
      </section>
      {projects.data && projects.data.length > 1 && <section className="workspace-projects"><div className="panel-heading"><div><p className="section-kicker">Portfolio</p><h3>All society projects</h3></div></div><div className="project-mini-list">{projects.data.map((project) => <Link href={`/project/${project.id}`} className="project-mini-row" key={project.id} data-testid={`link-portfolio-project-${project.id}`}><span className="project-mini-icon"><Building2 size={17} /></span><span><strong>{project.name}</strong><small>{project.location}</small></span><span className="project-mini-readiness">{project.readiness}% ready</span><ChevronRight size={16} /></Link>)}</div></section>}
    </div>
  );
}

const requirementServices = ['Developer', 'PMC', 'Architect', 'Legal advisor', 'Structural consultant'];

function Assessment() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ reference: string; status: string; nextStep: string; projectId?: string; demo?: boolean } | null>(null);
  const [form, setForm] = useState({
    societyName: '', location: '', societyType: '', memberCount: '', buildingAge: '',
    landType: '', plotArea: '', conveyanceStatus: '', structuralAudit: '',
    services: [] as string[], timeline: '', brief: '', contactName: '', contactRole: '',
    phone: '', email: '', consent: false,
  });
  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  const toggleService = (service: string) => update('services', form.services.includes(service) ? form.services.filter((item) => item !== service) : [...form.services, service]);
  const canContinue = step === 1
    ? Boolean(form.societyName && form.location && form.societyType && form.memberCount && form.buildingAge)
    : step === 2
      ? Boolean(form.conveyanceStatus && form.structuralAudit)
      : step === 3
        ? Boolean(form.services.length && form.timeline)
        : Boolean(form.contactName && form.contactRole && form.phone.replace(/\D/g, '').length >= 10 && form.email.includes('@') && form.consent);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canContinue) return;
    const data = {
      societyName: form.societyName.trim(), location: form.location.trim(), societyType: form.societyType,
      memberCount: Number(form.memberCount), buildingAge: Number(form.buildingAge),
      landType: form.landType || undefined, plotArea: form.plotArea ? Number(form.plotArea) : undefined,
      conveyanceStatus: form.conveyanceStatus || undefined, structuralAudit: form.structuralAudit || undefined,
      services: form.services, timeline: form.timeline, brief: form.brief.trim() || undefined,
      contactName: form.contactName.trim(), contactRole: form.contactRole, phone: form.phone.trim(),
      email: form.email.trim(), consent: form.consent,
    };
    setIsSubmitting(true);
    fetch('/api/requirements', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
      .then(async (response) => {
        if (!response.ok) throw new Error('Live requirement intake is not connected yet.');
        return response.json() as Promise<{ reference: string; status: string; nextStep: string; projectId?: string }>;
      })
      .then((result) => setSubmitted(result))
      .catch(() => {
        const reference = `RNV-DEMO-${String(Date.now()).slice(-6)}`;
        localStorage.setItem('renova:last-requirement', JSON.stringify({ ...data, reference, savedAt: new Date().toISOString() }));
        setSubmitted({ reference, status: 'Saved on this device', nextStep: 'Connect the production database to route this requirement into RENOVA’s review queue.', demo: true });
      })
      .finally(() => setIsSubmitting(false));
  };

  if (submitted) return (
    <div className="requirement-success" data-testid="state-requirement-success">
      <div className="success-mark"><Check size={34} /></div>
      <p className="section-kicker">Requirement submitted</p>
      <h1>Your society has taken<br /><em>the first clear step.</em></h1>
      <p className="success-lead">Your requirement reference is <strong>{submitted.reference}</strong>. Keep it handy for future conversations with RENOVA.</p>
      <div className="submission-receipt">
        <div><span>Status</span><strong>{submitted.status}</strong></div>
        <div><span>Society</span><strong>{form.societyName}</strong></div>
        <div><span>Services requested</span><strong>{form.services.join(', ')}</strong></div>
        <div><span>Next step</span><strong>{submitted.nextStep}</strong></div>
      </div>
      {submitted.demo && <div className="demo-mode-note"><CircleHelp size={17} /><span>This submission is saved locally for the investor-ready demonstration. The live-data phase will add the production review queue and notifications.</span></div>}
      <div className="success-actions"><Link href="/" className="button button-outline"><ArrowLeft size={16} /> RENOVA home</Link><Link href="/workspace" className="button button-dark">Open society workspace <ArrowUpRight size={16} /></Link></div>
    </div>
  );

  return (
    <div className="requirement-page">
      <div className="requirement-brand-row"><Logo /><span>Society requirement</span><Link href="/workspace">Existing workspace <ArrowUpRight size={14} /></Link></div>
      <div className="requirement-heading">
        <Link href="/" className="back-link"><ArrowLeft size={15} /> RENOVA home</Link>
        <PageIntro kicker="Post your requirement · About 6 minutes" title={<>Put your society’s<br /><em>needs into focus.</em></>} detail="Share the essentials once. RENOVA will use this brief to understand the opportunity and prepare the right next conversation." />
      </div>
      <div className="requirement-shell">
        <aside className="requirement-progress" aria-label="Submission progress">
          {[['01', 'Society'], ['02', 'Property'], ['03', 'Requirement'], ['04', 'Contact']].map(([number, label], index) => <button type="button" key={number} onClick={() => index + 1 < step && setStep(index + 1)} className={cn(step === index + 1 && 'active', step > index + 1 && 'complete')}><span>{step > index + 1 ? <Check size={14} /> : number}</span><b>{label}</b><small>{index === 0 ? 'Who you are' : index === 1 ? 'What you have' : index === 2 ? 'What you need' : 'Who we contact'}</small></button>)}
          <div className="requirement-trust"><ShieldCheck size={20} /><strong>Your details stay private.</strong><p>RENOVA will not share them with third parties without your permission.</p></div>
        </aside>
        <form className="requirement-form" onSubmit={submit}>
          <div className="requirement-step-label"><span>Step {step} of 4</span><b>{step * 25}% complete</b></div>
          <div className="requirement-progress-bar"><i style={{ width: `${step * 25}%` }} /></div>
          {step === 1 && <div className="requirement-form-step"><div className="form-heading"><span className="step-number">01</span><div><h2>Tell us about your society</h2><p>Start with the details your committee already knows.</p></div></div><div className="requirement-fields"><label className="field-wide">Registered society name<input required value={form.societyName} onChange={(event) => update('societyName', event.target.value)} placeholder="e.g. Kirti Heights CHS" /></label><label className="field-wide">Area / locality<input required value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="e.g. Chembur, Mumbai" /></label><label>Society type<select required value={form.societyType} onChange={(event) => update('societyType', event.target.value)}><option value="">Select type</option><option>Co-operative Housing Society</option><option>Apartment Owners Association</option><option>MHADA Society</option><option>Cessed building</option></select></label><label>Member households<input required type="number" min="1" value={form.memberCount} onChange={(event) => update('memberCount', event.target.value)} placeholder="e.g. 48" /></label><label>Building age (years)<input required type="number" min="1" value={form.buildingAge} onChange={(event) => update('buildingAge', event.target.value)} placeholder="e.g. 36" /></label></div></div>}
          {step === 2 && <div className="requirement-form-step"><div className="form-heading"><span className="step-number">02</span><div><h2>Set the property context</h2><p>It is fine to choose “Not sure” where documents need review.</p></div></div><div className="requirement-fields"><label>Land tenure<select value={form.landType} onChange={(event) => update('landType', event.target.value)}><option value="">Not sure</option><option>Freehold</option><option>Leasehold</option><option>MHADA lease</option><option>Collector land</option></select></label><label>Approx. plot area (sq. m.)<input type="number" min="1" value={form.plotArea} onChange={(event) => update('plotArea', event.target.value)} placeholder="Optional" /></label><label className="field-wide">Conveyance status<select required value={form.conveyanceStatus} onChange={(event) => update('conveyanceStatus', event.target.value)}><option value="">Select status</option><option>Registered conveyance completed</option><option>Deemed conveyance completed</option><option>In progress</option><option>Not completed</option><option>Not sure</option></select></label><label className="field-wide">Structural audit<select required value={form.structuralAudit} onChange={(event) => update('structuralAudit', event.target.value)}><option value="">Select status</option><option>Completed in the last 3 years</option><option>Completed more than 3 years ago</option><option>In progress</option><option>Not completed</option><option>Not sure</option></select></label></div></div>}
          {step === 3 && <div className="requirement-form-step"><div className="form-heading"><span className="step-number">03</span><div><h2>What does your society need?</h2><p>Select every service you want RENOVA to help you explore.</p></div></div><div className="requirement-choice-grid">{requirementServices.map((service) => <button type="button" key={service} aria-pressed={form.services.includes(service)} onClick={() => toggleService(service)} className={cn('requirement-choice', form.services.includes(service) && 'selected')}><span>{form.services.includes(service) && <Check size={15} />}</span>{service}</button>)}</div><label className="requirement-block-label">Preferred starting timeline<select required value={form.timeline} onChange={(event) => update('timeline', event.target.value)}><option value="">Select timeline</option><option>Immediately</option><option>Within 3 months</option><option>Within 6 months</option><option>Exploring for the future</option></select></label><label className="requirement-block-label">Anything RENOVA should know? <small>Optional</small><textarea maxLength={1000} value={form.brief} onChange={(event) => update('brief', event.target.value)} placeholder="Share committee priorities, past attempts, document concerns or the support you need most." /><span className="character-count">{form.brief.length}/1000</span></label></div>}
          {step === 4 && <div className="requirement-form-step"><div className="form-heading"><span className="step-number">04</span><div><h2>Who should RENOVA contact?</h2><p>Use the details of an authorised committee representative.</p></div></div><div className="requirement-fields"><label>Full name<input required value={form.contactName} onChange={(event) => update('contactName', event.target.value)} placeholder="Contact person" /></label><label>Committee role<select required value={form.contactRole} onChange={(event) => update('contactRole', event.target.value)}><option value="">Select role</option><option>Chairperson</option><option>Secretary</option><option>Treasurer</option><option>Committee member</option><option>Authorised representative</option></select></label><label>Mobile number<input required type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="10-digit mobile number" /></label><label>Email address<input required type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="name@example.com" /></label></div><div className="requirement-review"><span>Requirement summary</span><div><strong>{form.societyName}</strong><small>{form.location} · {form.memberCount} households · {form.buildingAge}-year-old building</small></div><div><strong>{form.services.join(', ')}</strong><small>Preferred timeline: {form.timeline}</small></div></div><label className="consent-row"><input type="checkbox" checked={form.consent} onChange={(event) => update('consent', event.target.checked)} /><span>I confirm that I am authorised to submit this requirement and agree to be contacted by RENOVA about it.</span></label></div>}
          <div className="form-actions requirement-form-actions">{step > 1 ? <button type="button" className="button button-ghost" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</button> : <span />} {step < 4 ? <button type="button" className="button button-dark" disabled={!canContinue} onClick={() => setStep(step + 1)}>Continue <ChevronRight size={16} /></button> : <button className="button button-accent" disabled={!canContinue || isSubmitting}>{isSubmitting ? <LoaderCircle size={16} className="spin" /> : <Send size={16} />} {isSubmitting ? 'Submitting' : 'Submit requirement'}</button>}</div>
        </form>
      </div>
    </div>
  );
}

function ProjectDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const projectQuery = useGetProject(id, { query: { enabled: Boolean(id), queryKey: getGetProjectQueryKey(id) } });
  if (projectQuery.isLoading) return <LoadingPage label="Opening project readiness file" />;
  if (projectQuery.isError || !projectQuery.data) return <ErrorState onRetry={() => projectQuery.refetch()} label="This project readiness file is unavailable." />;
  const project = projectQuery.data;
  const pathway = project.pathway || [];
  return (
    <div className="content-stack">
      <Link href="/workspace" className="back-link" data-testid="link-back-overview"><ArrowLeft size={15} /> Back to overview</Link>
      <div className="project-header"><div><p className="section-kicker">Project readiness file</p><h1>{project.name}</h1><div className="meta-row"><span><MapPin size={14} /> {project.location}</span><span><Building2 size={14} /> {project.societyType}</span><span>Last updated {project.updatedAt}</span></div></div><button className="icon-button" aria-label="Project options" data-testid="button-project-options"><MoreHorizontal size={20} /></button></div>
      <section className="readiness-hero"><div className="readiness-copy"><span className="section-kicker">Your project, at a glance</span><h2>Clarity before commitment.</h2><p>Readiness is a living score built from your society’s documents, decisions, and due diligence.</p><div className="readiness-legend"><span><i className="legend-dot orange" /> Current score</span><span><i className="legend-dot pale" /> Path to ready</span></div></div><ProgressRing value={project.readiness} size={144} /></section>
      <div className="detail-grid">
        <section className="panel"><div className="panel-heading"><div><p className="section-kicker">Needs attention</p><h3>Open red flags <span className="count-badge">{project.redFlags.length}</span></h3></div><AlertTriangle size={20} className="icon-red" /></div>{project.redFlags.length ? <div className="red-flag-list">{project.redFlags.map((flag, index) => <div className="red-flag-item" key={`${flag}-${index}`} data-testid={`red-flag-${index}`}><span className="flag-number">0{index + 1}</span><div><strong>{flag}</strong><p>Resolve this before the next committee decision.</p></div><ChevronRight size={16} /></div>)}</div> : <EmptyState icon={CheckCircle2} title="No open red flags" detail="Your file is clear at this stage." />}</section>
        <section className="panel next-step-panel"><div className="panel-heading"><div><p className="section-kicker">Keep moving</p><h3>Next best step</h3></div><Compass size={20} className="icon-accent" /></div><div className="next-step-card"><span className="step-number">01</span><h4>{project.nextStep}</h4><p>Make this the next item on your committee agenda. A clear decision now prevents weeks of drift later.</p><button className="button button-dark button-full" data-testid="button-mark-next-step"><CheckCircle2 size={16} /> Mark as in progress</button></div></section>
      </div>
      <section className="panel pathway-panel"><div className="panel-heading"><div><p className="section-kicker">Regulatory pathway</p><h3>Route to redevelopment</h3></div><Link href="/regulations" className="subtle-button" data-testid="link-open-regulations">Open regulation centre <ExternalLink size={14} /></Link></div><div className="pathway">{pathway.length ? pathway.map((item, index) => <div className={cn('pathway-step', index === 0 && 'pathway-current')} key={`${item}-${index}`}><span className="pathway-marker">{index === 0 ? <Check size={14} /> : index + 1}</span><div><strong>{item}</strong><p>{index === 0 ? 'Current focus' : index === 1 ? 'Prepare with your committee' : 'Later in the journey'}</p></div>{index < pathway.length - 1 && <i />}</div>) : <EmptyState icon={Compass} title="Pathway being prepared" detail="Complete more of the assessment to reveal your recommended route." />}</div></section>
      <section className="project-footer-grid"><div className="project-facts"><span><UsersRound size={16} /> {project.memberCount || '—'} households</span><span><Landmark size={16} /> {project.landType || 'Tenure to confirm'}</span><span><Clock3 size={16} /> Stage: {project.stage}</span></div><Link href="/professionals" className="button button-outline" data-testid="link-project-professionals">Explore matched professionals <ArrowUpRight size={15} /></Link></section>
    </div>
  );
}

function Professionals() {
  const [role, setRole] = useState(() => new URLSearchParams(window.location.search).get('role') || '');
  const [search, setSearch] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>(() => readStoredArray<string>('renova:saved-professionals'));
  const [showSaved, setShowSaved] = useState(false);
  const [activeProfessionalId, setActiveProfessionalId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<'profile' | 'introduction'>('profile');
  const [introductionSent, setIntroductionSent] = useState(false);
  const [introductionNote, setIntroductionNote] = useState('');
  const params = useMemo(() => ({ role: role || undefined }), [role]);
  const professionals = useListProfessionals(params, { query: { queryKey: getListProfessionalsQueryKey(params) } });
  if (professionals.isLoading) return <LoadingPage label="Finding the right people for your project" />;
  if (professionals.isError) return <ErrorState onRetry={() => professionals.refetch()} label="The professional directory is unavailable." />;
  const activeProfessional = (professionals.data || []).find((person) => person.id === activeProfessionalId);
  const filtered = (professionals.data || []).filter((person) => (!showSaved || savedIds.includes(person.id)) && `${person.name} ${person.role} ${person.location} ${person.specialties.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const saveProfessional = (id: string) => {
    const next = savedIds.includes(id) ? savedIds.filter((savedId) => savedId !== id) : [...savedIds, id];
    setSavedIds(next);
    localStorage.setItem('renova:saved-professionals', JSON.stringify(next));
  };
  const openProfessional = (id: string, mode: 'profile' | 'introduction') => {
    setActiveProfessionalId(id);
    setDrawerMode(mode);
    setIntroductionSent(false);
    setIntroductionNote('');
  };
  const requestIntroduction = () => {
    if (!activeProfessional) return;
    const requests = readStoredArray<{ professionalId: string; note: string; requestedAt: string }>('renova:introduction-requests');
    localStorage.setItem('renova:introduction-requests', JSON.stringify([...requests, { professionalId: activeProfessional.id, note: introductionNote.trim(), requestedAt: new Date().toISOString() }]));
    setIntroductionSent(true);
  };
  return (
    <div className="content-stack">
      <PageIntro kicker="The people around the table" title={<>Find expertise<br /><em>that earns trust.</em></>} detail="A considered shortlist of professionals matched to the realities of Mumbai society redevelopment." action={<button className={cn('button button-outline', showSaved && 'button-selected')} onClick={() => { setShowSaved((current) => !current); setRole(''); }} data-testid="button-save-shortlist"><Check size={16} /> Saved shortlist <span className="button-count">{savedIds.length}</span></button>} />
      <div className="directory-toolbar"><div className="search-field"><Search size={17} /><input type="search" placeholder="Search by name, role, or specialty" value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-professionals" /></div><div className="filter-group"><Filter size={15} /><span>Filter by</span>{['', 'Developer', 'PMC', 'Architect', 'Legal', 'Technical'].map((item) => <button key={item || 'all'} className={cn('filter-chip', role === item && 'selected')} onClick={() => setRole(item)} data-testid={`button-filter-${item || 'all'}`}>{item || 'All roles'}</button>)}</div><button className="icon-button filter-mobile" onClick={() => setRole('')} aria-label="Clear role filter" data-testid="button-more-filters"><SlidersHorizontal size={17} /></button></div>
      <div className="directory-result-bar"><span>{filtered.length} verified matches</span>{(search || role || showSaved) && <button type="button" onClick={() => { setSearch(''); setRole(''); setShowSaved(false); }}>Reset view <RotateCcw size={13} /></button>}</div>
      {filtered.length ? <div className="professional-list">{filtered.map((person) => <article className="professional-card" key={person.id} data-testid={`card-professional-${person.id}`}><div className="professional-top"><span className="professional-avatar">{person.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div className="professional-title"><h3>{person.name} {person.verified && <BadgeCheck size={16} />}</h3><p>{person.role} · {person.location}</p></div><button className={cn('save-button', savedIds.includes(person.id) && 'saved')} onClick={() => saveProfessional(person.id)} aria-pressed={savedIds.includes(person.id)} aria-label={`${savedIds.includes(person.id) ? 'Remove' : 'Save'} ${person.name}`} data-testid={`button-save-${person.id}`}><Check size={16} /></button></div><div className="professional-match"><span><strong>{person.match}%</strong> match</span><div><i style={{ width: `${person.match}%` }} /></div><span className="experience">{person.experience}</span></div><div className="specialty-list">{person.specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}</div><div className="professional-actions"><button className="button button-dark" onClick={() => openProfessional(person.id, 'introduction')} data-testid={`button-request-intro-${person.id}`}>Request introduction <ArrowUpRight size={14} /></button><button className="text-link" onClick={() => openProfessional(person.id, 'profile')} data-testid={`button-view-profile-${person.id}`}>View profile <ChevronRight size={14} /></button></div></article>)}</div> : <EmptyState icon={UsersRound} title={showSaved ? 'Your shortlist is ready to begin' : 'No professionals match that search'} detail={showSaved ? 'Save trusted professionals to compare them here.' : 'Try a broader role or a different search term.'} action={<button className="button button-ghost" onClick={() => { setSearch(''); setRole(''); setShowSaved(false); }} data-testid="button-clear-professionals">Clear filters</button>} />}
      <ExperienceDrawer open={Boolean(activeProfessional)} onClose={() => setActiveProfessionalId(null)} eyebrow={drawerMode === 'profile' ? 'Verified RENOVA network' : 'Private introduction request'} title={activeProfessional?.name || 'Professional'}>
        {activeProfessional && <>{drawerMode === 'profile' ? <div className="profile-detail"><div className="profile-identity"><span className="professional-avatar professional-avatar-large">{activeProfessional.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><StatusPill tone="green">Verified</StatusPill><p>{activeProfessional.role} · {activeProfessional.location}</p></div></div><div className="profile-score"><strong>{activeProfessional.match}%</strong><span>project match</span><i><b style={{ width: `${activeProfessional.match}%` }} /></i></div><div className="profile-facts"><div><span>Experience</span><strong>{activeProfessional.experience}</strong></div><div><span>Specialisms</span><strong>{activeProfessional.specialties.length} relevant areas</strong></div></div><div><p className="drawer-label">Relevant expertise</p><div className="specialty-list">{activeProfessional.specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}</div></div><div className="drawer-note"><ShieldCheck size={18} /><p>RENOVA reviews credentials and project relevance before professionals enter the network. Societies should complete their own appointment due diligence.</p></div><button className="button button-dark button-full" onClick={() => setDrawerMode('introduction')}>Request an introduction <ArrowUpRight size={15} /></button></div> : introductionSent ? <div className="drawer-success"><span><Check size={30} /></span><h3>Request saved</h3><p>RENOVA will review the fit and prepare the next conversation. Your society’s contact details are never shared automatically.</p><button className="button button-outline" onClick={() => setActiveProfessionalId(null)}>Done</button></div> : <div className="introduction-card"><div className="drawer-note"><ShieldCheck size={18} /><p>This is a private request. RENOVA reviews both sides before making an introduction.</p></div><div className="intro-summary"><span>Professional</span><strong>{activeProfessional.name}</strong><small>{activeProfessional.role} · {activeProfessional.match}% match</small></div><label>What support do you need?<textarea value={introductionNote} onChange={(event) => setIntroductionNote(event.target.value)} placeholder="Briefly describe your society’s current stage and the help you need." /></label><button className="button button-dark button-full" disabled={introductionNote.trim().length < 10} onClick={requestIntroduction}>Send request <Send size={15} /></button></div>}</>}
      </ExperienceDrawer>
    </div>
  );
}

function Regulations() {
  const regulations = useListRegulations();
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('All');
  const [activeRegulationId, setActiveRegulationId] = useState<string | null>(null);
  const [showOrientation, setShowOrientation] = useState(false);
  if (regulations.isLoading) return <LoadingPage label="Loading the regulation centre" />;
  if (regulations.isError) return <ErrorState onRetry={() => regulations.refetch()} label="The regulation centre is unavailable." />;
  const statuses = ['All', ...Array.from(new Set((regulations.data || []).map((item) => item.status)))];
  const filtered = (regulations.data || []).filter((item) => (activeStatus === 'All' || item.status === activeStatus) && `${item.code} ${item.title} ${item.summary} ${item.authority}`.toLowerCase().includes(search.toLowerCase()));
  const activeRegulation = (regulations.data || []).find((item) => item.id === activeRegulationId);
  const downloadGuide = () => {
    const guide = ['RENOVA — SOCIETY REDEVELOPMENT COMMITTEE STARTER GUIDE', '', '1. Record the society’s redevelopment intent and committee authority.', '2. Collect title, conveyance, property-card and structural-audit records.', '3. Commission an independent feasibility study before inviting proposals.', '4. Define transparent evaluation criteria for PMC, architect and developer selection.', '5. Record every resolution, disclosure and member communication.', '', 'Important: This guide is an orientation tool, not legal or technical advice. Verify the applicable pathway with qualified professionals and the relevant authority.'].join('\n');
    const url = URL.createObjectURL(new Blob([guide], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'RENOVA-committee-starter-guide.txt';
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="content-stack">
      <PageIntro kicker="Know the rules before you negotiate" title={<>The regulation<br /><em>centre.</em></>} detail="Plain-language guidance for the permissions, notices, and approvals that shape your redevelopment." action={<button className="button button-outline" onClick={downloadGuide} data-testid="button-regulation-guide"><FileText size={16} /> Download committee guide</button>} />
      <div className="regulation-feature"><div><span className="feature-label"><BookOpenText size={15} /> Start here</span><h2>What changes when<br />your society redevelops?</h2><p>A practical orientation to the decisions your committee will make, from consent to conveyance.</p><button className="text-link light-link" onClick={() => setShowOrientation(true)} data-testid="button-read-orientation">Read the orientation <ArrowUpRight size={15} /></button></div><div className="feature-lines"><span>01&nbsp; Consent</span><span>02&nbsp; Feasibility</span><span>03&nbsp; Appointment</span><span>04&nbsp; Approvals</span></div></div>
      <div className="directory-toolbar regulation-toolbar"><div className="search-field"><Search size={17} /><input type="search" placeholder="Search codes, topics, or authorities" value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-regulations" /></div><div className="filter-group"><ListFilter size={15} /><span>Show</span>{statuses.map((status) => <button key={status} className={cn('filter-chip', activeStatus === status && 'selected')} onClick={() => setActiveStatus(status)} data-testid={`button-regulation-filter-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</button>)}</div></div>
      <div className="directory-result-bar"><span>{filtered.length} guidance notes</span>{(search || activeStatus !== 'All') && <button type="button" onClick={() => { setSearch(''); setActiveStatus('All'); }}>Reset view <RotateCcw size={13} /></button>}</div>
      <div className="regulation-list">{filtered.length ? filtered.map((item) => <article className="regulation-row" key={item.id} data-testid={`row-regulation-${item.id}`}><div className="regulation-code">{item.code}</div><div className="regulation-copy"><div className="regulation-title-row"><h3>{item.title}</h3><StatusPill tone={item.status.toLowerCase().includes('active') || item.status.toLowerCase().includes('current') ? 'green' : 'neutral'}>{item.status}</StatusPill></div><p>{item.summary}</p><div className="regulation-meta"><span><Landmark size={13} /> {item.authority}</span><span><CalendarDays size={13} /> Updated {item.updatedAt}</span></div></div><button className="icon-button regulation-open" onClick={() => setActiveRegulationId(item.id)} aria-label={`Open ${item.code}`} data-testid={`button-open-regulation-${item.id}`}><ArrowUpRight size={17} /></button></article>) : <EmptyState icon={BookOpenText} title="No guidance found" detail="Try searching for a code, authority, or topic." />}</div>
      <ExperienceDrawer open={showOrientation} onClose={() => setShowOrientation(false)} eyebrow="Redevelopment orientation" title="Four decisions shape a safer start">
        <div className="orientation-steps">{[['01', 'Build informed consent', 'Give members the same facts, record questions and define how decisions will be taken.'], ['02', 'Establish feasibility', 'Understand title, land, planning potential, liabilities and realistic project economics.'], ['03', 'Appoint independently', 'Use documented criteria and conflict disclosures when selecting advisors and development partners.'], ['04', 'Protect execution', 'Track approvals, bank guarantees, milestones, member obligations and handover evidence.']].map(([number, title, detail]) => <article key={number}><span>{number}</span><div><strong>{title}</strong><p>{detail}</p></div></article>)}</div>
        <div className="drawer-note"><AlertTriangle size={18} /><p>Applicable rules depend on land tenure, building category and authority. Confirm your route with qualified legal and technical advisors.</p></div>
      </ExperienceDrawer>
      <ExperienceDrawer open={Boolean(activeRegulation)} onClose={() => setActiveRegulationId(null)} eyebrow={`Guidance note · ${activeRegulation?.code || ''}`} title={activeRegulation?.title || 'Regulation guidance'}>
        {activeRegulation && <div className="regulation-detail"><div className="regulation-detail-status"><StatusPill tone="green">{activeRegulation.status}</StatusPill><span>Reviewed {activeRegulation.updatedAt}</span></div><p className="regulation-detail-lead">{activeRegulation.summary}</p><div className="profile-facts"><div><span>Authority</span><strong>{activeRegulation.authority}</strong></div><div><span>RENOVA status</span><strong>Orientation available</strong></div></div><div><p className="drawer-label">Committee questions to confirm</p><ul><li>Does the society and its land fall within this pathway?</li><li>Which documents establish eligibility and development potential?</li><li>Which authority approvals and member resolutions apply?</li><li>What should be independently verified before proposals are compared?</li></ul></div><div className="drawer-note"><ShieldCheck size={18} /><p>RENOVA presents plain-language orientation. The governing notification, circular or regulation and professional advice remain authoritative.</p></div><Link href="/professionals?role=Legal" className="button button-dark button-full">Find a legal advisor <ArrowUpRight size={15} /></Link></div>}
      </ExperienceDrawer>
    </div>
  );
}

const publicNav = [
  { href: '#listings', label: 'Listings' },
  { href: '#opportunities', label: 'Opportunities' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#why-renova', label: 'Why RENOVA' },
];

const stakeholderCards = [
  { title: 'Find a Developer', detail: 'Explore verified developers suited to your society and project.', icon: Building2, href: '/professionals?role=Developer' },
  { title: 'Explore Societies', detail: 'Discover genuine redevelopment opportunities across Mumbai.', icon: Landmark, href: '#opportunities' },
  { title: 'Find a PMC', detail: 'Bring structure, evaluation and oversight to your redevelopment.', icon: ClipboardCheck, href: '/professionals?role=PMC' },
  { title: 'Find an Architect', detail: 'Connect with practices ready to shape what comes next.', icon: Compass, href: '/professionals?role=Architect' },
];

const featuredOpportunities = [
  { status: 'Ready to explore', name: 'Ashirwad CHS', location: 'Andheri West', detail: 'A resident-led opportunity seeking a transparent redevelopment partner.', age: '42 yrs', homes: '96', area: '1.8 acres', scale: '₹80–120 Cr' },
  { status: 'Shortlisting', name: 'Shantivan Cooperative', location: 'Chembur', detail: 'Large-format society with a clear committee mandate and strong connectivity.', age: '38 yrs', homes: '144', area: '2.4 acres', scale: '₹120–180 Cr' },
  { status: 'New opportunity', name: 'Sea Breeze Apartments', location: 'Bandra East', detail: 'An established community looking for a capable PMC to begin feasibility.', age: '51 yrs', homes: '58', area: '0.9 acres', scale: '₹45–70 Cr' },
  { status: 'Open for proposals', name: 'Navjeevan Nagar', location: 'Vikhroli', detail: 'A high-potential opportunity near major transit and employment corridors.', age: '34 yrs', homes: '212', area: '3.1 acres', scale: '₹180–260 Cr' },
];

const trustBenefits = [
  { title: 'Verified Trust', detail: 'Developers, PMCs and professionals are reviewed before they enter the RENOVA network.', icon: ShieldCheck },
  { title: 'Accelerated Timelines', detail: 'Structured requirements and milestone tracking reduce avoidable delays.', icon: Zap },
  { title: 'Absolute Transparency', detail: 'Clear context, project details and expectations support better decisions.', icon: Eye },
];

function CinematicLogoReveal({ onFinish }: { onFinish: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(onFinish, 8400);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [onFinish]);

  return (
    <div className="cinematic-logo-reveal" role="img" aria-label="A luminous architectural tower opens from the centre to reveal RENOVA, redevelopment reimagined">
      <button type="button" className="cinematic-skip" onClick={onFinish}>Skip intro</button>
      <div className="cinematic-atmosphere" aria-hidden="true" />
      <div className="cinematic-stage" aria-hidden="true">
        <div className="cinematic-wordmark">
          <span className="cinematic-eyebrow">MUMBAI · REDEVELOPMENT ECOSYSTEM</span>
          <strong className="cinematic-title" aria-label="RENOVA">
            <span className="cinematic-letter cinematic-letter-r">R</span>
            <span className="cinematic-letter cinematic-letter-existing">E</span>
            <span className="cinematic-letter cinematic-letter-new">N</span>
            <span className="cinematic-letter cinematic-letter-new">O</span>
            <span className="cinematic-letter cinematic-letter-new">V</span>
            <span className="cinematic-letter cinematic-letter-a">A</span>
          </strong>
          <span className="cinematic-tagline">REDEVELOPMENT, REIMAGINED.</span>
        </div>
        <svg className="cinematic-building-scene" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="existing-stone" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0d3d79" /><stop offset=".48" stopColor="#092556" /><stop offset="1" stopColor="#030d27" />
            </linearGradient>
            <linearGradient id="tower-stone" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#54bcff" /><stop offset=".44" stopColor="#1769c4" /><stop offset="1" stopColor="#062b68" />
            </linearGradient>
            <linearGradient id="tower-glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#97e3ff" /><stop offset=".2" stopColor="#168cff" /><stop offset=".58" stopColor="#063c91" /><stop offset="1" stopColor="#020d2b" />
            </linearGradient>
            <linearGradient id="glass-sheen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity=".04" /><stop offset=".38" stopColor="#fff" stopOpacity=".42" /><stop offset=".5" stopColor="#fff" stopOpacity=".08" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="balcony-metal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d5f5ff" /><stop offset="1" stopColor="#398fd5" />
            </linearGradient>
            <linearGradient id="warm-interior" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe4a9" /><stop offset="1" stopColor="#ba612a" />
            </linearGradient>
            <linearGradient id="light-cut" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".25" stopColor="#d7f6ff" /><stop offset=".65" stopColor="#198cff" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <pattern id="window-grid-left" width="42" height="48" patternUnits="userSpaceOnUse">
              <rect x="4" y="5" width="29" height="31" rx="1" fill="#02183e" stroke="#54bcff" strokeOpacity=".58" /><rect x="7" y="8" width="12" height="25" fill="#83dcff" fillOpacity=".2" /><rect x="22" y="8" width="8" height="25" fill="url(#warm-interior)" fillOpacity=".42" /><path d="M3 40h33" stroke="#77ccff" strokeOpacity=".72" />
            </pattern>
            <pattern id="window-grid-right" width="42" height="48" patternUnits="userSpaceOnUse">
              <rect x="8" y="5" width="29" height="31" rx="1" fill="#02183e" stroke="#54bcff" strokeOpacity=".58" /><rect x="11" y="8" width="8" height="25" fill="url(#warm-interior)" fillOpacity=".42" /><rect x="22" y="8" width="12" height="25" fill="#83dcff" fillOpacity=".2" /><path d="M7 40h33" stroke="#77ccff" strokeOpacity=".72" />
            </pattern>
            <filter id="tower-shadow" x="-80%" y="-25%" width="260%" height="180%"><feDropShadow dx="0" dy="20" stdDeviation="18" floodColor="#00050c" floodOpacity=".72" /></filter>
            <filter id="cinematic-glow" x="-200%" y="-30%" width="500%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <ellipse className="cinematic-ground-shadow" cx="600" cy="632" rx="205" ry="21" />

          <g className="cinematic-tower" filter="url(#tower-shadow)">
          <g className="cinematic-building-half cinematic-building-left">
            <path className="cinematic-modern-face cinematic-tower-silhouette" d="M420 610V164L454 122V92L478 66H600V610Z" fill="url(#tower-glass)" /><path className="cinematic-modern-face cinematic-stone-wing" d="M420 610V164L454 122H490V610Z" fill="url(#tower-stone)" /><path className="cinematic-modern-face" d="M492 96H600V610H492Z" fill="url(#window-grid-left)" /><path className="cinematic-modern-face cinematic-glass-sheen" d="M505 96H563V610H505Z" fill="url(#glass-sheen)" />
            <path className="cinematic-modern-grid" d="M482 139H600M482 187H600M482 235H600M482 283H600M482 331H600M482 379H600M482 427H600M482 475H600M482 523H600M482 571H600" /><path className="cinematic-modern-face cinematic-balcony-slab" d="M444 188H600v7H444zm-9 96h165v7H435zm-5 96h170v7H430zm-2 96h172v7H428zm-1 96h173v7H427z" fill="url(#balcony-metal)" /><path className="cinematic-modern-face cinematic-balcony-rail" d="M449 164v24m19-24v24m-29 96v24m20-24v24m-28 96v24m20-24v24m-22 96v24m21-24v24m-21 96v24m21-24v24" />
            <path className="cinematic-modern-face cinematic-crown" d="M478 66H600V91H454Z" fill="#72caff" /><path className="cinematic-modern-face cinematic-crown-glass" d="M496 73H600V88H481Z" fill="#0d5ca7" /><path className="cinematic-old-face" d="M420 610V164L454 122V92L478 66H600V610Z" fill="url(#existing-stone)" /><path className="cinematic-old-detail" d="M444 151H600M444 218H600M444 285H600M444 352H600M444 419H600M444 486H600M444 553H600M480 119V610M530 86V610" /><path className="cinematic-copper-edge" d="M465 610V133" />
          </g>

          <g className="cinematic-building-half cinematic-building-right">
            <path className="cinematic-modern-face cinematic-tower-silhouette" d="M600 66H722L746 92V122L780 164V610H600Z" fill="url(#tower-glass)" /><path className="cinematic-modern-face cinematic-stone-wing" d="M710 122H746L780 164V610H710Z" fill="url(#tower-stone)" /><path className="cinematic-modern-face" d="M600 96H708V610H600Z" fill="url(#window-grid-right)" /><path className="cinematic-modern-face cinematic-glass-sheen" d="M637 96H695V610H637Z" fill="url(#glass-sheen)" />
            <path className="cinematic-modern-grid" d="M600 139H718M600 187H718M600 235H718M600 283H718M600 331H718M600 379H718M600 427H718M600 475H718M600 523H718M600 571H718" /><path className="cinematic-modern-face cinematic-balcony-slab" d="M600 188h156v7H600zm0 96h165v7H600zm0 96h170v7H600zm0 96h172v7H600zm0 96h173v7H600z" fill="url(#balcony-metal)" /><path className="cinematic-modern-face cinematic-balcony-rail" d="M751 164v24m-19-24v24m29 96v24m-20-24v24m28 96v24m-20-24v24m22 96v24m-21-24v24m21 96v24m-21-24v24" />
            <path className="cinematic-modern-face cinematic-crown" d="M600 66H722L746 91H600Z" fill="#72caff" /><path className="cinematic-modern-face cinematic-crown-glass" d="M600 73H704L719 88H600Z" fill="#0d5ca7" /><path className="cinematic-old-face" d="M600 66H722L746 92V122L780 164V610H600Z" fill="url(#existing-stone)" /><path className="cinematic-old-detail" d="M600 151H756M600 218H756M600 285H756M600 352H756M600 419H756M600 486H756M600 553H756M720 119V610M670 86V610" /><path className="cinematic-copper-edge" d="M735 610V133" />
          </g>
          </g>

          <path className="cinematic-light-line" d="M600 42V630" stroke="url(#light-cut)" filter="url(#cinematic-glow)" />
        </svg>
      </div>
      <div className="cinematic-story" aria-hidden="true"><span>EXISTING</span><i /><span>TRANSFORMATION</span><i /><span>REIMAGINED</span></div>
    </div>
  );
}

function MarketingHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoReveal, setShowLogoReveal] = useState(true);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [activeOpportunityName, setActiveOpportunityName] = useState<string | null>(null);
  const activeOpportunity = featuredOpportunities.find((item) => item.name === activeOpportunityName);
  return (
    <div className="marketing-site stitch-site" id="top">
      {showLogoReveal && <CinematicLogoReveal onFinish={() => setShowLogoReveal(false)} />}
      <header className="stitch-header">
        <div className="stitch-header-inner">
          <button className="stitch-menu" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="Toggle navigation">
            {menuOpen ? <X size={20} /> : <Compass size={20} />}
          </button>
          <Logo />
          <button className="stitch-notification" onClick={() => setUpdatesOpen((open) => !open)} aria-expanded={updatesOpen} aria-label="RENOVA updates"><Bell size={19} /><span className="stitch-notification-dot" /></button>
          <nav className={cn('stitch-desktop-nav', menuOpen && 'is-open')} aria-label="RENOVA website navigation">
            <a href="#top" onClick={() => setMenuOpen(false)}>Home</a>
            {publicNav.map((item) => <a href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>)}
            <Link href="/assessment" onClick={() => setMenuOpen(false)}>Post requirement</Link>
          </nav>
          {updatesOpen && <div className="stitch-update-popover"><div><span>RENOVA pulse</span><button type="button" onClick={() => setUpdatesOpen(false)} aria-label="Close updates"><X size={16} /></button></div><article><BadgeCheck size={17} /><p><strong>Verified network growing</strong><span>New PMCs and architects are being reviewed for Mumbai societies.</span></p></article><article><Building2 size={17} /><p><strong>4 opportunities open</strong><span>Explore active society requirements across the city.</span></p></article><Link href="/assessment" onClick={() => setUpdatesOpen(false)}>Post your requirement <ArrowUpRight size={14} /></Link></div>}
        </div>
      </header>

      <main>
        <section className="stitch-hero" aria-labelledby="renova-hero-title">
          <div className="stitch-hero-image" role="img" aria-label="A contemporary residential redevelopment tower in Mumbai" />
          <div className="stitch-hero-overlay" />
          <div className="stitch-hero-frame" aria-hidden="true" />
          <div className="stitch-hero-meta" aria-hidden="true"><span>01 / Mumbai</span><span>19.0760° N&nbsp;&nbsp;72.8777° E</span></div>

          <div className="stitch-hero-copy">
            <p className="stitch-eyebrow">Redevelopment, reimagined.</p>
            <h1 id="renova-hero-title"><span>Renew Mumbai.</span><span>Responsibly.</span></h1>
            <p>RENOVA brings societies, developers and specialists into one clear, professional redevelopment process.</p>
            <div className="stitch-hero-actions">
              <Link href="/assessment" className="stitch-primary-button">Post a requirement <ArrowUpRight size={15} /></Link>
              <a href="#opportunities" className="stitch-secondary-button">View opportunities <ArrowUpRight size={15} /></a>
            </div>
          </div>

          <div className="stitch-hero-word" aria-hidden="true">RENOVA</div>
          <div className="stitch-hero-index" aria-label="RENOVA connects the redevelopment ecosystem">
            <span>For societies</span><span>For developers</span><span>For professionals</span><span>Explore RENOVA <ArrowUpRight size={14} /></span>
          </div>
        </section>

        <section className="stitch-actions" id="listings" aria-label="Explore RENOVA">
          <div className="stitch-action-grid">
            {stakeholderCards.map(({ title, detail, icon: Icon, href }) => (
              href.startsWith('/') ? (
                <Link href={href} className="stitch-action-card" key={title}>
                  <span className="stitch-action-icon"><Icon size={22} /></span><strong>{title}</strong><p>{detail}</p><ArrowUpRight size={15} />
                </Link>
              ) : (
                <a href={href} className="stitch-action-card" key={title}>
                  <span className="stitch-action-icon"><Icon size={22} /></span><strong>{title}</strong><p>{detail}</p><ArrowUpRight size={15} />
                </a>
              )
            ))}
          </div>
        </section>

        <section className="stitch-section stitch-opportunities" id="opportunities">
          <div className="stitch-section-heading">
            <div><p>Live possibilities</p><h2>Current redevelopment opportunities</h2></div>
            <Link href="/assessment">Post an opportunity <ArrowUpRight size={14} /></Link>
          </div>
          <div className="stitch-opportunity-grid">
            {featuredOpportunities.map((item) => (
              <article className="stitch-opportunity-card" key={item.name}>
                <span className="stitch-status">{item.status}</span>
                <h3>{item.name}</h3>
                <p><MapPin size={14} /> {item.location}</p>
                <p className="stitch-opportunity-detail">{item.detail}</p>
                <div>
                  <span>Building age<strong>{item.age}</strong></span>
                  <span>Homes<strong>{item.homes}</strong></span>
                  <span>Site area<strong>{item.area}</strong></span>
                </div>
                <button type="button" className="stitch-details-button" onClick={() => setActiveOpportunityName(item.name)}>View opportunity · {item.scale} <ArrowUpRight size={14} /></button>
              </article>
            ))}
          </div>
        </section>

        <section className="stitch-section stitch-why" id="why-renova">
          <div className="stitch-section-heading stitch-heading-stack">
            <div><p>A clearer way forward</p><h2>Why RENOVA?</h2></div>
            <span>Streamlining redevelopment through structured processes, verified connections and absolute clarity.</span>
          </div>
          <div className="stitch-benefit-grid">
            {trustBenefits.map(({ title, detail, icon: Icon }) => (
              <article key={title}><span><Icon size={22} /></span><div><h3>{title}</h3><p>{detail}</p></div></article>
            ))}
          </div>
        </section>

        <section className="stitch-section stitch-process" id="how-it-works">
          <div className="stitch-section-heading stitch-heading-stack">
            <div><p>How it works</p><h2>From requirement to right connection.</h2></div>
          </div>
          <div className="stitch-process-grid">
            {[['01', 'Make your intent clear', 'Tell us where you are in the journey, from first conversation to a ready opportunity.'], ['02', 'Meet the right people', 'Explore a focused network of developers, PMCs, architects and advisors.'], ['03', 'Move forward, together', 'Shortlist a match, start a conversation and shape a better brief.']].map(([number, title, detail]) => (
              <article key={number}><span>{number}</span><h3>{title}</h3><p>{detail}</p></article>
            ))}
          </div>
          <div className="stitch-requirement-cta" id="requirement">
            <div><p>Ready to begin?</p><h2>Start your society's redevelopment journey.</h2></div>
            <Link href="/assessment" className="stitch-primary-button">Post your requirement <ArrowUpRight size={16} /></Link>
          </div>
        </section>

        <section className="stitch-section stitch-about" id="about">
          <p>About RENOVA</p>
          <h2>Renewing communities. Restoring ageing properties. Creating better possibilities for Mumbai.</h2>
          <div>
            <p>RENOVA is a redevelopment-focused platform and service ecosystem that brings housing societies, developers, PMCs, architects and specialists together.</p>
            <Link href="/regulations">Open knowledge centre <BookOpenText size={16} /></Link>
          </div>
        </section>
      </main>

      <footer className="stitch-footer" id="contact">
        <div><Logo /><p>Renew. Connect. Redevelop.</p></div>
        <div><a href="#listings">Listings</a><a href="#opportunities">Opportunities</a><Link href="/regulations">Knowledge centre</Link><Link href="/assessment">Post requirement</Link></div>
        <small>© {new Date().getFullYear()} RENOVA · Mumbai</small>
      </footer>

      <nav className="stitch-bottom-nav" aria-label="Mobile navigation">
        <a href="#top" className="active"><Home size={20} /><span>Home</span></a>
        <a href="#listings"><Building2 size={20} /><span>Listings</span></a>
        <a href="#opportunities"><Handshake size={20} /><span>Opportunities</span></a>
        <Link href="/assessment"><Plus size={22} /><span>Post</span></Link>
      </nav>
      <ExperienceDrawer open={Boolean(activeOpportunity)} onClose={() => setActiveOpportunityName(null)} eyebrow="Verified redevelopment opportunity" title={activeOpportunity?.name || 'Opportunity'}>
        {activeOpportunity && <div className="opportunity-detail"><div className="opportunity-detail-top"><span className="stitch-status">{activeOpportunity.status}</span><p><MapPin size={15} /> {activeOpportunity.location}</p></div><p className="regulation-detail-lead">{activeOpportunity.detail}</p><div className="opportunity-metrics"><div><span>Building age</span><strong>{activeOpportunity.age}</strong></div><div><span>Member homes</span><strong>{activeOpportunity.homes}</strong></div><div><span>Site area</span><strong>{activeOpportunity.area}</strong></div><div><span>Indicative scale</span><strong>{activeOpportunity.scale}</strong></div></div><div><p className="drawer-label">Current requirement</p><ul><li>Initial fit assessment and stakeholder verification</li><li>Professional support appropriate to the society’s stage</li><li>Transparent next-step discussion through RENOVA</li></ul></div><div className="drawer-note"><ShieldCheck size={18} /><p>Detailed society documents and contact information are shared only after an approved introduction.</p></div><Link href="/assessment" className="button button-dark button-full">Express interest through RENOVA <ArrowUpRight size={15} /></Link></div>}
      </ExperienceDrawer>
    </div>
  );
}

function WorkspaceRouter() {
  return <Switch><Route path="/workspace" component={Overview} /><Route path="/assessment" component={Assessment} /><Route path="/project/:id" component={ProjectDetail} /><Route path="/professionals" component={Professionals} /><Route path="/regulations" component={Regulations} /><Route component={NotFound} /></Switch>;
}

function Router() {
  const [location] = useLocation();
  if (location === '/') return <MarketingHome />;
  if (location === '/assessment') return <Assessment />;
  return <AppShell><WorkspaceRouter /></AppShell>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
