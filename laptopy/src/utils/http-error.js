/** Error carrying an HTTP status and a stable machine-readable code. */
export class HttpError extends Error {
  constructor(status, message, code = 'error') {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message, code = 'bad_request') => new HttpError(400, message, code);
export const unauthorized = (message = 'Sign in required.') => new HttpError(401, message, 'unauthorized');
export const forbidden = (message = 'You do not have access to this.') => new HttpError(403, message, 'forbidden');
export const notFound = (message = 'Not found.') => new HttpError(404, message, 'not_found');
export const unavailable = (message, code = 'unavailable') => new HttpError(503, message, code);
