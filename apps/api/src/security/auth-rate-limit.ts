import { createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

// Bounded per-process defense; the Nginx IP limit remains the edge defense.
export class AuthRateLimit {
  private readonly buckets = new Map<
    string,
    { count: number; expires: number }
  >();
  consume(key: string, limit: number, now = Date.now()): number {
    for (const [id, bucket] of this.buckets)
      if (bucket.expires <= now) this.buckets.delete(id);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= 10000) return 60;
      bucket = { count: 0, expires: now + 60000 };
      this.buckets.set(key, bucket);
    }
    bucket.count++;
    return bucket.count > limit
      ? Math.max(1, Math.ceil((bucket.expires - now) / 1000))
      : 0;
  }
  middleware = (
    request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    if (
      request.method !== 'POST' ||
      !/^\/api\/auth\/(login|register|refresh)\/?$/i.test(request.path)
    ) {
      next();
      return;
    }
    // Ignore untrusted forwarded headers. Proxy clients share this conservative upper ceiling.
    const remote = request.socket.remoteAddress || 'unknown';
    const ipWait = this.consume(`ip:${remote}`, 120);
    const email: unknown = request.body?.email;
    const accountWait =
      typeof email === 'string'
        ? this.consume(
            `account:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`,
            10,
          )
        : 0;
    const wait = Math.max(ipWait, accountWait);
    if (wait) {
      response.setHeader('Retry-After', wait);
      response.status(429).json({
        message: 'Muitas tentativas. Aguarde um minuto e tente novamente.',
      });
      return;
    }
    next();
  };
}
