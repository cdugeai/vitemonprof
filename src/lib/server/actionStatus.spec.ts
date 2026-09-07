import { describe, it, expect } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { handleActionStatus } from './actionStatus';

/**
 * The hook only ever touches `event.locals` and the response, so a bare object
 * with locals is a faithful stand-in for the event — everything else on a
 * `RequestEvent` is out of reach of the code under test.
 */
function run(locals: App.Locals, response: Response) {
  return handleActionStatus({
    event: { locals } as RequestEvent,
    resolve: async () => response,
  });
}

describe('handleActionStatus', () => {
  it('stamps the status the action asked for onto a 200', async () => {
    const response = await run({ actionStatus: 201 }, new Response('body', { status: 200 }));

    expect(response.status).toBe(201);
  });

  it('keeps the body and headers of the response it restamps', async () => {
    const response = await run(
      { actionStatus: 400 },
      new Response('{"type":"failure"}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    expect(response.headers.get('content-type')).toBe('application/json');
    await expect(response.text()).resolves.toBe('{"type":"failure"}');
  });

  it('leaves a response alone when no action ran', async () => {
    const response = await run({}, new Response('page', { status: 200 }));

    expect(response.status).toBe(200);
  });

  // The no-JS path: SvelteKit turns the action's `redirect(303)` into a real
  // redirect the browser has to follow, and Post/Redirect/Get depends on it.
  // Rewriting that to 201 would leave the submitter looking at a POST response.
  it('leaves a real redirect alone even though the action claimed 201', async () => {
    const response = await run(
      { actionStatus: 201 },
      new Response(null, { status: 303, headers: { location: '/?submitted' } })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/?submitted');
  });

  // SvelteKit answers an unhandled throw with a 500 of its own. Whatever the
  // action managed to set before dying is not the truth about that response.
  it('leaves an error status alone', async () => {
    const response = await run({ actionStatus: 400 }, new Response('boom', { status: 500 }));

    expect(response.status).toBe(500);
  });
});
