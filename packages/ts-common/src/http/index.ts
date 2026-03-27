// Error classes (use in both client and server)
export {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  InternalError,
  toErrorResponse,
} from './errors'

// Server-side error helpers (requires h3)
export {
  toHttpError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  internalError,
} from './errors'

// Client-side utilities
export {
  ApiError,
  apiFetch,
  getErrorMessage,
  type ApiFetchOptions,
} from './client'

// IP normalization / fingerprinting
export {
  extractClientIp,
  hashClientIp,
  normalizeClientIp,
  resolveClientIpFingerprint,
  type ClientIpHeaders,
} from './client-ip'

// Fetch with timeout
export {
  TimeoutError,
  fetchWithTimeout,
  fetchJson,
  type FetchWithTimeoutOptions,
} from './fetch-with-timeout'
