import { Router } from "express";
import authRoutes from "./auth.routes";
import contestRouter from "./contest.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/contests", contestRouter);

export default router;
