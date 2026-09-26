import { useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BookOpenText,
  BriefcaseBusiness,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Compass,
  FileCheck2,
  FileText,
  FolderLock,
  Handshake,
  Home,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  Menu,
  MessageSquareText,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import {
  demoOpportunities,
  demoProject,
  journeyStages,
  proposalDisclaimer,
  roleCopy,
  type PlatformRole,
} from '@/data/platform-demo';
import './platform.css';

const roleIcons = { society: Building2, developer: BriefcaseBusiness, pmc: ClipboardCheck } as const;

const roleDetails: Record<PlatformRole, { heading: string; detail: string; action: string }> = {
  society: { heading: 'Society & property owners', detail: 'Create a structured opportunity, discover specialists, compare factual proposal terms and manage the journey.', action: 'Preview society dashboard' },
  developer: { heading: 'Developers', detail: 'Discover relevant opportunities, manage approved connections and submit proposals in a consistent format.', action: 'Preview developer dashboard' },
  pmc: { heading: 'PMC & consultants', detail: 'Support societies, participate in project workspaces and organize technical review across the process.', action: 'Preview PMC dashboard' },
};

const roleNavigation: Record<PlatformRole, Array<{ label: string; icon: typeof Home }>> = {
  society: [
    { label: 'Overview', icon: LayoutDashboard }, { label: 'My society', icon: Building2 }, { label: 'Journey', icon: Compass },
    { label: 'Discover', icon: Search }, { label: 'Proposals', icon: FileCheck2 }, { label: 'Compare', icon: SlidersHorizontal },
    { label: 'Documents', icon: FolderLock }, { label: 'Messages', icon: MessageSquareText }, { label: 'Activity', icon: Activity },
  ],
  developer: [
    { label: 'Overview', icon: LayoutDashboard }, { label: 'Opportunities', icon: Search }, { label: 'My proposals', icon: FileCheck2 },
    { label: 'Connections', icon: Handshake }, { label: 'Projects', icon: Building2 }, { label: 'Company profile', icon: BriefcaseBusiness },
    { label: 'Documents', icon: FolderLock }, { label: 'Messages', icon: MessageSquareText },
  ],
  pmc: [
    { label: 'Overview', icon: LayoutDashboard }, { label: 'Society requests', icon: Search }, { label: 'Connections', icon: Handshake },
    { label: 'Projects', icon: Building2 }, { label: 'PMC profile', icon: ClipboardCheck }, { label: 'Documents', icon: FolderLock },
    { label: 'Messages', icon: MessageSquareText }, { label: 'Activity', icon: Activity },
  ],
};

function PlatformMark() {
  return <Link href="/" className="platform-brand" aria-label="RENOVA home"><span>R</span><div><strong>RENOVA</strong><small>Digital infrastructure for redevelopment</small></div></Link>;
}

function DemoBadge() {
  return <span className="platform-demo-badge"><Sparkles size={12} /> Product preview · demo data</span>;
}

function PlatformGateway() {
  return (
    <div className="platform-gateway">
      <header><PlatformMark /><Link href="/" className="platform-back"><ArrowLeft size={15} /> Back to website</Link></header>
      <main>
        <section className="platform-gateway-hero">
          <div className="platform-blueprint" aria-hidden="true" />
          <DemoBadge />
          <p>RENOVA platform</p>
          <h1>The digital infrastructure<br />for <em>redevelopment.</em></h1>
          <span>Discover opportunities. Connect stakeholders. Compare proposals. Manage the journey.</span>
          <div className="platform-flow" aria-label="RENOVA platform workflow">
            {['Discover', 'Verify', 'Connect', 'Opportunity', 'Proposal', 'Compare', 'Select', 'Collaborate', 'Track'].map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item}</strong>{index < 8 ? <ArrowRight size={14} /> : null}</div>)}
          </div>
        </section>

        <section className="platform-role-section">
          <div className="platform-section-heading"><div><p>One ecosystem · different workspaces</p><h2>Enter the platform through your role.</h2></div><span>Each preview uses the same demonstration project, with information and actions shaped around that stakeholder.</span></div>
          <div className="platform-role-grid">
            {(Object.keys(roleDetails) as PlatformRole[]).map((role) => {
              const Icon = roleIcons[role];
              const copy = roleDetails[role];
              return <Link href={`/dashboard/${role}`} className={`platform-role-card role-${role}`} key={role}>
                <span className="platform-role-icon"><Icon size={24} /></span><small>{roleCopy[role].label}</small><h2>{copy.heading}</h2><p>{copy.detail}</p><span className="platform-role-action">{copy.action} <ArrowUpRight size={15} /></span>
              </Link>;
            })}
          </div>
        </section>

        <section className="platform-project-principle">
          <div><p>One project · multiple stakeholder dashboards</p><h2>A shared source of truth, with controlled access.</h2><span>Project information, proposals, documents and activity remain associated with the redevelopment record—not scattered across inboxes.</span></div>
          <div className="platform-principle-visual">
            <span className="principle-project"><Building2 size={24} /><strong>ABC CHS Redevelopment</strong><small>Central project workspace</small></span>
            {['Society', 'Developer', 'PMC', 'RENOVA'].map((role) => <span key={role}><LockKeyhole size={15} /> {role} view</span>)}
          </div>
        </section>
      </main>
      <footer><span>RENOVA product preview</span><span>No real organizations, offers or credentials are represented in this demo.</span></footer>
    </div>
  );
}

function PlatformShell({ role, children, active = 'Overview' }: { role: PlatformRole; children: ReactNode; active?: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const copy = roleCopy[role];
  const [, setLocation] = useLocation();
  const switchRole = (nextRole: PlatformRole) => setLocation(`/dashboard/${nextRole}`);
  return (
    <div className="platform-shell">
      <aside className={mobileOpen ? 'is-open' : ''}>
        <div className="platform-sidebar-head"><PlatformMark /><button onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
        <label className="platform-role-switcher"><span className={`platform-avatar role-${role}`}>{copy.initials}</span><span><small>Viewing as</small><strong>{copy.organization}</strong></span><ChevronDown size={15} /><select value={role} onChange={(event) => switchRole(event.target.value as PlatformRole)} aria-label="Switch demo role"><option value="society">Society</option><option value="developer">Developer</option><option value="pmc">PMC</option></select></label>
        <p className="platform-nav-caption">{copy.label}</p>
        <nav aria-label={`${copy.label} navigation`}>
          {roleNavigation[role].map(({ label, icon: Icon }) => <button type="button" className={active === label ? 'active' : ''} key={label}><Icon size={17} /><span>{label}</span>{label === 'Messages' ? <i>2</i> : null}</button>)}
        </nav>
        <div className="platform-sidebar-project"><span><Building2 size={17} /></span><div><small>Active project</small><strong>ABC CHS Redevelopment</strong></div><ChevronRight size={15} /></div>
        <div className="platform-sidebar-bottom"><Link href="/platform"><Compass size={16} /> Switch preview</Link><Link href="/"><Home size={16} /> RENOVA website</Link></div>
      </aside>
      {mobileOpen ? <button className="platform-sidebar-overlay" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" /> : null}
      <div className="platform-main">
        <header className="platform-topbar"><div><button className="platform-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><span>{copy.label}</span><i>/</i><strong>{active}</strong></div><div><DemoBadge /><button aria-label="Help"><CircleHelp size={18} /></button><button aria-label="Notifications" className="platform-notification"><Bell size={18} /><i /></button><span className={`platform-avatar role-${role}`}>{copy.initials}</span></div></header>
        <main>{children}</main>
      </div>
    </div>
  );
}

function DashboardHeading({ role, title, detail, action }: { role: PlatformRole; title: string; detail: string; action?: ReactNode }) {
  return <div className="platform-dashboard-heading"><div><DemoBadge /><p>{roleCopy[role].title}</p><h1>{title}</h1><span>{detail}</span></div>{action}</div>;
}

function ProjectLink({ role, label = 'Open project workspace' }: { role: PlatformRole; label?: string }) {
  return <Link href={`/platform/project/${demoProject.id}?role=${role}`} className="platform-primary-button">{label} <ArrowUpRight size={15} /></Link>;
}

function SocietyDashboard() {
  const currentIndex = journeyStages.findIndex((stage) => stage.id === demoProject.stage);
  return <PlatformShell role="society">
    <DashboardHeading role="society" title="Good evening, ABC CHS committee." detail="Your opportunity is active. Two structured proposals are ready for factual comparison." action={<ProjectLink role="society" />} />
    <section className="platform-metrics">
      <article className="platform-metric-primary"><span>Current stage</span><strong>06 <small>/ 08</small></strong><p>Proposal comparison</p><i style={{ '--progress': '75%' } as React.CSSProperties} /></article>
      <article><span>Developer proposals</span><strong>2</strong><p><CheckCircle2 size={14} /> Both submitted</p></article>
      <article><span>Open clarifications</span><strong>3</strong><p><Clock3 size={14} /> 1 due this week</p></article>
      <article><span>Project stakeholders</span><strong>5</strong><p><ShieldCheck size={14} /> Access controlled</p></article>
    </section>
    <section className="platform-panel platform-journey-panel"><div className="platform-panel-heading"><div><p>Redevelopment journey</p><h2>From society profile to managed project.</h2></div><span>Stage 6 of 8</span></div><div className="platform-journey">{journeyStages.map((stage, index) => <div className={index < currentIndex ? 'complete' : index === currentIndex ? 'current' : ''} key={stage.id}><span>{index < currentIndex ? <Check size={14} /> : index + 1}</span><strong>{stage.label}</strong></div>)}</div></section>
    <div className="platform-dashboard-grid">
      <section className="platform-panel platform-opportunity-summary"><div className="platform-panel-heading"><div><p>Active redevelopment opportunity</p><h2>{demoProject.name}</h2></div><span className="platform-status"><i /> {demoProject.opportunityStatus}</span></div><p>{demoProject.summary}</p><div className="platform-facts">{demoProject.societyFacts.map((fact) => <div key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></div>)}</div><ProjectLink role="society" label="Manage opportunity" /></section>
      <section className="platform-panel platform-next-actions"><div className="platform-panel-heading"><div><p>Committee focus</p><h2>Next actions</h2></div></div>{[['01', 'Review comparable terms', '7 proposal fields are aligned for review.'], ['02', 'Resolve clarifications', 'Confirm the bank guarantee evidence.'], ['03', 'Record committee discussion', 'Add meeting notes to the project activity.']].map(([number, title, detail]) => <button type="button" key={number}><span>{number}</span><div><strong>{title}</strong><small>{detail}</small></div><ChevronRight size={16} /></button>)}</section>
    </div>
    <section className="platform-panel platform-compare-preview"><div className="platform-panel-heading"><div><p>Structured proposals</p><h2>Compare factual terms, side by side.</h2></div><Link href="/platform/compare?role=society">Open comparison <ArrowUpRight size={14} /></Link></div><div className="platform-compare-mini"><div><span>Proposal</span><strong>Rehab area</strong><strong>Transit rent</strong><strong>Duration</strong><span>Status</span></div><div><span>Developer Alpha</span><strong>735 sq ft</strong><strong>₹72,000</strong><strong>36 months</strong><span className="platform-tag amber">Clarification</span></div><div><span>Developer Beta</span><strong>720 sq ft</strong><strong>₹68,000</strong><strong>39 months</strong><span className="platform-tag green">Submitted</span></div></div><p className="platform-disclaimer"><ShieldCheck size={14} /> {proposalDisclaimer}</p></section>
  </PlatformShell>;
}

function DeveloperDashboard() {
  const [search, setSearch] = useState('');
  const [interested, setInterested] = useState<string[]>(['opp-102']);
  const opportunities = useMemo(() => demoOpportunities.filter((item) => `${item.name} ${item.location} ${item.status}`.toLowerCase().includes(search.toLowerCase())), [search]);
  const toggleInterest = (id: string) => setInterested((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return <PlatformShell role="developer">
    <DashboardHeading role="developer" title="Find the right redevelopment opportunities." detail="Discover approved society briefs, manage interest and keep your proposal activity in one place." action={<Link href="/ecosystem" className="platform-secondary-button">Update company profile <ArrowUpRight size={15} /></Link>} />
    <section className="platform-metrics developer-metrics"><article className="platform-metric-primary"><span>Relevant opportunities</span><strong>12</strong><p>3 added this week</p></article><article><span>Active connections</span><strong>4</strong><p><Handshake size={14} /> Society-approved</p></article><article><span>Proposals</span><strong>3</strong><p><FileCheck2 size={14} /> 1 clarification</p></article><article><span>Profile completion</span><strong>78%</strong><p><BadgeCheck size={14} /> Documents pending</p></article></section>
    <section className="platform-panel platform-marketplace"><div className="platform-panel-heading"><div><p>Opportunity marketplace</p><h2>Society opportunities matched to your preferences.</h2></div><Link href="/projects/current">Public opportunity directory <ArrowUpRight size={14} /></Link></div><div className="platform-market-toolbar"><label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search location, society or status" /></label><button type="button"><SlidersHorizontal size={16} /> Filters</button></div><div className="platform-opportunity-list">{opportunities.map((item) => <article key={item.id}><span className="platform-opportunity-mark"><Building2 size={20} /></span><div><span className="platform-tag blue">{item.status}</span><h3>{item.name}</h3><p><MapPin size={13} /> {item.location} · {item.homes} · {item.type}</p></div><div className="platform-opportunity-fit"><small>Preference match</small><strong>{item.fit}</strong></div><button type="button" className={interested.includes(item.id) ? 'is-interested' : ''} onClick={() => toggleInterest(item.id)}>{interested.includes(item.id) ? <><Check size={14} /> Interest recorded</> : <>Express interest <ArrowUpRight size={14} /></>}</button></article>)}</div></section>
    <div className="platform-dashboard-grid">
      <section className="platform-panel platform-active-project"><div className="platform-panel-heading"><div><p>Connected opportunity</p><h2>{demoProject.name}</h2></div><span className="platform-tag amber">Clarification requested</span></div><p>Your organization can view the approved opportunity details, its own proposal and shared project communications.</p><ProjectLink role="developer" label="Open permitted project view" /></section>
      <section className="platform-panel platform-permission-card"><LockKeyhole size={24} /><h2>Privacy by role, not by hiding menus.</h2><p>Developer access is scoped to society-approved opportunity information, the organization’s own proposal and shared activity.</p><span>Other developers’ proposals and internal committee notes remain unavailable.</span></section>
    </div>
  </PlatformShell>;
}

function PmcDashboard() {
  return <PlatformShell role="pmc">
    <DashboardHeading role="pmc" title="Guide projects with structure and evidence." detail="Manage society requests, technical review, proposal normalization and project activity from one advisory workspace." action={<ProjectLink role="pmc" />} />
    <section className="platform-metrics pmc-metrics"><article className="platform-metric-primary"><span>Active society projects</span><strong>4</strong><p>2 in proposal stage</p></article><article><span>New requests</span><strong>3</strong><p><Clock3 size={14} /> Awaiting response</p></article><article><span>Review tasks</span><strong>7</strong><p><ClipboardCheck size={14} /> 2 due this week</p></article><article><span>Shared documents</span><strong>18</strong><p><FolderLock size={14} /> Permission controlled</p></article></section>
    <div className="platform-dashboard-grid platform-pmc-grid">
      <section className="platform-panel platform-review-board"><div className="platform-panel-heading"><div><p>Technical review</p><h2>ABC CHS proposal comparison</h2></div><span className="platform-status"><i /> In progress</span></div><div className="platform-review-progress"><div><span>Standard fields mapped</span><strong>7 / 7</strong></div><i><span style={{ width: '100%' }} /></i><div><span>Clarifications resolved</span><strong>2 / 5</strong></div><i><span style={{ width: '40%' }} /></i><div><span>Supporting evidence reviewed</span><strong>6 / 9</strong></div><i><span style={{ width: '67%' }} /></i></div><ProjectLink role="pmc" label="Continue technical review" /></section>
      <section className="platform-panel platform-next-actions"><div className="platform-panel-heading"><div><p>Society requests</p><h2>Action queue</h2></div></div>{[['01', 'ABC CHS', 'Normalize bank guarantee terms'], ['02', 'Sea Crest Society', 'Review feasibility request'], ['03', 'Pragati Nagar', 'Prepare developer Q&A note']].map(([number, title, detail]) => <button type="button" key={number}><span>{number}</span><div><strong>{title}</strong><small>{detail}</small></div><ChevronRight size={16} /></button>)}</section>
    </div>
    <section className="platform-panel platform-role-boundary"><div><ShieldCheck size={21} /><span><strong>PMC project access</strong><small>Technical records, society-approved proposals, assigned tasks and shared communications</small></span></div><div><LockKeyhole size={21} /><span><strong>Not included</strong><small>Unrelated organization data, private developer workspaces or RENOVA administration</small></span></div></section>
  </PlatformShell>;
}

type ProjectTab = 'Overview' | 'Stakeholders' | 'Proposals' | 'Documents' | 'Activity';

function SharedProjectWorkspace({ role }: { role: PlatformRole }) {
  const [tab, setTab] = useState<ProjectTab>('Overview');
  const visibleDocuments = demoProject.documents.filter((document) => document.visibility.includes(role));
  const visibleActivity = demoProject.activity.filter((item) => item.visibility.includes(role));
  const currentIndex = journeyStages.findIndex((stage) => stage.id === demoProject.stage);
  return <PlatformShell role={role} active="Project workspace">
    <div className="platform-project-header"><div><Link href={`/dashboard/${role}`}><ArrowLeft size={14} /> Back to dashboard</Link><div><DemoBadge /><span className="platform-status"><i /> {demoProject.stageLabel}</span></div><h1>{demoProject.name}</h1><p><MapPin size={14} /> {demoProject.location}<i>·</i> {demoProject.reference}</p></div><div><button type="button" className="platform-secondary-button"><MessageSquareText size={15} /> Message project</button><button type="button" className="platform-primary-button"><FileText size={15} /> Add document</button></div></div>
    <div className="platform-project-tabs" role="tablist" aria-label="Project workspace sections">{(['Overview', 'Stakeholders', 'Proposals', 'Documents', 'Activity'] as ProjectTab[]).map((item) => <button role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={tab === item ? 'active' : ''} key={item}>{item}{item === 'Documents' ? <span>{visibleDocuments.length}</span> : null}</button>)}</div>
    {tab === 'Overview' ? <div className="platform-project-layout"><div>
      <section className="platform-panel platform-project-journey"><div className="platform-panel-heading"><div><p>Project journey</p><h2>One record from opportunity to delivery.</h2></div><span>Stage {currentIndex + 1} of {journeyStages.length}</span></div><div>{journeyStages.map((stage, index) => <span className={index < currentIndex ? 'complete' : index === currentIndex ? 'current' : ''} key={stage.id}><i>{index < currentIndex ? <Check size={12} /> : index + 1}</i><small>{stage.label}</small></span>)}</div></section>
      <section className="platform-panel platform-project-brief"><div className="platform-panel-heading"><div><p>Opportunity brief</p><h2>Society-approved project information</h2></div><span className="platform-tag blue">Shared with permission</span></div><p>{demoProject.summary}</p><div className="platform-facts">{demoProject.societyFacts.map((fact) => <div key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></div>)}</div></section>
      <section className="platform-panel platform-activity"><div className="platform-panel-heading"><div><p>Recent activity</p><h2>Project record</h2></div><button type="button" onClick={() => setTab('Activity')}>View all <ArrowUpRight size={13} /></button></div>{visibleActivity.slice(0, 3).map((item) => <article key={item.title + item.time}><span><Activity size={16} /></span><div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.actor} · {item.time}</small></div></article>)}</section>
    </div><aside>
      <section className="platform-panel platform-access-card"><LockKeyhole size={22} /><p>Your access lens</p><h2>{roleCopy[role].label}</h2><span>{role === 'society' ? 'Full society view, proposal comparison and committee records.' : role === 'developer' ? 'Approved opportunity data, your proposal and shared project communication.' : 'Technical review, assigned documents and society-approved proposals.'}</span><small>Permissions are represented in the data model and enforced before records are rendered.</small></section>
      <section className="platform-panel platform-stakeholder-preview"><div className="platform-panel-heading"><div><p>Participants</p><h2>Project table</h2></div><button type="button" onClick={() => setTab('Stakeholders')}>All</button></div>{demoProject.stakeholders.slice(0, 4).map((item) => <div key={item.id}><span>{item.name.slice(0, 2).toUpperCase()}</span><p><strong>{item.name}</strong><small>{item.role}</small></p><i className={item.status.toLowerCase()}>{item.status}</i></div>)}</section>
    </aside></div> : null}
    {tab === 'Stakeholders' ? <WorkspaceStakeholders role={role} /> : null}
    {tab === 'Proposals' ? <WorkspaceProposals role={role} /> : null}
    {tab === 'Documents' ? <WorkspaceDocuments role={role} /> : null}
    {tab === 'Activity' ? <WorkspaceActivity role={role} /> : null}
  </PlatformShell>;
}

function WorkspaceStakeholders({ role }: { role: PlatformRole }) {
  const stakeholders = role === 'developer' ? demoProject.stakeholders.filter((item) => item.role !== 'Developer' || item.name === 'Developer Alpha') : demoProject.stakeholders;
  return <section className="platform-panel platform-workspace-table"><div className="platform-panel-heading"><div><p>Project participants</p><h2>Stakeholders and access</h2></div><button className="platform-secondary-button"><UsersRound size={15} /> Invite stakeholder</button></div><div className="platform-table"><div className="platform-table-head"><span>Organization</span><span>Role</span><span>Access</span><span>Status</span></div>{stakeholders.map((item) => <div key={item.id}><span><i>{item.name.slice(0, 2).toUpperCase()}</i><strong>{item.name}</strong></span><span>{item.role}</span><span>{item.access}</span><span className="platform-tag green">{item.status}</span></div>)}</div></section>;
}

function WorkspaceProposals({ role }: { role: PlatformRole }) {
  if (role === 'developer') return <section className="platform-panel platform-developer-proposal"><div className="platform-panel-heading"><div><p>Your proposal</p><h2>Developer Alpha · Version 2</h2></div><span className="platform-tag amber">Clarification requested</span></div><p>The society has requested additional supporting detail for one proposal field. Other developers’ submissions are not visible in your workspace.</p><div className="platform-facts">{demoProject.proposalTerms.slice(0, 4).map((term) => <div key={term.label}><span>{term.label}</span><strong>{term.alpha}</strong></div>)}</div><button className="platform-primary-button">Respond to clarification <Send size={14} /></button><p className="platform-disclaimer"><ShieldCheck size={14} /> {proposalDisclaimer}</p></section>;
  return <ProposalComparison compact role={role} />;
}

function WorkspaceDocuments({ role }: { role: PlatformRole }) {
  const documents = demoProject.documents.filter((document) => document.visibility.includes(role));
  return <section className="platform-panel platform-workspace-table"><div className="platform-panel-heading"><div><p>Project files</p><h2>Documents available to this role</h2></div><button className="platform-primary-button"><FileText size={15} /> Add document</button></div><div className="platform-table document-table"><div className="platform-table-head"><span>Document</span><span>Category</span><span>Owner</span><span>Updated</span></div>{documents.map((item) => <div key={item.name}><span><i><FileText size={16} /></i><strong>{item.name}</strong></span><span>{item.type}</span><span>{item.owner}</span><span>{item.updated}</span></div>)}</div><p className="platform-disclaimer"><LockKeyhole size={14} /> Files are filtered by project membership and role visibility in the data model.</p></section>;
}

function WorkspaceActivity({ role }: { role: PlatformRole }) {
  const items = demoProject.activity.filter((item) => item.visibility.includes(role));
  return <section className="platform-panel platform-full-activity"><div className="platform-panel-heading"><div><p>Auditable project record</p><h2>Activity</h2></div><button className="platform-secondary-button"><Settings2 size={15} /> Activity filters</button></div>{items.map((item) => <article key={item.title + item.time}><span><Activity size={17} /></span><div><h3>{item.title}</h3><p>{item.detail}</p><small>{item.actor} · {item.time}</small></div></article>)}</section>;
}

function ProposalComparison({ compact = false, role = 'society' }: { compact?: boolean; role?: PlatformRole }) {
  return <section className={`platform-panel platform-comparison ${compact ? 'compact' : ''}`}><div className="platform-panel-heading"><div><p>Standardized proposal comparison</p><h2>Compare terms without ranking developers.</h2></div>{compact ? <Link href="/platform/compare?role=society">Full comparison <ArrowUpRight size={14} /></Link> : <button className="platform-secondary-button"><FileText size={15} /> Export committee copy</button>}</div><p className="platform-comparison-intro">RENOVA aligns factual fields supplied by participants. It does not declare a winner or replace technical, legal or financial advice.</p><div className="platform-comparison-table"><div><strong>Comparison field</strong><strong>Developer Alpha<small>Version 2 · clarification</small></strong><strong>Developer Beta<small>Version 1 · submitted</small></strong></div>{demoProject.proposalTerms.map((term) => <div key={term.label}><span>{term.label}</span><strong>{term.alpha}</strong><strong>{term.beta}</strong></div>)}</div><p className="platform-disclaimer"><ShieldCheck size={14} /> {proposalDisclaimer} · Viewing as {roleCopy[role].label.toLowerCase()}.</p></section>;
}

function ComparisonPage({ role }: { role: PlatformRole }) {
  return <PlatformShell role={role} active="Compare"><div className="platform-project-header comparison-header"><div><Link href={`/platform/project/${demoProject.id}?role=${role}`}><ArrowLeft size={14} /> Back to project</Link><div><DemoBadge /></div><h1>Proposal comparison</h1><p>{demoProject.name}<i>·</i> {demoProject.reference}</p></div></div><ProposalComparison role={role} /></PlatformShell>;
}

function roleFromUrl(location: string): PlatformRole {
  const queryRole = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('role');
  if (queryRole === 'developer' || queryRole === 'pmc' || queryRole === 'society') return queryRole;
  if (location.includes('/developer')) return 'developer';
  if (location.includes('/pmc')) return 'pmc';
  return 'society';
}

export function PlatformRouter() {
  const [location] = useLocation();
  const role = roleFromUrl(location);
  const pathname = location.split('?')[0];
  if (pathname === '/platform') return <PlatformGateway />;
  if (pathname.startsWith('/platform/project/')) return <SharedProjectWorkspace role={role} />;
  if (pathname === '/platform/compare') return <ComparisonPage role={role} />;
  if (pathname === '/dashboard/developer') return <DeveloperDashboard />;
  if (pathname === '/dashboard/pmc') return <PmcDashboard />;
  return <SocietyDashboard />;
}
