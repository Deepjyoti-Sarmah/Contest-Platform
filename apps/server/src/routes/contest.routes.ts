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

router.get(
  "/:contestId/leaderboard",
  async (req: AuthRequest, res: Response) => {
    try {
      const constestId = Number.parseInt(req.params.contestId as string);

      if (Number.isNaN(constestId)) {
        sendError(res, "INVALID_REQUEST", 400);
        return;
      }

      const contest = await prisma.contest.findUnique({
        where: { id: constestId },
        include: {
          mcqQuestions: true,
          dsaProblems: true,
        },
      });

      if (!contest) {
        sendError(res, "CONTEST_NOT_FOUND", 404);
        return;
      }

      const mcqQuestionIds = contest.mcqQuestions.map((q) => q.id);

      const mcqSubmissions = await prisma.mcqSubmission.findMany({
        where: {
          questionId: { in: mcqQuestionIds },
        },
        include: {
          user: true,
        },
      });

      const dsaProblemIds = contest.dsaProblems.map((p) => p.id);

      const dsaSubmissions = await prisma.dsaSubmission.findMany({
        where: {
          problemId: { in: dsaProblemIds },
        },
        include: {
          user: true,
        },
      });

      const userScores = new Map<
        number,
        { userId: number; name: string; totalPoints: number }
      >();

      for (const submission of mcqSubmissions) {
        if (!userScores.has(submission.userId)) {
          userScores.set(submission.userId, {
            userId: submission.userId,
            name: submission.user.name,
            totalPoints: 0,
          });
        }

        const userScore = userScores.get(submission.userId);
        userScore!.totalPoints += submission.pointsEarned;
      }

      const dsaMaxPoints = new Map<string, number>();
      for (const submission of dsaSubmissions) {
        const key = `${submission.userId}-${submission.problemId}`;
        const currentMax = dsaMaxPoints.get(key) || 0;
        dsaMaxPoints.set(key, Math.max(currentMax, submission.pointsEarned));
      }

      for (const submission of dsaSubmissions) {
        const key = `${submission.userId}-${submission.problemId}`;
        const maxPoints = dsaMaxPoints.get(key)!;

        if (!userScores.has(submission.userId)) {
          userScores.set(submission.userId, {
            userId: submission.userId,
            name: submission.user.name,
            totalPoints: 0,
          });
        }

        const userScore = userScores.get(submission.userId)!;

        const alreadyCounted = Array.from(dsaMaxPoints.entries())
          .filter(([k]) => k.startsWith(`${submission.userId}-`))
          .some(([k, v]) => k < key && v > 0);

        if (submission.pointsEarned === maxPoints && !alreadyCounted) {
          userScore.totalPoints += maxPoints;
          dsaMaxPoints.delete(key);
        }
      }

      const leaderboardArray = Array.from(userScores.values()).sort(
        (a, b) => b.totalPoints - a.totalPoints,
      );

      const leaderboard = leaderboardArray.map((user, index) => {
        let rank = index + 1;
        if (
          index > 0 &&
          user.totalPoints === leaderboardArray[index - 1]?.totalPoints
        ) {
          rank = (leaderboard[index - 1] as any).rank;
        }

        return {
          userId: user.userId,
          name: user.name,
          totalPoints: user.totalPoints,
          rank,
        };
      });

      sendSuccess(res, leaderboard, 200);
    } catch (error) {
      console.error("Get leaderboard error:", error);
      sendError(res, "INTERNAL_SERVER_ERROR", 500);
    }
  },
);

export default router;
