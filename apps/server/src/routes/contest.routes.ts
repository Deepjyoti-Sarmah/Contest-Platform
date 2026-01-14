import prisma from "@Contest-Platform/db";
import { type Response, Router } from "express";
import {
  type AuthRequest,
  authenticate,
  requireRole,
} from "@/middleware/auth.middleware";
import { createContestSchema } from "@/schemas/contest.schema";
import { sendError, sendSuccess } from "@/utils/response";

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

export default router;
