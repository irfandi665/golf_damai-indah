import { createClient } from 'redis';
import { ApiError } from './errors';

const globalForRedis = globalThis;
const localBuckets = new Map();

async function redisClient() {
  if (!process.env.REDIS_URL) {
    if (process.env.NODE_ENV === 'production') {
      const error = new Error('REDIS_URL is required in production.');
      error.code = 'service_unavailable';
      throw error;
    }
    return null;
  }

  if (!globalForRedis.golfRedis) {
    const client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (error) => console.error('Redis connection error:', error));
    globalForRedis.golfRedis = client;
  }
  if (!globalForRedis.golfRedis.isOpen) await globalForRedis.golfRedis.connect();
  return globalForRedis.golfRedis;
}

export async function enforceRateLimit(request, scope, limit, windowSeconds) {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const key = `rate:${scope}:${address}`;
  const client = await redisClient();

  if (client) {
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, windowSeconds);
    if (count > limit) {
      const ttl = await client.ttl(key);
      throw new ApiError(429, 'rate_limited', 'Too many requests. Try again later.', [
        { field: 'retryAfter', message: String(Math.max(ttl, 1)) },
      ]);
    }
    return;
  }

  const now = Date.now();
  const bucket = localBuckets.get(key);
  if (!bucket || now >= bucket.expiresAt) {
    localBuckets.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw new ApiError(429, 'rate_limited', 'Too many requests. Try again later.');
  }
}
