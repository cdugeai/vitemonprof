import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

/**
 * The slice of the data.gouv.fr Main API this project writes to: attaching a
 * day's CSV to a dataset as a resource of type "Mise à jour".
 *
 * https://www.data.gouv.fr/api/1/swagger.json is authoritative; what follows is
 * the part of it we depend on, and why each call is shaped the way it is.
 */
const DEFAULT_API_URL = 'https://www.data.gouv.fr/api/1';

/**
 * `type` on a resource is a closed vocabulary, served by
 * `GET /datasets/resource_types/`: `main`, `documentation`, `update`, `api`,
 * `code`, `other`. The French label the issue asks for — "Mise à jour" — is that
 * endpoint's rendering of the id `update`; the API only ever accepts the id.
 */
const RESOURCE_TYPE_UPDATE = 'update';

/**
 * The fields `PUT /datasets/{id}/resources/{rid}/` marks required. The upload
 * response already carries every one of them, so the update below is a
 * round-trip of what the server just told us with `type` and `description`
 * changed — not a hand-built object that could omit one and get a 400.
 */
const REQUIRED_RESOURCE_FIELDS = ['title', 'type', 'format', 'filetype', 'url'] as const;

export interface DatagouvResource {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly format: string;
  readonly filetype: string;
  readonly url: string;
  readonly description?: string | null;
}

export interface PublishOptions {
  /** Dataset UUID or slug. Prefer the UUID: a slug can be renamed. */
  readonly datasetId: string;
  /** Never logged, never placed in a URL or a body — only the `X-API-KEY` header. */
  readonly apiKey: string;
  /** Local CSV to upload. Its basename becomes the resource title. */
  readonly filePath: string;
  /** Markdown shown under the resource on the dataset page. */
  readonly description?: string;
  /** Point at `https://demo.data.gouv.fr/api/1` to rehearse against the sandbox. */
  readonly apiUrl?: string;
}

export interface PublishResult {
  readonly resource: DatagouvResource;
  /** False when an earlier run had already published this day and the file was replaced. */
  readonly created: boolean;
}

/**
 * Publishes `filePath` as a "Mise à jour" resource of `datasetId`.
 *
 * **Re-running a day replaces it rather than duplicating it.** A scheduled job
 * gets re-run — a retry after a network blip, a manual dispatch to repair a
 * night the database was down — and the obvious implementation would leave the
 * dataset with two resources named `missed-hour-20260914.csv` and no way for a
 * consumer to tell which one is current. So the resource is looked up by title
 * first: found, its *file* is replaced in place (the resource keeps its id, and
 * `/datasets/r/{id}` keeps resolving); not found, a new resource is created.
 * That makes the whole script idempotent per day, which is the property a cron
 * job needs.
 */
export async function publishUpdateResource({
  datasetId,
  apiKey,
  filePath,
  description,
  apiUrl = DEFAULT_API_URL,
}: PublishOptions): Promise<PublishResult> {
  const title = basename(filePath);
  const existing = await findResourceByTitle({ datasetId, apiKey, apiUrl, title });

  // Two endpoints, one for each case. `/datasets/{id}/upload/` creates a resource
  // from the file; `/datasets/{id}/resources/{rid}/upload/` overwrites the file
  // behind an existing one. Both answer with the resource itself plus a `success`
  // flag (`UploadedResource` = `Resource` + `success` in the Swagger).
  const uploadPath = existing
    ? `/datasets/${datasetId}/resources/${existing.id}/upload/`
    : `/datasets/${datasetId}/upload/`;

  const body = new FormData();
  // A `File` rather than a `Blob`: multipart needs a filename part, and without
  // one the API stores the resource under a generated name instead of the day's.
  body.set('file', new File([await readFile(filePath)], title, { type: 'text/csv' }));

  const uploaded = await request<DatagouvResource & { success?: boolean }>({
    apiUrl,
    apiKey,
    method: 'POST',
    path: uploadPath,
    body,
  });

  // Neither upload endpoint takes a `type`, so the classification is a second
  // call. Sending back only the required fields keeps the read-only ones the
  // upload returned (`created_at`, `metrics`, `latest`, …) out of a payload that
  // would reject them.
  //
  // Order matters, and not subtly: `REQUIRED_RESOURCE_FIELDS` contains `type`, so
  // the echo has to be copied *before* the overrides. Seeding the object with
  // `type: 'update'` and then running the loop over it puts the platform's
  // default (`main`) back, and the API accepts that happily — the resource is
  // published, nothing fails, and the one thing this whole script exists to set
  // is wrong.
  const payload: Record<string, unknown> = {};
  for (const field of REQUIRED_RESOURCE_FIELDS) payload[field] = uploaded[field];
  payload.type = RESOURCE_TYPE_UPDATE;
  if (description !== undefined) payload.description = description;

  const resource = await request<DatagouvResource>({
    apiUrl,
    apiKey,
    method: 'PUT',
    path: `/datasets/${datasetId}/resources/${uploaded.id}/`,
    body: payload,
  });

  return { resource, created: existing === null };
}

async function findResourceByTitle({
  datasetId,
  apiKey,
  apiUrl,
  title,
}: {
  datasetId: string;
  apiKey: string;
  apiUrl: string;
  title: string;
}): Promise<DatagouvResource | null> {
  // Read from the dataset rather than `/datasets/{id}/resources/`, which
  // paginates: the whole point is to see *every* resource, and a dataset that
  // outgrows one page of its own record is not a shape this project has.
  const dataset = await request<{ resources: DatagouvResource[] }>({
    apiUrl,
    apiKey,
    method: 'GET',
    path: `/datasets/${datasetId}/`,
  });

  return dataset.resources.find((resource) => resource.title === title) ?? null;
}

async function request<T>({
  apiUrl,
  apiKey,
  method,
  path,
  body,
}: {
  apiUrl: string;
  apiKey: string;
  method: string;
  path: string;
  body?: FormData | Record<string, unknown>;
}): Promise<T> {
  const isForm = body instanceof FormData;

  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      'X-API-KEY': apiKey,
      // Let undici set the multipart `Content-Type`; it has to carry the boundary
      // it generated, so spelling it out here would produce an unparseable body.
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    // The body is where data.gouv.fr puts the reason (`{"message": "..."}`), and a
    // bare "403" would send whoever reads the failed run hunting. The key is only
    // ever a request header, so nothing echoed back here can contain it.
    const detail = (await response.text().catch(() => '')).slice(0, 500);
    throw new Error(`${method} ${path} — ${response.status} ${response.statusText}\n${detail}`);
  }

  return (await response.json()) as T;
}
