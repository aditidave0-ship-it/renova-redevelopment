export type PlatformRole = 'society' | 'developer' | 'pmc';

export type ProjectStage =
  | 'profile'
  | 'requirements'
  | 'discover'
  | 'connect'
  | 'proposals'
  | 'compare'
  | 'selection'
  | 'project';

export type Stakeholder = {
  id: string;
  name: string;
  role: 'Society' | 'Developer' | 'PMC' | 'RENOVA';
  access: string;
  status: 'Active' | 'Invited' | 'Interested';
};

export type ProposalTerm = {
  label: string;
  alpha: string;
  beta: string;
  kind?: 'money' | 'duration' | 'text';
};

export type PlatformProject = {
  id: string;
  name: string;
  location: string;
  stage: ProjectStage;
  stageLabel: string;
  opportunityStatus: string;
  reference: string;
  summary: string;
  societyFacts: Array<{ label: string; value: string }>;
  stakeholders: Stakeholder[];
  proposalTerms: ProposalTerm[];
  documents: Array<{ name: string; type: string; owner: string; updated: string; visibility: PlatformRole[] }>;
  activity: Array<{ title: string; detail: string; actor: string; time: string; visibility: PlatformRole[] }>;
};

export const journeyStages: Array<{ id: ProjectStage; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'discover', label: 'Discover' },
  { id: 'connect', label: 'Connect' },
  { id: 'proposals', label: 'Proposals' },
  { id: 'compare', label: 'Compare' },
  { id: 'selection', label: 'Selection' },
  { id: 'project', label: 'Project' },
];

export const demoProject: PlatformProject = {
  id: 'abc-chs-redevelopment',
  name: 'ABC Cooperative Housing Society Redevelopment',
  location: 'Andheri West, Mumbai',
  stage: 'compare',
  stageLabel: 'Proposal comparison',
  opportunityStatus: 'Open to invited developers',
  reference: 'RNV-DEMO-2401',
  summary: 'A shared redevelopment workspace connecting the society, invited developers, the appointed PMC and RENOVA with role-appropriate access.',
  societyFacts: [
    { label: 'Member homes', value: '72' },
    { label: 'Building age', value: '41 years' },
    { label: 'Property type', value: 'Co-operative housing society' },
    { label: 'Current focus', value: 'Proposal clarification' },
  ],
  stakeholders: [
    { id: 'society-abc', name: 'ABC CHS Committee', role: 'Society', access: 'Project owner · full society view', status: 'Active' },
    { id: 'developer-alpha', name: 'Developer Alpha', role: 'Developer', access: 'Opportunity and own proposal only', status: 'Interested' },
    { id: 'developer-beta', name: 'Developer Beta', role: 'Developer', access: 'Opportunity and own proposal only', status: 'Interested' },
    { id: 'pmc-demo', name: 'PMC Advisory Team', role: 'PMC', access: 'Technical review and project documents', status: 'Active' },
    { id: 'renova-ops', name: 'RENOVA Platform Operations', role: 'RENOVA', access: 'Permissions, verification and audit', status: 'Active' },
  ],
  proposalTerms: [
    { label: 'Proposal status', alpha: 'Clarification requested', beta: 'Submitted', kind: 'text' },
    { label: 'Rehabilitation carpet area', alpha: 'As submitted: 735 sq ft', beta: 'As submitted: 720 sq ft', kind: 'text' },
    { label: 'Corpus per eligible member', alpha: '₹18,00,000', beta: '₹20,00,000', kind: 'money' },
    { label: 'Monthly transit rent', alpha: '₹72,000', beta: '₹68,000', kind: 'money' },
    { label: 'Proposed construction period', alpha: '36 months', beta: '39 months', kind: 'duration' },
    { label: 'Bank guarantee', alpha: 'Terms provided in document', beta: 'Clarification pending', kind: 'text' },
    { label: 'Amenities and specifications', alpha: '12 structured items', beta: '10 structured items', kind: 'text' },
  ],
  documents: [
    { name: 'Society requirement brief', type: 'Opportunity', owner: 'ABC CHS Committee', updated: '24 Sep 2026', visibility: ['society', 'developer', 'pmc'] },
    { name: 'Structural audit summary', type: 'Technical', owner: 'ABC CHS Committee', updated: '22 Sep 2026', visibility: ['society', 'developer', 'pmc'] },
    { name: 'Developer Alpha proposal', type: 'Proposal', owner: 'Developer Alpha', updated: '25 Sep 2026', visibility: ['society', 'developer', 'pmc'] },
    { name: 'Proposal comparison working note', type: 'Evaluation', owner: 'PMC Advisory Team', updated: '26 Sep 2026', visibility: ['society', 'pmc'] },
    { name: 'Committee internal note', type: 'Internal', owner: 'ABC CHS Committee', updated: '26 Sep 2026', visibility: ['society'] },
  ],
  activity: [
    { title: 'Comparison fields updated', detail: 'PMC aligned the two submissions to the standard RENOVA proposal structure.', actor: 'PMC Advisory Team', time: 'Today · 6:10 PM', visibility: ['society', 'pmc'] },
    { title: 'Clarification requested', detail: 'The society requested supporting detail for the proposed bank guarantee.', actor: 'ABC CHS Committee', time: 'Today · 2:40 PM', visibility: ['society', 'developer', 'pmc'] },
    { title: 'Proposal submitted', detail: 'A structured proposal was added to the opportunity.', actor: 'Developer Beta', time: 'Yesterday · 5:25 PM', visibility: ['society', 'developer', 'pmc'] },
    { title: 'Opportunity access approved', detail: 'RENOVA approved access after society consent and profile review.', actor: 'RENOVA Platform Operations', time: '23 Sep 2026', visibility: ['society', 'developer', 'pmc'] },
  ],
};

export const demoOpportunities = [
  { id: 'opp-101', name: 'Westview CHS Redevelopment', location: 'Goregaon West', type: 'Co-operative society', status: 'Open for interest', homes: '64 homes', fit: 'Western suburbs' },
  { id: 'opp-102', name: 'Pragati Nagar Renewal', location: 'Chembur', type: 'Housing society', status: 'Invited proposals', homes: '108 homes', fit: 'Central suburbs' },
  { id: 'opp-103', name: 'Sea Crest Society', location: 'Bandra West', type: 'Co-operative society', status: 'PMC requested', homes: '48 homes', fit: 'Feasibility support' },
];

export const roleCopy: Record<PlatformRole, { label: string; title: string; organization: string; initials: string }> = {
  society: { label: 'Society workspace', title: 'Committee overview', organization: 'ABC Cooperative Housing Society', initials: 'AC' },
  developer: { label: 'Developer workspace', title: 'Opportunity overview', organization: 'Developer Alpha', initials: 'DA' },
  pmc: { label: 'PMC workspace', title: 'Advisory overview', organization: 'PMC Advisory Team', initials: 'PA' },
};

export const proposalDisclaimer = 'Demo proposal data for product preview only. These are not real offers, recommendations or verified commercial terms.';
