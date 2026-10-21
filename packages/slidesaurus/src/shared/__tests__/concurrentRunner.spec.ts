import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runConcurrently } from "../concurrentRunner";

describe("runConcurrently", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty array for empty input", async () => {
    const results = await runConcurrently([], 4, async (x) => x);
    expect(results).toEqual([]);
  });

  it("returns results in input order regardless of completion order", async () => {
    // Items with higher index resolve faster (reverse order)
    const items = [0, 1, 2, 3, 4];
    const promise = runConcurrently(items, 5, async (item) => {
      await new Promise<void>((r) => setTimeout(r, (items.length - item) * 5));
      return item * 10;
    });
    await vi.advanceTimersByTimeAsync(25);
    const results = await promise;
    expect(results).toEqual([0, 10, 20, 30, 40]);
  });

  it("respects concurrency cap — at most N tasks run simultaneously", async () => {
    let active = 0;
    let maxActive = 0;
    const concurrency = 2;

    const promise = runConcurrently(
      [1, 2, 3, 4, 5, 6],
      concurrency,
      async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise<void>((r) => setTimeout(r, 10));
        active--;
      },
    );
    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(maxActive).toBeLessThanOrEqual(concurrency);
  });

  it("processes all items even when N < items.length", async () => {
    const processed: number[] = [];
    await runConcurrently([1, 2, 3, 4, 5], 2, async (item) => {
      processed.push(item);
    });
    expect(processed.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("continues processing other items when one task throws", async () => {
    const processed: number[] = [];
    const fn = vi.fn(async (item: number) => {
      processed.push(item);
      if (item === 2) throw new Error("task 2 failed");
    });

    await expect(runConcurrently([1, 2, 3, 4, 5], 2, fn)).rejects.toThrow(
      "task 2 failed",
    );
    // All items must have been attempted despite the failure
    expect(processed.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("throws the first error after all workers complete", async () => {
    await expect(
      runConcurrently([1, 2, 3], 3, async (item) => {
        if (item !== 2) throw new Error(`task ${item} failed`);
      }),
    ).rejects.toThrow(/task \d+ failed/);
  });

  it("passes the item index as the second argument", async () => {
    const indices: number[] = [];
    await runConcurrently(["a", "b", "c"], 2, async (_item, index) => {
      indices.push(index);
    });
    expect(indices.sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it("handles concurrency larger than items.length without spawning extra workers", async () => {
    let workerCallCount = 0;
    // Each item is one task; no extra workers beyond items.length should spin up
    const results = await runConcurrently([10, 20, 30], 100, async (item) => {
      workerCallCount++;
      return item;
    });
    expect(results).toEqual([10, 20, 30]);
    // workerCallCount equals items.length, not concurrency
    expect(workerCallCount).toBe(3);
  });
});
