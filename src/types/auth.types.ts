export type UserRole = "ADMIN" | "VENDEDOR" | "CLIENTE";

export interface AuthSession {
  userId: string;
  email: string;
  role: string;
  csrf: string;
}

export interface LoginAttemptRecord {
  email: string;
  ipAddress: string;
  success: boolean;
  userAgent?: string;
}

export interface RateLimitInfo {
  attempts: number;
  lockedUntil: Date | null;
  remainingAttempts: number;
}

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  path: string;
  domain?: string;
  maxAge?: number;
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, string[]>;
}

export interface ApiSuccessResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}
