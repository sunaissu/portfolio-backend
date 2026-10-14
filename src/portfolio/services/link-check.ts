import { resolve4 } from 'node:dns/promises';
import { request } from 'node:https';
export function publicIPv4(address: string): boolean {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) return false;
  const parts = address.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)
  )
    return false;
  const [a, b, c] = parts;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 &&
      (b === 168 ||
        (b === 0 && (c === 0 || c === 2)) ||
        (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}
export async function checkPublicLink(
  value: string,
): Promise<{ url: string; status: number | null; result: string }> {
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      (url.port && url.port !== '443')
    )
      return {
        url: value,
        status: null,
        result: 'Skipped: only public HTTPS on port 443 is checked.',
      };
    const addresses = await Promise.race([
      resolve4(url.hostname),
      new Promise<never>((_, reject) => {
        dnsTimer = setTimeout(() => reject(new Error('DNS timeout')), 1500);
      }),
    ]);
    clearTimeout(dnsTimer);
    if (!addresses.length || addresses.some((address) => !publicIPv4(address)))
      return {
        url: value,
        status: null,
        result: 'Blocked: private, reserved or unsupported address.',
      };
    // Pin the checked address. Do not resolve again or follow redirects.
    return await new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let done = false;
      const finish = (status: number | null, result: string) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ url: value, status, result });
      };
      const req = request(
        url,
        {
          method: 'HEAD',
          maxHeaderSize: 16384,
          agent: false,
          lookup: (_host, _options, callback) =>
            callback(null, addresses[0], 4),
          headers: { 'User-Agent': 'Portfolio-Link-Review/1', Accept: '*/*' },
        },
        (response) => {
          const status = response.statusCode || 0;
          response.destroy();
          finish(
            status,
            status >= 200 && status < 300
              ? 'Reachable'
              : status >= 300 && status < 400
                ? 'Redirect; destination was not followed.'
                : status === 405
                  ? 'HEAD unsupported; check manually.'
                  : 'HTTP error',
          );
        },
      );
      timer = setTimeout(() => {
        req.destroy();
        finish(null, 'Timed out.');
      }, 2500);
      req.on('error', () => finish(null, 'Connection failed.'));
      req.end();
    });
  } catch {
    return {
      url: value,
      status: null,
      result: 'Address could not be checked.',
    };
  } finally {
    clearTimeout(dnsTimer);
  }
}
export function collectLinks(value: unknown): string[] {
  const found = new Set<string>();
  function visit(item: unknown) {
    if (typeof item === 'string' && /^https?:\/\//.test(item)) {
      try {
        const url = new URL(item);
        if (!url.username && !url.password && item.length <= 2000)
          found.add(url.href);
      } catch {}
    } else if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === 'object')
      Object.values(item).forEach(visit);
  }
  visit(value);
  return [...found].slice(0, 120);
}

/** Read only a bounded public service-info contract. Never forward credentials or redirects. */
export async function readPublicService(value: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      (url.port && url.port !== '443')
    )
      throw new Error('Unsupported service URL.');
    const addresses = await Promise.race([
      resolve4(url.hostname),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('DNS timeout')), 1500);
      }),
    ]);
    clearTimeout(timer);
    if (!addresses.length || addresses.some((address) => !publicIPv4(address)))
      throw new Error('Private addresses are blocked.');
    const body = await new Promise<string>((resolve, reject) => {
      let done = false;
      const fail = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(new Error('Service information unavailable.'));
      };
      const req = request(
        url,
        {
          method: 'GET',
          maxHeaderSize: 8192,
          agent: false,
          lookup: (_host, _options, callback) =>
            callback(null, addresses[0], 4),
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'identity',
            'User-Agent': 'Portfolio-Service-Review/1',
          },
        },
        (response) => {
          if (
            response.statusCode !== 200 ||
            !response.headers['content-type']?.includes('application/json') ||
            Number(response.headers['content-length']) > 16384
          ) {
            response.destroy();
            fail();
            return;
          }
          const chunks: Buffer[] = [];
          let bytes = 0;
          response.on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > 16384) {
              response.destroy();
              fail();
            } else chunks.push(chunk);
          });
          response.on('error', fail);
          response.on('end', () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve(Buffer.concat(chunks).toString('utf8'));
          });
        },
      );
      timer = setTimeout(() => {
        req.destroy();
        fail();
      }, 2500);
      req.on('error', fail);
      req.end();
    });
    return serviceProjection(JSON.parse(body));
  } finally {
    clearTimeout(timer);
  }
}
export function serviceProjection(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid service information.');
  const data = value as Record<string, unknown>;
  if (
    typeof data.version !== 'string' ||
    !data.version.trim() ||
    data.version.length > 80 ||
    ![
      'operational',
      'ready',
      'degraded',
      'unavailable',
      'maintenance',
    ].includes(String(data.status))
  )
    throw new Error('Invalid service status contract.');
  return {
    version: data.version,
    status: String(data.status),
    reportedAt:
      typeof data.checkedAt === 'string' &&
      Number.isFinite(Date.parse(data.checkedAt))
        ? new Date(data.checkedAt).toISOString()
        : null,
  };
}
