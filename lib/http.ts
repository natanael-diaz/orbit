import { z } from 'zod';
import { AccessError } from './accounts';

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
export function checkOrigin(request: Request) {
  if (
    request.headers.get('origin') !== new URL(request.url).origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new AccessError('Origin ditolak.', 403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    throw new AccessError('JSON diperlukan.', 415);
}
export async function body(request: Request, max = 16000) {
  checkOrigin(request);
  const reader = request.body?.getReader();
  if (!reader) throw new AccessError('JSON diperlukan.');
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new AccessError('Request terlalu besar.', 413);
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AccessError('JSON tidak valid.');
  }
}
export function failure(error: unknown) {
  if (error instanceof AccessError) return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return json(
      {
        error:
          'Format data tidak valid: ' +
          error.issues
            .map((i) => `${i.path.join('.')} ${i.message}`)
            .slice(0, 3)
            .join('; '),
      },
      400,
    );
  return json({ error: 'Operasi gagal. Periksa database/migrasi dan coba lagi.' }, 500);
}
