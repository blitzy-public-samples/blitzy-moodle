# LTI Activity Unit Tests

## Overview

This directory contains comprehensive unit tests for the LTI (Learning Tools Interoperability) activity module in the React frontend. The tests cover components, custom hooks, and API integration for launching external LTI tools, handling OAuth 1.0a signatures, managing grade passback, and supporting both LTI 1.1 and LTI 1.3 (LTI Advantage) standards.

### Testing Strategy

The LTI testing strategy focuses on:

- **Component Testing**: Verifying LTI tool launch UI, iframe embedding, configuration displays, and error states
- **Hook Testing**: Validating custom hooks for tool launches, grade synchronization, and OIDC authentication flows
- **API Integration**: Testing API calls for LTI parameter generation, OAuth signature creation, and grade passback with retry logic
- **Security Validation**: Ensuring OAuth signature integrity, parameter tampering detection, and secure iframe communication
- **Version Compatibility**: Separate test coverage for LTI 1.1 (OAuth 1.0a) and LTI 1.3 (OIDC/OAuth 2.0)

## Test File Structure

The test suite is organized by component, hook, and API layer:

```
lti/
├── README.md                           # This file
├── components/
│   ├── LTIView.test.tsx               # Tests for main LTI tool display component
│   ├── LTILaunchButton.test.tsx       # Tests for tool launch trigger button
│   ├── LTIConfigDisplay.test.tsx      # Tests for tool configuration viewer
│   └── LTIGradeDisplay.test.tsx       # Tests for grade passback status display
├── hooks/
│   ├── useLTI.test.ts                 # Tests for LTI tool data fetching hook
│   ├── useLTILaunch.test.ts           # Tests for tool launch initiation hook
│   └── useLTIGrade.test.ts            # Tests for grade passback hook
├── api/
│   └── ltiApi.test.ts                 # Tests for LTI API client functions
├── utils/
│   ├── fixtures.ts                    # Mock LTI data (tools, parameters, grades)
│   └── testUtils.ts                   # Helper functions for LTI test setup
└── __mocks__/
    └── handlers.ts                    # MSW handlers for LTI API endpoints
```

### Test File Descriptions

- **LTIView.test.tsx**: Tests the main component that displays LTI tool information, handles tool launches, and manages iframe embedding. Covers successful launches, error states, loading states, and grade display.

- **LTILaunchButton.test.tsx**: Tests the button component that initiates LTI tool launches. Validates OAuth signature generation, custom parameter substitution, and launch form submission.

- **LTIConfigDisplay.test.tsx**: Tests the component displaying LTI tool configuration details (tool URL, consumer key, custom parameters). Validates proper display and security of sensitive information.

- **LTIGradeDisplay.test.tsx**: Tests the component showing grade passback status. Covers successful grade sync, retry mechanisms, and error displays.

- **useLTI.test.ts**: Tests the hook for fetching LTI tool data from the API. Validates data transformation, caching behavior with React Query, and error handling.

- **useLTILaunch.test.ts**: Tests the hook for initiating tool launches. Validates OAuth signature generation, parameter encoding, and launch URL construction.

- **useLTIGrade.test.ts**: Tests the hook for grade passback functionality. Validates grade format conversion, retry logic, and synchronization state management.

- **ltiApi.test.ts**: Tests the API client functions directly. Validates correct HTTP methods, request payloads, OAuth headers, and response parsing.

## Running Tests

### Run All LTI Tests

```bash
npm test lti
```

or

```bash
npm test tests/unit/features/activities/lti
```

### Run Specific Test File

```bash
npm test LTIView.test.tsx
```

### Watch Mode (for development)

```bash
npm test lti -- --watch
```

### Generate Coverage Report

```bash
npm test lti -- --coverage
```

The coverage report will be generated in `coverage/` directory and can be viewed in HTML format:

```bash
open coverage/index.html
```

## Coverage Goals

**Target Coverage**: 90%+ across all LTI test files

### Critical Paths Requiring Full Coverage

1. **Tool Launch Flow**: 100% coverage for OAuth signature generation, parameter encoding, and launch form submission
2. **Grade Passback**: 100% coverage for grade format conversion, retry logic on failure, and success confirmations
3. **OAuth Signature Validation**: 100% coverage for HMAC-SHA1 signature generation and parameter sorting
4. **Error Handling**: Full coverage for missing parameters, invalid signatures, tool configuration errors, and network failures
5. **LTI 1.3 OIDC Flow**: Complete coverage for initiation, authentication, and token exchange

## Testing Patterns

### OAuth Signature Testing

LTI 1.1 uses OAuth 1.0a signatures. Tests must validate correct signature generation:

```typescript
import { generateOAuthSignature } from '@/features/activities/lti/utils/oauth';

describe('OAuth Signature Generation', () => {
  it('should generate valid HMAC-SHA1 signature', () => {
    const params = {
      oauth_consumer_key: 'test-key',
      oauth_timestamp: '1234567890',
      oauth_nonce: 'abc123',
      lti_message_type: 'basic-lti-launch-request',
      lti_version: 'LTI-1p0',
      resource_link_id: '123'
    };
    
    const baseString = constructBaseString('POST', 'https://tool.example.com/launch', params);
    const signature = generateOAuthSignature(baseString, 'consumer-secret', '');
    
    expect(signature).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 format
    expect(signature.length).toBeGreaterThan(20);
  });

  it('should produce different signatures for different parameters', () => {
    const params1 = { oauth_nonce: 'nonce1', oauth_timestamp: '1000' };
    const params2 = { oauth_nonce: 'nonce2', oauth_timestamp: '2000' };
    
    const sig1 = generateOAuthSignature(constructBaseString('POST', 'https://tool.example.com', params1), 'secret', '');
    const sig2 = generateOAuthSignature(constructBaseString('POST', 'https://tool.example.com', params2), 'secret', '');
    
    expect(sig1).not.toBe(sig2);
  });
});
```

### LTI Parameter Validation

Tests must ensure all required LTI parameters are present and correctly formatted:

```typescript
describe('LTI Parameter Validation', () => {
  it('should include all required LTI 1.1 parameters', async () => {
    const { result } = renderHook(() => useLTILaunch(mockLTITool.id));
    
    await act(async () => {
      await result.current.launchTool();
    });
    
    const launchParams = result.current.launchParameters;
    
    // Required OAuth parameters
    expect(launchParams).toHaveProperty('oauth_consumer_key');
    expect(launchParams).toHaveProperty('oauth_signature_method', 'HMAC-SHA1');
    expect(launchParams).toHaveProperty('oauth_timestamp');
    expect(launchParams).toHaveProperty('oauth_nonce');
    expect(launchParams).toHaveProperty('oauth_version', '1.0');
    expect(launchParams).toHaveProperty('oauth_signature');
    
    // Required LTI parameters
    expect(launchParams).toHaveProperty('lti_message_type', 'basic-lti-launch-request');
    expect(launchParams).toHaveProperty('lti_version', 'LTI-1p0');
    expect(launchParams).toHaveProperty('resource_link_id');
    expect(launchParams).toHaveProperty('user_id');
    expect(launchParams).toHaveProperty('roles');
    expect(launchParams).toHaveProperty('context_id');
  });
  
  it('should properly encode special characters in parameters', () => {
    const params = {
      lis_person_name_full: 'John O\'Brien & Associates',
      custom_course_name: 'Math 101: Algebra & Geometry'
    };
    
    const encoded = encodeParameters(params);
    
    expect(encoded['lis_person_name_full']).toBe('John%20O%27Brien%20%26%20Associates');
    expect(encoded['custom_course_name']).toBe('Math%20101%3A%20Algebra%20%26%20Geometry');
  });
});
```

### Custom Parameter Substitution

LTI supports variable substitution in custom parameters (e.g., `$User.id`, `$CourseSection.title`):

```typescript
describe('Custom Parameter Substitution', () => {
  it('should substitute user variables in custom parameters', () => {
    const customParams = {
      user_id: '$User.id',
      user_email: '$Person.email.primary',
      course_id: '$CourseSection.sourcedId'
    };
    
    const context = {
      userId: '12345',
      userEmail: 'student@example.com',
      courseId: 'MATH101'
    };
    
    const substituted = substituteCustomParameters(customParams, context);
    
    expect(substituted.user_id).toBe('12345');
    expect(substituted.user_email).toBe('student@example.com');
    expect(substituted.course_id).toBe('MATH101');
  });
  
  it('should leave unrecognized variables unchanged', () => {
    const customParams = {
      unknown: '$Unknown.variable',
      static: 'static-value'
    };
    
    const substituted = substituteCustomParameters(customParams, {});
    
    expect(substituted.unknown).toBe('$Unknown.variable');
    expect(substituted.static).toBe('static-value');
  });
});
```

### Iframe Security Testing

LTI tools are typically embedded in iframes. Tests must validate security attributes:

```typescript
describe('LTI Iframe Security', () => {
  it('should set appropriate sandbox attributes on iframe', () => {
    render(<LTIView ltiId={1} />);
    
    const iframe = screen.getByTitle(/LTI Tool/i);
    
    expect(iframe).toHaveAttribute('sandbox', 
      'allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'
    );
  });
  
  it('should use https for tool launch URLs', async () => {
    const { result } = renderHook(() => useLTILaunch(mockLTITool.id));
    
    await act(async () => {
      await result.current.launchTool();
    });
    
    expect(result.current.launchUrl).toMatch(/^https:\/\//);
  });
  
  it('should not expose sensitive data in iframe src', () => {
    render(<LTIView ltiId={1} />);
    
    const iframe = screen.getByTitle(/LTI Tool/i);
    const src = iframe.getAttribute('src');
    
    expect(src).not.toContain('oauth_signature');
    expect(src).not.toContain('consumer_secret');
  });
});
```

### Grade Format Conversion Testing

LTI grade passback requires converting between Moodle's grade format and LTI's 0.0-1.0 scale:

```typescript
describe('Grade Format Conversion', () => {
  it('should convert Moodle grade to LTI scale (0.0-1.0)', () => {
    expect(convertToLTIGrade(85, 100)).toBe(0.85);
    expect(convertToLTIGrade(42.5, 50)).toBe(0.85);
    expect(convertToLTIGrade(0, 100)).toBe(0.0);
    expect(convertToLTIGrade(100, 100)).toBe(1.0);
  });
  
  it('should handle edge cases in grade conversion', () => {
    expect(convertToLTIGrade(null, 100)).toBeNull();
    expect(convertToLTIGrade(50, 0)).toBeNull(); // Invalid: division by zero
    expect(convertToLTIGrade(-10, 100)).toBe(0.0); // Clamp negative to 0
    expect(convertToLTIGrade(110, 100)).toBe(1.0); // Clamp over 100% to 1.0
  });
  
  it('should convert LTI grade back to Moodle format', () => {
    expect(convertFromLTIGrade(0.85, 100)).toBe(85);
    expect(convertFromLTIGrade(1.0, 50)).toBe(50);
    expect(convertFromLTIGrade(0.0, 100)).toBe(0);
  });
});
```

### Error Handling Patterns

All LTI operations must handle errors gracefully:

```typescript
describe('LTI Error Handling', () => {
  it('should display error when tool launch fails', async () => {
    server.use(
      rest.post('/api/v1/lti/:id/launch', (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({
          success: false,
          error: { message: 'Tool configuration error' }
        }));
      })
    );
    
    render(<LTIView ltiId={1} />);
    
    const launchButton = screen.getByRole('button', { name: /launch tool/i });
    await userEvent.click(launchButton);
    
    await waitFor(() => {
      expect(screen.getByText(/tool configuration error/i)).toBeInTheDocument();
    });
  });
  
  it('should retry grade passback on failure', async () => {
    let attemptCount = 0;
    
    server.use(
      rest.post('/api/v1/lti/:id/grade', (req, res, ctx) => {
        attemptCount++;
        if (attemptCount < 3) {
          return res(ctx.status(503), ctx.json({ success: false }));
        }
        return res(ctx.status(200), ctx.json({ success: true }));
      })
    );
    
    const { result } = renderHook(() => useLTIGrade(1));
    
    await act(async () => {
      await result.current.syncGrade(0.85);
    });
    
    expect(attemptCount).toBe(3);
    expect(result.current.syncStatus).toBe('success');
  });
});
```

## Mock Data

### fixtures.ts

Contains mock LTI tool data, launch parameters, and grade objects:

```typescript
export const mockLTITool = {
  id: 1,
  name: 'External Tool',
  description: 'A sample LTI tool',
  toolUrl: 'https://tool.example.com/launch',
  consumerKey: 'test-consumer-key',
  customParameters: {
    user_id: '$User.id',
    course_id: '$CourseSection.sourcedId'
  },
  version: '1.1',
  gradePassbackEnabled: true
};

export const mockLTILaunchParams = {
  oauth_consumer_key: 'test-consumer-key',
  oauth_signature_method: 'HMAC-SHA1',
  oauth_timestamp: '1234567890',
  oauth_nonce: 'abc123',
  oauth_version: '1.0',
  oauth_signature: 'mock-signature',
  lti_message_type: 'basic-lti-launch-request',
  lti_version: 'LTI-1p0',
  resource_link_id: 'res-123',
  user_id: 'user-456',
  roles: 'Learner',
  context_id: 'course-789'
};
```

### testUtils.ts

Provides helper functions for test setup:

```typescript
export function setupLTITest() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  
  return {
    queryClient,
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  };
}

export function mockOAuthSignature(baseString: string, secret: string): string {
  // Mock HMAC-SHA1 signature generation for tests
  return Buffer.from(`${baseString}:${secret}`).toString('base64').substring(0, 28);
}
```

## MSW Setup

The test suite uses Mock Service Worker (MSW) to intercept API calls. LTI-specific handlers are defined in `__mocks__/handlers.ts`:

```typescript
import { rest } from 'msw';
import { mockLTITool, mockLTILaunchParams } from '../utils/fixtures';

export const ltiHandlers = [
  // Get LTI tool details
  rest.get('/api/v1/lti/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(ctx.status(200), ctx.json({
      success: true,
      data: { ...mockLTITool, id: Number(id) }
    }));
  }),
  
  // Generate launch parameters
  rest.post('/api/v1/lti/:id/launch', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({
      success: true,
      data: { launchParams: mockLTILaunchParams, launchUrl: mockLTITool.toolUrl }
    }));
  }),
  
  // Grade passback
  rest.post('/api/v1/lti/:id/grade', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({
      success: true,
      data: { gradePassedBack: true, timestamp: Date.now() }
    }));
  })
];
```

These handlers are registered in the global MSW server setup in `tests/setup.ts`.

## LTI Version Compatibility Testing

The test suite covers both LTI 1.1 and LTI 1.3 specifications with separate test cases:

### LTI 1.1 Tests

Focus on OAuth 1.0a signatures and basic launch parameters:

```typescript
describe('LTI 1.1 Tool Launch', () => {
  it('should generate OAuth 1.0a signature', () => {
    const tool = { ...mockLTITool, version: '1.1' };
    const { result } = renderHook(() => useLTILaunch(tool.id));
    
    expect(result.current.launchParameters.oauth_signature_method).toBe('HMAC-SHA1');
    expect(result.current.launchParameters.lti_version).toBe('LTI-1p0');
  });
});
```

### LTI 1.3 Tests

Focus on OIDC authentication and JWT tokens:

```typescript
describe('LTI 1.3 Tool Launch', () => {
  it('should initiate OIDC authentication flow', async () => {
    const tool = { ...mockLTITool, version: '1.3' };
    const { result } = renderHook(() => useLTILaunch(tool.id));
    
    await act(async () => {
      await result.current.launchTool();
    });
    
    expect(result.current.oidcInitiated).toBe(true);
    expect(result.current.launchParameters).toHaveProperty('id_token');
  });
  
  it('should include LTI Advantage claims in JWT', () => {
    const idToken = decodeJWT(mockLTI13Token);
    
    expect(idToken).toHaveProperty('https://purl.imsglobal.org/spec/lti/claim/message_type');
    expect(idToken).toHaveProperty('https://purl.imsglobal.org/spec/lti/claim/version', '1.3.0');
    expect(idToken).toHaveProperty('https://purl.imsglobal.org/spec/lti/claim/resource_link');
  });
});
```

## Common Test Scenarios

### 1. Successful Tool Launch

```typescript
it('should successfully launch LTI tool', async () => {
  render(<LTIView ltiId={1} />);
  
  const launchButton = screen.getByRole('button', { name: /launch tool/i });
  await userEvent.click(launchButton);
  
  await waitFor(() => {
    const iframe = screen.getByTitle(/LTI Tool/i);
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', expect.stringContaining('tool.example.com'));
  });
});
```

### 2. OAuth Signature Validation Failure

```typescript
it('should handle OAuth signature validation failure', async () => {
  server.use(
    rest.post('/api/v1/lti/:id/launch', (req, res, ctx) => {
      return res(ctx.status(401), ctx.json({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'OAuth signature validation failed' }
      }));
    })
  );
  
  render(<LTIView ltiId={1} />);
  
  const launchButton = screen.getByRole('button', { name: /launch tool/i });
  await userEvent.click(launchButton);
  
  await waitFor(() => {
    expect(screen.getByText(/signature validation failed/i)).toBeInTheDocument();
  });
});
```

### 3. Missing Required Parameters

```typescript
it('should display error for missing required parameters', async () => {
  server.use(
    rest.post('/api/v1/lti/:id/launch', (req, res, ctx) => {
      return res(ctx.status(400), ctx.json({
        success: false,
        error: { 
          code: 'MISSING_PARAMETERS', 
          message: 'Missing required parameter: resource_link_id',
          details: { missingParams: ['resource_link_id'] }
        }
      }));
    })
  );
  
  render(<LTIView ltiId={1} />);
  
  const launchButton = screen.getByRole('button', { name: /launch tool/i });
  await userEvent.click(launchButton);
  
  await waitFor(() => {
    expect(screen.getByText(/missing required parameter/i)).toBeInTheDocument();
  });
});
```

### 4. Grade Passback with Retry

```typescript
it('should retry grade passback on transient failure', async () => {
  let attemptCount = 0;
  
  server.use(
    rest.post('/api/v1/lti/:id/grade', (req, res, ctx) => {
      attemptCount++;
      if (attemptCount === 1) {
        return res(ctx.status(503), ctx.json({ success: false, error: { message: 'Service temporarily unavailable' } }));
      }
      return res(ctx.status(200), ctx.json({ success: true, data: { gradePassedBack: true } }));
    })
  );
  
  const { result } = renderHook(() => useLTIGrade(1), {
    wrapper: setupLTITest().wrapper
  });
  
  await act(async () => {
    await result.current.syncGrade(0.85);
  });
  
  await waitFor(() => {
    expect(result.current.syncStatus).toBe('success');
    expect(attemptCount).toBe(2);
  });
});
```

### 5. OIDC Initiation Flow (LTI 1.3)

```typescript
it('should complete OIDC initiation for LTI 1.3 tool', async () => {
  const lti13Tool = { ...mockLTITool, version: '1.3' };
  
  server.use(
    rest.post('/api/v1/lti/:id/oidc/initiate', (req, res, ctx) => {
      return res(ctx.status(200), ctx.json({
        success: true,
        data: {
          authorizationUrl: 'https://tool.example.com/oidc/auth',
          state: 'state-token',
          nonce: 'nonce-value'
        }
      }));
    })
  );
  
  render(<LTIView ltiId={lti13Tool.id} />);
  
  const launchButton = screen.getByRole('button', { name: /launch tool/i });
  await userEvent.click(launchButton);
  
  await waitFor(() => {
    expect(screen.getByText(/authenticating/i)).toBeInTheDocument();
  });
});
```

### 6. Deep Linking Flow (LTI 1.3)

```typescript
it('should handle deep linking content selection', async () => {
  server.use(
    rest.post('/api/v1/lti/:id/deep-link', (req, res, ctx) => {
      return res(ctx.status(200), ctx.json({
        success: true,
        data: {
          contentItems: [
            { type: 'link', url: 'https://content.example.com/item1', title: 'Content Item 1' }
          ]
        }
      }));
    })
  );
  
  render(<LTIView ltiId={1} deepLinking={true} />);
  
  await waitFor(() => {
    expect(screen.getByText(/select content/i)).toBeInTheDocument();
  });
});
```

### 7. Tool Configuration Errors

```typescript
it('should display error for misconfigured tool', async () => {
  server.use(
    rest.get('/api/v1/lti/:id', (req, res, ctx) => {
      return res(ctx.status(200), ctx.json({
        success: true,
        data: { ...mockLTITool, toolUrl: null, consumerKey: null }
      }));
    })
  );
  
  render(<LTIView ltiId={1} />);
  
  await waitFor(() => {
    expect(screen.getByText(/tool not properly configured/i)).toBeInTheDocument();
  });
});
```

## Adding New Tests

### File Naming Conventions

- Component tests: `ComponentName.test.tsx`
- Hook tests: `useHookName.test.ts`
- API tests: `apiModule.test.ts`
- Place tests in the same directory structure as source files

### Test Structure

Follow the Arrange-Act-Assert pattern:

```typescript
describe('ComponentName', () => {
  // Setup common to all tests
  beforeEach(() => {
    // Reset state, clear mocks, etc.
  });
  
  describe('Feature or Behavior', () => {
    it('should do something specific', async () => {
      // Arrange: Set up test data and mocks
      const mockData = { /* ... */ };
      
      // Act: Perform the action being tested
      render(<Component data={mockData} />);
      await userEvent.click(screen.getByRole('button'));
      
      // Assert: Verify expected outcomes
      await waitFor(() => {
        expect(screen.getByText(/expected result/i)).toBeInTheDocument();
      });
    });
  });
});
```

### Mock Data Creation

Store reusable mock data in `fixtures.ts`:

```typescript
export const mockLTIToolWithGrading = {
  ...mockLTITool,
  gradePassbackEnabled: true,
  outcomeServiceUrl: 'https://tool.example.com/outcomes'
};
```

### Assertion Patterns

Use descriptive matchers:

```typescript
// Good: Specific and clear
expect(screen.getByRole('button', { name: /launch tool/i })).toBeEnabled();

// Avoid: Too generic
expect(screen.getByRole('button')).toBeTruthy();

// Good: Test user-facing behavior
expect(screen.getByText(/grade successfully synced/i)).toBeInTheDocument();

// Avoid: Test implementation details
expect(component.state.gradesSynced).toBe(true);
```

## Debugging Tips

### Common Test Failures

#### OAuth Signature Mismatches

**Issue**: Signature validation fails in tests.

**Solution**: Ensure parameter sorting is consistent:

```typescript
// Parameters must be sorted alphabetically before signature generation
const sortedParams = Object.keys(params)
  .sort()
  .reduce((acc, key) => ({ ...acc, [key]: params[key] }), {});
```

#### Parameter Encoding Errors

**Issue**: Special characters in parameters cause launch failures.

**Solution**: Use proper URL encoding:

```typescript
// Correct: Encode parameter values
const encoded = encodeURIComponent(value);

// Incorrect: Don't use encodeURI (encodes differently)
const wrong = encodeURI(value);
```

#### Timing Issues in Async Tests

**Issue**: Tests fail intermittently with "element not found" errors.

**Solution**: Always use `waitFor` for async operations:

```typescript
// Good: Wait for async state changes
await waitFor(() => {
  expect(screen.getByText(/loaded/i)).toBeInTheDocument();
});

// Avoid: Don't expect immediate results
expect(screen.getByText(/loaded/i)).toBeInTheDocument(); // May fail
```

#### Mock Server Not Intercepting Requests

**Issue**: Real API calls are being made instead of mocked responses.

**Solution**: Verify MSW server is started and handlers are registered:

```typescript
// In tests/setup.ts
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Debugging Tools

**Enable Verbose Logging**:

```bash
DEBUG=msw npm test lti
```

**View React Query DevTools** (in browser during test development):

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Add to test wrapper
<QueryClientProvider client={queryClient}>
  {children}
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

**Inspect Rendered Component**:

```typescript
import { screen, debug } from '@testing-library/react';

// Print entire DOM
debug();

// Print specific element
debug(screen.getByRole('button'));
```

## References

### LTI Specifications

- [IMS LTI 1.1 Core Specification](https://www.imsglobal.org/specs/ltiv1p1/implementation-guide)
- [IMS LTI 1.3 Core Specification](https://www.imsglobal.org/spec/lti/v1p3/)
- [LTI Advantage Complete Specification](https://www.imsglobal.org/spec/lti/v1p3/impl)
- [OAuth 1.0a Specification](https://oauth.net/core/1.0a/)
- [LTI Basic Outcomes Service](https://www.imsglobal.org/spec/lti-bo/v1p1)

### Moodle LTI Documentation

- [Moodle LTI Documentation](https://docs.moodle.org/en/External_tool)
- [Moodle LTI Grade Passback](https://docs.moodle.org/en/External_tool_settings#Grade_passback)
- [Moodle LTI Custom Parameters](https://docs.moodle.org/en/External_tool_settings#Custom_parameters)

### Testing Resources

- [React Testing Library Documentation](https://testing-library.com/react)
- [Vitest Documentation](https://vitest.dev/)
- [MSW Documentation](https://mswjs.io/)
- [Testing React Hooks](https://react-hooks-testing-library.com/)

---

**Last Updated**: 2024  
**Maintained By**: Moodle React Frontend Team
