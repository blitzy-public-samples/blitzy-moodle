# ADR 0001: JWT Authentication Strategy

## Status

**ACCEPTED**

Date: 2024-01-15  
Deciders: Architecture Team, Security Team  
Supersedes: None

## Context

The refactoring transforms Moodle from PHP session-based authentication to a React Single Page Application (SPA) that requires stateless, API-friendly authentication. The existing Moodle authentication system supports multiple methods (LDAP, SSO, OAuth2, SAML, manual/local) that must continue functioning without modification. 

The new React frontend needs a modern, scalable authentication mechanism that:

- **Works with RESTful APIs and client-side routing**: Session-based authentication is challenging with client-side routing and API-first architecture
- **Supports stateless authentication for horizontal scaling**: Modern cloud deployments require stateless authentication to enable load balancing without sticky sessions
- **Maintains backward compatibility with all existing auth plugins**: The existing 89 authentication plugin files in `/auth/` directory must remain completely untouched (zero modifications allowed per Minimal Change Clause)
- **Enables token-based security without modifying PHP backend auth logic**: All existing authentication business logic in `/lib/moodlelib.php` and authentication plugins must be preserved
- **Provides secure logout with server-side token invalidation**: Tokens must be revocable to prevent unauthorized access after logout
- **Supports gradual rollout**: Both PHP session-based and JWT-based authentication must coexist during the transition period

### Technical Constraints

1. **Minimal Change Discipline**: Modifications to existing PHP authentication code are prohibited (<2% file modification limit)
2. **Protected Directory Enforcement**: No modifications to `/auth/` directory (89 files), `/lib/` directory (847 files)
3. **Zero Business Logic Duplication**: Cannot reimplement authentication logic; must wrap existing functions
4. **Performance Requirements**: P95 API response time <1 second, support 1000+ concurrent users per server
5. **Security Standards**: HTTPS required, WCAG 2.1 AA compliance, XSS and CSRF protection

## Decision

We will implement JWT (JSON Web Token) based authentication as a **thin layer ON TOP OF existing Moodle authentication methods**, not as a replacement. This preserves all existing authentication functionality while enabling modern API access patterns.

### Token Structure

**Access Token** (Short-lived):
- **Expiration**: 1 hour (configurable via `$CFG->jwt_access_token_expiry`)
- **Purpose**: Authorizes individual API requests
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Payload**:
  ```json
  {
    "iss": "https://moodle.example.com",  // Issuer (Moodle instance URL)
    "sub": "12345",                        // Subject (Moodle user ID)
    "iat": 1705334400,                     // Issued at (Unix timestamp)
    "exp": 1705338000,                     // Expiration (Unix timestamp)
    "roles": ["student", "editingteacher"],// User roles in enrolled courses
    "username": "jsmith",                  // Moodle username
    "email": "jsmith@example.com",         // User email
    "fullname": "John Smith"               // User full name
  }
  ```

**Refresh Token** (Long-lived):
- **Expiration**: 7 days (configurable via `$CFG->jwt_refresh_token_expiry`)
- **Purpose**: Obtains new access tokens without re-authentication
- **Algorithm**: HS256 (HMAC with SHA-256)
- **Payload**:
  ```json
  {
    "iss": "https://moodle.example.com",
    "sub": "12345",
    "iat": 1705334400,
    "exp": 1705939200,
    "type": "refresh",
    "jti": "unique-token-id-123"  // JWT ID for blacklist tracking
  }
  ```

**Signature**:
- **Secret Key**: 256-bit secret stored in `$CFG->jwt_secret` in config.php
- **Generation**: Use cryptographically secure random generator (e.g., `random_bytes(32)`)
- **Rotation**: Support secret rotation without invalidating existing tokens (multi-key support)

### Authentication Flow

**Initial Login**:
1. User submits credentials to React login form
2. React calls `POST /api/v1/auth/login` with username and password
3. API validates JWT secret is configured, then calls existing `authenticate_user_login($username, $password)`
4. If successful, API generates JWT token pair using `firebase/php-jwt` library
5. API returns both tokens in response body:
   ```json
   {
     "success": true,
     "data": {
       "access_token": "eyJhbGc...",
       "refresh_token": "eyJhbGc...",
       "expires_in": 3600,
       "user": {
         "id": 12345,
         "username": "jsmith",
         "email": "jsmith@example.com",
         "fullname": "John Smith",
         "roles": ["student", "editingteacher"]
       }
     }
   }
   ```
6. React stores tokens securely (see Token Storage section)

**API Request with Authentication**:
1. React includes access token in Authorization header: `Authorization: Bearer <access_token>`
2. API middleware validates token signature using `JWT::decode()` from firebase/php-jwt
3. API checks token expiration (reject if expired)
4. API checks token blacklist in Redis (reject if logged out)
5. API extracts user ID from token payload and loads user context
6. API proceeds with request processing using extracted user context

**Token Refresh**:
1. When access token expires (detected by 401 response with specific error code)
2. React automatically calls `POST /api/v1/auth/refresh` with refresh token
3. API validates refresh token signature and expiration
4. API checks refresh token is not blacklisted
5. API generates new access token (and optionally new refresh token for rotation)
6. React updates stored tokens and retries original request

**Logout**:
1. User clicks logout in React interface
2. React calls `POST /api/v1/auth/logout` with access token
3. API extracts JWT ID (`jti`) from token payload
4. API adds token to Redis blacklist with TTL matching token expiration
5. API returns success response
6. React clears stored tokens and redirects to login page

### Token Storage

**Primary Strategy: httpOnly Cookies** (Recommended):
- **Advantages**: 
  - Automatic XSS protection (JavaScript cannot access)
  - Browser automatically sends with requests (no manual header management)
  - Works seamlessly with CORS if properly configured
- **Implementation**:
  - Set-Cookie header with `httpOnly`, `secure` (HTTPS only), `sameSite=Strict` flags
  - Access token in `moodle_jwt_access` cookie
  - Refresh token in `moodle_jwt_refresh` cookie (separate, more restrictive)
- **CORS Requirements**:
  - API must set `Access-Control-Allow-Credentials: true`
  - React must set `credentials: 'include'` on fetch/axios requests
  - Domain whitelist in `$CFG->cors_allowed_origins`

**Fallback Strategy: localStorage** (If cookies blocked):
- **Advantages**:
  - Works when third-party cookies are blocked
  - Explicit control over token lifecycle
- **Disadvantages**:
  - Vulnerable to XSS attacks if site has any XSS vulnerability
  - Requires manual header management
- **Mitigation**:
  - Strict Content Security Policy (CSP) headers
  - Regular security audits for XSS vulnerabilities
  - Token encryption at rest using Web Crypto API (optional enhancement)
- **Implementation**:
  - Store in localStorage with keys `moodle_jwt_access` and `moodle_jwt_refresh`
  - React axios interceptor adds Authorization header to every request
  - Clear localStorage on logout

**Storage Decision Logic**:
```typescript
// React: Attempt httpOnly cookie storage first
try {
  // Login endpoint sets httpOnly cookies
  await apiClient.post('/api/v1/auth/login', credentials, {
    withCredentials: true  // Enable cookie sending
  });
  // If successful and cookies are set, use cookie-based auth
} catch (error) {
  if (error.cookiesBlocked) {
    // Fall back to localStorage
    const { access_token, refresh_token } = await apiClient.post('/api/v1/auth/login', credentials);
    localStorage.setItem('moodle_jwt_access', access_token);
    localStorage.setItem('moodle_jwt_refresh', refresh_token);
  }
}
```

### Token Validation

**Every API Request Validates**:
1. **Signature Verification**: Validate HMAC signature using `JWT::decode()` with configured secret
2. **Expiration Check**: Verify `exp` claim is greater than current timestamp
3. **Issuer Validation**: Verify `iss` claim matches `$CFG->wwwroot`
4. **Blacklist Check**: Query Redis for token ID (`jti` claim) to check if logged out
5. **User Existence**: Verify user ID from `sub` claim exists in Moodle database
6. **User Active Check**: Verify user is not suspended or deleted

**Validation Implementation** (`api/lib/auth_jwt.php`):
```php
function validate_jwt_token($token) {
    global $CFG, $DB;
    
    try {
        // Decode and verify signature
        $decoded = JWT::decode($token, new Key($CFG->jwt_secret, 'HS256'));
        
        // Validate issuer
        if ($decoded->iss !== $CFG->wwwroot) {
            throw new api_exception('INVALID_TOKEN_ISSUER');
        }
        
        // Check blacklist (Redis)
        if (is_token_blacklisted($decoded->jti ?? null)) {
            throw new api_exception('TOKEN_REVOKED');
        }
        
        // Verify user exists and is active
        $user = $DB->get_record('user', ['id' => $decoded->sub]);
        if (!$user || $user->deleted || $user->suspended) {
            throw new api_exception('USER_INVALID');
        }
        
        return [
            'valid' => true,
            'user_id' => $decoded->sub,
            'username' => $decoded->username,
            'roles' => $decoded->roles
        ];
        
    } catch (ExpiredException $e) {
        throw new api_exception('TOKEN_EXPIRED');
    } catch (SignatureInvalidException $e) {
        throw new api_exception('INVALID_TOKEN_SIGNATURE');
    } catch (Exception $e) {
        throw new api_exception('TOKEN_VALIDATION_FAILED');
    }
}
```

### Token Blacklist (Redis)

**Purpose**: Enable logout by invalidating tokens before natural expiration

**Implementation**:
- **Storage**: Redis key-value store with automatic expiration (TTL)
- **Key Format**: `jwt_blacklist:{jti}` where `jti` is unique token ID
- **Value**: Token expiration timestamp (for debugging)
- **TTL**: Set to token's remaining lifetime (`exp - current_time`)
- **On Logout**: Add token `jti` to Redis with appropriate TTL
- **On Validation**: Check if `jwt_blacklist:{jti}` exists in Redis

**Redis Configuration** (`config.php`):
```php
$CFG->jwt_blacklist_enabled = true;
$CFG->redis_host = 'localhost';
$CFG->redis_port = 6379;
$CFG->redis_database = 1;  // Use separate database for JWT blacklist
```

**Blacklist Operation** (`api/lib/auth_jwt.php`):
```php
function blacklist_token($token_payload) {
    global $CFG;
    
    $redis = new Redis();
    $redis->connect($CFG->redis_host, $CFG->redis_port);
    $redis->select($CFG->redis_database);
    
    $jti = $token_payload->jti ?? hash('sha256', json_encode($token_payload));
    $ttl = $token_payload->exp - time();
    
    if ($ttl > 0) {
        $redis->setex("jwt_blacklist:{$jti}", $ttl, $token_payload->exp);
    }
}

function is_token_blacklisted($jti) {
    global $CFG;
    
    if (!$jti || !$CFG->jwt_blacklist_enabled) {
        return false;
    }
    
    $redis = new Redis();
    $redis->connect($CFG->redis_host, $CFG->redis_port);
    $redis->select($CFG->redis_database);
    
    return $redis->exists("jwt_blacklist:{$jti}") > 0;
}
```

### Backward Compatibility

**Zero Modifications to Existing Auth Plugins**:
- JWT layer calls `authenticate_user_login()` which delegates to appropriate auth plugin
- All existing auth plugin code in `/auth/` directory remains completely untouched
- Plugin selection logic (`$CFG->authloginpage`) continues to work identically
- LDAP, OAuth2, SAML, Shibboleth, CAS plugins all function without changes

**Coexistence with PHP Sessions**:
- During transition period, both session-based and JWT-based auth can coexist
- Feature flag `$CFG->jwt_enabled` controls JWT availability
- User preference or admin setting determines which auth method is used
- PHP session authentication remains default until JWT is fully validated
- No data inconsistencies between auth methods (same user database)

**Gradual Migration Path**:
```php
// config.php - Feature flag configuration
$CFG->jwt_enabled = true;  // Enable JWT authentication
$CFG->jwt_force_users = [];  // Array of user IDs forced to use JWT
$CFG->jwt_force_roles = ['student'];  // Roles forced to use JWT
$CFG->jwt_rollout_percentage = 10;  // Gradual rollout to 10% of users
```

**Authentication Method Selection**:
1. Check if user is in `jwt_force_users` → Use JWT
2. Check if user role is in `jwt_force_roles` → Use JWT
3. Check if user preference set → Use preferred method
4. Check random rollout percentage → Use JWT or session
5. Default to session-based authentication

## Consequences

### Positive Consequences

1. **Horizontal Scalability**:
   - Stateless authentication eliminates need for sticky sessions
   - Load balancers can distribute requests to any API server
   - Reduces memory requirements on API servers (no session storage)
   - Enables true cloud-native deployment patterns

2. **Performance Improvements**:
   - No database lookup required for every request (user data in token)
   - Validation is cryptographic operation (fast)
   - Reduces database load significantly under high concurrency
   - Enables aggressive API response caching

3. **Security Enhancements**:
   - Built-in expiration mechanism provides automatic security
   - Token rotation capability improves security posture
   - Explicit logout via blacklist prevents token misuse
   - Token payload immutable (cannot be modified without detection)

4. **Developer Experience**:
   - JWT is industry-standard with extensive library support
   - Well-documented pattern familiar to React developers
   - Axios interceptors simplify token refresh logic
   - Clear separation between authentication and authorization

5. **Mobile and Third-Party Integration**:
   - Token-based auth is mobile-app friendly
   - Easy integration with external services and APIs
   - Supports programmatic API access for integrations
   - No cookie management complexity for native apps

6. **Backward Compatibility**:
   - Zero modifications to existing authentication plugins
   - Gradual rollout reduces deployment risk
   - Coexistence with session-based auth during transition
   - Preserves all existing authentication methods (LDAP, SSO, OAuth)

### Negative Consequences

1. **Token Invalidation Complexity**:
   - Tokens cannot be invalidated individually without blacklist infrastructure
   - Requires Redis or similar for logout functionality
   - Blacklist size grows with logout frequency
   - Token compromise requires blacklist check on every request

2. **Token Size Overhead**:
   - JWT tokens are larger than session IDs (~200-300 bytes vs ~32 bytes)
   - Increased network overhead on every API request
   - Header size limits may be reached with many roles/permissions
   - Compression reduces but doesn't eliminate overhead

3. **Refresh Token Complexity**:
   - Client must implement token refresh logic
   - Race conditions possible during concurrent requests with expired token
   - Refresh token storage requires additional security considerations
   - Token rotation implementation adds complexity

4. **Infrastructure Requirements**:
   - Redis deployment required for token blacklist
   - Redis failover and clustering needed for high availability
   - Additional monitoring and alerting for Redis health
   - Backup strategy for token blacklist (if needed)

5. **Clock Synchronization**:
   - Token expiration relies on synchronized clocks across servers
   - Clock skew can cause premature token rejection or extended validity
   - Requires NTP (Network Time Protocol) on all servers
   - Monitoring needed to detect clock drift

6. **Secret Management**:
   - JWT secret compromise invalidates all tokens
   - Secret rotation requires multi-key support or downtime
   - Secret must be synchronized across all API servers
   - Backup and recovery procedures for secret more critical

### Risk Assessment and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **XSS Token Theft** | Critical | Low | Use httpOnly cookies; implement strict CSP headers; regular security audits |
| **Token Secret Compromise** | Critical | Very Low | Store in config.php with restricted permissions; implement secret rotation; monitor for unauthorized access |
| **Redis Failure** | High | Low | Implement Redis clustering; graceful degradation (allow requests if Redis unavailable during outage); alerts and monitoring |
| **Clock Skew Issues** | Medium | Low | Enforce NTP on all servers; add 30-second tolerance window in validation; monitor clock drift |
| **Token Replay Attacks** | Medium | Low | Short token expiration (1 hour); require HTTPS; implement rate limiting; monitor for suspicious patterns |
| **Refresh Token Theft** | High | Low | Separate storage with stricter security; rotate on use; limit refresh token lifetime; detect multiple simultaneous refreshes |

## Alternatives Considered

### Alternative 1: Session-Based Authentication with API

**Description**: Continue using PHP sessions, pass session ID to API in cookie or custom header

**Pros**:
- No infrastructure changes required
- Familiar to existing Moodle developers
- Built-in session management in PHP
- Easy logout (destroy session)

**Cons**:
- Not stateless; requires sticky sessions or centralized session storage
- Breaks RESTful principles (stateful communication)
- Horizontal scaling challenges with sticky sessions
- Session serialization performance overhead
- Difficult to support mobile apps and third-party integrations

**Decision**: **REJECTED** - Violates stateless architecture requirement and limits scalability

### Alternative 2: OAuth2 for API Access

**Description**: Implement full OAuth2 authorization server for API access

**Pros**:
- Industry-standard protocol for authorization
- Supports third-party application authorization
- Fine-grained scope-based permissions
- Widely supported by client libraries

**Cons**:
- Significant implementation complexity (authorization server, client registration, scope management)
- Overkill for single-application use case (React SPA accessing same backend)
- OAuth2 designed for third-party app authorization, not primary authentication
- Additional infrastructure (database tables for clients, tokens, scopes)
- Steeper learning curve for developers

**Decision**: **REJECTED** - Excessive complexity for the primary use case; JWT is sufficient

### Alternative 3: Long-Lived API Keys

**Description**: Generate long-lived API keys for each user, stored in database

**Pros**:
- Simple implementation (random string generation)
- Easy to revoke (delete from database)
- No expiration management needed
- Familiar pattern for developers

**Cons**:
- No built-in expiration mechanism (security risk)
- Requires database lookup on every request (performance impact)
- Harder to rotate keys (manual user action required)
- No standard format (custom implementation)
- Poor user experience (manual key management)
- Keys stored in database are target for attacks

**Decision**: **REJECTED** - Security and performance concerns outweigh simplicity benefits

### Alternative 4: Extend Existing Moodle Sessions to API

**Description**: Make API endpoints accept Moodle session cookies, validate via existing session mechanism

**Pros**:
- Minimal changes to authentication flow
- Reuses existing, battle-tested session validation
- No new infrastructure required
- Easy backward compatibility

**Cons**:
- Ties API to PHP session mechanism (not truly stateless)
- Sessions still require database lookup on every request
- Doesn't solve horizontal scaling challenges
- Makes gradual migration to React more difficult (tight coupling)
- Mobile app support remains challenging
- Mixed authentication patterns confuse developers

**Decision**: **REJECTED** - Doesn't achieve the stateless, scalable architecture goal

## Implementation Details

### PHP Dependencies

**Library**: `firebase/php-jwt` version ^6.10

**Installation**:
```bash
composer require firebase/php-jwt:^6.10
```

**composer.json**:
```json
{
  "require": {
    "php": ">=8.2.0",
    "firebase/php-jwt": "^6.10"
  }
}
```

**Usage Example**:
```php
<?php
require_once(__DIR__ . '/../../vendor/autoload.php');

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

// Generate token
$payload = [
    'iss' => $CFG->wwwroot,
    'sub' => $userid,
    'iat' => time(),
    'exp' => time() + 3600,
    'roles' => get_user_roles($userid),
    'username' => $user->username,
    'email' => $user->email,
    'fullname' => fullname($user)
];

$access_token = JWT::encode($payload, $CFG->jwt_secret, 'HS256');

// Validate token
try {
    $decoded = JWT::decode($access_token, new Key($CFG->jwt_secret, 'HS256'));
    $userid = $decoded->sub;
} catch (Exception $e) {
    // Invalid token
    throw new api_exception('INVALID_TOKEN');
}
```

### Configuration (config.php)

Add the following configuration to `config.php`:

```php
// ============================================================================
// JWT AUTHENTICATION CONFIGURATION
// ============================================================================

// Enable JWT authentication (set to false to use only session-based auth)
$CFG->jwt_enabled = true;

// JWT secret key (256-bit). GENERATE USING: bin/bash -c 'openssl rand -base64 32'
// CRITICAL: Keep this secret secure. Compromise invalidates all tokens.
$CFG->jwt_secret = 'REPLACE_WITH_SECURE_RANDOM_256_BIT_SECRET';

// Access token expiration (seconds). Default: 3600 (1 hour)
$CFG->jwt_access_token_expiry = 3600;

// Refresh token expiration (seconds). Default: 604800 (7 days)
$CFG->jwt_refresh_token_expiry = 604800;

// Token blacklist (requires Redis)
$CFG->jwt_blacklist_enabled = true;

// Redis configuration for token blacklist
$CFG->redis_host = 'localhost';
$CFG->redis_port = 6379;
$CFG->redis_database = 1;  // Use database 1 for JWT blacklist

// CORS configuration for React frontend
$CFG->cors_allowed_origins = [
    'http://localhost:5173',   // Development
    'https://moodle.example.com'  // Production
];

// Gradual rollout configuration (optional)
$CFG->jwt_force_users = [];  // Array of user IDs to force JWT auth
$CFG->jwt_force_roles = [];  // Array of role shortnames to force JWT auth
$CFG->jwt_rollout_percentage = 100;  // Percentage of users to use JWT (0-100)
```

### API Implementation Files

**api/lib/auth_jwt.php**: JWT token generation, validation, and blacklist management

**api/v1/auth/login.php**: Login endpoint that generates JWT tokens

**api/v1/auth/logout.php**: Logout endpoint that blacklists tokens

**api/v1/auth/refresh.php**: Token refresh endpoint

**api/v1/auth/me.php**: Current user endpoint (validates token and returns user data)

### React Implementation

**Token Storage Service** (`src/services/auth/authService.ts`):
```typescript
class AuthService {
  private useHttpOnlyCookies: boolean = true;
  
  async login(username: string, password: string) {
    try {
      const response = await apiClient.post('/api/v1/auth/login', 
        { username, password },
        { withCredentials: true }  // Enable cookies
      );
      
      if (response.data.success) {
        // If using localStorage fallback
        if (!this.useHttpOnlyCookies) {
          localStorage.setItem('moodle_jwt_access', response.data.data.access_token);
          localStorage.setItem('moodle_jwt_refresh', response.data.data.refresh_token);
        }
        
        return response.data.data.user;
      }
    } catch (error) {
      throw new Error('Login failed');
    }
  }
  
  async refreshToken() {
    const response = await apiClient.post('/api/v1/auth/refresh',
      {},
      { withCredentials: true }
    );
    
    if (!this.useHttpOnlyCookies) {
      localStorage.setItem('moodle_jwt_access', response.data.data.access_token);
    }
  }
  
  async logout() {
    await apiClient.post('/api/v1/auth/logout', {}, { withCredentials: true });
    localStorage.clear();
  }
}
```

**Axios Interceptor** (`src/services/api/interceptors.ts`):
```typescript
// Request interceptor: Add Authorization header if using localStorage
apiClient.interceptors.request.use(config => {
  if (!config.withCredentials) {  // If not using cookies
    const token = localStorage.getItem('moodle_jwt_access');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor: Handle token expiration and refresh
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && 
        error.response?.data?.error?.code === 'TOKEN_EXPIRED' &&
        !originalRequest._retry) {
      
      originalRequest._retry = true;
      
      try {
        await authService.refreshToken();
        return apiClient(originalRequest);  // Retry original request
      } catch (refreshError) {
        // Refresh failed, redirect to login
        authService.logout();
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);
```

### Security Considerations

1. **Secret Generation**:
   ```bash
   # Generate secure 256-bit secret
   openssl rand -base64 32
   ```

2. **Secret Storage**:
   - Store in `config.php` with file permissions 600 (owner read/write only)
   - Never commit to version control
   - Use environment variables in containerized deployments
   - Rotate periodically (quarterly recommended)

3. **HTTPS Requirement**:
   - JWT authentication MUST be used over HTTPS only
   - Configure web server to redirect HTTP to HTTPS
   - Set `Secure` flag on cookies in production

4. **Content Security Policy**:
   ```php
   header("Content-Security-Policy: default-src 'self'; script-src 'self'");
   ```

5. **Rate Limiting**:
   - Implement rate limiting on `/api/v1/auth/login` (5 attempts per minute per IP)
   - Implement rate limiting on `/api/v1/auth/refresh` (10 attempts per minute per user)
   - Block IPs with excessive failed attempts (brute force protection)

### Monitoring and Logging

**Metrics to Monitor**:
- Token generation rate (logins per minute)
- Token validation success/failure rate
- Token refresh rate
- Token blacklist size (Redis keys)
- Average token validation time
- Redis connection pool health

**Events to Log**:
- All login attempts (success and failure)
- Token generation events
- Token validation failures (expired, invalid signature, blacklisted)
- Token refresh events
- Logout events
- Redis connection failures
- Suspicious activity (multiple failed validations, concurrent logins)

**Log Format**:
```json
{
  "timestamp": "2024-01-15T10:30:45Z",
  "event": "jwt_validation_failed",
  "user_id": 12345,
  "username": "jsmith",
  "reason": "TOKEN_EXPIRED",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "token_jti": "unique-token-id-123"
}
```

### Testing Requirements

1. **Unit Tests** (Vitest):
   - Token generation with various payloads
   - Token validation with valid/invalid/expired tokens
   - Token refresh logic
   - Axios interceptor behavior

2. **Integration Tests**:
   - Login endpoint with various auth plugins (LDAP, OAuth, manual)
   - Token refresh flow
   - Logout and blacklist verification
   - Concurrent requests with token expiration

3. **E2E Tests** (Playwright):
   - Complete login flow
   - Authenticated navigation across pages
   - Token expiration and automatic refresh
   - Logout and re-login

4. **Security Tests**:
   - XSS attack prevention with token in localStorage
   - CSRF protection verification
   - Token replay attack detection
   - Secret key compromise simulation

## References

### Internal Documentation
- Agent Action Plan Section 0.1: Authentication Modernization requirements
- Agent Action Plan Section 0.7: Authentication and Security constraints
- Agent Action Plan Section 0.5: Dependency Inventory (firebase/php-jwt)

### External Standards and Specifications
- [RFC 7519: JSON Web Token (JWT)](https://tools.ietf.org/html/rfc7519)
- [RFC 7515: JSON Web Signature (JWS)](https://tools.ietf.org/html/rfc7515)
- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)

### Implementation Files
- `api/lib/auth_jwt.php`: JWT token generation, validation, and blacklist utilities
- `api/v1/auth/login.php`: Login endpoint implementation
- `api/v1/auth/logout.php`: Logout endpoint implementation
- `api/v1/auth/refresh.php`: Token refresh endpoint implementation
- `api/v1/auth/me.php`: Current user endpoint implementation
- `react-frontend/src/services/auth/authService.ts`: React authentication service
- `react-frontend/src/services/api/interceptors.ts`: Axios request/response interceptors

### Related ADRs
- ADR 0002: API Response Format Standardization (pending)
- ADR 0003: State Management Strategy (pending)
- ADR 0004: Error Handling and Logging (pending)

---

**Last Updated**: 2024-01-15  
**Review Date**: 2024-04-15 (Quarterly review recommended)
