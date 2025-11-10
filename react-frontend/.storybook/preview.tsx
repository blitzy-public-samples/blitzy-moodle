import type { Preview } from '@storybook/react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';

import theme from '../src/styles/theme';
import customTheme from './theme';

// Define mock auth state type for type safety
interface MockAuthState {
  user: null;
  isAuthenticated: boolean;
  token: null;
}

// Create mock Redux store for stories with minimal state
// Individual stories can override this with custom state via parameters if needed
const mockStore = configureStore({
  reducer: {
    // Provide basic auth reducer for components that check authentication state
    auth: (state: MockAuthState = { user: null, isAuthenticated: false, token: null }): MockAuthState => state,
  },
});

// Create QueryClient instance with Storybook-optimized configuration
// Disables retries and sets staleTime to Infinity to avoid unnecessary API calls
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false, // Disable retries to avoid unnecessary API calls in Storybook
      staleTime: Infinity, // Treat data as always fresh to prevent refetches during story interaction
    },
    mutations: {
      retry: false, // Disable retry attempts for mutations in stories
    },
  },
});

const preview: Preview = {
  parameters: {
    // Auto-detect event handler props starting with 'on' (e.g., onClick, onChange, onSubmit)
    // These will be automatically logged in the Actions panel
    actions: { argTypesRegex: '^on[A-Z].*' },
    
    // Configure interactive controls for component props
    controls: {
      matchers: {
        color: /(background|color)$/i, // Color picker for color-related props
        date: /Date$/, // Date picker for date-related props
      },
      expanded: true, // Expand controls panel by default for easier prop manipulation
    },
    
    // Define background color options for testing components on different backgrounds
    // Useful for testing contrast, visibility, and theming behavior
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#FFFFFF' },
        { name: 'dark', value: '#121212' },
        { name: 'moodle-bg', value: '#F5F5F5' },
      ],
    },
    
    // Configure viewport presets for responsive design testing
    // Matches common device sizes for mobile, tablet, desktop, and wide displays
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: { width: '375px', height: '667px' },
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1280px', height: '720px' },
        },
        wide: {
          name: 'Wide',
          styles: { width: '1920px', height: '1080px' },
        },
      },
    },
    
    // Configure documentation theme to match Material-UI and Moodle branding
    docs: {
      theme: customTheme,
    },
  },
  
  // Global decorators applied to all stories in order
  // Each decorator wraps the story with a provider to simulate the production environment
  decorators: [
    // Material-UI theme provider with CSS baseline
    // Applies Material Design styles and the custom Moodle theme to all components
    (Story) => (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Story />
      </ThemeProvider>
    ),
    // Redux store provider
    // Makes Redux state available to components using useSelector and useDispatch
    (Story) => (
      <Provider store={mockStore}>
        <Story />
      </Provider>
    ),
    // React Query provider
    // Enables components to use useQuery and useMutation hooks for data fetching
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
    // React Router provider
    // Provides routing context for components using Link, useNavigate, useParams, etc.
    (Story) => (
      <BrowserRouter>
        <Story />
      </BrowserRouter>
    ),
  ],
};

export default preview;
