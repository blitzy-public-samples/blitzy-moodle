# ADR 0007: TypeScript Strict Mode Enforcement

## Status
ACCEPTED

## Context
The React frontend involves 320+ component files, 127 API integrations, complex state management, and intricate data flows. JavaScript's dynamic typing makes it difficult to:
- Catch bugs at compile time
- Understand component APIs without reading implementation
- Refactor code safely
- Maintain large codebases
- Onboard new developers

**TypeScript Benefits**:
- Compile-time type checking prevents runtime errors
- IDE autocomplete and IntelliSense
- Self-documenting code via type signatures
- Safe refactoring with rename/find-all-references
- Better collaboration through explicit contracts

**Strict Mode Importance**:
TypeScript's default mode is lenient, allowing:
- Implicit `any` types (defeats type safety)
- Nullable values without checks
- Unchecked index access
- Weak type conversions

Strict mode enables all safety checks, catching bugs that would otherwise slip through.

The refactoring creates a greenfield React codebase - a perfect opportunity to enforce strict typing from day one without migration burden.

## Decision
We will enforce **TypeScript Strict Mode** across the entire React frontend:

1. **tsconfig.json Strict Configuration**:
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true,
       "strictFunctionTypes": true,
       "strictBindCallApply": true,
       "strictPropertyInitialization": true,
       "noImplicitThis": true,
       "alwaysStrict": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true,
       "noImplicitReturns": true,
       "noFallthroughCasesInSwitch": true
     }
   }
   ```

2. **Zero 'any' Types in Production**:
   - `any` type PROHIBITED in all production code
   - Use `unknown` for truly unknown types (requires type guards)
   - Use generic types for flexible but type-safe code
   - ESLint rule enforces: `@typescript-eslint/no-explicit-any: error`

3. **Component Prop Interfaces (Mandatory)**:
   ```typescript
   // ✅ CORRECT: Explicit interface
   interface CourseCardProps {
     course: Course;
     onEnroll: (courseId: number) => void;
     isEnrolled?: boolean;
   }
   
   function CourseCard({ course, onEnroll, isEnrolled = false }: CourseCardProps) {
     // Implementation
   }
   
   // ❌ WRONG: No prop types
   function CourseCard(props) {
     // TypeScript error
   }
   ```

4. **API Response Type Definitions (Mandatory)**:
   ```typescript
   // Define response shapes
   interface Course {
     id: number;
     fullname: string;
     shortname: string;
     summary: string;
     startdate: number;
     enddate: number;
   }
   
   // Type-safe API call
   async function fetchCourse(id: number): Promise<Course> {
     const response = await apiClient.get<ApiResponse<Course>>(`/courses/${id}`);
     return response.data.data;
   }
   
   // React Query hook with types
   function useCourse(id: number) {
     return useQuery<Course, ApiError>({
       queryKey: ['courses', id],
       queryFn: () => fetchCourse(id)
     });
   }
   ```

5. **Type Inference Preference**:
   - Prefer type inference where obvious
   - Explicit types for public APIs, component props, function returns
   - Generic types for reusable utilities
   ```typescript
   // Good: Inference for local variables
   const courses = await fetchCourses();  // Type inferred as Course[]
   
   // Good: Explicit for function signatures
   function enrollUser(userId: number, courseId: number): Promise<void> {
     // Implementation
   }
   ```

6. **Null Safety**:
   - Use optional chaining: `user?.email`
   - Use nullish coalescing: `user?.name ?? 'Anonymous'`
   - Explicitly handle null/undefined cases
   - Avoid non-null assertions (!) except when guaranteed safe

7. **ESLint TypeScript Rules**:
   ```json
   {
     "rules": {
       "@typescript-eslint/no-explicit-any": "error",
       "@typescript-eslint/no-unused-vars": "error",
       "@typescript-eslint/explicit-function-return-type": "warn",
       "@typescript-eslint/explicit-module-boundary-types": "warn",
       "@typescript-eslint/no-non-null-assertion": "warn"
     }
   }
   ```

## Consequences

**Positive**:
- **Compile-Time Error Detection**: Catch bugs before runtime
- **IDE Support**: Excellent autocomplete, navigation, refactoring
- **Self-Documenting**: Type signatures serve as inline documentation
- **Safe Refactoring**: Rename and move code with confidence
- **API Contract Enforcement**: API response changes cause compile errors
- **Reduced Testing Burden**: Type checker eliminates entire classes of bugs
- **Better Collaboration**: Explicit types clarify intent
- **Easier Onboarding**: New developers understand code faster

**Negative**:
- **Initial Learning Curve**: Developers must learn TypeScript advanced types
- **More Code**: Type definitions add lines of code
- **Compilation Time**: TypeScript compilation adds build time (~5-10 seconds)
- **Generic Complexity**: Generic types can be hard to understand

**Trade-offs**:
- More upfront typing effort vs fewer runtime bugs (clear benefit)
- Compilation time vs type safety (acceptable overhead)
- Learning curve vs long-term maintainability (investment pays off)

## Alternatives Considered

**Alternative 1: JavaScript with JSDoc**
- Use JavaScript with JSDoc type comments
- REJECTED: JSDoc not enforced at compile time, easy to ignore
- Weaker type inference and IDE support
- No strict null checks

**Alternative 2: TypeScript Non-Strict Mode**
- Use TypeScript but allow lenient typing
- REJECTED: Defeats purpose of TypeScript, allows implicit any
- False sense of security, bugs still slip through
- Harder to migrate to strict mode later

**Alternative 3: Gradual TypeScript Adoption**
- Start with JavaScript, gradually add TypeScript
- REJECTED: Greenfield project doesn't need gradual migration
- Mixed codebase reduces benefits
- Creates technical debt from day one

**Alternative 4: Flow (Facebook's Type System)**
- Use Flow instead of TypeScript
- REJECTED: Smaller community, less library support
- TypeScript is industry standard
- Better IDE integration and tooling

## Implementation Guidelines

**Type Organization**:
```
react-frontend/src/
├── types/
│   ├── api.ts          # API response envelope types
│   ├── entities.ts     # Domain entity types (Course, User, Assignment)
│   ├── common.ts       # Shared utility types
│   └── errors.ts       # Error types
├── features/
│   └── courses/
│       └── types/
│           └── course.types.ts  # Feature-specific types
```

**Common Type Patterns**:
```typescript
// Discriminated unions for state
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

// Utility types
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

// API response wrapper
interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    pagination?: PaginationMeta;
  };
}

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

**Type Guards**:
```typescript
function isCourse(obj: unknown): obj is Course {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'fullname' in obj
  );
}

// Usage
const data = await fetchData();
if (isCourse(data)) {
  console.log(data.fullname);  // Type-safe
}
```

**React Component Patterns**:
```typescript
// Props interface
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

// Component with explicit return type
const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  loading = false,
  children,
  ...props 
}) => {
  return <button className={variant} disabled={loading} {...props}>{children}</button>;
};
```

## Code Review Checklist

- [ ] No `any` types in production code
- [ ] All component props have explicit interfaces
- [ ] All API responses have type definitions
- [ ] Public functions have explicit return types
- [ ] Null checks present where values may be undefined
- [ ] Type guards used for runtime type checking
- [ ] Generic types used where appropriate
- [ ] No non-null assertions (!) without justification
- [ ] ESLint passes with zero warnings

## Migration from Existing Patterns

This is a greenfield project, so no migration needed. However, when referencing PHP code:

```typescript
// PHP function signature
// function get_course(int $id): stdClass

// TypeScript equivalent
interface Course {
  id: number;
  fullname: string;
  // Map all PHP object properties
}

async function getCourse(id: number): Promise<Course> {
  // Type-safe implementation
}
```

## Performance Considerations

- TypeScript compiled away at build time (zero runtime overhead)
- Compilation adds ~5-10 seconds to build (acceptable)
- Development mode uses esbuild for fast recompilation
- Production build fully type-checked

## Training Resources

- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/
- React TypeScript Cheatsheet: https://react-typescript-cheatsheet.netlify.app/
- Internal type patterns documentation
- Code examples in existing components

## References
- Agent Action Plan Section 0.7: TypeScript Strict Mode Requirements
- Agent Action Plan Section 0.1: Component Development Standards
- Implementation: `react-frontend/tsconfig.json`, `react-frontend/.eslintrc.cjs`
