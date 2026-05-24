import { Router, type IRouter } from "express";
import healthRouter from "./health";
import registryRouter from "./registry";
import walrusProxyRouter from "./walrus-proxy";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/registry", registryRouter);
router.use("/walrus", walrusProxyRouter);

export default router;
