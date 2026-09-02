import { describeError } from "../logging/error-info";
import type { AppPrismaClient } from "../prisma/prisma.factory";
import type { AppRedisClient } from "../redis/redis.factory";

/**
 * 依赖存活探测。纯函数，可脱离 NestJS 单测。
 *
 * 每个探测都带超时：健康检查本身绝不能挂住。上一代的 `/api/admin/logs`
 * 就是因为一个慢查询把串行 DB worker 堵死，连带整站不可用。
 */

export interface ProbeResult {
  ok: boolean;
  /** 探测耗时（毫秒）。失败时是「失败前花了多久」。 */
  latencyMs: number;
  error?: string;
}

const DEFAULT_PROBE_TIMEOUT_MS = 2_000;

export function probeDatabase(
  client: AppPrismaClient,
  timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS,
): Promise<ProbeResult> {
  return runProbe(async () => {
    await client.$queryRaw`SELECT 1`;
  }, timeoutMs);
}

export function probeRedis(
  client: AppRedisClient,
  timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS,
): Promise<ProbeResult> {
  return runProbe(async () => {
    const reply = String(await client.ping());
    if (reply !== "PONG") {
      throw new Error(`unexpected PING reply: ${reply}`);
    }
  }, timeoutMs);
}

async function runProbe(task: () => Promise<void>, timeoutMs: number): Promise<ProbeResult> {
  const startedAt = Date.now();
  try {
    await withTimeout(task(), timeoutMs);
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (cause) {
    return { ok: false, latencyMs: Date.now() - startedAt, error: describeError(cause) };
  }
}

/**
 * 给任意 Promise 套一个超时。
 *
 * 注意：超时只是让**调用方**不再等待，底层查询仍在跑 —— 这正是我们要的，
 * 健康检查不该去 cancel 一个可能正常的查询。定时器一律清理，防止句柄泄漏。
 */
function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`probe timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([task, guard]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });
}
