/**
 * Request validation schemas for jobs and tasks (zod).
 *
 * Body schemas throw `ZodError`, which `withErrorHandler` maps to a 422
 * `VALIDATION_ERROR` envelope with field-level details.
 */

import { z } from "zod";

export const modalitySchema = z.enum(["image", "video"]);
export const jobStatusSchema = z.enum(["draft", "published", "paused", "closed"]);

/** POST /api/jobs */
export const createJobSchema = z.object({
  project_id: z.string().uuid("project_id must be a UUID"),
  title: z.string().trim().min(1, "title is required").max(200),
  description: z.string().max(5000).optional(),
  modality: modalitySchema,
  reward_per_task: z
    .number({ invalid_type_error: "reward_per_task must be a number" })
    .positive("reward_per_task must be positive"),
  budget: z
    .number({ invalid_type_error: "budget must be a number" })
    .positive("budget must be positive"),
  deadline: z
    .string()
    .datetime({ offset: true, message: "deadline must be an ISO 8601 timestamp" })
    .optional(),
  rubric: z.record(z.unknown()).optional(),
  label_list: z
    .array(z.string().trim().min(1))
    .min(1, "label_list must contain at least one label"),
  schema_version_id: z.string().uuid("schema_version_id must be a UUID").optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

/** GET /api/jobs query filters (pagination handled separately). */
export const listJobsQuerySchema = z.object({
  status: jobStatusSchema.optional(),
  modality: modalitySchema.optional(),
});

/** GET /api/tasks/available query filters (pagination handled separately). */
export const listAvailableTasksQuerySchema = z.object({
  job_id: z.string().uuid("job_id must be a UUID").optional(),
  modality: modalitySchema.optional(),
});

/** Parse a URLSearchParams object (first value wins) into a plain record. */
export function searchParamsToRecord(
  searchParams: URLSearchParams,
): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (record[key] === undefined) record[key] = value;
  }
  return record;
}
