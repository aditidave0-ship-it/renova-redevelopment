import { Router, type IRouter } from "express";
import healthRouter from "./health";
import renovaRouter from "./renova";
import authRouter from "./auth";
import opportunitiesRouter from "./opportunities";
import enquiriesRouter from "./enquiries";
import profilesRouter from "./profiles";

const router: IRouter = Router();

router.use(healthRouter);
router.use(renovaRouter);
router.use(authRouter);
router.use(opportunitiesRouter);
router.use(enquiriesRouter);
router.use(profilesRouter);

export default router;
