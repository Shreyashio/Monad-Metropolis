/**
 * MockSettlementService tests.
 */

import { describe, it, expect } from "vitest";
import { MockSettlementService } from "../service";

const service = new MockSettlementService();

describe("MockSettlementService", () => {
  it("records mock settlement with a deterministic tx hash", async () => {
    const input = {
      taskId: "task-a",
      submissionId: "sub-a",
      annotationHash: "0xannot",
      policyHash: "0xpolicy",
      amount: "1.5",
    };
    const first = await service.settle(input);
    const second = await service.settle(input);

    expect(first.is_mock).toBe(true);
    expect(first.tx_hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(second).toEqual(first);
  });

  it("derives a different hash for a different task", async () => {
    const base = {
      submissionId: "sub-a",
      annotationHash: "0xannot",
      policyHash: "0xpolicy",
      amount: "1.5",
    };
    const a = await service.settle({ ...base, taskId: "task-a" });
    const b = await service.settle({ ...base, taskId: "task-b" });
    expect(a.tx_hash).not.toBe(b.tx_hash);
  });
});