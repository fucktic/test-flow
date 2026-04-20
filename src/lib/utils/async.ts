/** 至少等待 `minMs` 毫秒后结束（用于保存后的最短 Loading 展示） */
export async function withMinDuration<T>(minMs: number, run: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const out = await run();
  const elapsed = Date.now() - start;
  if (elapsed < minMs) {
    await new Promise((r) => setTimeout(r, minMs - elapsed));
  }
  return out;
}
