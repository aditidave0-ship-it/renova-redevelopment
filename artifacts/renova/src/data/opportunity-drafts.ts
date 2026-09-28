/** Preparation records only. Publication must later go through an authenticated API. */
export const DRAFT_KEY = 'renova.opportunity-drafts.v1';
export const stages = ['Exploring redevelopment', 'Committee discussions', 'PMC appointed', 'Preparing tender'] as const;
export const services = ['Developer', 'PMC', 'Architect', 'Structural consultant', 'Legal advisor', 'Valuation expert'] as const;
export type OpportunityBrief = {
  name: string; location: string; homes: string; plotArea: string;
  age: string; stage: string; conveyance: string; requirements: string;
  services: string[];
};
export type OpportunityDraft = { id: string; updatedAt: string; brief: OpportunityBrief };
export const emptyBrief: OpportunityBrief = { name: '', location: '', homes: '', plotArea: '', age: '', stage: '', conveyance: '', requirements: '', services: [] };
export const fieldLabels: Record<Exclude<keyof OpportunityBrief, 'services'>, string> = {
  name: 'Society name', location: 'Mumbai area / locality', homes: 'Number of homes',
  plotArea: 'Approximate plot area (sq m)', age: 'Building age (years)', stage: 'Current stage',
  conveyance: 'Conveyance status', requirements: 'Society requirements',
};
export type BriefErrors = Partial<Record<keyof OpportunityBrief, string>>;
export function validateBrief(brief: OpportunityBrief): BriefErrors {
  const errors: BriefErrors = {};
  if (brief.name.trim().length < 3 || brief.name.length > 160) errors.name = 'Enter a society name between 3 and 160 characters.';
  if (brief.location.trim().length < 2 || brief.location.length > 120) errors.location = 'Enter a locality between 2 and 120 characters.';
  for (const key of ['homes', 'age', 'plotArea'] as const) {
    const value = brief[key];
    if ((key === 'homes' && !value.trim()) || (value && (!Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) > (key === 'age' ? 300 : key === 'homes' ? 10000 : 10000000) || (key !== 'plotArea' && !Number.isInteger(Number(value)))))) {
      errors[key] = key === 'plotArea' ? 'Enter a positive area up to 10,000,000 sq m, or leave blank.' : key === 'age' ? 'Enter whole years from 1 to 300, or leave blank.' : 'Enter a whole number of homes from 1 to 10,000.';
    }
  }
  if (!stages.some((stage) => stage === brief.stage)) errors.stage = 'Choose your current stage.';
  if (!brief.services.length || brief.services.some((service) => !services.some((option) => option === service))) errors.services = 'Choose at least one professional you need.';
  if (brief.requirements.trim().length < 20 || brief.requirements.length > 3000) errors.requirements = 'Describe your requirements in 20–3,000 characters.';
  return errors;
}
function isBrief(value: unknown): value is OpportunityBrief {
  if (!value || typeof value !== 'object') return false;
  const brief = value as Record<string, unknown>;
  return Object.keys(fieldLabels).every((key) => typeof brief[key] === 'string' && (brief[key] as string).length <= 3000)
    && Array.isArray(brief.services) && brief.services.length <= services.length && brief.services.every((item) => typeof item === 'string' && services.some((service) => service === item));
}
export function readDrafts(storage: Pick<Storage, 'getItem'>): OpportunityDraft[] {
  const raw = storage.getItem(DRAFT_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1 || !('drafts' in parsed) || !Array.isArray(parsed.drafts)) throw new Error('Unsupported saved draft format.');
  if (!parsed.drafts.every((item) => item && typeof item.id === 'string' && /^[\w-]+$/.test(item.id) && typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)) && isBrief(item.brief))) throw new Error('Saved drafts could not be read.');
  return parsed.drafts as OpportunityDraft[];
}
export function saveDraft(storage: Pick<Storage, 'getItem' | 'setItem'>, draft: OpportunityDraft): void {
  const drafts = readDrafts(storage);
  storage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, drafts: [draft, ...drafts.filter((item) => item.id !== draft.id)] }));
}
export function removeDraft(storage: Pick<Storage, 'getItem' | 'setItem'>, id: string): void {
  storage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, drafts: readDrafts(storage).filter((item) => item.id !== id) }));
}
export function briefText(brief: OpportunityBrief): string {
  return ['RENOVA — Society opportunity brief', 'Preparation draft · Not published or verified', '', ...Object.entries(fieldLabels).map(([key, label]) => `${label}: ${brief[key as keyof typeof fieldLabels].trim() || 'Information not yet provided'}`), `Professionals required: ${brief.services.join(', ') || 'Information not yet provided'}`, '', 'All details are supplied by the preparer. Areas and feasibility require professional verification.'].join('\n\n');
}
