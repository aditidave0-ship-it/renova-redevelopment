import { Router, type IRouter } from "express";
import healthRouter from "./health";
import renovaRouter from "./renova";
import authRouter from "./auth";
import opportunitiesRouter from "./opportunities";

const router: IRouter = Router();

router.use(healthRouter);
router.use(renovaRouter);
router.use(authRouter);
router.use(opportunitiesRouter);

export default router;
