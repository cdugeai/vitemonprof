interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

/**
 * Rate limit based on IP address.
 * Returns true if the request is allowed, false if it exceeds the limit.
 */
export function checkRateLimit(ip: string, maxRequests: number = 5, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = store.get(ip) || { timestamps: [] };

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs);

  const isAllowed = entry.timestamps.length < maxRequests;

  if (isAllowed) {
    entry.timestamps.push(now);
    store.set(ip, entry);
  }

  return isAllowed;
}

/**
 * Reset the rate limit store. For testing only.
 */
export function resetRateLimitStore(): void {
  store.clear();
}
