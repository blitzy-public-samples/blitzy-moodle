/**
 * Mock Authentication Data Generators
 * 
 * Factory functions for creating realistic JWT tokens, decoded JWT payloads, and login
 * responses for testing authentication flows. Provides mockJwtTokens(), mockDecodedJwt(),
 * and mockLoginResponse() functions with sensible defaults and customizable properties.
 * 
 * Mock JWT tokens are not cryptographically valid but have the correct structure for
 * testing purposes. All timestamps and expiration times match the real JWT implementation
 * from api/lib/auth_jwt.php (1-hour access tokens, 7-day refresh tokens).
 * 
 * @module tests/mocks/data/auth
 * @see api/lib/auth_jwt.php - Real JWT implementation reference
 * @see react-frontend/src/types/api.ts - JwtTokens, DecodedJwt, LoginResponse interfaces
 */

import type { JwtTokens, DecodedJwt, LoginResponse } from '@/types/api';
import type { UserId } from '@/types/common';
import { mockUser } from './users';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * DeepPartial utility type for nested partial objects
 * Allows partial overrides of nested properties in mock objects
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : DeepPartial<T[P]>
    : T[P];
};

// ============================================================================
// Timestamp Utilities
// ============================================================================

/**
 * Get current Unix timestamp in seconds
 * 
 * Matches Moodle's timestamp format (seconds since Unix epoch)
 * 
 * @returns {number} Current Unix timestamp in seconds
 * 
 * @example
 * const now = getCurrentTimestamp(); // 1705327200
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

// ============================================================================
// JWT Token Creation Utilities
// ============================================================================

/**
 * Create a mock JWT string (not cryptographically valid)
 * 
 * Generates a JWT-like string with proper structure (header.payload.signature)
 * but without actual cryptographic signing. Suitable for testing purposes where
 * token structure is verified but not cryptographic validity.
 * 
 * The generated token has three base64url-encoded parts separated by dots:
 * - Header: Contains algorithm (HS256) and token type (JWT)
 * - Payload: Contains the provided claims
 * - Signature: Random base64url string (not a real signature)
 * 
 * @param {object} payload - JWT claims to encode in the token
 * @returns {string} Mock JWT token string
 * 
 * @example
 * const token = createMockJwt({ sub: 2, exp: 1705327200 });
 * // Returns: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsImV4cCI6MTcwNTMyNzIwMH0.mock_signature_xyz"
 */
export function createMockJwt(payload: object): string {
  // JWT header (HS256 algorithm, JWT type)
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  // Base64url encode header and payload
  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Generate a mock signature (not cryptographically valid)
  // In real JWT, this would be HMAC-SHA256(encodedHeader + '.' + encodedPayload, secret)
  const mockSignature = btoa(Math.random().toString(36))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
    .substring(0, 43); // Standard signature length

  // Combine into JWT format
  return `${encodedHeader}.${encodedPayload}.${mockSignature}`;
}

// ============================================================================
// Mock JWT Tokens Factory
// ============================================================================

/**
 * Create mock JWT token pair (access and refresh tokens)
 * 
 * Generates a JwtTokens object containing access token (1-hour expiration) and
 * refresh token (7-day expiration) matching the real implementation in
 * api/lib/auth_jwt.php.
 * 
 * Default values:
 * - accessToken: Mock JWT string with 1-hour expiration
 * - refreshToken: Mock JWT string with 7-day expiration
 * - expiresIn: 3600 seconds (1 hour)
 * - tokenType: 'Bearer'
 * 
 * @param {DeepPartial<JwtTokens>} [overrides={}] - Partial token properties to override
 * @returns {JwtTokens} Complete JWT tokens object
 * 
 * @example
 * // Basic tokens with all defaults
 * const tokens = mockJwtTokens();
 * 
 * @example
 * // Custom tokens with specific values
 * const customTokens = mockJwtTokens({
 *   accessToken: 'custom.access.token',
 *   expiresIn: 7200
 * });
 */
export function mockJwtTokens(overrides: DeepPartial<JwtTokens> = {}): JwtTokens {
  const now = getCurrentTimestamp();
  const accessExpiry = now + 3600; // 1 hour
  const refreshExpiry = now + 604800; // 7 days

  // Default access token payload (1-hour expiration)
  const accessPayload = {
    iss: 'http://localhost:8000',
    iat: now,
    exp: accessExpiry,
    sub: 2, // Default user ID
    type: 'access',
    roles: ['student'],
  };

  // Default refresh token payload (7-day expiration)
  const refreshPayload = {
    iss: 'http://localhost:8000',
    iat: now,
    exp: refreshExpiry,
    sub: 2, // Default user ID
    type: 'refresh',
    roles: ['student'],
  };

  // Default token values
  const defaults: JwtTokens = {
    accessToken: createMockJwt(accessPayload),
    refreshToken: createMockJwt(refreshPayload),
    expiresIn: 3600, // 1 hour in seconds
    tokenType: 'Bearer',
  };

  // Merge defaults with overrides
  return {
    ...defaults,
    ...overrides,
  };
}

// ============================================================================
// Mock Decoded JWT Factory
// ============================================================================

/**
 * Create mock decoded JWT payload
 * 
 * Generates a DecodedJwt object representing the claims contained within a JWT token
 * after decoding. Matches the structure of real JWT payloads from api/lib/auth_jwt.php.
 * 
 * Default values:
 * - sub: UserId 2 (default test user)
 * - iss: 'http://localhost:8000' (local Moodle instance)
 * - iat: Current timestamp
 * - exp: Current timestamp + 3600 seconds (1 hour)
 * - roles: ['student'] (default role)
 * 
 * @param {DeepPartial<DecodedJwt>} [overrides={}] - Partial JWT claims to override
 * @returns {DecodedJwt} Complete decoded JWT payload
 * 
 * @example
 * // Basic decoded JWT with all defaults
 * const decoded = mockDecodedJwt();
 * 
 * @example
 * // Teacher with specific ID
 * const teacherJwt = mockDecodedJwt({
 *   sub: 5,
 *   roles: ['teacher', 'editingteacher']
 * });
 * 
 * @example
 * // Expired token for testing expiration handling
 * const expiredJwt = mockDecodedJwt({
 *   exp: getCurrentTimestamp() - 3600 // Expired 1 hour ago
 * });
 */
export function mockDecodedJwt(overrides: DeepPartial<DecodedJwt> = {}): DecodedJwt {
  const now = getCurrentTimestamp();

  // Default decoded JWT payload
  const defaults: DecodedJwt = {
    sub: 2 as UserId, // Default user ID
    iss: 'http://localhost:8000', // Issuer (local Moodle instance)
    iat: now, // Issued at (current timestamp)
    exp: now + 3600, // Expiration (1 hour from now)
    roles: ['student'], // Default user roles
  };

  // Merge defaults with overrides
  return {
    ...defaults,
    ...overrides,
  } as DecodedJwt;
}

// ============================================================================
// Mock Login Response Factory
// ============================================================================

/**
 * Create mock login response with tokens and user data
 * 
 * Generates a complete LoginResponse object returned by the /api/v1/auth/login endpoint
 * after successful authentication. Contains JWT token pair and authenticated user profile.
 * 
 * This factory combines mockJwtTokens() and mockUser() to create a realistic complete
 * authentication response for testing login flows, session initialization, and
 * authenticated application state.
 * 
 * @param {object} [overrides={}] - Partial overrides for tokens and user
 * @param {DeepPartial<JwtTokens>} [overrides.tokens] - Partial token overrides
 * @param {DeepPartial<import('@/types/entities').User>} [overrides.user] - Partial user overrides
 * @returns {LoginResponse} Complete login response with tokens and user
 * 
 * @example
 * // Basic login response with all defaults
 * const loginResponse = mockLoginResponse();
 * 
 * @example
 * // Login response for specific user
 * const teacherLogin = mockLoginResponse({
 *   user: {
 *     id: 5,
 *     email: 'teacher@example.com',
 *     firstname: 'John',
 *     lastname: 'Smith'
 *   },
 *   tokens: {
 *     expiresIn: 7200 // 2-hour session
 *   }
 * });
 * 
 * @example
 * // Testing token refresh scenario
 * const refreshedLogin = mockLoginResponse({
 *   tokens: mockJwtTokens({
 *     accessToken: 'new.access.token'
 *   })
 * });
 */
export function mockLoginResponse(
  overrides: {
    tokens?: DeepPartial<JwtTokens>;
    user?: Parameters<typeof mockUser>[0];
  } = {}
): LoginResponse {
  // Generate tokens with any provided overrides
  const tokens = mockJwtTokens(overrides.tokens);

  // Generate user with any provided overrides
  // If tokens have a custom sub (user ID), use that for the user
  const userId = overrides.tokens?.accessToken
    ? undefined // Can't extract from custom token string
    : overrides.user?.id;

  const user = mockUser({
    id: userId,
    ...overrides.user,
  });

  return {
    tokens,
    user,
  };
}
