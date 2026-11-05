'use client';

let csrfToken = null;
let sessionRequest = null;

export class ApiClientError extends Error {
  constructor(problem, status) {
    super(problem?.detail || 'The request could not be completed.');
    this.name = 'ApiClientError';
    this.status = status;
    this.code = problem?.code || 'request_failed';
    this.errors = problem?.errors || [];
  }
}

async function ensureSession() {
  if (!sessionRequest) {
    sessionRequest = fetch('/api/v1/auth/session', {
      credentials: 'same-origin',
      cache: 'no-store',
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new ApiClientError(body, response.status);
      csrfToken = body.csrfToken;
      return csrfToken;
    }).finally(() => {
      sessionRequest = null;
    });
  }
  return sessionRequest;
}

export async function apiRequest(path, { method = 'GET', body, signal, idempotencyKey } = {}) {
  const headers = { accept: 'application/json' };
  const normalizedMethod = method.toUpperCase();
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;

  if (!['GET', 'HEAD', 'OPTIONS'].includes(normalizedMethod)) {
    headers['x-csrf-token'] = csrfToken || await ensureSession();
  }

  const response = await fetch(path, {
    method: normalizedMethod,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const responseBody = await response.json().catch(() => null);
  if (!response.ok) throw new ApiClientError(responseBody, response.status);
  if (responseBody?.csrfToken) csrfToken = responseBody.csrfToken;
  return responseBody;
}

export function newIdempotencyKey() {
  return crypto.randomUUID();
}

export async function refreshCsrfToken() {
  csrfToken = null;
  return ensureSession();
}
