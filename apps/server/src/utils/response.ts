import type { Response } from "express";

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number,
): Response => {
  return res.status(statusCode).json({
    success: true,
    data,
    error: null,
  } as ApiResponse<T>);
};

export const sendError = <T>(
  res: Response,
  errorCode: string,
  statusCode: number,
): Response => {
  return res.status(statusCode).json({
    success: false,
    data: null,
    error: errorCode,
  } as ApiResponse<T>);
};
