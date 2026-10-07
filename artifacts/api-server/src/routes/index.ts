import { Router, type IRouter } from "express";
import healthRouter from "./health";
import renovaRouter from "./renova";
import authRouter from "./auth";
import opportunitiesRouter from "./opportunities";
import enquiriesRouter from "./enquiries";
import profilesRouter from "./profiles";
import feasibilityRouter from "./feasibility";

const router: IRouter = Router();

router.use(healthRouter);
router.use(renovaRouter);
router.use(authRouter);
router.use(opportunitiesRouter);
router.use(enquiriesRouter);
router.use(profilesRouter);
router.use(feasibilityRouter);

export default router;
