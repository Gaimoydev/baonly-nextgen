/**
 * 未知错误 → 可读字符串。
 *
 * `catch (cause: unknown)` 之后不能假设拿到的是 Error（Promise 可以 reject 任何值），
 * 这两个函数把「怎么描述一个未知错误」收在一处，避免每个 catch 各写一份。
 */

/** 取一行可读描述。永不抛错。 */
export function describeError(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message === "" ? cause.name : cause.message;
  }
  if (typeof cause === "string") {
    return cause;
  }
  try {
    return JSON.stringify(cause) ?? String(cause);
  } catch {
    return String(cause);
  }
}

/** 取堆栈（没有就退回描述）。用于 5xx 日志。 */
export function stackOfError(cause: unknown): string {
  if (cause instanceof Error && typeof cause.stack === "string") {
    return cause.stack;
  }
  return describeError(cause);
}
