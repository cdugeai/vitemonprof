import { test, expect } from '@playwright/test';
import { resetRateLimit } from './support/rate-limit';

test.describe('rate limiting', () => {
  // Each test below spends the full quota, so without this they'd only pass in the
  // order they happen to be declared — the second test's "submit 5 times to reach
  // the limit" loop would already be starting from a full bucket.
  test.beforeEach(async ({ request }) => {
    await resetRateLimit(request);
  });

  test('should allow 5 form submissions within 1 minute', async ({ page }) => {
    await page.goto('/');

    // Submit the form 5 times
    for (let i = 1; i <= 5; i++) {
      // Fill required fields with valid data
      const formData = new FormData();
      formData.append('schoolId', `test-school-${i}`);
      formData.append('class', '6e');
      formData.append('date', '2026-08-20');
      formData.append('nbHours', '1');

      // Submit via fetch to check response status
      const response = await page.evaluate(
        async (data) => {
          const formData = new FormData();
          formData.append('schoolId', data.schoolId);
          formData.append('class', data.class);
          formData.append('date', data.date);
          formData.append('nbHours', data.nbHours);

          const res = await fetch('/', {
            method: 'POST',
            body: formData,
            redirect: 'manual',
          });

          const text = await res.text();
          return {
            status: res.status,
            isRateLimited: text.includes('Trop de soumissions'),
          };
        },
        { schoolId: `test-school-${i}`, class: '6e', date: '2026-08-20', nbHours: '1' }
      );

      expect(response.status).toBe(201);
      expect(response.isRateLimited).toBe(false);
    }
  });

  test('should block the 6th submission within 1 minute', async ({ page }) => {
    await page.goto('/');

    // Submit 5 times to reach the limit
    for (let i = 1; i <= 5; i++) {
      await page.evaluate(async (num) => {
        const formData = new FormData();
        formData.append('schoolId', `test-school-${num}`);
        formData.append('class', '6e');
        formData.append('date', '2026-08-20');
        formData.append('nbHours', '1');

        await fetch('/', {
          method: 'POST',
          body: formData,
          redirect: 'manual',
        });
      }, i);
    }

    // 6th submission should be blocked
    const response = await page.evaluate(async () => {
      const formData = new FormData();
      formData.append('schoolId', 'test-school-6');
      formData.append('class', '6e');
      formData.append('date', '2026-08-20');
      formData.append('nbHours', '1');

      const res = await fetch('/', {
        method: 'POST',
        body: formData,
        redirect: 'manual',
      });

      const text = await res.text();
      return {
        status: res.status,
        isRateLimited: text.includes('Trop de soumissions'),
        hasErrorMessage: text.includes('patienter une minute'),
      };
    });

    expect(response.status).toBe(429);
    expect(response.isRateLimited).toBe(true);
    expect(response.hasErrorMessage).toBe(true);
  });

  test('should return correct error message when rate limited', async ({ page }) => {
    await page.goto('/');

    // Hit the rate limit
    for (let i = 1; i <= 5; i++) {
      await page.evaluate(async (num) => {
        const formData = new FormData();
        formData.append('schoolId', `test-school-${num}`);
        formData.append('class', '6e');
        formData.append('date', '2026-08-20');
        formData.append('nbHours', '1');

        await fetch('/', {
          method: 'POST',
          body: formData,
          redirect: 'manual',
        });
      }, i);
    }

    // 6th submission should have the error message
    const errorMessage = await page.evaluate(async () => {
      const formData = new FormData();
      formData.append('schoolId', 'test-school-6');
      formData.append('class', '6e');
      formData.append('date', '2026-08-20');
      formData.append('nbHours', '1');

      const res = await fetch('/', {
        method: 'POST',
        body: formData,
        redirect: 'manual',
      });

      const text = await res.text();
      // Look for the error message in the response
      if (text.includes('Trop de soumissions')) {
        return 'Trop de soumissions coup sur coup. Merci de patienter une minute.';
      }
      return null;
    });

    expect(errorMessage).toBe('Trop de soumissions coup sur coup. Merci de patienter une minute.');
  });
});
