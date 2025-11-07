# ADR 0003: Material-UI v5 Component Library Selection

## Status

ACCEPTED

## Context

The React frontend refactoring requires a comprehensive UI component library to ensure:
- Visual consistency across all interfaces
- Accessibility compliance (WCAG 2.1 AA)
- Responsive design with mobile support
- Theming capability (light/dark modes)
- Extensive component coverage (forms, tables, modals, navigation, etc.)
- Strong TypeScript support
- Active maintenance and community support

Moodle's existing PHP interface uses Bootstrap 4 with custom styling. The new React frontend needs a modern component library that:
- Provides out-of-box accessibility
- Supports extensive customization via theming
- Offers comprehensive documentation
- Has strong TypeScript definitions
- Maintains consistent design language
- Reduces custom CSS requirements

The library must cover all use cases from the Agent Action Plan: complex forms (course editing, user management), data tables (gradebook, user lists), navigation (sidebar, breadcrumbs), feedback (toasts, modals, alerts), and activity-specific components.

## Decision

We will use **Material-UI v5 (MUI)** as the EXCLUSIVE UI component library for the entire React frontend:

1. **Exclusive Usage**:
   - ALL UI components must use or extend MUI components
   - No mixing with other UI libraries (Bootstrap, Ant Design, Chakra UI, etc.)
   - Custom components built on top of MUI primitives
   - MUI's styling solution (@emotion) used for custom styles

2. **Theming Strategy**:
   - Single centralized theme configuration in `src/styles/theme.ts`
   - Support both light and dark modes via MUI theme switching
   - Custom color palette matching Moodle brand colors
   - Consistent spacing, typography, and breakpoints
   - Theme customization via theme provider

3. **Component Usage Patterns**:
   - Use MUI components directly where possible (Button, TextField, Card, etc.)
   - Extend MUI components with custom props/styles for domain-specific needs
   - Build composite components from MUI primitives (CourseCard from Card + CardContent + Button)
   - Use MUI's sx prop for component-specific styling
   - Use styled() for reusable styled components

4. **Responsive Design**:
   - Use MUI's breakpoint system (xs, sm, md, lg, xl)
   - Responsive props and sx prop for mobile-first design
   - Grid and Stack components for layout
   - Hidden/Visible components for conditional rendering

5. **Accessibility**:
   - Leverage MUI's built-in accessibility features
   - All interactive elements keyboard accessible
   - Proper ARIA labels and roles
   - Focus management for modals and drawers
   - Screen reader support

6. **TypeScript Integration**:
   - Full TypeScript support with strict types
   - Custom theme type definitions
   - Component prop interfaces
   - Type-safe styled components

## Consequences

**Positive**:
- **Comprehensive Components**: 60+ components covering all use cases
- **Built-in Accessibility**: WCAG 2.1 AA compliant out of the box
- **Theming System**: Powerful customization without compromising consistency
- **TypeScript Support**: Excellent type definitions and IDE autocomplete
- **Active Community**: Large community, frequent updates, extensive documentation
- **Dark Mode**: Built-in theme switching with CSS variables
- **Responsive**: Mobile-first design with breakpoint system
- **Tree Shaking**: Only used components included in bundle
- **Icon Library**: @mui/icons-material with 2000+ Material Design icons
- **Data Grid**: Professional data table with sorting, filtering, pagination

**Negative**:
- **Bundle Size**: MUI core is ~85KB gzipped (acceptable for benefits)
- **Learning Curve**: Developers must learn MUI patterns and theming system
- **Design Language**: Material Design may not match Moodle's existing design
- **CSS-in-JS**: @emotion styling solution different from traditional CSS
- **Customization Limits**: Some components difficult to heavily customize

**Trade-offs**:
- Larger bundle size vs comprehensive component coverage (acceptable trade-off)
- Material Design opinion vs complete design freedom (benefit: consistency)
- MUI patterns vs developer familiarity (mitigated by documentation)

## Alternatives Considered

**Alternative 1: Ant Design**
- Popular React UI library with extensive components
- REJECTED: Less TypeScript-friendly than MUI, weaker theming system
- Bundle size larger (~100KB gzipped)
- Less flexible customization

**Alternative 2: Chakra UI**
- Modern UI library with excellent developer experience
- REJECTED: Smaller component library, less data grid support
- Newer library with smaller community
- Missing some enterprise components (advanced DataGrid)

**Alternative 3: React Bootstrap**
- React implementation of Bootstrap
- REJECTED: Would maintain Bootstrap dependency, less modern design
- Weaker TypeScript support
- Less sophisticated theming system

**Alternative 4: Headless UI + Tailwind CSS**
- Unstyled components with utility-first CSS
- REJECTED: Requires building all visual styles from scratch
- More custom CSS code to maintain
- Accessibility features need manual implementation

**Alternative 5: Build Custom Component Library**
- Create bespoke component library from scratch
- REJECTED: Massive development effort, reinventing the wheel
- Accessibility requires extensive expertise and testing
- Maintenance burden too high for this project

## Implementation Guidelines

**Theme Configuration**:
```typescript
// src/styles/theme.ts
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#0f6cbf', // Moodle blue
      light: '#4d9fd9',
      dark: '#0a4a87'
    },
    secondary: {
      main: '#f98012', // Moodle orange
      light: '#ffa042',
      dark: '#c65000'
    },
    mode: 'light' // Switchable to 'dark'
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif'
  },
  spacing: 8, // 8px base spacing unit
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920
    }
  }
});
```

**Component Usage**:
```typescript
import { Button, Card, CardContent, Typography } from '@mui/material';

function CourseCard({ course }) {
  return (
    <Card sx={{ maxWidth: 345 }}>
      <CardContent>
        <Typography variant="h5" component="h2">
          {course.fullname}
        </Typography>
        <Button variant="contained" color="primary">
          View Course
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Custom Styling**:
```typescript
import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

const StyledBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius
}));
```

## Migration from Bootstrap

- Existing Bootstrap classes in PHP pages NOT affected
- React components use MUI exclusively
- No Bootstrap CSS loaded in React app
- Gradual transition as features move to React

## References

- Agent Action Plan Section 0.7: Material-UI Consistency Requirements
- Agent Action Plan Section 0.1: Component Library Standards
- Material-UI v5 Documentation: https://mui.com/
- Implementation: `react-frontend/src/styles/theme.ts`, `react-frontend/src/components/`
