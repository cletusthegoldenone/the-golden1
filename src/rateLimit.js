class RateLimiter {
  constructor() {
    this.buckets = new Map();
  }

  consume({ key, limit, windowMs }, now = Date.now()) {
    const bucketKey = `${key}:${limit}:${windowMs}`;
    const current = this.buckets.get(bucketKey);

    if (!current || current.resetAt <= now) {
      this.buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: Math.max(limit - 1, 0), retryAfterSeconds: 0 };
    }

    if (current.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
      };
    }

    current.count += 1;
    return { allowed: true, remaining: Math.max(limit - current.count, 0), retryAfterSeconds: 0 };
  }
}

module.exports = {
  RateLimiter
};
