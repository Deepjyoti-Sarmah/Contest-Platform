import { z } from "zod";

const testCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  isHidden: z.boolean().optional().default(false),
});

export const createDsaProblemSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  tags: z.array(z.string()).min(1, "At least one tag is required"),
  points: z.number().int().positive().optional().default(100),
  timeLimit: z.number().int().positive().optional().default(2000),
  memoryLimit: z.number().int().positive().optional().default(256),
  testCases: z
    .array(testCaseSchema)
    .min(1, "At least one test case is required"),
});

export const submitDsaSchema = z.object({
  code: z.string().min(1, "Code is required"),
  language: z.string().min(1, "Language is required"),
});

export type createDsaProblemInput = z.infer<typeof createDsaProblemSchema>;
export type SubmitDsaInput = z.infer<typeof submitDsaSchema>;
