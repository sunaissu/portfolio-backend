/** Bound both declared and chunked provider bodies before parsing any JSON. */
export async function readProviderJson<T>(
  response: Response,
  limit = 1024 * 1024,
): Promise<T> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error('Provider response exceeds the byte limit');
  }
  if (!response.body) throw new Error('Provider response is empty');
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel().catch(() => undefined);
        throw new Error('Provider response exceeds the byte limit');
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return JSON.parse(chunks.join('')) as T;
  } finally {
    reader.releaseLock();
  }
}
