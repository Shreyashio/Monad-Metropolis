/**
 * Job request validation tests.
 */

import { describe, it, expect } from "vitest";
import {
  createJobSchema,
  listAvailableTasksQuerySchema,
  searchParamsToRecord,
} from "../jobs";

const validJob = {
  project_id: "5eed0000-0000-4000-8000-000000000010",
  title: "Cup and Block Detection",
  description: "Draw boxes.",
  modality: "image",
  reward_per_task: 1.5,
  budget: 100,
  deadline: "2026-12-01T00:00:00.000Z",
  rubric: { accepted_iou: 0.5 },
  label_list: ["cup", "red_block"],
  schema_version_id: "a0000000-0000-0000-0000-000000000001",
};

describe("createJobSchema", () => {
  it("accepts a valid payload", () => {
    expect(createJobSchema.safeParse(validJob).success).toBe(true);
  });

  it("requires a title", () => {
    expect(createJobSchema.safeParse({ ...validJob, title: "" }).success).toBe(false);
  });

  it("requires a positive reward and budget", () => {
    expect(createJobSchema.safeParse({ ...validJob, reward_per_task: 0 }).success).toBe(false);
    expect(createJobSchema.safeParse({ ...validJob, budget: -5 }).success).toBe(false);
  });

  it("requires a non-empty label_list", () => {
    expect(createJobSchema.safeParse({ ...validJob, label_list: [] }).success).toBe(false);
  });

  it("requires a UUID project_id", () => {
    expect(createJobSchema.safeParse({ ...validJob, project_id: "nope" }).success).toBe(false);
  });

  it("rejects a non-ISO deadline", () => {
    expect(createJobSchema.safeParse({ ...validJob, deadline: "tomorrow" }).success).toBe(false);
  });

  it("rejects an unknown modality", () => {
    expect(createJobSchema.safeParse({ ...validJob, modality: "audio" }).success).toBe(false);
  });

  it("allows omitting optional fields", () => {
    const { description, deadline, rubric, schema_version_id, ...rest } = validJob;
    void description;
    void deadline;
    void rubric;
    void schema_version_id;
    expect(createJobSchema.safeParse(rest).success).toBe(true);
  });
});

describe("listAvailableTasksQuerySchema", () => {
  it("accepts empty filters", () => {
    expect(listAvailableTasksQuerySchema.safeParse({}).success).toBe(true);
  });

  it("validates the job_id UUID", () => {
    expect(listAvailableTasksQuerySchema.safeParse({ job_id: "bad" }).success).toBe(false);
  });
});

describe("searchParamsToRecord", () => {
  it("takes the first value for repeated keys", () => {
    expect(searchParamsToRecord(new URLSearchParams("a=1&a=2&b=3"))).toEqual({
      a: "1",
      b: "3",
    });
  });
});
