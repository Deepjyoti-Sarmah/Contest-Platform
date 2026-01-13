import prisma from "@Contest-Platform/db";
import bcrypt from "bcryptjs";
import { type Request, type Response, Router } from "express";
import { loginSchema, signupSchema } from "@/schemas/auth.schema";
import { generateToken } from "@/utils/jwt";
import { sendError, sendSuccess } from "@/utils/response";

const router = Router();

router.post("/signup", async (req: Request, res: Response) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, "INVALID_REQUEST", 400);
      return;
    }

    const { name, email, password, role } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      sendError(res, "EMAIL_ALREADY_EXISTS", 400);
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
    });

    sendSuccess(
      res,
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      201,
    );
  } catch (error) {
    console.error("Signup error:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", 500);
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, "INVALID_REQUEST", 400);
      return;
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      sendError(res, "INVALID_CREDENTIALS", 401);
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      sendError(res, "INVALID_CREDENTIALS", 401);
      return;
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    sendSuccess(res, { token }, 200);
  } catch (error) {
    console.error("Login error:", error);
    sendError(res, "INTERNAL_SERVER_ERROR", 500);
  }
});

export default router;
