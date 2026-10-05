import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, Building2, Check, Download, FileText, Plus, Save, Trash2 } from 'lucide-react';
import { briefText, emptyBrief, fieldLabels, readDrafts, removeDraft, saveDraft, services, stages, validateBrief, type BriefErrors, type OpportunityBrief, type OpportunityDraft } from '@/data/opportunity-drafts';
import './opportunity.css';
import './dashboard-theme.css';

function loadDrafts() {
  try { return { drafts: readDrafts(window.localStorage), error: '' }; }
  catch { return { drafts: [] as OpportunityDraft[], error: 'Saved drafts are unavailable in this browser. Existing stored data has not been changed. You can prepare and download a new brief.' }; }
}
function downloadBrief(brief: OpportunityBrief) {
  const url = URL.createObjectURL(new Blob([briefText(brief)], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `RENOVA-${brief.name.trim().replace(/[^a-z0-9]+/gi, '-').slice(0, 60) || 'society'}-brief.txt`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function BriefHeader() {
  return <header className="brief-header"><Link href="/platform" className="platform-brand"><span>R</span><div><strong>RENOVA</strong><small>Society opportunity preparation</small></div></Link><Link href="/platform/opportunities"><FileText size={16} /> My drafts</Link></header>;
}
function StorageNotice() {
  return <p className="brief-storage"><strong>Private preparation on this browser.</strong> Drafts are saved only when you choose Save draft. They are not sent to RENOVA, published, or shared with developers. Anyone using this browser can access saved drafts; avoid confidential or personal information. Download a copy before clearing browser data.</p>;
}
export function OpportunityDrafts() {
  const [state, setState] = useState(loadDrafts);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const erase = (id: string) => {
    try { removeDraft(window.localStorage, id); setState(loadDrafts()); setDeleteId(null); setNotice('Draft deleted from this browser.'); }
    catch { setNotice('Could not delete this draft. Your stored data has not been changed.'); }
  };
  return <div className="platform-gateway brief-page"><BriefHeader /><main className="brief-main">
    <Link className="brief-back" href="/dashboard/society"><ArrowLeft size={15} /> Society dashboard preview</Link>
    <div className="brief-title"><div><p>Opportunity / Prepare</p><h1>Your society. Your next chapter.</h1><span>Build a clear brief before starting conversations with redevelopment professionals.</span></div><Link className="platform-primary-button" href="/platform/opportunities/new"><Plus size={17} /> Create opportunity brief</Link></div>
    <StorageNotice />
    {state.error ? <p role="alert" className="brief-error-banner">{state.error}</p> : null}
    <p role="status" className="brief-status">{notice}</p>
    {state.drafts.length ? <div className="brief-draft-grid">{state.drafts.map((draft) => <article className="brief-draft-card" key={draft.id}>
      <div className="brief-card-top"><Building2 size={25} /><span>LOCAL DRAFT · NOT PUBLISHED</span></div><h2>{draft.brief.name || 'Untitled society brief'}</h2><p>{draft.brief.location || 'Location not yet provided'}</p><p>{draft.brief.services.join(' · ') || 'Services not yet selected'}</p><small>Saved {new Date(draft.updatedAt).toLocaleString('en-IN')}</small>
      <div className="brief-actions"><Link href={`/platform/opportunities/${draft.id}`} className="platform-primary-button">Continue brief <ArrowRight size={15} /></Link><button onClick={() => downloadBrief(draft.brief)} aria-label={`Download ${draft.brief.name || 'untitled'} brief`}><Download size={17} /></button><button onClick={() => setDeleteId(draft.id)} aria-label={`Delete ${draft.brief.name || 'untitled'} draft`}><Trash2 size={17} /></button></div>
      {deleteId === draft.id ? <div className="brief-delete"><p>Delete this saved draft from this browser?</p><button onClick={() => erase(draft.id)}>Delete draft</button><button onClick={() => setDeleteId(null)}>Keep draft</button></div> : null}
    </article>)}</div> : <section className="brief-empty"><FileText size={34} /><h2>Start with the facts you know.</h2><p>Add your society’s location, property details and requirements. Unknown plot area or building age can stay blank.</p><Link href="/platform/opportunities/new">Prepare your first brief <ArrowRight size={16} /></Link></section>}
    <section className="brief-next"><h2>What happens after preparation?</h2><p>Download your brief for committee discussion and explore the <Link href="/ecosystem">professional directory</Link>. Account-based publication, verification and controlled developer access are the next platform phase; this builder does not submit your brief.</p></section>
  </main></div>;
}
const stepFields: Array<Array<keyof OpportunityBrief>> = [['name', 'location', 'homes', 'plotArea', 'age'], ['stage', 'conveyance', 'services', 'requirements']];
export function OpportunityBuilder({ id }: { id?: string }) {
  const [initial] = useState(loadDrafts);
  const existing = initial.drafts.find((draft) => draft.id === id);
  const [brief, setBrief] = useState<OpportunityBrief>(() => existing?.brief ?? { ...emptyBrief, services: [] });
  const [draftId] = useState(() => id ?? crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<BriefErrors>({});
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [, navigate] = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const update = <K extends keyof OpportunityBrief>(key: K, value: OpportunityBrief[K]) => {
    setBrief((current) => ({ ...current, [key]: value })); setDirty(true); setNotice('');
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const save = () => {
    try { saveDraft(window.localStorage, { id: draftId, brief, updatedAt: new Date().toISOString() }); setDirty(false); setNotice('Draft saved on this browser. It has not been published.'); return true; }
    catch { setNotice('Draft could not be saved. Browser storage may be blocked, full or unreadable. Download a copy to keep your work.'); return false; }
  };
  const forward = (event: FormEvent) => {
    event.preventDefault();
    const all = validateBrief(brief);
    const relevant = Object.fromEntries(Object.entries(all).filter(([key]) => stepFields[step]?.includes(key as keyof OpportunityBrief)));
    setErrors(relevant);
    if (Object.keys(relevant).length) { requestAnimationFrame(() => errorSummary.current?.focus()); return; }
    setStep((value) => Math.min(2, value + 1)); setNotice('');
  };
  const textField = (key: 'name' | 'location' | 'homes' | 'plotArea' | 'age', required = false) => <div className="brief-field" key={key}><label htmlFor={`brief-${key}`}>{fieldLabels[key]} {required ? <span>*</span> : <small>Optional</small>}</label><input id={`brief-${key}`} value={brief[key]} type={key === 'name' || key === 'location' ? 'text' : 'number'} min="1" max={key === 'age' ? 300 : key === 'homes' ? 10000 : key === 'plotArea' ? 10000000 : undefined} step={key === 'plotArea' ? 'any' : '1'} maxLength={key === 'name' ? 160 : 120} required={required} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `error-${key}` : undefined} onChange={(event) => update(key, event.target.value)} />{errors[key] ? <span className="brief-field-error" id={`error-${key}`}>{errors[key]}</span> : null}</div>;
  if (id && !existing) return <div className="platform-gateway brief-page"><BriefHeader /><main className="brief-main"><h1>Draft unavailable</h1><p>{initial.error || 'This draft is not saved in this browser. Draft links do not transfer data between devices.'}</p><Link href="/platform/opportunities">Return to my drafts</Link></main></div>;
  return <div className="platform-gateway brief-page"><header className="brief-header"><span className="platform-brand"><span>R</span><strong>RENOVA</strong></span><button onClick={() => dirty ? setLeaving(true) : navigate('/platform/opportunities')}><ArrowLeft size={15} /> My drafts</button></header><main className="brief-main">
    <div className="brief-title"><div><p>Society opportunity / Draft preparation</p><h1>Make your requirements clear.</h1><span>A structured starting point for your redevelopment journey.</span></div><span className="brief-local-label">NOT PUBLISHED</span></div>
    <StorageNotice />
    {initial.error ? <p role="alert" className="brief-error-banner">{initial.error}</p> : null}
    {leaving ? <section className="brief-leave" role="region" aria-label="Unsaved changes"><h2>You have unsaved changes</h2><p>Save on this browser before returning to your drafts, or stay here to download your brief.</p><button onClick={() => { if (save()) navigate('/platform/opportunities'); }}>Save and leave</button><button onClick={() => navigate('/platform/opportunities')}>Discard changes and leave</button><button onClick={() => setLeaving(false)}>Keep editing</button></section> : null}
    <ol className="brief-steps" aria-label="Brief preparation steps">{['Society & property', 'Requirements', 'Review & download'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={step === index ? 'current' : step > index ? 'complete' : ''}><span>{step > index ? <Check size={15} /> : `0${index + 1}`}</span>{label}</li>)}</ol>
    <form className="brief-form" onSubmit={forward} noValidate>
      <div className="brief-section-heading"><p>STEP 0{step + 1}</p><h2 tabIndex={-1} ref={heading}>{['Tell us about your society', 'Define the support you need', 'Review your opportunity brief'][step]}</h2><p>{['Required fields are marked *. Leave unknown optional details blank.', 'Use factual requirements. Avoid resident names, phone numbers or confidential documents.', 'Check the details with your committee. This is a preparation document, not a published opportunity.'][step]}</p></div>
      {Object.values(errors).some(Boolean) ? <div className="brief-error-banner" role="alert" tabIndex={-1} ref={errorSummary}><strong>Please check these fields:</strong><ul>{Object.entries(errors).filter(([, value]) => value).map(([key, value]) => <li key={key}><a href={`#brief-${key}`}>{value}</a></li>)}</ul></div> : null}
      {step === 0 ? <div className="brief-fields">{textField('name', true)}{textField('location', true)}{textField('homes', true)}{textField('plotArea')}{textField('age')}<aside className="brief-hint">Plot area is recorded in square metres. These details do not determine FSI or redevelopment eligibility; a qualified professional must assess those separately.</aside></div> : null}
      {step === 1 ? <><div className="brief-fields"><div className="brief-field"><label htmlFor="brief-stage">Current stage <span>*</span></label><select id="brief-stage" required value={brief.stage} aria-invalid={Boolean(errors.stage)} aria-describedby={errors.stage ? 'error-stage' : undefined} onChange={(event) => update('stage', event.target.value)}><option value="">Select a stage</option>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select>{errors.stage ? <span className="brief-field-error" id="error-stage">{errors.stage}</span> : null}</div><div className="brief-field"><label htmlFor="brief-conveyance">Conveyance status <small>Optional</small></label><select id="brief-conveyance" value={brief.conveyance} onChange={(event) => update('conveyance', event.target.value)}><option value="">Not yet known</option><option>Registered conveyance available</option><option>Deemed conveyance in progress</option><option>Conveyance not available</option><option>Professional review needed</option></select></div></div><fieldset id="brief-services" className="brief-services" aria-describedby={errors.services ? 'error-services' : undefined}><legend>Professionals required *</legend>{services.map((service) => <label key={service}><input type="checkbox" checked={brief.services.includes(service)} onChange={(event) => update('services', event.target.checked ? [...brief.services, service] : brief.services.filter((item) => item !== service))} />{service}</label>)}{errors.services ? <p id="error-services" className="brief-field-error">{errors.services}</p> : null}</fieldset><div className="brief-field"><label htmlFor="brief-requirements">Society requirements <span>*</span></label><textarea id="brief-requirements" rows={6} required minLength={20} maxLength={3000} value={brief.requirements} aria-invalid={Boolean(errors.requirements)} aria-describedby="requirements-help" placeholder="For example: We need a PMC to review our property documents, prepare a feasibility study and help define a transparent developer selection process." onChange={(event) => update('requirements', event.target.value)} /><small id="requirements-help">{brief.requirements.length}/3,000 characters · Minimum 20 characters</small>{errors.requirements ? <span className="brief-field-error">{errors.requirements}</span> : null}</div></> : null}
      {step === 2 ? <><dl className="brief-review">{Object.entries(fieldLabels).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{brief[key as keyof typeof fieldLabels].trim() || 'Information not yet provided'}</dd></div>)}<div><dt>Professionals required</dt><dd>{brief.services.join(', ')}</dd></div></dl><div className="brief-next"><h3>Ready for committee discussion</h3><p>Download this brief and review it with your society. Account-based verification and submission are not available yet.</p></div></> : null}
      <p role="status" className="brief-status">{notice || (dirty ? 'Unsaved changes' : existing ? 'Saved draft loaded from this browser' : '')}</p>
      <div className="brief-form-actions"><div>{step > 0 ? <button type="button" className="platform-secondary-button" onClick={() => { setStep((value) => value - 1); setErrors({}); }}><ArrowLeft size={15} /> Back</button> : null}<button type="button" className="platform-secondary-button" onClick={save}><Save size={15} /> Save draft</button></div>{step < 2 ? <button type="submit" className="platform-primary-button">{step === 0 ? 'Continue to requirements' : 'Review brief'} <ArrowRight size={15} /></button> : <button type="button" className="platform-primary-button" onClick={() => { downloadBrief(brief); setNotice('Download requested. Your brief has not been published.'); }}><Download size={16} /> Download brief</button>}</div>
      {step < 2 ? <button type="button" className="brief-download" onClick={() => downloadBrief(brief)}>Download unfinished brief</button> : null}
    </form>
  </main></div>;
}
