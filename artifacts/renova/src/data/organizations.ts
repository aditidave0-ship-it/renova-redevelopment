export const organizationCategories = [
  'Developers',
  'PMC',
  'Architects',
  'Structural Consultants',
  'Legal',
  'Finance',
  'Valuation',
  'Contractors',
  'Liaison & Approvals',
  'Other Professionals',
] as const;

export type OrganizationCategory = typeof organizationCategories[number];
export type OrganizationProfileStatus = 'public' | 'verified';

export interface OrganizationSource {
  title: string;
  url: string;
  sourceType: 'official-website';
  reviewedAt: string;
}

export interface Organization {
  slug: string;
  name: string;
  category: OrganizationCategory;
  location: string;
  areasServed: string[];
  specializations: string[];
  services: string[];
  redevelopmentTypes: string[];
  website: string;
  sourceUrl: string;
  sources: OrganizationSource[];
  profileStatus: OrganizationProfileStatus;
  overview?: string;
  projects?: string[];
  companyInformation?: string;
}

type Seed = [string, string, OrganizationCategory, string, string[], string[], string[]];

const seed: Seed[] = [
  ['toughcons-nirman', 'Toughcons Nirman Pvt. Ltd.', 'PMC', 'Mumbai', ['Mumbai Metropolitan Region'], ['Society redevelopment', 'Architecture'], ['Project management consultancy', 'Feasibility and planning']],
  ['project-maitree', 'Project Maitree', 'PMC', 'Andheri East, Mumbai', ['Mumbai'], ['Co-operative society redevelopment', 'Architecture'], ['Techno-economic consultancy', 'Project management consultancy']],
  ['rex-pmc', 'REX CON COR Consultants Pvt. Ltd.', 'PMC', 'Andheri West, Mumbai', ['Mumbai'], ['Society redevelopment', 'Structural and civil engineering'], ['Project management consultancy', 'Techno-legal support', 'Structural services']],
  ['swami-pmc', 'SWAMI Project Management Consultant LLP', 'PMC', 'Kandivali West, Mumbai', ['Mumbai'], ['Society redevelopment'], ['Project management', 'Legal counselling', 'Finance consulting']],
  ['sharpmind-consultancy', 'Sharpmind Consultancy Services Pvt. Ltd.', 'PMC', 'Mumbai', ['Mumbai'], ['Society redevelopment', 'Self-redevelopment'], ['Feasibility studies', 'Project management consultancy']],
  ['sharp-pmc', 'Sharp PMC', 'PMC', 'Kalyan, Maharashtra', ['Mumbai', 'Thane', 'Kalyan'], ['Building redevelopment', 'Self-redevelopment'], ['Project management consultancy', 'Construction management']],
  ['supreme-engicons', 'Supreme Engicons', 'PMC', 'Mumbai', ['Mumbai'], ['Redevelopment', 'Structural engineering'], ['Project management consultancy', 'Structural audit', 'Architecture']],
  ['acme-consultants', 'Acme Consultants', 'PMC', 'Mulund West, Mumbai', ['Mumbai'], ['Redevelopment', 'Building repairs'], ['Project management consultancy', 'Structural audit']],
  ['ggdc-consultants', 'GGDC Consultants', 'PMC', 'Mumbai', ['Mumbai Metropolitan Region'], ['Society redevelopment', 'MHADA redevelopment'], ['Project management consultancy', 'Real estate strategy']],
  ['mano-projects', 'MANO Projects Private Limited', 'PMC', 'Mumbai', ['India'], ['Project planning', 'Cost consultancy'], ['Project management consultancy', 'Engineering', 'EPC services']],
  ['shilp-associates', 'Shilp Associates', 'PMC', 'Mumbai', ['Mumbai'], ['Redevelopment advisory'], ['Project management consultancy', 'Architecture']],
  ['pmc-mumbai', 'PMC Mumbai', 'PMC', 'Mumbai', ['Mumbai'], ['Architecture and building planning'], ['Project management consultancy', 'Architecture']],
  ['imk-architects', 'IMK Architects', 'Architects', 'Mumbai', ['Mumbai'], ['Self-redevelopment', 'Residential architecture'], ['Architecture', 'Feasibility reports']],
  ['cna-architects', 'CNA Architects', 'Architects', 'Andheri West, Mumbai', ['Mumbai'], ['Redevelopment architecture', 'Mixed-use design'], ['Architecture', 'Interior design', 'Project management']],
  ['architect-hafeez-contractor', 'Architect Hafeez Contractor', 'Architects', 'Mumbai', ['India'], ['Architecture', 'Urban design'], ['Architectural design', 'Planning']],
  ['talati-partners', 'Talati and Partners LLP', 'Architects', 'Mumbai', ['India'], ['Architecture', 'Interior design'], ['Architectural design', 'Planning']],
  ['sanjay-puri-architects', 'Sanjay Puri Architects', 'Architects', 'Mumbai', ['India'], ['Architecture', 'Urban design'], ['Architectural design']],
  ['dsp-design', 'DSP Design Associates', 'Architects', 'Mumbai', ['India'], ['Architecture', 'Interior design'], ['Architecture', 'Design consultancy']],
  ['edifice-consultants', 'Edifice Consultants Pvt. Ltd.', 'Architects', 'Mumbai', ['India'], ['Architecture', 'Urban design'], ['Architecture', 'Design consultancy']],
  ['ssa-architects', 'SSA Architects', 'Architects', 'Mumbai', ['India'], ['Architecture', 'Planning'], ['Architectural design']],
  ['mahimtura-consultants', 'Mahimtura Consultants Pvt. Ltd.', 'Structural Consultants', 'Mumbai', ['India'], ['Structural engineering'], ['Structural consultancy', 'Engineering design']],
  ['structwel', 'Structwel Designers & Consultants Pvt. Ltd.', 'Structural Consultants', 'Mumbai', ['India'], ['Structural engineering', 'Building assessment'], ['Structural consultancy', 'Engineering services']],
  ['epicons-consultants', 'Epicons Consultants Pvt. Ltd.', 'Structural Consultants', 'Mumbai', ['India'], ['Structural engineering'], ['Structural consultancy', 'Engineering design']],
  ['jw-consultants', 'JW Consultants LLP', 'Structural Consultants', 'Mumbai', ['India'], ['Structural engineering'], ['Structural design consultancy']],
  ['arkade-developers', 'Arkade Developers Limited', 'Developers', 'Mumbai', ['Mumbai'], ['Society redevelopment', 'Residential development'], ['Real estate development', 'Redevelopment']],
  ['sugee-developers', 'Sugee Developers Pvt. Ltd.', 'Developers', 'Mumbai', ['Mumbai'], ['Society redevelopment', 'Residential development'], ['Real estate development', 'Redevelopment']],
  ['rustomjee', 'Rustomjee', 'Developers', 'Mumbai', ['Mumbai Metropolitan Region'], ['Residential development', 'Redevelopment'], ['Real estate development']],
  ['ajmera-realty', 'Ajmera Realty & Infra India Ltd.', 'Developers', 'Mumbai', ['Mumbai Metropolitan Region'], ['Residential development'], ['Real estate development']],
  ['kalpataru', 'Kalpataru Limited', 'Developers', 'Mumbai', ['Mumbai Metropolitan Region'], ['Residential development'], ['Real estate development']],
  ['runwal', 'Runwal', 'Developers', 'Mumbai', ['Mumbai Metropolitan Region'], ['Residential development'], ['Real estate development']],
  ['wadhwa-group', 'The Wadhwa Group', 'Developers', 'Mumbai', ['Mumbai Metropolitan Region'], ['Residential development'], ['Real estate development']],
  ['chandak-group', 'Chandak Group', 'Developers', 'Mumbai', ['Mumbai'], ['Residential development'], ['Real estate development']],
  ['mahindra-lifespaces', 'Mahindra Lifespace Developers Ltd.', 'Developers', 'Mumbai', ['India'], ['Residential development', 'Urban development'], ['Real estate development']],
  ['sunteck-realty', 'Sunteck Realty Limited', 'Developers', 'Mumbai', ['Mumbai Metropolitan Region'], ['Residential development'], ['Real estate development']],
  ['raymond-realty', 'Raymond Realty', 'Developers', 'Mumbai Metropolitan Region', ['Mumbai Metropolitan Region'], ['Residential development'], ['Real estate development']],
  ['micl-group', 'Man Infraconstruction Limited', 'Developers', 'Mumbai', ['Mumbai Metropolitan Region'], ['Residential development', 'Construction'], ['Real estate development', 'Construction']],
  ['dosti-realty', 'Dosti Realty', 'Developers', 'Mumbai', ['Mumbai Metropolitan Region'], ['Residential development'], ['Real estate development']],
  ['hiranandani', 'Hiranandani Group', 'Developers', 'Mumbai', ['India'], ['Integrated communities', 'Residential development'], ['Real estate development']],
  ['godrej-properties', 'Godrej Properties Limited', 'Developers', 'Mumbai', ['India'], ['Residential development'], ['Real estate development']],
  ['oberoi-realty', 'Oberoi Realty Limited', 'Developers', 'Mumbai', ['Mumbai Metropolitan Region'], ['Residential development'], ['Real estate development']],
  ['piramal-realty', 'Piramal Realty', 'Developers', 'Mumbai', ['Mumbai Metropolitan Region'], ['Residential development'], ['Real estate development']],
  ['lodha', 'Lodha', 'Developers', 'Mumbai', ['India'], ['Residential development'], ['Real estate development']],
  ['adani-realty', 'Adani Realty', 'Developers', 'Mumbai', ['India'], ['Residential development'], ['Real estate development']],
  ['shapoorji-pallonji-real-estate', 'Shapoorji Pallonji Real Estate', 'Developers', 'Mumbai', ['India'], ['Residential development'], ['Real estate development']],
  ['puravankara', 'Puravankara Limited', 'Developers', 'Mumbai', ['India'], ['Residential development'], ['Real estate development']],
  ['paradigm-realty', 'Paradigm Realty', 'Developers', 'Mumbai', ['Mumbai'], ['Residential development', 'Society redevelopment'], ['Real estate development', 'Redevelopment']],
  ['hubtown', 'Hubtown Limited', 'Developers', 'Mumbai', ['Mumbai Metropolitan Region'], ['Residential development'], ['Real estate development']],
  ['rohan-lifescapes', 'Rohan Lifescapes', 'Developers', 'Mumbai', ['Mumbai'], ['Residential redevelopment'], ['Real estate development', 'Redevelopment']],
  ['dsk-legal', 'DSK Legal', 'Legal', 'Mumbai', ['India'], ['Real estate law'], ['Legal advisory']],
  ['mulla-mulla', 'Mulla & Mulla & Craigie Blunt & Caroe', 'Legal', 'Mumbai', ['India'], ['Real estate law'], ['Legal advisory']],
  ['wadia-ghandy', 'Wadia Ghandy & Co.', 'Legal', 'Mumbai', ['India'], ['Real estate law'], ['Legal advisory']],
  ['hariani-company', 'Hariani & Co.', 'Legal', 'Mumbai', ['India'], ['Real estate law'], ['Legal advisory']],
  ['khaitan-company', 'Khaitan & Co.', 'Legal', 'Mumbai', ['India'], ['Real estate law'], ['Legal advisory']],
  ['cyril-amarchand', 'Cyril Amarchand Mangaldas', 'Legal', 'Mumbai', ['India'], ['Real estate law'], ['Legal advisory']],
  ['knight-frank-india', 'Knight Frank India', 'Valuation', 'Mumbai', ['India'], ['Real estate valuation', 'Research'], ['Valuation and advisory']],
  ['jll-india', 'JLL India', 'Valuation', 'Mumbai', ['India'], ['Real estate valuation', 'Advisory'], ['Valuation and advisory']],
  ['cbre-india', 'CBRE India', 'Valuation', 'Mumbai', ['India'], ['Real estate valuation', 'Advisory'], ['Valuation and advisory']],
  ['cushman-wakefield-india', 'Cushman & Wakefield India', 'Valuation', 'Mumbai', ['India'], ['Real estate valuation', 'Advisory'], ['Valuation and advisory']],
  ['anarock', 'ANAROCK Property Consultants', 'Finance', 'Mumbai', ['India'], ['Real estate advisory', 'Capital markets'], ['Real estate consultancy']],
  ['savills-india', 'Savills India', 'Valuation', 'Mumbai', ['India'], ['Real estate valuation', 'Advisory'], ['Valuation and advisory']],
  ['larsen-toubro-construction', 'L&T Construction', 'Contractors', 'Mumbai', ['India'], ['Building construction', 'Engineering'], ['Construction', 'EPC services']],
  ['capacite-infraprojects', 'Capacit’e Infraprojects Limited', 'Contractors', 'Mumbai', ['India'], ['Building construction'], ['Construction services']],
  ['ahluwalia-contracts', 'Ahluwalia Contracts (India) Limited', 'Contractors', 'Mumbai', ['India'], ['Building construction'], ['Construction services']],
  ['j-kumar-infraprojects', 'J. Kumar Infraprojects Limited', 'Contractors', 'Mumbai', ['India'], ['Urban infrastructure', 'Construction'], ['Construction services']],
  ['aquire-manage', 'A&M Advisory', 'Liaison & Approvals', 'Mumbai', ['Mumbai'], ['SRA redevelopment', 'Statutory coordination'], ['Redevelopment consultancy', 'Documentation coordination']],
  ['paradigm-pmc', 'PARADIGM Project Management Consultants', 'PMC', 'Sion–Chunabhatti, Mumbai', ['Mumbai', 'Maharashtra'], ['Society redevelopment', 'Self-redevelopment'], ['Project management consultancy', 'Owner’s engineer', 'Contract management']],
  ['ms-consultants-engineers', 'MS Consultants & Engineers', 'PMC', 'Mulund East, Mumbai', ['Mumbai'], ['Project management', 'Repairs and rehabilitation'], ['Project management consultancy', 'Structural design', 'MEP consulting', 'Valuation']],
  ['rbsa-advisors', 'RBSA Advisors', 'Valuation', 'Andheri East, Mumbai', ['India'], ['Real estate valuation', 'Transaction advisory'], ['Valuation advisory', 'Project appraisal and monitoring', 'Technical due diligence']],
  ['aakar-architects-consultants', 'Aakar Architects and Consultants', 'Liaison & Approvals', 'Mumbai', ['Mumbai'], ['Municipal approvals', 'Real estate liaisoning'], ['Approval coordination', 'Architectural services']],
  ['crescent-consulting-engineers', 'Crescent Consulting Engineers', 'Other Professionals', 'Bhandup West, Mumbai', ['Mumbai', 'India'], ['MEP design', 'BIM and drafting'], ['MEP design', 'CAD drafting', 'Lighting design']],
  ['wisetech-mep', 'WISETECH MEP Consultants Pvt. Ltd.', 'Other Professionals', 'Jogeshwari West, Mumbai', ['Mumbai', 'India'], ['MEP design', 'Fire-fighting systems'], ['Mechanical design', 'Electrical design', 'Plumbing design', 'Fire-fighting design']],
  ['urbanetek', 'UrbaneTek', 'Other Professionals', 'Vidyavihar West, Mumbai', ['Mumbai', 'Pune', 'India'], ['MEP systems', 'Design and build'], ['HVAC systems', 'Fire systems', 'Plumbing systems', 'Electrical systems']],
  ['total-mep-consultants', 'Total MEP Design & Consulting Engineers', 'Other Professionals', 'Mumbai', ['Mumbai', 'India'], ['MEP consulting', 'Building services'], ['HVAC design', 'Electrical design', 'Plumbing design', 'Fire protection design']],
  ['mastertech-mep', 'Mastertech MEP Consultants', 'Other Professionals', 'Mumbai', ['Mumbai', 'India'], ['MEP consulting', 'Building systems'], ['HVAC design', 'Electrical design', 'Plumbing design', 'Fire protection design']],
  ['global-mep-consultant', 'Global MEP Consultant', 'Other Professionals', 'Mumbai Metropolitan Region', ['Mumbai', 'Navi Mumbai', 'Thane', 'Pune'], ['MEP consulting', 'BIM coordination'], ['HVAC design', 'Electrical design', 'Plumbing design', 'Fire and life safety']],
  ['d-plumbing-consultants', "D'Plumbing Consultants", 'Other Professionals', 'Mumbai', ['Mumbai', 'India'], ['Plumbing and sanitation', 'Water conservation'], ['Plumbing design', 'Fire-fighting systems', 'Wastewater treatment', 'MEP coordination']],
  ['aqua-corp-engineering', 'Aqua Corp Engineering Solutions', 'Other Professionals', 'Navi Mumbai', ['Mumbai Metropolitan Region', 'India'], ['MEP and fire engineering', 'Green building services'], ['MEP design', 'Fire-fighting design', 'Environmental clearance assistance']],
  ['faircon-uno', 'Faircon Uno', 'Other Professionals', 'Mumbai', ['Mumbai', 'India'], ['MEP building services', 'Illumination design'], ['MEP design', 'Tender support', 'Green building support']],
  ['arkk-consulting', 'ARKK Consulting Pvt. Ltd.', 'Other Professionals', 'Mumbai', ['Mumbai', 'India'], ['MEP infrastructure', 'Design coordination'], ['MEP consulting', 'Design coordination']],
  ['shine-consultants-engineers', 'Shine Consultants & Engineers', 'Other Professionals', 'Dahisar East, Mumbai', ['Mumbai', 'India'], ['MEP design', 'Architectural design'], ['Building services consultancy', 'MEP design', 'Architectural design']],
];

const websites: Record<string, string> = {
  'toughcons-nirman': 'https://www.toughconsnirman.com/', 'project-maitree': 'https://www.projectmaitree.com/', 'rex-pmc': 'https://rexgroup.in/pmc-for-redevelopment-and-construction/', 'swami-pmc': 'https://swamipmc.com/', 'sharpmind-consultancy': 'https://www.scspl.net/', 'sharp-pmc': 'https://sharppmc.com/', 'supreme-engicons': 'https://www.supremeengicons.com/', 'acme-consultants': 'https://acmeconsultant.co.in/', 'ggdc-consultants': 'https://www.ggdc.in/', 'mano-projects': 'https://www.mano.co.in/', 'shilp-associates': 'https://shilpassociates.com/', 'pmc-mumbai': 'https://pmcmumbai.com/', 'imk-architects': 'https://imkarchitects.com/self-redevelopment.php', 'cna-architects': 'https://www.cna-arch.com/projects/redevelopment.php', 'architect-hafeez-contractor': 'https://www.hafeezcontractor.com/', 'talati-partners': 'https://talatiandpartners.com/', 'sanjay-puri-architects': 'https://sanjaypuriarchitects.com/', 'dsp-design': 'https://www.dspdesign.co.in/', 'edifice-consultants': 'https://www.edifice.co.in/', 'ssa-architects': 'https://ssaarchitects.com/', 'mahimtura-consultants': 'https://mahimtura.com/', 'structwel': 'https://structwel.com/', 'epicons-consultants': 'https://www.epicons.co.in/', 'jw-consultants': 'https://jwconsultants.in/', 'arkade-developers': 'https://arkade.in/redevelopment/', 'sugee-developers': 'https://sugee.co.in/', 'rustomjee': 'https://www.rustomjee.com/', 'ajmera-realty': 'https://ajmera.com/', 'kalpataru': 'https://www.kalpataru.com/', 'runwal': 'https://runwal.com/', 'wadhwa-group': 'https://www.thewadhwagroup.com/', 'chandak-group': 'https://chandakhomes.com/', 'mahindra-lifespaces': 'https://www.mahindralifespaces.com/', 'sunteck-realty': 'https://www.sunteckindia.com/', 'raymond-realty': 'https://raymondrealty.in/', 'micl-group': 'https://www.miclgroup.com/', 'dosti-realty': 'https://www.dostirealty.com/', 'hiranandani': 'https://www.hiranandani.com/', 'godrej-properties': 'https://www.godrejproperties.com/', 'oberoi-realty': 'https://www.oberoirealty.com/', 'piramal-realty': 'https://www.piramalrealty.com/', 'lodha': 'https://www.lodhagroup.com/', 'adani-realty': 'https://www.adanirealty.com/', 'shapoorji-pallonji-real-estate': 'https://www.shapoorjirealestate.com/', 'puravankara': 'https://www.puravankara.com/', 'paradigm-realty': 'https://paradigmrealty.co.in/', 'hubtown': 'https://www.hubtown.co.in/', 'rohan-lifescapes': 'https://rohanlifescapes.com/', 'dsk-legal': 'https://www.dsklegal.com/', 'mulla-mulla': 'https://mullaandmulla.com/', 'wadia-ghandy': 'https://www.wadiaghandy.com/', 'hariani-company': 'https://hariani.co.in/', 'khaitan-company': 'https://www.khaitanco.com/', 'cyril-amarchand': 'https://www.cyrilshroff.com/', 'knight-frank-india': 'https://www.knightfrank.co.in/', 'jll-india': 'https://www.jll.co.in/', 'cbre-india': 'https://www.cbre.co.in/', 'cushman-wakefield-india': 'https://www.cushmanwakefield.com/en/india', 'anarock': 'https://www.anarock.com/', 'savills-india': 'https://www.savills.in/', 'larsen-toubro-construction': 'https://www.lntecc.com/', 'capacite-infraprojects': 'https://www.capacite.in/', 'ahluwalia-contracts': 'https://www.acilnet.com/', 'j-kumar-infraprojects': 'https://www.jkumar.com/', 'aquire-manage': 'https://www.aquireandmanage.com/', 'paradigm-pmc': 'https://www.paradigm.org.in/', 'ms-consultants-engineers': 'https://mscepl.com/', 'rbsa-advisors': 'https://rbsa.in/', 'aakar-architects-consultants': 'https://aakararchitect.org/', 'crescent-consulting-engineers': 'https://www.crescentengineers.com/', 'wisetech-mep': 'https://www.wisetech-mep.com/', 'urbanetek': 'https://urbanetek.com/', 'total-mep-consultants': 'https://www.totalmepconsultants.com/', 'mastertech-mep': 'https://mastertechmep.com/', 'global-mep-consultant': 'https://www.globalmepconsultant.com/', 'd-plumbing-consultants': 'https://www.dplumbing.net/', 'aqua-corp-engineering': 'https://www.aquacorp.in/', 'faircon-uno': 'https://www.fairconuno.com/', 'arkk-consulting': 'https://www.arkkconsulting.com/', 'shine-consultants-engineers': 'https://www.shineconsultant.net/'
};

export const organizationDataVersion = '2026-09-24';

export const organizations: Organization[] = seed.map(([slug, name, category, location, areasServed, specializations, services]) => ({
  slug,
  name,
  category,
  location,
  areasServed,
  specializations,
  services,
  redevelopmentTypes: specializations.some((item) => item.toLowerCase().includes('self-redevelopment')) ? ['Self-redevelopment'] : specializations.some((item) => item.toLowerCase().includes('redevelopment')) ? ['Society redevelopment'] : [],
  website: websites[slug],
  sourceUrl: websites[slug],
  sources: [{
    title: `${name} official website`,
    url: websites[slug],
    sourceType: 'official-website',
    reviewedAt: organizationDataVersion,
  }],
  profileStatus: 'public',
}));

export const getOrganization = (slug: string) => organizations.find((organization) => organization.slug === slug);
