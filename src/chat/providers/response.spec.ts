import { readProviderJson } from './response';

it('rejects declared and streamed oversized provider data before parsing', async () => {
  const cancel = jest.fn();
  const declared = new Response(new ReadableStream({ cancel }), {
    headers: { 'content-length': '99999' },
  });
  await expect(readProviderJson(declared, 10)).rejects.toThrow('byte limit');
  expect(cancel).toHaveBeenCalled();
  const streamed = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(100)));
      },
    }),
  );
  await expect(readProviderJson(streamed, 10)).rejects.toThrow('byte limit');
});
it('decodes split UTF-8 provider JSON and rejects malformed JSON', async () => {
  const bytes = new TextEncoder().encode('{"text":"✓"}');
  const response = new Response(
    new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    }),
  );
  await expect(readProviderJson(response)).resolves.toEqual({ text: '✓' });
  await expect(readProviderJson(new Response('not json'))).rejects.toThrow();
});
