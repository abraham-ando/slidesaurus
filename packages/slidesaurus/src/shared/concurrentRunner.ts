import pLimit from "p-limit";

/**
 * Execute tasks from a queue with bounded concurrency.
 * Results are returned in the same order as the input items.
 *
 * All tasks run to completion even if some throw. If any task throws, the
 * first error is re-thrown after all tasks finish (fail-at-end semantics).
 *
 * @param items - Tasks to process
 * @param concurrency - Maximum number of tasks running simultaneously
 * @param task - Async function receiving each item and its index
 */
export async function runConcurrently<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = pLimit(concurrency);
  const errors: Array<{ index: number; err: unknown }> = [];

  const results = await Promise.all(
    items.map((item, i) =>
      limit(async () => {
        try {
          return await task(item, i);
        } catch (err) {
          errors.push({ index: i, err });
          return undefined as unknown as R;
        }
      }),
    ),
  );

  if (errors.length > 0) {
    const { err } = errors[0];
    throw err instanceof Error ? err : new Error(String(err));
  }

  return results;
}
