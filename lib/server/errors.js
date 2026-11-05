export class ApiError extends Error {
  constructor(status, code, detail, errors) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

export function problemResponse(error) {
  const status = error instanceof ApiError
    ? error.status
    : error.code === 'service_unavailable' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND'
      ? 503
      : 500;
  const code = error instanceof ApiError
    ? error.code
    : status === 503
      ? 'service_unavailable'
      : 'internal_error';
  const detail = error instanceof ApiError
    ? error.message
    : status === 503
      ? 'Backend database or required service is not configured or unavailable.'
      : 'The request could not be completed.';

  if (status === 500) console.error('API request failed:', error);
  return Response.json({
    type: `https://api.damaiindah.example/problems/${code.replaceAll('_', '-')}`,
    title: code.replaceAll('_', ' '),
    status,
    code,
    detail,
    ...(error.errors ? { errors: error.errors } : {}),
  }, {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

export function assert(condition, status, code, message, errors) {
  if (!condition) throw new ApiError(status, code, message, errors);
}
