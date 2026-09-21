/** Bound stalled requests so the outbox runner can retry after connectivity returns. */
export async function cloudFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (init.signal?.aborted) cancel();
  init.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 20_000);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); init.signal?.removeEventListener('abort', cancel); }
}
