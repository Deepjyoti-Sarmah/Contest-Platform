import { z } from "zod";

export const createMcqSchema = z
  .object({
    questionText: z.string().min(1, "Question text is required"),
    options: z.array(z.string()).min(2, "At least 2 options are required"),
    correctOptionIndex: z.number().int().nonnegative(),
    points: z.number().int().positive().optional().default(1),
  })
  .refine((data) => data.correctOptionIndex < data.options.length, {
    message: "Correct option index must be valid",
    path: ["correctOptionIndex"],
  });

export const submitMcqSchema = z.object({
  selectedOptionIndex: z.number().int().nonnegative(),
});

export type createMcqInput = z.infer<typeof createMcqSchema>;
export type SubmitMcqInput = z.infer<typeof submitMcqSchema>;
