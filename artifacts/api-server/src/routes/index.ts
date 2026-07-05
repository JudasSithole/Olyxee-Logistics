import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import businessRouter from "./business";
import dashboardRouter from "./dashboard";
import customersRouter from "./customers";
import ordersRouter from "./orders";
import auditRouter from "./audit";
import workflowTemplatesRouter from "./workflow-templates";
import billingRouter from "./billing";
import v1Router from "./v1";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(businessRouter);
router.use(dashboardRouter);
router.use(customersRouter);
router.use(ordersRouter);
router.use(auditRouter);
router.use(workflowTemplatesRouter);
// Launch-prep foundations. Both self-gate: billing responds 503 unless test
// billing is enabled; the public API responds 503 unless featureFlags.publicApi.
router.use(billingRouter);
router.use(v1Router);

export default router;
