import { Router, type IRouter } from "express";
import { enquiryEmailJobs } from "@workspace/db";
import { getDb, requireAuth, requireRole } from "../lib/session";
import { processEnquiryEmailJobs } from "../lib/enquiry-email-jobs";
const router: IRouter = Router();
router.get(
  "/admin/enquiry-email-jobs",
  requireAuth(),
  requireRole("ADMIN"),
  async (_req, res, next) => {
    try {
      return res.json({
        jobs: await getDb().select().from(enquiryEmailJobs).limit(100),
        notice: "ACCEPTED means provider acceptance, not inbox delivery.",
      });
    } catch (e) {
      return next(e);
    }
  },
);
router.post(
  "/admin/enquiry-email-jobs/process",
  requireAuth(),
  requireRole("ADMIN"),
  async (_req, res, next) => {
    try {
      return res.json({
        jobs: await processEnquiryEmailJobs(),
        notice: "ACCEPTED means provider acceptance, not inbox delivery.",
      });
    } catch (e) {
      return next(e);
    }
  },
);
export default router;
