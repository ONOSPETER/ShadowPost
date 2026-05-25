import { Router, type IRouter } from "express";
import healthRouter from "./health";
import registryRouter from "./registry";
import walrusProxyRouter from "./walrus-proxy";
import suiRpcRouter from "./sui-rpc";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/registry", registryRouter);
router.use("/walrus", walrusProxyRouter);
router.use("/sui-rpc", suiRpcRouter);

export default router;
