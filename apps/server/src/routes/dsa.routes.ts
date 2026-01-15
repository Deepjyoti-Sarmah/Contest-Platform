import {
  authenticate,
  requireRole,
  type AuthRequest,
} from "@/middleware/auth.middleware";
import { submitDsaSchema } from "@/schemas/dsa.schema";
import { executeCode } from "@/utils/codeExecutor";
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

router.post(
  "/:problemId/submit",
  requireRole(["contestee"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const problemId = Number.parseInt(req.params.problemId as string);

      if (Number.isNaN(problemId)) {
        sendError(res, "INVALID_REQUEST", 400);
        return;
      }

      const parsed = submitDsaSchema.safeParse(req.body);
      if (!parsed.success) {
        sendError(res, "INVALID_REQUEST", 400);
        return;
      }

      const { code, language } = parsed.data;

      const problem = await prisma.dsaProblem.findUnique({
        where: { id: problemId },
        include: {
          contest: true,
          testCases: true,
        },
      });

      if (!problem) {
        sendError(res, "PROBLEM_NOT_FOUND", 404);
        return;
      }

      if (problem.contest.creatorId === req.user?.userId) {
        sendError(res, "FORBIDDEN", 403);
        return;
      }

      const now = new Date();
      if (now < problem.contest.startTime || now > problem.contest.endTime) {
        sendError(res, "CONTEST_NOT_ACTIVE", 400);
        return;
      }

      const testCases = problem.testCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      }));

      const executionResult = await executeCode(
        code,
        language,
        testCases,
        problem.timeLimit,
      );

      const pointsEarned = Math.floor(
        (executionResult.testCasesPassed / executionResult.totalTestCases) *
          problem.points,
      );

      await prisma.dsaSubmission.create({
        data: {
          userId: req.user?.userId,
          problemId,
          code,
          language,
          status: executionResult.status,
          pointsEarned,
          testCasesPassed: executionResult.testCasesPassed,
          totalTestCases: executionResult.totalTestCases,
          executionTime: executionResult.executionTime,
        },
      });

      sendSuccess(
        res,
        {
          status: executionResult.status,
          pointsEarned,
          testCasesPassed: executionResult.testCasesPassed,
          totalTestCases: executionResult.totalTestCases,
        },
        201,
      );
    } catch (error) {
      console.error("Submit DSA solution error:", error);
      sendError(res, "INTERNAL_SERVER_ERROR", 500);
    }
  },
);

export default router;
