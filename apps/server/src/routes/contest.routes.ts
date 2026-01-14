import prisma from "@Contest-Platform/db";
import { type Response, Router } from "express";
import {
  type AuthRequest,
  authenticate,
  requireRole,
} from "@/middleware/auth.middleware";
import { createContestSchema } from "@/schemas/contest.schema";
import { createMcqSchema, submitMcqSchema } from "@/schemas/mcq.schema";
import { sendError, sendSuccess } from "@/utils/response";
import { createDsaProblemSchema } from "@/schemas/dsa.schema";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  requireRole(["creator"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = createContestSchema.safeParse(req.body);
      if (!parsed.success) {
        sendError(res, "INVALID_REQUEST", 400);
        return;
      }

      const { title, description, startTime, endTime } = parsed.data;

      const contest = await prisma.contest.create({
        data: {
          title,
          description,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          creatorId: req.user?.userId as number,
        },
      });

      sendSuccess(
        res,
        {
          id: contest.id,
          title: contest.title,
          description: contest.description,
          creatorId: contest.creatorId,
          startTime: contest.startTime.toISOString(),
          endTime: contest.endTime.toISOString(),
        },
        201,
      );
    } catch (error) {
      console.error("Create contest error:", error);
      sendError(res, "INTERNAL_SERVER_ERROR", 500);
    }
  },
);

router.get("/:contestId", async (req: AuthRequest, res: Response) => {
  try {
    const contestId = Number.parseInt(req.params.contestId as string);

    if (Number.isNaN(contestId)) {
      sendError(res, "INVALID_REQUEST", 400);
      return;
    }

    const contest = await prisma.contest.findUnique({
      where: { id: contestId },
      include: {
        mcqQuestions: true,
        dsaProblems: true,
      },
    });

    if (!contest) {
      sendError(res, "CONTEST_NOT_FOUND", 404);
      return;
    }

    const isCreator = req.user?.userId === contest.creatorId;

    const mcqs = contest.mcqQuestions.map((mcq) => {
      const mcqData: any = {
        id: mcq.id,
        questionText: mcq.questionText,
        options: mcq.options,
        points: mcq.points,
      };

      if (isCreator) {
        mcqData.correctOptionIndex = mcq.correctOptionIndex;
      }

      return mcqData;
    });

    const dsaProblems = contest.dsaProblems.map((problem) => ({
      id: problem.id,
      title: problem.title,
      description: problem.description,
      tags: problem.tags,
      points: problem.points,
      timeLimit: problem.timeLimit,
      memoryLimit: problem.memoryLimit,
    }));

    sendSuccess(
      res,
      {
        id: contest.id,
        title: contest.title,
        description: contest.description,
        startTime: contest.startTime.toISOString(),
        endTime: contest.endTime.toISOString(),
        creatorId: contest.creatorId,
        mcqs,
        dsaProblems,
      },
      200,
    );
  } catch (error) {
    console.error("Get contest error:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", 500);
  }
});

router.post(
  "/:contestId/mcq",
  requireRole(["creator"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const contestId = Number.parseInt(req.params.contestId as string);

      if (Number.isNaN(contestId)) {
        sendError(res, "INVALID_REQUEST", 400);
        return;
      }

      const parsed = createMcqSchema.safeParse(req.body);
      if (!parsed.success) {
        sendError(res, "INVALID_REQUEST", 400);
        return;
      }

      const contest = await prisma.contest.findUnique({
        where: { id: contestId },
      });

      if (!contest) {
        sendError(res, "CONTEST_NOT_FOUND", 404);
        return;
      }

      if (contest.creatorId !== req.user?.userId) {
        sendError(res, "FORBIDDEN", 403);
        return;
      }

      const { questionText, options, correctOptionIndex, points } = parsed.data;

      const mcq = await prisma.mcqQuestion.create({
        data: {
          contestId,
          questionText,
          options,
          correctOptionIndex,
          points,
        },
      });

      sendSuccess(
        res,
        {
          id: mcq.id,
          contestId: mcq.contestId,
        },
        201,
      );
    } catch (error) {
      console.error("Create MCQ error:", error);
      sendError(res, "INTERNAL_SERVER_ERROR", 500);
    }
  },
);

router.post(
  "/:contestId/mcq/:questionId/submit",
  requireRole(["contestee"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const contestId = Number.parseInt(req.params.contestId as string);

      const questionId = Number.parseInt(req.params.questionId as string);

      if (Number.isNaN(contestId) || Number.isNaN(questionId)) {
        sendError(res, "INVALID_REQUEST", 400);
        return;
      }

      const parsed = submitMcqSchema.safeParse(req.body);
      if (!parsed.success) {
        sendError(res, "INVALID_REQUEST", 400);
        return;
      }

      const { selectedOptionIndex } = parsed.data;

      const question = await prisma.mcqQuestion.findUnique({
        where: {
          id: questionId,
        },
        include: {
          contest: true,
        },
      });

      if (!question || question.contestId !== contestId) {
        sendError(res, "QUESTION_NOT_FOUND", 404);
        return;
      }

      if (question.contest.creatorId === req.user?.userId) {
        sendError(res, "FORBIDDEN", 403);
        return;
      }

      const now = new Date();
      if (now < question.contest.startTime || now > question.contest.endTime) {
        sendError(res, "CONTEST_NOT_ACTIVE", 400);
        return;
      }

      const existingSubmission = await prisma.mcqSubmission.findUnique({
        where: {
          userId_questionId: {
            userId: req.user?.userId as number,
            questionId: questionId,
          },
        },
      });

      if (existingSubmission) {
        sendError(res, "ALREADY_SUBMITTED", 400);
        return;
      }

      const isCorrect = selectedOptionIndex === question.correctOptionIndex;
      const pointsEarned = isCorrect ? question.points : 0;

      await prisma.mcqSubmission.create({
        data: {
          userId: req.user?.userId as number,
          questionId,
          selectedOptionIndex,
          isCorrect,
          pointsEarned,
        },
      });

      sendSuccess(
        res,
        {
          isCorrect,
          pointsEarned,
        },
        201,
      );
    } catch (error) {
      console.error("Sumbit MCQ error:", error);
      sendError(res, "INTERNAL_SERVER_ERROR", 500);
    }
  },
);

router.post(
  "/:contestId/dsa",
  requireRole(["contestee"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const contestId = Number.parseInt(req.params.contestId as string);

      if (Number.isNaN(contestId)) {
        sendError(res, "INVALID_REQUEST", 400);
        return;
      }

      const parsed = createDsaProblemSchema.safeParse(req.body);

      if (!parsed.success) {
        sendError(res, "INVALID_REQUEST", 400);
        return;
      }

      const contest = await prisma.contest.findUnique({
        where: { id: contestId },
      });

      if (!contest) {
        sendError(res, "CONTEST_NOT_FOUND", 404);
        return;
      }

      if (contest.creatorId !== req.user?.userId) {
        sendError(res, "FORBIDDEN", 403);
        return;
      }

      const {
        title,
        description,
        tags,
        points,
        timeLimit,
        memoryLimit,
        testCases,
      } = parsed.data;

      const problem = await prisma.dsaProblem.create({
        data: {
          contestId,
          title,
          description,
          tags,
          points,
          timeLimit,
          memoryLimit,
          testCases: {
            create: testCases.map((tc) => ({
              input: tc.input,
              expectedOutput: tc.expectedOutput,
              isHidden: tc.isHidden,
            })),
          },
        },
      });

      sendSuccess(
        res,
        {
          id: problem.id,
          contestId: problem.contestId,
        },
        201,
      );
    } catch (error) {
      console.error("Create DSA problem error:", error);
      sendError(res, "INTERNAL_SERVER_ERROR", 500);
    }
  },
);

export default router;
