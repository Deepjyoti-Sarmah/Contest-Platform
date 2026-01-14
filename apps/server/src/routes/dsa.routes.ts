import {
  authenticate,
  requireRole,
  type AuthRequest,
} from "@/middleware/auth.middleware";
import { sendError, sendSuccess } from "@/utils/response";
import prisma from "@Contest-Platform/db";
import { Router, type Response } from "express";

const router = Router();

router.use(authenticate);

router.get("/:problemId", async (req: AuthRequest, res: Response) => {
  try {
    const problemId = Number.parseInt(req.params.problemId as string);

    if (Number.isNaN(problemId)) {
      sendError(res, "INVALID_REQUEST", 400);
      return;
    }

    const problem = await prisma.dsaProblem.findUnique({
      where: { id: problemId },
      include: {
        testCases: true,
      },
    });

    if (!problem) {
      sendError(res, "PROBLEM_NOT_FOUND", 404);
      return;
    }

    const visibleTestCases = problem.testCases
      .filter((tc) => !tc.isHidden)
      .map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      }));

    sendSuccess(
      res,
      {
        id: problem.id,
        contestId: problem.contestId,
        title: problem.title,
        description: problem.description,
        tags: problem.tags,
        poinnts: problem.points,
        timeLimit: problem.timeLimit,
        memoryLimit: problem.memoryLimit,
        visibleTestCases,
      },
      200,
    );
  } catch (error) {
    console.error("Get DSA problem error:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", 500);
  }
});

export default router;
