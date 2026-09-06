import { createServer, type IncomingMessage, type Server } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { publishUpdateResource } from './datagouv.ts';

/**
 * These run against a local stand-in for `www.data.gouv.fr/api/1` rather than
 * mocked `fetch`, because the two things most likely to be wrong here are the
 * *shape* of what goes over the wire — a multipart part without a filename, a
 * PUT missing a required field — and the order of the calls. A stub that parses
 * the real request and answers with the real status codes catches those; a stub
 * for `fetch` that returns whatever the test author expected does not.
 */
const DATASET = 'DS';
const CSV = 'id,school_id\n1,0010001A\n';

interface Recorded {
  method: string;
  url: string;
  apiKey: string | undefined;
  contentType: string;
  raw: string;
  json: Record<string, unknown> | null;
}

let open: Server | undefined;

afterEach(() => open?.close());

/** Starts the stub, runs `use` against it, and hands back what it received. */
async function withStub(
  resources: Record<string, unknown>[],
  use: (apiUrl: string) => Promise<unknown>
): Promise<{ seen: Recorded[]; result: unknown; error: Error | null }> {
  const seen: Recorded[] = [];

  const server = createServer(async (req: IncomingMessage, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString('utf8');
    const contentType = String(req.headers['content-type'] ?? '');

    seen.push({
      method: req.method ?? '',
      url: req.url ?? '',
      apiKey: req.headers['x-api-key'] as string | undefined,
      contentType,
      raw,
      json: contentType.startsWith('application/json') ? JSON.parse(raw) : null,
    });

    const send = (code: number, body: unknown) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    const url = req.url ?? '';

    if (req.method === 'GET' && url === `/datasets/${DATASET}/`) {
      return send(200, { id: DATASET, resources });
    }

    const toExisting = /^\/datasets\/DS\/resources\/([^/]+)\/upload\/$/.exec(url);
    if (req.method === 'POST' && (url === `/datasets/${DATASET}/upload/` || toExisting)) {
      const id = toExisting ? toExisting[1] : 'NEW';
      const uploaded = {
        id,
        title: /filename="([^"]+)"/.exec(raw)?.[1],
        // The platform files a freshly uploaded resource under `main`. Answering
        // with it is what makes this stub able to catch an update payload that
        // echoes the server's type back instead of overriding it.
        type: 'main',
        format: 'csv',
        filetype: 'file',
        url: `https://stub/${id}`,
        created_at: '2026-09-06T00:00:00+00:00',
        latest: `https://stub/latest/${id}`,
        success: true,
      };
      if (!toExisting) resources.push(uploaded);
      return send(toExisting ? 200 : 201, uploaded);
    }

    const put = /^\/datasets\/DS\/resources\/([^/]+)\/$/.exec(url);
    if (req.method === 'PUT' && put) {
      const body = JSON.parse(raw);
      // The real API rejects an incomplete resource; so does this one, so that a
      // payload that drops a required field fails the test rather than passing it.
      for (const field of ['title', 'type', 'format', 'filetype', 'url']) {
        if (!(field in body)) return send(400, { message: `missing ${field}` });
      }
      return send(200, { id: put[1], ...body });
    }

    send(404, { message: 'no such route' });
  });

  open = server;
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as { port: number };

  let result: unknown = null;
  let error: Error | null = null;
  try {
    result = await use(`http://127.0.0.1:${port}`);
  } catch (thrown) {
    error = thrown as Error;
  }

  return { seen, result, error };
}

function csvOnDisk(name: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'datagouv-')), name);
  writeFileSync(path, CSV);
  return path;
}

const publish = (apiUrl: string, path: string) =>
  publishUpdateResource({
    datasetId: DATASET,
    apiKey: 'TEST-KEY',
    filePath: path,
    description: 'Soumissions du 05/09/2026.',
    apiUrl,
  });

describe('publishUpdateResource', () => {
  it('classifies the resource as "update" — the platform id of "Mise à jour"', async () => {
    const { seen } = await withStub([], (api) =>
      publish(api, csvOnDisk('missed-hour-20260905.csv'))
    );
    const update = seen.find(({ method }) => method === 'PUT');

    // The regression this file exists for. The upload answers `type: "main"`, and
    // an update payload built by echoing the response back has to override that
    // *after* the echo, not before it. Get the order wrong and the API returns
    // 200, the resource appears on the dataset, and it is filed under the wrong
    // type forever.
    expect(update?.json?.type).toBe('update');
  });

  it('sends every field the update endpoint requires, and no read-only one', async () => {
    const { seen } = await withStub([], (api) =>
      publish(api, csvOnDisk('missed-hour-20260905.csv'))
    );
    const update = seen.find(({ method }) => method === 'PUT');

    expect(Object.keys(update?.json ?? {}).sort()).toEqual([
      'description',
      'filetype',
      'format',
      'title',
      'type',
      'url',
    ]);
  });

  it('uploads the file under its day-stamped name', async () => {
    const { seen } = await withStub([], (api) =>
      publish(api, csvOnDisk('missed-hour-20260905.csv'))
    );
    const upload = seen.find(({ method, url }) => method === 'POST' && url.endsWith('/upload/'));

    // Without a filename part the platform stores the resource under a generated
    // name, and the day — the only thing distinguishing one daily export from the
    // next — is lost.
    expect(upload?.raw).toContain('filename="missed-hour-20260905.csv"');
  });

  it('creates a resource when the day has not been published yet', async () => {
    const { seen, result } = await withStub([], (api) =>
      publish(api, csvOnDisk('missed-hour-20260905.csv'))
    );

    expect({
      created: (result as { created: boolean }).created,
      uploadedTo: seen.find(({ method }) => method === 'POST')?.url,
    }).toEqual({ created: true, uploadedTo: `/datasets/${DATASET}/upload/` });
  });

  it('replaces the file in place when the day was already published', async () => {
    const existing = {
      id: 'OLD',
      title: 'missed-hour-20260905.csv',
      type: 'update',
      format: 'csv',
      filetype: 'file',
      url: 'https://stub/OLD',
    };
    const resources = [existing];

    const { seen, result } = await withStub(resources, (api) =>
      publish(api, csvOnDisk('missed-hour-20260905.csv'))
    );

    // A retried or manually re-dispatched night must not leave the dataset with
    // two resources for one day: the existing one keeps its id, so `/datasets/r/`
    // links stay valid and consumers see one file per day.
    expect({
      created: (result as { created: boolean }).created,
      uploadedTo: seen.find(({ method }) => method === 'POST')?.url,
      resourceCount: resources.length,
    }).toEqual({
      created: false,
      uploadedTo: `/datasets/${DATASET}/resources/OLD/upload/`,
      resourceCount: 1,
    });
  });

  it("reports the API's own explanation when a call fails, without the key", async () => {
    // An unknown dataset hits the stub's 404 branch, the way a bad id or a
    // revoked permission would on the real platform.
    const { error } = await withStub([], (api) =>
      publishUpdateResource({
        datasetId: 'MISSING',
        apiKey: 'TEST-KEY',
        filePath: csvOnDisk('missed-hour-20260905.csv'),
        apiUrl: api,
      })
    );

    expect({
      message: error?.message,
      leaksKey: error?.message.includes('TEST-KEY') ?? false,
    }).toEqual({
      message: expect.stringContaining('404') as unknown as string,
      leaksKey: false,
    });
    expect(error?.message).toContain('no such route');
  });
});
