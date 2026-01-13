import { verifyToken, type JwtPayload } from "@/utils/jwt";
import { sendError } from "@/utils/response";
import type { NextFunction, Request, Response } from "express";

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    email: string;
    role: string;
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      sendError(res, "UNAUTHORIZED", 401);
      return;
    }

    const token = authHeader.split(" ")[1] as string;

    const decoded = verifyToken(token) as JwtPayload;
    if (!decoded) {
      sendError(res, "MISSING_OR_INVALID_TOKEN", 401);
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    sendError(res, "UNAUTHORIZED", 401);
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      sendError(res, "UNAUTHORIZED", 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(res, "FORBIDDEN", 403);
      return;
    }

    next();
  };
};
