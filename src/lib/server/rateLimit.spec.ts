import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, resetRateLimitStore } from './rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRateLimitStore();
  });

  it('allows up to 5 requests within the window', () => {
    const ip = '192.168.1.1';

    expect(checkRateLimit(ip)).toBe(true);
    expect(checkRateLimit(ip)).toBe(true);
    expect(checkRateLimit(ip)).toBe(true);
    expect(checkRateLimit(ip)).toBe(true);
    expect(checkRateLimit(ip)).toBe(true);
  });

  it('blocks the 6th request within the window', () => {
    const ip = '192.168.1.1';

    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(ip)).toBe(true);
    }

    expect(checkRateLimit(ip)).toBe(false);
  });

  it('blocks subsequent requests while at limit', () => {
    const ip = '192.168.1.1';

    for (let i = 0; i < 5; i++) {
      checkRateLimit(ip);
    }

    expect(checkRateLimit(ip)).toBe(false);
    expect(checkRateLimit(ip)).toBe(false);
    expect(checkRateLimit(ip)).toBe(false);
  });

  it('tracks different IPs independently', () => {
    const ip1 = '192.168.1.1';
    const ip2 = '192.168.1.2';

    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(ip1)).toBe(true);
    }

    expect(checkRateLimit(ip1)).toBe(false);

    // ip2 should still be allowed
    expect(checkRateLimit(ip2)).toBe(true);
    expect(checkRateLimit(ip2)).toBe(true);
  });

  it('allows more requests after the window expires', () => {
    const ip = '192.168.1.1';

    // Use up 5 requests
    for (let i = 0; i < 5; i++) {
      checkRateLimit(ip);
    }

    expect(checkRateLimit(ip)).toBe(false);

    // Advance time by 60 seconds (the default window)
    vi.advanceTimersByTime(60000);

    // Should now be allowed again
    expect(checkRateLimit(ip)).toBe(true);
  });

  it('respects custom window size', () => {
    const ip = '192.168.1.1';
    const customWindow = 30000; // 30 seconds

    // Use up 5 requests
    for (let i = 0; i < 5; i++) {
      checkRateLimit(ip, 5, customWindow);
    }

    expect(checkRateLimit(ip, 5, customWindow)).toBe(false);

    // Advance time by less than the window
    vi.advanceTimersByTime(20000);
    expect(checkRateLimit(ip, 5, customWindow)).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(10000);
    expect(checkRateLimit(ip, 5, customWindow)).toBe(true);
  });

  it('respects custom max requests limit', () => {
    const ip = '192.168.1.1';
    const maxRequests = 3;

    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(ip, maxRequests)).toBe(true);
    }

    expect(checkRateLimit(ip, maxRequests)).toBe(false);
  });
});
