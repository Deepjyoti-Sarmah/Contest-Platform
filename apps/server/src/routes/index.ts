import { Router } from "express";
import authRoutes from "./auth.routes";
import contestRouter from "./contest.routes";
import dsaRouter from "./dsa.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/contests", contestRouter);
router.use("/problems", dsaRouter);
export default router;
