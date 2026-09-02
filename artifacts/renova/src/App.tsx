import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
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
  FileText,
  Filter,
  HardHat,
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
  useCreateProject,
  useGetDashboard,
  useGetProject,
  useHealthCheck,
  useListProfessionals,
  useListProjects,
  useListRegulations,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import './index.css';
import './marketing.css';

const queryClient = new QueryClient();

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function Logo() {
  return (
    <Link href="/" className="brand-lockup" data-testid="link-home">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      <span className="brand-name">RENOVA</span>
    </Link>
  );
}

const navItems = [
  { href: '/workspace', label: 'Overview', icon: LayoutDashboard },
  { href: '/assessment', label: 'New assessment', icon: ClipboardCheck },
  { href: '/professionals', label: 'Professionals', icon: UsersRound },
  { href: '/regulations', label: 'Regulation centre', icon: BookOpenText },
];

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
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
              {label === 'New assessment' && <span className="nav-dot" />}
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
            <button className="topbar-help" data-testid="button-help"><CircleHelp size={17} /> Help desk</button>
            <button className="notification-button" aria-label="Notifications" data-testid="button-notifications"><ActivityIcon size={18} /><span /></button>
            <span className="topbar-user">AR</span>
          </div>
        </header>
        <div className="page-wrap">
          <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>
        </div>
      </main>
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
  const { activeProject, recentActivity } = dashboard.data;

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

function Assessment() {
  const [, setLocation] = useLocation();
  const createProject = useCreateProject();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', location: '', societyType: '', landType: '', memberCount: '' });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    createProject.mutate({ data: { name: form.name, location: form.location, societyType: form.societyType, landType: form.landType || undefined, memberCount: form.memberCount ? Number(form.memberCount) : undefined } }, { onSuccess: (project) => setLocation(`/project/${project.id}`) });
  };
  const canContinue = step === 1 ? form.name && form.location : form.societyType && form.memberCount;
  return (
    <div className="assessment-layout">
      <div className="assessment-main">
        <PageIntro kicker="Guided assessment · 04 minutes" title={<>Start with the<br /><em>right questions.</em></>} detail="We’ll build a practical redevelopment brief for your committee. No jargon, no guesswork." />
        <div className="assessment-steps"><span className={cn(step >= 1 && 'done')}>01 <b>Society basics</b></span><i /><span className={cn(step >= 2 && 'done')}>02 <b>Property context</b></span><i /><span className={cn(step >= 3 && 'done')}>03 <b>Your brief</b></span></div>
        <form className="assessment-form" onSubmit={submit}>
          {step === 1 && <div className="form-step"><div className="form-heading"><span className="step-number">01</span><div><h2>Tell us about your society</h2><p>Use the name members recognise. You can refine the brief later.</p></div></div><label>Society name<input required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Kirti Heights CHS" data-testid="input-society-name" /></label><label>Area / locality<input required value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="e.g. Chembur, Mumbai" data-testid="input-society-location" /></label></div>}
          {step === 2 && <div className="form-step"><div className="form-heading"><span className="step-number">02</span><div><h2>Set the property context</h2><p>These details shape the regulatory route we’ll recommend.</p></div></div><label>Society type<select required value={form.societyType} onChange={(event) => update('societyType', event.target.value)} data-testid="select-society-type"><option value="">Select a type</option><option value="Co-operative Housing Society">Co-operative Housing Society</option><option value="Apartment Owners Association">Apartment Owners Association</option><option value="MHADA Society">MHADA Society</option></select></label><label>Land tenure<select value={form.landType} onChange={(event) => update('landType', event.target.value)} data-testid="select-land-type"><option value="">Not sure yet</option><option value="Freehold">Freehold</option><option value="Leasehold">Leasehold</option><option value="MHADA lease">MHADA lease</option></select></label><label>Number of member households<input required type="number" min="1" value={form.memberCount} onChange={(event) => update('memberCount', event.target.value)} placeholder="e.g. 48" data-testid="input-member-count" /></label></div>}
          {step === 3 && <div className="form-step"><div className="form-heading"><span className="step-number">03</span><div><h2>Your assessment is ready to begin</h2><p>Review the basics before we create your private project workspace.</p></div></div><div className="review-card"><div><span>Society</span><strong>{form.name}</strong></div><div><span>Location</span><strong>{form.location}</strong></div><div><span>Type</span><strong>{form.societyType}</strong></div><div><span>Households</span><strong>{form.memberCount}</strong></div></div><div className="privacy-note"><ShieldCheck size={17} /><span>Your information is kept within your society workspace and is never shared without your permission.</span></div></div>}
          {createProject.isError && <div className="form-error" data-testid="status-assessment-error"><AlertTriangle size={16} /> We couldn’t create the assessment. Please check your connection and try again.</div>}
          <div className="form-actions">{step > 1 && <button type="button" className="button button-ghost" onClick={() => setStep(step - 1)} data-testid="button-assessment-back"><ArrowLeft size={16} /> Back</button>}<span />{step < 3 ? <button type="button" className="button button-dark" disabled={!canContinue} onClick={() => setStep(step + 1)} data-testid="button-assessment-continue">Continue <ChevronRight size={16} /></button> : <button className="button button-accent" disabled={createProject.isPending} data-testid="button-create-assessment">{createProject.isPending ? <LoaderCircle size={16} className="spin" /> : <Send size={16} />} {createProject.isPending ? 'Creating workspace' : 'Create assessment'}</button>}</div>
        </form>
      </div>
      <aside className="assessment-aside"><div className="aside-quote"><Sparkles size={19} /><p>“The best redevelopment decisions are made before a developer enters the room.”</p><span>— RENOVA field note 02</span></div><div className="aside-checklist"><p className="section-kicker">What you’ll get</p>{['A readiness score for your society', 'Your regulatory pathway, explained', 'A practical list of next steps'].map((item) => <div key={item}><Check size={16} /> {item}</div>)}</div><div className="aside-image"><img src="/renova-hero.png" alt="Mumbai redevelopment vision" /><span>From what is, to what could be.</span></div></aside>
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
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const params = useMemo(() => ({ role: role || undefined }), [role]);
  const professionals = useListProfessionals(params, { query: { queryKey: getListProfessionalsQueryKey(params) } });
  if (professionals.isLoading) return <LoadingPage label="Finding the right people for your project" />;
  if (professionals.isError) return <ErrorState onRetry={() => professionals.refetch()} label="The professional directory is unavailable." />;
  const filtered = (professionals.data || []).filter((person) => `${person.name} ${person.role} ${person.location} ${person.specialties.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="content-stack">
      <PageIntro kicker="The people around the table" title={<>Find expertise<br /><em>that earns trust.</em></>} detail="A considered shortlist of professionals matched to the realities of Mumbai society redevelopment." action={<button className="button button-outline" data-testid="button-save-shortlist"><Check size={16} /> Saved shortlist <span className="button-count">0</span></button>} />
      <div className="directory-toolbar"><div className="search-field"><Search size={17} /><input type="search" placeholder="Search by name, role, or specialty" value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-professionals" /></div><div className="filter-group"><Filter size={15} /><span>Filter by</span>{['', 'PMC', 'Architect', 'Legal', 'Technical'].map((item) => <button key={item || 'all'} className={cn('filter-chip', role === item && 'selected')} onClick={() => setRole(item)} data-testid={`button-filter-${item || 'all'}`}>{item || 'All roles'}</button>)}</div><button className="icon-button filter-mobile" aria-label="More filters" data-testid="button-more-filters"><SlidersHorizontal size={17} /></button></div>
      {filtered.length ? <div className="professional-list">{filtered.map((person) => <article className="professional-card" key={person.id} data-testid={`card-professional-${person.id}`}><div className="professional-top"><span className="professional-avatar">{person.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div className="professional-title"><h3>{person.name} {person.verified && <BadgeCheck size={16} />}</h3><p>{person.role} · {person.location}</p></div><button className="save-button" aria-label={`Save ${person.name}`} data-testid={`button-save-${person.id}`}><Check size={16} /></button></div><div className="professional-match"><span><strong>{person.match}%</strong> match</span><div><i style={{ width: `${person.match}%` }} /></div><span className="experience">{person.experience}</span></div><div className="specialty-list">{person.specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}</div><div className="professional-actions"><button className="button button-dark" data-testid={`button-request-intro-${person.id}`}>Request introduction <ArrowUpRight size={14} /></button><button className="text-link" data-testid={`button-view-profile-${person.id}`}>View profile <ChevronRight size={14} /></button></div></article>)}</div> : <EmptyState icon={UsersRound} title="No professionals match that search" detail="Try a broader role or a different search term." action={<button className="button button-ghost" onClick={() => { setSearch(''); setRole(''); }} data-testid="button-clear-professionals">Clear filters</button>} />}
    </div>
  );
}

function Regulations() {
  const regulations = useListRegulations();
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('All');
  if (regulations.isLoading) return <LoadingPage label="Loading the regulation centre" />;
  if (regulations.isError) return <ErrorState onRetry={() => regulations.refetch()} label="The regulation centre is unavailable." />;
  const statuses = ['All', ...Array.from(new Set((regulations.data || []).map((item) => item.status)))];
  const filtered = (regulations.data || []).filter((item) => (activeStatus === 'All' || item.status === activeStatus) && `${item.code} ${item.title} ${item.summary} ${item.authority}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="content-stack">
      <PageIntro kicker="Know the rules before you negotiate" title={<>The regulation<br /><em>centre.</em></>} detail="Plain-language guidance for the permissions, notices, and approvals that shape your redevelopment." action={<button className="button button-outline" data-testid="button-regulation-guide"><FileText size={16} /> Download committee guide</button>} />
      <div className="regulation-feature"><div><span className="feature-label"><BookOpenText size={15} /> Start here</span><h2>What changes when<br />your society redevelops?</h2><p>A practical orientation to the decisions your committee will make, from consent to conveyance.</p><button className="text-link light-link" data-testid="button-read-orientation">Read the orientation <ArrowUpRight size={15} /></button></div><div className="feature-lines"><span>01&nbsp; Consent</span><span>02&nbsp; Feasibility</span><span>03&nbsp; Appointment</span><span>04&nbsp; Approvals</span></div></div>
      <div className="directory-toolbar regulation-toolbar"><div className="search-field"><Search size={17} /><input type="search" placeholder="Search codes, topics, or authorities" value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-regulations" /></div><div className="filter-group"><ListFilter size={15} /><span>Show</span>{statuses.map((status) => <button key={status} className={cn('filter-chip', activeStatus === status && 'selected')} onClick={() => setActiveStatus(status)} data-testid={`button-regulation-filter-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</button>)}</div></div>
      <div className="regulation-list">{filtered.length ? filtered.map((item) => <article className="regulation-row" key={item.id} data-testid={`row-regulation-${item.id}`}><div className="regulation-code">{item.code}</div><div className="regulation-copy"><div className="regulation-title-row"><h3>{item.title}</h3><StatusPill tone={item.status.toLowerCase().includes('active') ? 'green' : 'neutral'}>{item.status}</StatusPill></div><p>{item.summary}</p><div className="regulation-meta"><span><Landmark size={13} /> {item.authority}</span><span><CalendarDays size={13} /> Updated {item.updatedAt}</span></div></div><button className="icon-button regulation-open" aria-label={`Open ${item.code}`} data-testid={`button-open-regulation-${item.id}`}><ArrowUpRight size={17} /></button></article>) : <EmptyState icon={BookOpenText} title="No guidance found" detail="Try searching for a code, authority, or topic." />}</div>
    </div>
  );
}

const publicNav = [
  { href: '#about', label: 'About RENOVA' },
  { href: '#listings', label: 'Listings' },
  { href: '#opportunities', label: 'Opportunities' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#knowledge', label: 'Knowledge centre' },
  { href: '#stories', label: 'Success stories' },
];

const stakeholderCards = [
  { title: 'Housing societies', detail: 'Explore the people and pathways that can move your redevelopment forward.', icon: Building2 },
  { title: 'Developers', detail: 'Discover genuine societies and redevelopment opportunities aligned to your strengths.', icon: HardHat },
  { title: 'Architects', detail: 'Connect design expertise with societies ready to imagine what comes next.', icon: Compass },
  { title: 'PMCs', detail: 'Bring structure, evaluation and project oversight to the right society mandates.', icon: ClipboardCheck },
  { title: 'Professionals', detail: 'Make legal, technical and specialist expertise easier to find at the right moment.', icon: Scale },
];

function MarketingHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="marketing-site" id="top">
      <header className="marketing-header">
        <div className="marketing-container marketing-nav-row">
          <Logo />
          <nav className={cn('marketing-nav', menuOpen && 'marketing-nav-open')} aria-label="RENOVA website navigation">
            <a href="#top" onClick={() => setMenuOpen(false)}>Home</a>
            {publicNav.map((item) => <a href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>)}
            <a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
          </nav>
          <div className="marketing-header-actions">
            <Link href="/workspace" className="marketing-workspace-link">Society workspace</Link>
            <a href="#requirement" className="button button-accent">Post your requirement <ArrowUpRight size={15} /></a>
          </div>
          <button className="marketing-menu-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="Toggle navigation">
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

      <main>
        <section className="marketing-hero">
          <div className="marketing-container marketing-hero-grid">
            <div className="marketing-hero-copy">
              <p className="marketing-kicker"><span /> Mumbai's redevelopment network</p>
              <h1>Redevelopment,<br /><em>reimagined.</em></h1>
              <p className="marketing-lead">RENOVA brings housing societies, developers, PMCs, architects and redevelopment professionals into one better-connected ecosystem.</p>
              <div className="marketing-hero-actions">
                <a href="#requirement" className="button marketing-primary-button">Post your requirement <ArrowUpRight size={16} /></a>
                <a href="#opportunities" className="marketing-text-link">Explore opportunities <ChevronDown size={16} /></a>
              </div>
              <div className="marketing-principles" aria-label="RENOVA principles">
                <span><b>01</b> Renew</span><span><b>02</b> Connect</span><span><b>03</b> Redevelop</span>
              </div>
            </div>
            <div className="marketing-hero-visual">
              <img src="/renova-hero.png" alt="Modern residential redevelopment in Mumbai" />
              <div className="marketing-image-note"><span>RENOVA</span><strong>From ageing property<br />to renewed possibility.</strong></div>
            </div>
          </div>
        </section>

        <section className="marketing-section marketing-intro" id="about">
          <div className="marketing-container marketing-intro-grid">
            <div><p className="marketing-kicker">About RENOVA</p><h2>One city. Many stakeholders.<br /><em>One clearer way forward.</em></h2></div>
            <div className="marketing-copy-column">
              <p>Mumbai's redevelopment is about more than new buildings. It is about renewing communities, restoring ageing properties and unlocking the potential of existing land.</p>
              <p>RENOVA is a redevelopment-focused platform and service ecosystem designed to make that journey simpler, faster, more transparent and better connected.</p>
              <div className="marketing-meaning"><span>RENOVA / Latin</span><strong>To renew. To restore. To transform.</strong></div>
            </div>
          </div>
        </section>

        <section className="marketing-section marketing-listings" id="listings">
          <div className="marketing-container">
            <div className="marketing-section-heading"><div><p className="marketing-kicker">The RENOVA network</p><h2>The right people,<br /><em>around the same table.</em></h2></div><p>Explore the stakeholders who shape a redevelopment project from its first conversation to execution.</p></div>
            <div className="stakeholder-grid">
              {stakeholderCards.map(({ title, detail, icon: Icon }, index) => (
                <article className="stakeholder-card" key={title}>
                  <div className="stakeholder-card-top"><span>0{index + 1}</span><Icon size={22} strokeWidth={1.6} /></div>
                  <h3>{title}</h3><p>{detail}</p>
                  <Link href={title === 'Housing societies' ? '/assessment' : '/professionals'} className="marketing-card-link">Explore <ArrowUpRight size={15} /></Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-section marketing-opportunities" id="opportunities">
          <div className="marketing-container">
            <div className="marketing-section-heading marketing-section-heading-light"><div><p className="marketing-kicker">Redevelopment opportunities</p><h2>Better matches begin<br />with <em>better context.</em></h2></div><p>RENOVA helps both sides discover relevant possibilities and begin with a clearer understanding of what each project needs.</p></div>
            <div className="opportunity-grid">
              <article><span className="opportunity-label"><Building2 size={17} /> For housing societies</span><h3>Find the team your project deserves.</h3><ul><li>Suitable developers</li><li>Project management consultants</li><li>Architects and design practices</li><li>Legal and technical professionals</li></ul><a href="#requirement" className="button marketing-light-button">Share your requirement <ArrowUpRight size={15} /></a></article>
              <article><span className="opportunity-label"><HardHat size={17} /> For developers &amp; professionals</span><h3>Find the opportunity where you fit.</h3><ul><li>Genuine redevelopment opportunities</li><li>Suitable housing societies</li><li>Relevant project mandates</li><li>Potential partners and consultants</li></ul><Link href="/professionals" className="button marketing-outline-light">Explore the network <ArrowUpRight size={15} /></Link></article>
            </div>
          </div>
        </section>

        <section className="marketing-section marketing-process" id="how-it-works">
          <div className="marketing-container">
            <div className="marketing-section-heading"><div><p className="marketing-kicker">How it works</p><h2>From requirement<br />to <em>right connection.</em></h2></div><p>A structured starting point replaces scattered searching, unclear introductions and months of avoidable drift.</p></div>
            <div className="process-grid">
              {[['01', 'Share your requirement', 'Tell RENOVA about your society, expertise or opportunity.'], ['02', 'Build the right context', 'Organise the project details that matter before introductions begin.'], ['03', 'Explore relevant matches', 'Find developers, societies and professionals suited to the need.'], ['04', 'Move forward clearly', 'Begin the next conversation with better information and direction.']].map(([number, title, detail]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{detail}</p></article>)}
            </div>
          </div>
        </section>

        <section className="marketing-section marketing-knowledge" id="knowledge">
          <div className="marketing-container marketing-knowledge-grid">
            <div className="knowledge-visual"><BookOpenText size={28} /><span>Knowledge centre / Mumbai</span><strong>Know the rules<br />before you negotiate.</strong></div>
            <div><p className="marketing-kicker">Knowledge centre</p><h2>Complex policy,<br /><em>made more navigable.</em></h2><p>Explore plain-language orientation around the permissions, notices and approvals that can shape a Mumbai redevelopment journey.</p><Link href="/regulations" className="button marketing-primary-button">Open knowledge centre <ArrowUpRight size={15} /></Link></div>
          </div>
        </section>

        <section className="marketing-section marketing-stories" id="stories">
          <div className="marketing-container marketing-stories-grid">
            <div><p className="marketing-kicker">Success stories</p><h2>Every renewed building<br />starts with <em>a first step.</em></h2></div>
            <div className="story-placeholder"><Sparkles size={22} /><span>Stories in progress</span><p>As the first RENOVA journeys take shape, this space will document the decisions, partnerships and outcomes that moved redevelopment forward.</p></div>
          </div>
        </section>

        <section className="marketing-section marketing-requirement" id="requirement">
          <div className="marketing-container requirement-panel">
            <div><p className="marketing-kicker">Post your requirement</p><h2>Tell us what needs<br /><em>to move forward.</em></h2><p>Whether you represent a housing society, developer or redevelopment practice, start with the opportunity in front of you.</p></div>
            <div className="requirement-actions"><Link href="/assessment" className="button marketing-primary-button">I represent a society <ArrowUpRight size={16} /></Link><Link href="/professionals" className="button button-outline">I am a developer or professional <ArrowUpRight size={16} /></Link></div>
          </div>
        </section>
      </main>

      <footer className="marketing-footer" id="contact">
        <div className="marketing-container">
          <div className="marketing-footer-main"><div><Logo /><p>Renew. Connect. Redevelop.</p></div><div><span>Start here</span><a href="#requirement">Post your requirement</a><Link href="/workspace">Society workspace</Link></div><div><span>Explore</span><a href="#listings">Listings</a><a href="#knowledge">Knowledge centre</a></div><div><span>RENOVA Mumbai</span><p>Making redevelopment easier to initiate, easier to connect and easier to execute.</p></div></div>
          <div className="marketing-footer-bottom"><span>© {new Date().getFullYear()} RENOVA</span><a href="#top">Back to top <ArrowUpRight size={13} /></a></div>
        </div>
      </footer>
    </div>
  );
}

function WorkspaceRouter() {
  return <Switch><Route path="/workspace" component={Overview} /><Route path="/assessment" component={Assessment} /><Route path="/project/:id" component={ProjectDetail} /><Route path="/professionals" component={Professionals} /><Route path="/regulations" component={Regulations} /><Route component={NotFound} /></Switch>;
}

function Router() {
  const [location] = useLocation();
  if (location === '/') return <MarketingHome />;
  return <AppShell><WorkspaceRouter /></AppShell>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
