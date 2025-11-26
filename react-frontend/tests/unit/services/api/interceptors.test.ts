/**
 * Unit Tests for API Request/Response Interceptors
 *
 * This test suite provides comprehensive coverage of the interceptors.ts module,
 * validating JWT token injection, automatic token refresh on 401 errors, error
 * handling and standardization, response formatting, and concurrent request
 * management during token refresh.
 *
 * Test Coverage:
 * - setupInterceptors function configuration
 * - Request interceptor: JWT token injection, header management
 * - Response success interceptor: envelope standardization
 * - Response error interceptor: 401 handling, token refresh, request retry
 * - Token refresh queue: concurrent request management, race condition prevention
 * - Error standardization: 401, 403, 404, 500+, network errors
 * - Integration tests: full authentication flow
 * - Edge cases: undefined configs, null responses, malformed errors
 *
 * Mocking Strategy:
 * - authService: Completely mocked to control token availability and refresh behavior
 * - window.location: Mocked to test redirect behavior without actual navigation
 * - axios: Used with real implementation to test actual interceptor integration
 *
 * @module tests/unit/services/api/interceptors.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import axios, { AxiosHeaders } from 'axios';
import { setupInterceptors } from '@/services/api/interceptors';

// ============================================================================
// Type Extensions
// ============================================================================

/**
 * Extended Axios config type that includes the custom _retry flag
 * used by the error interceptor to prevent infinite retry loops
 */
interface AxiosRequestConfigWithRetry extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// ============================================================================
// Mock Setup
// ============================================================================

/**
 * Mock authService module completely
 * This allows tests to control token availability and refresh behavior
 */
vi.mock('@/services/auth/authService', () => ({
  getAccessToken: vi.fn(),
  refreshAccessToken: vi.fn(),
  clearTokens: vi.fn(),
}));

// Import mocked authService to configure in tests
import {
  getAccessToken,
  refreshAccessToken,
  clearTokens,
} from '@/services/auth/authService';

// ============================================================================
// Mock Helper Functions
// ============================================================================

/**
 * Create mock Axios request config object
 *
 * Generates a valid InternalAxiosRequestConfig with sensible defaults
 * that can be customized for specific test scenarios.
 *
 * @param overrides - Optional partial config to override defaults
 * @returns Complete mock request config
 */
function createMockConfig(
  overrides: Partial<InternalAxiosRequestConfig> = {}
): InternalAxiosRequestConfig {
  const headers = new AxiosHeaders();
  headers['Content-Type'] = 'application/json';

  return {
    url: '/test',
    method: 'get',
    headers,
    baseURL: '/api/v1',
    ...overrides,
  } as InternalAxiosRequestConfig;
}

/**
 * Create mock successful Axios response
 *
 * @param data - Response data payload
 * @param status - HTTP status code (default: 200)
 * @returns Mock AxiosResponse object
 */
function createMockResponse<T = unknown>(
  data: T,
  status: number = 200
): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: createMockConfig() as InternalAxiosRequestConfig<unknown>,
  } as AxiosResponse<T>;
}

/**
 * Create mock Axios error object
 *
 * @param status - HTTP status code
 * @param message - Error message
 * @param config - Optional request config
 * @param data - Optional response data
 * @returns Mock AxiosError object
 */
function createMockError(
  status: number | null,
  message: string,
  config?: InternalAxiosRequestConfig,
  data?: unknown
): AxiosError {
  const error = new Error(message) as AxiosError;
  error.config = config ?? createMockConfig();
  error.isAxiosError = true;
  error.name = 'AxiosError';

  if (status !== null) {
    error.response = {
      data,
      status,
      statusText: getStatusText(status),
      headers: {},
      config: error.config as InternalAxiosRequestConfig<unknown>,
    } as AxiosResponse;
  }

  return error;
}

/**
 * Get standard status text for HTTP status code
 */
function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    503: 'Service Unavailable',
  };
  return statusTexts[status] ?? 'Unknown';
}

/**
 * Create mock 401 Unauthorized error
 */
function createMock401Error(config?: InternalAxiosRequestConfig): AxiosError {
  return createMockError(
    401,
    'Unauthorized',
    config,
    { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }
  );
}

/**
 * Create mock 403 Forbidden error
 */
function createMock403Error(): AxiosError {
  return createMockError(
    403,
    'Forbidden',
    undefined,
    { error: { code: 'PERMISSION_DENIED', message: 'Access denied' } }
  );
}

/**
 * Create mock 404 Not Found error
 */
function createMock404Error(): AxiosError {
  return createMockError(
    404,
    'Not Found',
    undefined,
    { error: { code: 'NOT_FOUND', message: 'Resource not found' } }
  );
}

/**
 * Create mock 500 Server Error
 */
function createMock500Error(): AxiosError {
  return createMockError(
    500,
    'Internal Server Error',
    undefined,
    { error: { code: 'SERVER_ERROR', message: 'Internal server error' } }
  );
}

/**
 * Create mock network error (no response from server)
 */
function createNetworkError(): AxiosError {
  const error = new Error('Network Error') as AxiosError;
  error.config = createMockConfig();
  error.isAxiosError = true;
  error.name = 'AxiosError';
  error.code = 'ERR_NETWORK';
  // No response property for network errors
  return error;
}

/**
 * Safely access response error interceptor from axios instance
 * 
 * Axios interceptor handlers are internal/private API, so we need
 * type assertion to access them in tests.
 * 
 * @param instance - Axios instance with interceptors configured
 * @returns The response error interceptor handler
 */
function getResponseErrorInterceptor(instance: AxiosInstance): {
  fulfilled: ((value: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>) | null;
  rejected: ((error: unknown) => unknown) | null;
} {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
  return (instance.interceptors.response as any)['handlers'][0];
}

// ============================================================================
// Test Suite: setupInterceptors Function
// ============================================================================

describe('setupInterceptors', () => {
  it('should be a function', () => {
    expect(typeof setupInterceptors).toBe('function');
  });

  it('should return the axios instance', () => {
    const instance = axios.create();
    const result = setupInterceptors(instance);
    expect(result).toBe(instance);
  });

  it('should attach request interceptors', () => {
    const instance = axios.create();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const initialRequestHandlers = (instance.interceptors.request as any)['handlers'].length;
    setupInterceptors(instance);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const finalRequestHandlers = (instance.interceptors.request as any)['handlers'].length;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    expect(finalRequestHandlers).toBeGreaterThan(initialRequestHandlers);
  });

  it('should attach response interceptors', () => {
    const instance = axios.create();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const initialResponseHandlers = (instance.interceptors.response as any)['handlers'].length;
    setupInterceptors(instance);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const finalResponseHandlers = (instance.interceptors.response as any)['handlers'].length;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    expect(finalResponseHandlers).toBeGreaterThan(initialResponseHandlers);
  });
});

// ============================================================================
// Test Suite: Request Interceptor
// ============================================================================

describe('Request Interceptor', () => {
  let axiosInstance: AxiosInstance;

  beforeEach(() => {
    // Create fresh axios instance for each test
    axiosInstance = axios.create({ baseURL: '/api/v1' });
    setupInterceptors(axiosInstance);
    
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Token Injection', () => {
    it('should inject Authorization header with Bearer token when token is available', async () => {
      const mockToken = 'mock-jwt-token-12345';
      vi.mocked(getAccessToken).mockReturnValue(mockToken);

      // Create a fresh instance and add capturing interceptor BEFORE setupInterceptors
      // This ensures the capturing interceptor runs AFTER onRequest (due to LIFO order)
      const testInstance = axios.create({ baseURL: '/api/v1' });
      
      let capturedConfig: InternalAxiosRequestConfig | null = null;
      testInstance.interceptors.request.use((config) => {
        capturedConfig = config;
        // Throw error to prevent actual request
        throw new Error('Request intercepted');
      });

      // Now setup interceptors - they will run BEFORE the capturing interceptor
      setupInterceptors(testInstance);

      try {
        await testInstance.get('/test');
      } catch (error) {
        // Expected to throw from interceptor
      }

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig!.headers.Authorization).toBe(`Bearer ${mockToken}`);
    });

    it('should not add Authorization header when token is missing', async () => {
      vi.mocked(getAccessToken).mockReturnValue(null);

      // Create a fresh instance and add capturing interceptor BEFORE setupInterceptors
      const testInstance = axios.create({ baseURL: '/api/v1' });
      
      let capturedConfig: InternalAxiosRequestConfig | null = null;
      testInstance.interceptors.request.use((config) => {
        capturedConfig = config;
        throw new Error('Request intercepted');
      });

      // Now setup interceptors - they will run BEFORE the capturing interceptor
      setupInterceptors(testInstance);

      try {
        await testInstance.get('/test');
      } catch (error) {
        // Expected to throw from interceptor
      }

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig!.headers.Authorization).toBeUndefined();
    });

    it('should not add Authorization header when token is empty string', async () => {
      vi.mocked(getAccessToken).mockReturnValue('');

      // Create a fresh instance and add capturing interceptor BEFORE setupInterceptors
      const testInstance = axios.create({ baseURL: '/api/v1' });
      
      let capturedConfig: InternalAxiosRequestConfig | null = null;
      testInstance.interceptors.request.use((config) => {
        capturedConfig = config;
        throw new Error('Request intercepted');
      });

      // Now setup interceptors - they will run BEFORE the capturing interceptor
      setupInterceptors(testInstance);

      try {
        await testInstance.get('/test');
      } catch (error) {
        // Expected to throw from interceptor
      }

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig!.headers.Authorization).toBeUndefined();
    });

    it('should call getAccessToken on every request', async () => {
      vi.mocked(getAccessToken).mockReturnValue('token-123');

      // Create a fresh instance and add capturing interceptor BEFORE setupInterceptors
      const testInstance = axios.create({ baseURL: '/api/v1' });
      
      testInstance.interceptors.request.use(() => {
        throw new Error('Request intercepted');
      });

      // Now setup interceptors - they will run BEFORE the capturing interceptor
      setupInterceptors(testInstance);

      try {
        await testInstance.get('/test');
      } catch (error) {
        // Expected to throw
      }

      expect(getAccessToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('Header Configuration', () => {
    it('should set default Content-Type to application/json when not present', async () => {
      vi.mocked(getAccessToken).mockReturnValue('token-123');

      // Create a fresh instance and add capturing interceptor BEFORE setupInterceptors
      const testInstance = axios.create({ baseURL: '/api/v1' });
      
      let capturedConfig: InternalAxiosRequestConfig | null = null;
      testInstance.interceptors.request.use((config) => {
        capturedConfig = config;
        throw new Error('Request intercepted');
      });

      // Now setup interceptors - they will run BEFORE the capturing interceptor
      setupInterceptors(testInstance);

      try {
        await testInstance.get('/test');
      } catch (error) {
        // Expected to throw
      }

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig!.headers['Content-Type']).toBe('application/json');
    });

    it('should preserve existing Content-Type header', async () => {
      vi.mocked(getAccessToken).mockReturnValue('token-123');
      const existingContentType = 'multipart/form-data';

      // Create a fresh instance and add capturing interceptor BEFORE setupInterceptors
      const testInstance = axios.create({ baseURL: '/api/v1' });
      
      let capturedConfig: InternalAxiosRequestConfig | null = null;
      testInstance.interceptors.request.use((config) => {
        capturedConfig = config;
        throw new Error('Request intercepted');
      });

      // Now setup interceptors - they will run BEFORE the capturing interceptor
      setupInterceptors(testInstance);

      try {
        await testInstance.post('/test', {}, {
          headers: {
            'Content-Type': existingContentType,
          },
        });
      } catch (error) {
        // Expected to throw
      }

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig!.headers['Content-Type']).toBe(existingContentType);
    });

    it('should handle multipart/form-data for file uploads', async () => {
      vi.mocked(getAccessToken).mockReturnValue('token-123');

      let capturedConfig: InternalAxiosRequestConfig | null = null;
      axiosInstance.interceptors.request.use((config) => {
        capturedConfig = config;
        throw new Error('Request intercepted');
      });

      const formData = new FormData();
      formData.append('file', new Blob(['test']));

      try {
        await axiosInstance.post('/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } catch (error) {
        // Expected to throw
      }

      expect(capturedConfig).not.toBeNull();
      expect(capturedConfig!.headers['Content-Type']).toBe('multipart/form-data');
    });
  });
});

// ============================================================================
// Test Suite: Response Success Interceptor
// ============================================================================

describe('Response Success Interceptor', () => {
  let axiosInstance: AxiosInstance;

  beforeEach(() => {
    axiosInstance = axios.create({ baseURL: '/api/v1' });
    setupInterceptors(axiosInstance);
    vi.clearAllMocks();
  });

  it('should return response with standard envelope unchanged', () => {
    const standardResponse = createMockResponse({
      success: true,
      data: { id: 1, name: 'Test Course' },
      meta: { timestamp: Date.now() },
    });

    // Manually trigger response interceptor
    const responseInterceptor = getResponseErrorInterceptor(axiosInstance);
    const result = responseInterceptor.fulfilled!(standardResponse) as AxiosResponse;

    expect(result.data).toHaveProperty('success', true);
     
    expect(result.data).toHaveProperty('data');
    expect(result.data).toHaveProperty('meta');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.data.data).toEqual({ id: 1, name: 'Test Course' });
  });

  it('should wrap non-standard response in standard envelope', () => {
    const nonStandardResponse = createMockResponse({
      id: 1,
      name: 'Test Course',
    });

    const responseInterceptor = getResponseErrorInterceptor(axiosInstance);
    const result = responseInterceptor.fulfilled!(nonStandardResponse) as AxiosResponse;

    expect(result.data).toHaveProperty('success', true);
     
    expect(result.data).toHaveProperty('data');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.data.data).toEqual({ id: 1, name: 'Test Course' });
  });

  it('should preserve response metadata in standard envelope', () => {
    const response = createMockResponse({
      success: true,
      data: { id: 1 },
      meta: { page: 1, totalPages: 5 },
    });

    const responseInterceptor = getResponseErrorInterceptor(axiosInstance);
    const result = responseInterceptor.fulfilled!(response) as AxiosResponse;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(result.data.meta).toEqual({ page: 1, totalPages: 5 });
  });

  it('should handle null response data gracefully', () => {
    const response = createMockResponse(null);

    const responseInterceptor = getResponseErrorInterceptor(axiosInstance);
    const result = responseInterceptor.fulfilled!(response) as AxiosResponse;

    // Null is not standard format, should be wrapped
    expect(result.data).toHaveProperty('success', true);
    expect(result.data).toHaveProperty('data', null);
  });

  it('should handle undefined response data gracefully', () => {
    const response = createMockResponse(undefined);

    const responseInterceptor = getResponseErrorInterceptor(axiosInstance);
    const result = responseInterceptor.fulfilled!(response) as AxiosResponse;

    // Undefined is not standard format, should be wrapped
    expect(result.data).toHaveProperty('success', true);
    expect(result.data).toHaveProperty('data', undefined);
  });
});

// ============================================================================
// Test Suite: Response Error Interceptor - 401 Unauthorized
// ============================================================================

describe('Response Error Interceptor - 401 Unauthorized', () => {
  let axiosInstance: AxiosInstance;
  let originalLocation: Location;

  beforeEach(() => {
    axiosInstance = axios.create({ baseURL: '/api/v1' });
    setupInterceptors(axiosInstance);
    vi.clearAllMocks();

    // Mock window.location to prevent actual navigation during tests
    originalLocation = window.location;
    delete (window as { location?: Location }).location;
    // Use Object.defineProperty to properly mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore window.location after each test
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('should attempt token refresh on 401 error', async () => {
    const mockError = createMock401Error();
    const newToken = 'refreshed-token-67890';
    
    vi.mocked(refreshAccessToken).mockResolvedValue(newToken);
    vi.mocked(getAccessToken).mockReturnValue('old-token');

    // Mock successful retry
    const mockSuccessResponse = createMockResponse({ success: true, data: 'test' });
    vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockSuccessResponse);

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);
    await errorInterceptor.rejected!(mockError);

    expect(refreshAccessToken).toHaveBeenCalled();
  });

  it('should retry original request with new token after successful refresh', async () => {
    const newToken = 'refreshed-token-67890';
    const mockConfig = createMockConfig({ url: '/courses', method: 'get' });
    const mockError = createMock401Error(mockConfig);
    
    vi.mocked(refreshAccessToken).mockResolvedValue(newToken);
    vi.mocked(getAccessToken).mockReturnValue('old-token');

    const mockSuccessResponse = createMockResponse({ success: true, data: 'courses' });
    const requestSpy = vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockSuccessResponse);

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);
    const result = await errorInterceptor.rejected!(mockError);

    expect(requestSpy).toHaveBeenCalledWith(
       
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({
          Authorization: `Bearer ${newToken}`,
        }),
      })
    );
    expect(result).toEqual(mockSuccessResponse);
  });

  it('should not retry if request already has _retry flag', async () => {
    const mockConfig = createMockConfig() as AxiosRequestConfigWithRetry;
    mockConfig._retry = true;
    const mockError = createMock401Error(mockConfig);

    vi.mocked(getAccessToken).mockReturnValue('token');

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

    await expect(errorInterceptor.rejected!(mockError)).rejects.toThrow();
    
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(clearTokens).toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });

  it('should set _retry flag on first 401 error', async () => {
    const mockConfig = createMockConfig() as AxiosRequestConfigWithRetry;
    const mockError = createMock401Error(mockConfig);
    const newToken = 'refreshed-token';

    vi.mocked(refreshAccessToken).mockResolvedValue(newToken);
    vi.mocked(getAccessToken).mockReturnValue('old-token');

    const mockSuccessResponse = createMockResponse({ success: true });
    vi.spyOn(axiosInstance, 'request').mockResolvedValue(mockSuccessResponse);

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);
    await errorInterceptor.rejected!(mockError);

    expect(mockConfig._retry).toBe(true);
  });

  it('should redirect to login when token refresh fails', async () => {
    const mockError = createMock401Error();
    const refreshError = new Error('Refresh failed');

    vi.mocked(refreshAccessToken).mockRejectedValue(refreshError);
    vi.mocked(getAccessToken).mockReturnValue('old-token');

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

    await expect(errorInterceptor.rejected!(mockError)).rejects.toThrow();
    
    expect(clearTokens).toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });

  it('should clear tokens on refresh failure', async () => {
    const mockError = createMock401Error();
    
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('Token expired'));
    vi.mocked(getAccessToken).mockReturnValue('old-token');

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

    await expect(errorInterceptor.rejected!(mockError)).rejects.toThrow();
    
    expect(clearTokens).toHaveBeenCalled();
  });
});

// ============================================================================
// Test Suite: Token Refresh Queue
// ============================================================================

describe('Token Refresh Queue', () => {
  let axiosInstance: AxiosInstance;
  let originalLocation: Location;

  beforeEach(() => {
    axiosInstance = axios.create({ baseURL: '/api/v1' });
    setupInterceptors(axiosInstance);
    vi.clearAllMocks();

    originalLocation = window.location;
    delete (window as { location?: Location }).location;
    // Use Object.defineProperty to properly mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore window.location after each test
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('should queue concurrent 401 requests during token refresh', async () => {
    const mockError1 = createMock401Error(createMockConfig({ url: '/request1' }));
    const mockError2 = createMock401Error(createMockConfig({ url: '/request2' }));

    let resolveRefresh: (token: string) => void;
    const refreshPromise = new Promise<string>((resolve) => {
      resolveRefresh = resolve;
    });

    vi.mocked(refreshAccessToken).mockReturnValue(refreshPromise);
    vi.mocked(getAccessToken).mockReturnValue('old-token');

    const mockResponse1 = createMockResponse({ data: 'response1' });
    const mockResponse2 = createMockResponse({ data: 'response2' });
    
    // Make the mock URL-aware to return the correct response based on the request URL
    const requestSpy = vi.spyOn(axiosInstance, 'request')
      .mockImplementation((config) => {
        if (config.url === '/request1') {
          return Promise.resolve(mockResponse1);
        } else if (config.url === '/request2') {
          return Promise.resolve(mockResponse2);
        }
        return Promise.resolve(createMockResponse({ data: 'unknown' }));
      });

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

    // Start both requests simultaneously
    const promise1 = errorInterceptor.rejected!(mockError1);
    const promise2 = errorInterceptor.rejected!(mockError2);

    // Only one refresh should be attempted initially
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);

    // Complete the refresh
    resolveRefresh!('new-token-123');

    // Wait for both promises to resolve
    const [result1, result2] = await Promise.all([promise1, promise2]);

    // Both requests should have been retried
    expect(requestSpy).toHaveBeenCalledTimes(2);
    expect(result1).toEqual(mockResponse1);
    expect(result2).toEqual(mockResponse2);
  });

  it('should process all queued requests after successful refresh', async () => {
    const errors = [
      createMock401Error(createMockConfig({ url: '/req1' })),
      createMock401Error(createMockConfig({ url: '/req2' })),
      createMock401Error(createMockConfig({ url: '/req3' })),
    ];

    let resolveRefresh: (token: string) => void;
    const refreshPromise = new Promise<string>((resolve) => {
      resolveRefresh = resolve;
    });

    vi.mocked(refreshAccessToken).mockReturnValue(refreshPromise);
    vi.mocked(getAccessToken).mockReturnValue('old-token');

    const requestSpy = vi.spyOn(axiosInstance, 'request')
      .mockResolvedValue(createMockResponse({ data: 'success' }));

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

    // Start all requests
    const promises = errors.map(error => errorInterceptor.rejected!(error));

    // Verify only one refresh attempt
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);

    // Complete refresh
    resolveRefresh!('new-token');

    // Wait for all to complete
    await Promise.all(promises);

    // All requests should have been retried
    expect(requestSpy).toHaveBeenCalledTimes(3);
  });

  it('should reject all queued requests on refresh failure', async () => {
    const errors = [
      createMock401Error(createMockConfig({ url: '/req1' })),
      createMock401Error(createMockConfig({ url: '/req2' })),
    ];

    let rejectRefresh: (error: Error) => void;
    const refreshPromise = new Promise<string>((_, reject) => {
      rejectRefresh = reject;
    });

    vi.mocked(refreshAccessToken).mockReturnValue(refreshPromise);
    vi.mocked(getAccessToken).mockReturnValue('old-token');

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

    // Start both requests
    const promises = errors.map(error => errorInterceptor.rejected!(error));

    // Fail the refresh
    rejectRefresh!(new Error('Refresh failed'));

    // All should reject
    await expect(Promise.all(promises)).rejects.toThrow();

    expect(clearTokens).toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });

  it('should handle large number of concurrent requests', async () => {
    const numRequests = 20;
    const errors = Array.from({ length: numRequests }, (_, i) =>
      createMock401Error(createMockConfig({ url: `/req${i}` }))
    );

    let resolveRefresh: (token: string) => void;
    const refreshPromise = new Promise<string>((resolve) => {
      resolveRefresh = resolve;
    });

    vi.mocked(refreshAccessToken).mockReturnValue(refreshPromise);
    vi.mocked(getAccessToken).mockReturnValue('old-token');

    const requestSpy = vi.spyOn(axiosInstance, 'request')
      .mockResolvedValue(createMockResponse({ data: 'success' }));

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

    // Start all requests
    const promises = errors.map(error => errorInterceptor.rejected!(error));

    // Verify single refresh
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);

    // Complete refresh
    resolveRefresh!('new-token');

    // Wait for all
    await Promise.all(promises);

    // All should have retried
    expect(requestSpy).toHaveBeenCalledTimes(numRequests);
  });
});

// ============================================================================
// Test Suite: Error Standardization
// ============================================================================

describe('Error Standardization', () => {
  let axiosInstance: AxiosInstance;

  beforeEach(() => {
    axiosInstance = axios.create({ baseURL: '/api/v1' });
    setupInterceptors(axiosInstance);
    vi.clearAllMocks();
  });

  describe('403 Forbidden Errors', () => {
    it('should format 403 error with permission denied message', async () => {
      const mockError = createMock403Error();

      const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

      try {
        await errorInterceptor.rejected!(mockError);
      } catch (error: unknown) {
        expect(error).toHaveProperty('customError');
        expect((error as any).customError).toMatchObject({
          message: 'You do not have permission to perform this action',
          code: 'PERMISSION_DENIED',
          status: 403,
        });
      }
    });

    it('should include error details in 403 response', async () => {
      const mockError = createMock403Error();

      const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

      try {
        await errorInterceptor.rejected!(mockError);
      } catch (error) {
        expect(error).toHaveProperty('customError');
        expect((error as any).customError).toHaveProperty('details');
      }
    });
  });

  describe('404 Not Found Errors', () => {
    it('should format 404 error with not found message', async () => {
      const mockError = createMock404Error();

      const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

      try {
        await errorInterceptor.rejected!(mockError);
      } catch (error: unknown) {
        expect(error).toHaveProperty('customError');
        expect((error as any).customError).toMatchObject({
          message: 'The requested resource was not found',
          code: 'NOT_FOUND',
          status: 404,
        });
      }
    });

    it('should include URL in 404 error details', async () => {
      const mockConfig = createMockConfig({ url: '/courses/999' });
      const mockError = createMockError(404, 'Not Found', mockConfig);

      const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

      try {
        await errorInterceptor.rejected!(mockError);
      } catch (error: unknown) {
        expect(error).toHaveProperty('customError');
        const typedError = (error as any).customError as { details: { url: string } };
        expect(typedError.details).toHaveProperty('url', '/courses/999');
      }
    });
  });

  describe('500+ Server Errors', () => {
    it('should format 500 error with server error message', async () => {
      const mockError = createMock500Error();

      const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

      try {
        await errorInterceptor.rejected!(mockError);
      } catch (error: unknown) {
        expect(error).toHaveProperty('customError');
        expect((error as any).customError).toMatchObject({
          message: 'A server error occurred. Please try again later.',
          code: 'SERVER_ERROR',
          status: 500,
        });
      }
    });

    it('should handle 503 Service Unavailable', async () => {
      const mockError = createMockError(503, 'Service Unavailable');

      const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

      try {
        await errorInterceptor.rejected!(mockError);
      } catch (error: unknown) {
        expect(error).toHaveProperty('customError');
        expect((error as any).customError).toMatchObject({
          message: 'A server error occurred. Please try again later.',
          code: 'SERVER_ERROR',
          status: 503,
        });
      }
    });

    it('should format all 5xx errors consistently', async () => {
      const statusCodes = [500, 501, 502, 503, 504];

      for (const status of statusCodes) {
        const mockError = createMockError(status, 'Server Error');
        const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

        try {
          await errorInterceptor.rejected!(mockError);
        } catch (error: unknown) {
          expect(error).toHaveProperty('customError');
          expect((error as any).customError).toMatchObject({
            code: 'SERVER_ERROR',
            status,
          });
        }
      }
    });
  });

  describe('Network Errors', () => {
    it('should format network errors with connection message', async () => {
      const mockError = createNetworkError();

      const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

      try {
        await errorInterceptor.rejected!(mockError);
      } catch (error: unknown) {
        expect(error).toHaveProperty('customError');
        expect((error as any).customError).toMatchObject({
          message: 'Network error. Please check your connection.',
          code: 'NETWORK_ERROR',
          status: 0,
        });
      }
    });

    it('should handle timeout errors', async () => {
      const mockError = new Error('timeout of 5000ms exceeded') as AxiosError;
      mockError.config = createMockConfig();
      mockError.isAxiosError = true;
      mockError.code = 'ECONNABORTED';
      mockError.name = 'AxiosError';

      const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

      try {
        await errorInterceptor.rejected!(mockError);
      } catch (error: unknown) {
        expect(error).toHaveProperty('customError');
        expect((error as any).customError).toMatchObject({
          code: 'NETWORK_ERROR',
          status: 0,
        });
      }
    });

    it('should handle DNS resolution errors', async () => {
      const mockError = new Error('getaddrinfo ENOTFOUND') as AxiosError;
      mockError.config = createMockConfig();
      mockError.isAxiosError = true;
      mockError.code = 'ENOTFOUND';
      mockError.name = 'AxiosError';

      const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

      try {
        await errorInterceptor.rejected!(mockError);
      } catch (error: unknown) {
        expect(error).toHaveProperty('customError');
        expect((error as any).customError).toMatchObject({
          code: 'NETWORK_ERROR',
          status: 0,
        });
      }
    });
  });

  describe('Standard Error Format', () => {
    it('should ensure all errors have message field', async () => {
      const errorTypes = [
        createMock403Error(),
        createMock404Error(),
        createMock500Error(),
        createNetworkError(),
      ];

      const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

      for (const error of errorTypes) {
        try {
          await errorInterceptor.rejected!(error);
        } catch (e: unknown) {
          expect(e).toHaveProperty('message');
          expect(typeof (e as { message: string }).message).toBe('string');
        }
      }
    });

    it('should ensure all errors have code field', async () => {
      const errorTypes = [
        createMock403Error(),
        createMock404Error(),
        createMock500Error(),
        createNetworkError(),
      ];

      const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

      for (const error of errorTypes) {
        try {
          await errorInterceptor.rejected!(error);
        } catch (e: unknown) {
          expect(e).toHaveProperty('customError');
          expect((e as any).customError).toHaveProperty('code');
          expect(typeof (e as any).customError.code).toBe('string');
        }
      }
    });

    it('should ensure all errors have status field', async () => {
      const errorTypes = [
        createMock403Error(),
        createMock404Error(),
        createMock500Error(),
        createNetworkError(),
      ];

      const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

      for (const error of errorTypes) {
        try {
          await errorInterceptor.rejected!(error);
        } catch (e: unknown) {
          expect(e).toHaveProperty('customError');
          expect((e as any).customError).toHaveProperty('status');
          expect(typeof (e as any).customError.status).toBe('number');
        }
      }
    });

    it('should use user-friendly error messages', async () => {
      const mockError = createMock500Error();
      const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

      try {
        await errorInterceptor.rejected!(mockError);
      } catch (error: unknown) {
        expect(error).toHaveProperty('customError');
        const message = (error as any).customError.message;
        // Should not contain technical jargon like "AxiosError" or stack traces
        expect(message).not.toMatch(/axios/i);
        expect(message).not.toMatch(/stack/i);
        expect(message.length).toBeGreaterThan(10); // Should be descriptive
      }
    });

    it('should follow error code naming conventions', async () => {
      const errorTypes = [
        createMock403Error(),
        createMock404Error(),
        createMock500Error(),
        createNetworkError(),
      ];

      const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

      for (const error of errorTypes) {
        try {
          await errorInterceptor.rejected!(error);
        } catch (e: unknown) {
          expect(e).toHaveProperty('customError');
          const code = (e as any).customError.code;
          // Should be uppercase with underscores
          expect(code).toMatch(/^[A-Z_]+$/);
        }
      }
    });
  });
});

// ============================================================================
// Test Suite: Integration Tests
// ============================================================================

describe('Interceptor Integration', () => {
  let axiosInstance: AxiosInstance;
  let originalLocation: Location;

  beforeEach(() => {
    axiosInstance = axios.create({ baseURL: '/api/v1' });
    setupInterceptors(axiosInstance);
    vi.clearAllMocks();

    originalLocation = window.location;
    delete (window as { location?: Location }).location;
    // Use Object.defineProperty to properly mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore window.location after each test
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('should inject token in request and handle successful response', async () => {
    const mockToken = 'test-token-123';
    vi.mocked(getAccessToken).mockReturnValue(mockToken);

    // Mock the adapter to simulate successful HTTP response
    const mockResponse = createMockResponse({ success: true, data: 'test' });
    const adapterSpy = vi.fn().mockResolvedValue(mockResponse);
    axiosInstance.defaults.adapter = adapterSpy;

    const response = await axiosInstance.get('/test');

    expect(getAccessToken).toHaveBeenCalled();
    expect(adapterSpy).toHaveBeenCalledWith(
       
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockToken}`
        })
      })
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(response.data.success).toBe(true);
  });

  it('should handle full 401 refresh cycle transparently', async () => {
    const oldToken = 'old-token';
    const newToken = 'new-token-refreshed';

    // First request has old token, then after refresh we'll have the new token
    vi.mocked(getAccessToken)
      .mockReturnValueOnce(oldToken)
      .mockReturnValue(newToken);
    vi.mocked(refreshAccessToken).mockResolvedValue(newToken);

    // First request fails with 401, retry succeeds
    const mock401Error = createMock401Error(createMockConfig({ url: '/test' }));
    const successResponse = createMockResponse({ success: true, data: 'data' });

    const adapterSpy = vi.fn()
      .mockRejectedValueOnce(mock401Error) // First request fails with 401
      .mockResolvedValueOnce(successResponse); // Retry succeeds with new token

    axiosInstance.defaults.adapter = adapterSpy;

    // Make the request - should fail with 401, refresh token, and retry successfully
    const response = await axiosInstance.get('/test');

    expect(refreshAccessToken).toHaveBeenCalled();
    expect(adapterSpy).toHaveBeenCalledTimes(2); // Initial request + retry
    expect(response).toEqual(successResponse);
  });

  it('should propagate errors through interceptor chain', async () => {
    vi.mocked(getAccessToken).mockReturnValue('token');

    const mockError = createMock404Error();
    vi.spyOn(axiosInstance, 'request').mockRejectedValue(mockError);

    try {
      await axiosInstance.get('/nonexistent');
    } catch (error) {
      // Error should be caught
      expect(error).toBeDefined();
    }

    // Manually test error interceptor
    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);
    
    try {
      await errorInterceptor.rejected!(mockError);
    } catch (error: unknown) {
      expect(error).toHaveProperty('customError');
      expect((error as any).customError).toMatchObject({
        code: 'NOT_FOUND',
        status: 404,
      });
    }
  });
});

// ============================================================================
// Test Suite: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  let axiosInstance: AxiosInstance;

  beforeEach(() => {
    axiosInstance = axios.create({ baseURL: '/api/v1' });
    setupInterceptors(axiosInstance);
    vi.clearAllMocks();
  });

  it('should handle undefined error config gracefully', async () => {
    const mockError = new Error('Test error') as AxiosError;
    mockError.isAxiosError = true;
    mockError.name = 'AxiosError';
    // config is undefined

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

    await expect(errorInterceptor.rejected!(mockError)).rejects.toBeDefined();
  });

  it('should handle null error response', async () => {
    const mockError = new Error('Test error') as AxiosError;
    mockError.isAxiosError = true;
    mockError.name = 'AxiosError';
    mockError.config = createMockConfig();
    mockError.response = null as unknown as AxiosResponse;

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

    try {
      await errorInterceptor.rejected!(mockError);
    } catch (error: unknown) {
      expect(error).toHaveProperty('customError');
      expect((error as any).customError).toMatchObject({
        code: 'NETWORK_ERROR',
      });
    }
  });

  it('should handle malformed error objects', async () => {
    const mockError = { message: 'Malformed' } as unknown as AxiosError;

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

    await expect(errorInterceptor.rejected!(mockError)).rejects.toBeDefined();
  });

  it('should handle missing error.config in 401 scenario', async () => {
    const mockError = createMock401Error();
    mockError.config = undefined as unknown as InternalAxiosRequestConfig;

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

    // Should not crash, should handle gracefully
    await expect(errorInterceptor.rejected!(mockError)).rejects.toBeDefined();
  });

  it('should handle missing error.response', async () => {
    const mockError = new Error('No response') as AxiosError;
    mockError.isAxiosError = true;
    mockError.name = 'AxiosError';
    mockError.config = createMockConfig();
    // response is undefined

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

    try {
      await errorInterceptor.rejected!(mockError);
    } catch (error: unknown) {
      expect(error).toHaveProperty('customError');
      expect((error as any).customError).toMatchObject({
        code: 'NETWORK_ERROR',
        status: 0,
      });
    }
  });

  it('should handle concurrent refresh with different error types', async () => {
    const error401_1 = createMock401Error(createMockConfig({ url: '/test1' }));
    const error401_2 = createMock401Error(createMockConfig({ url: '/test2' }));

    let resolveRefresh: (token: string) => void;
    const refreshPromise = new Promise<string>((resolve) => {
      resolveRefresh = resolve;
    });

    vi.mocked(refreshAccessToken).mockReturnValue(refreshPromise);
    vi.mocked(getAccessToken).mockReturnValue('old-token');

    const requestSpy = vi.spyOn(axiosInstance, 'request')
      .mockResolvedValue(createMockResponse({ data: 'success' }));

    const errorInterceptor = getResponseErrorInterceptor(axiosInstance);

    // Start both errors
    const promise1 = errorInterceptor.rejected!(error401_1);
    const promise2 = errorInterceptor.rejected!(error401_2);

    // Complete refresh
    resolveRefresh!('new-token');

    await Promise.all([promise1, promise2]);

    // Both should have been retried
    expect(requestSpy).toHaveBeenCalledTimes(2);
  });

  it('should handle empty response data', () => {
    const response = createMockResponse('');

    const responseInterceptor = getResponseErrorInterceptor(axiosInstance);
    const result = responseInterceptor.fulfilled!(response) as AxiosResponse;

    // Empty string should be wrapped
    expect(result.data).toHaveProperty('success', true);
    expect(result.data).toHaveProperty('data', '');
  });

  it('should handle array response data', () => {
    const arrayData = [{ id: 1 }, { id: 2 }];
    const response = createMockResponse(arrayData);

    const responseInterceptor = getResponseErrorInterceptor(axiosInstance);
    const result = responseInterceptor.fulfilled!(response) as AxiosResponse;

    // Arrays don't have 'success' property, should be wrapped
    expect(result.data).toHaveProperty('success', true);
     
    expect(result.data).toHaveProperty('data');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect(Array.isArray(result.data.data)).toBe(true);
  });

  it('should handle response with only success property', () => {
    const response = createMockResponse({ success: true });

    const responseInterceptor = getResponseErrorInterceptor(axiosInstance);
    const result = responseInterceptor.fulfilled!(response) as AxiosResponse;

    // Has success but no data property, should be wrapped
    expect(result.data).toHaveProperty('success', true);
     
    expect(result.data).toHaveProperty('data');
  });
});
