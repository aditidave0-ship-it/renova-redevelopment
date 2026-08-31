import { Router, type IRouter } from "express";
import healthRouter from "./health";
import renovaRouter from "./renova";

const router: IRouter = Router();

router.use(healthRouter);
router.use(renovaRouter);

export default router;
