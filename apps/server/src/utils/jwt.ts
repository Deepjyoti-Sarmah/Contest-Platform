import { env } from "@Contest-Platform/env/server";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

export const generateToken = (payload: JwtPayload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch (error) {
    throw new Error("Invalid token");
  }
};
