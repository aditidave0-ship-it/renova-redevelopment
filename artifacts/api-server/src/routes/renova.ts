import { Router, type IRouter } from "express";
import {
  CreateProjectBody,
  GetProjectParams,
  ListProfessionalsQueryParams,
  GetDashboardResponse,
  ListProjectsResponse,
  CreateProjectResponse,
  GetProjectResponse,
  ListProfessionalsResponse,
  ListRegulationsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type Project = {
  id: string;
  name: string;
  location: string;
  societyType: string;
  landType?: string;
  stage: string;
  readiness: number;
  memberCount?: number;
  updatedAt: string;
  redFlags: string[];
  nextStep: string;
  pathway?: string[];
};

const projects: Project[] = [
  {
    id: "project-1",
    name: "Sai Darshan Co-operative Housing Society",
    location: "Borivali West, Mumbai",
    societyType: "Co-operative Housing Society",
    landType: "MHADA leasehold",
    stage: "Assessment in progress",
    readiness: 42,
    memberCount: 72,
    updatedAt: "Today, 10:42 AM",
    redFlags: ["No registered conveyance", "Structural audit incomplete", "Title report required"],
    nextStep: "Resolve title & conveyance issue",
    pathway: ["DCPR 2034", "Regulation 33(5)", "MHADA redevelopment"],
  },
];

const professionals = [
  { id: "pmc-1", name: "UrbanFrame Consultants", role: "Redevelopment PMC", location: "Andheri East", experience: "18 years", match: 96, specialties: ["MHADA", "CHS redevelopment", "Tender management"], verified: true },
  { id: "legal-1", name: "Mehta & Iyer Associates", role: "Property & Title Legal", location: "Fort, Mumbai", experience: "22 years", match: 91, specialties: ["Conveyance", "Title due diligence", "Society law"], verified: true },
  { id: "arch-1", name: "Studio Northline", role: "Architect", location: "Bandra West", experience: "14 years", match: 87, specialties: ["Feasibility", "High-rise residential", "DCPR planning"], verified: true },
  { id: "tech-1", name: "Structura Labs", role: "Structural Consultant", location: "Powai", experience: "16 years", match: 84, specialties: ["Structural audits", "Dilapidated buildings", "Repair assessment"], verified: true },
];

const regulations = [
  { id: "reg-33-5", code: "33(5)", title: "Redevelopment of MHADA colonies", summary: "Provisions relevant to redevelopment of buildings and layouts under MHADA jurisdiction.", authority: "MHADA / BMC", updatedAt: "16 Aug 2026", status: "Current" },
  { id: "reg-33-7", code: "33(7)", title: "Redevelopment of cessed buildings", summary: "A potential pathway for redevelopment of eligible cessed buildings in Mumbai.", authority: "BMC DCPR 2034", updatedAt: "16 Aug 2026", status: "Current" },
  { id: "reg-33-9", code: "33(9)", title: "Cluster redevelopment", summary: "Framework for redevelopment of multiple buildings or societies as a cluster.", authority: "BMC DCPR 2034", updatedAt: "16 Aug 2026", status: "Current" },
  { id: "reg-33-10", code: "33(10)", title: "Slum rehabilitation schemes", summary: "Potentially relevant provisions for SRA schemes and rehabilitation projects.", authority: "SRA / BMC", updatedAt: "16 Aug 2026", status: "Current" },
];

const activity = [
  { id: "a1", title: "Assessment started", detail: "Your society profile has been created", date: "Today", kind: "milestone" },
  { id: "a2", title: "3 red flags identified", detail: "Review items that may affect readiness", date: "Today", kind: "alert" },
  { id: "a3", title: "Potential pathway found", detail: "DCPR 2034 · Regulation 33(5)", date: "Yesterday", kind: "regulation" },
];

router.get("/dashboard", (_req, res) => {
  const project = projects[0];
  res.json(GetDashboardResponse.parse({
    activeProject: project,
    totalReadiness: project.readiness,
    openRedFlags: project.redFlags.length,
    completedSteps: 2,
    recentActivity: activity,
  }));
});

router.get("/projects", (_req, res) => res.json(ListProjectsResponse.parse(projects)));

router.post("/projects", (req, res) => {
  const input = CreateProjectBody.parse(req.body);
  const project: Project = {
    id: `project-${projects.length + 1}`,
    name: input.name,
    location: input.location,
    societyType: input.societyType,
    landType: input.landType,
    stage: "Assessment started",
    readiness: 8,
    memberCount: input.memberCount,
    updatedAt: "Just now",
    redFlags: ["Property documents not reviewed", "Conveyance status not confirmed"],
    nextStep: "Complete property diagnostic",
    pathway: ["Potential pathway pending assessment"],
  };
  projects.unshift(project);
  res.status(201).json(CreateProjectResponse.parse(project));
});

router.get("/projects/:id", (req, res) => {
  const { id } = GetProjectParams.parse(req.params);
  const project = projects.find((item) => item.id === id);
  if (!project) return res.status(404).json({ error: "Project not found" });
  return res.json(GetProjectResponse.parse(project));
});

router.get("/professionals", (req, res) => {
  const { role } = ListProfessionalsQueryParams.parse(req.query);
  const matches = role ? professionals.filter((item) => item.role.toLowerCase().includes(role.toLowerCase())) : professionals;
  return res.json(ListProfessionalsResponse.parse(matches));
});

router.get("/regulations", (_req, res) => res.json(ListRegulationsResponse.parse(regulations)));

export default router;