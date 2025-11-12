/**
 * Redux Store Configuration
 *
 * Central Redux store using Redux Toolkit for global application state.
 * Configures middleware, dev tools, and combines all feature slices.
 *
 * @module app/store
 */

import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

// ============================================================================
// Store Configuration
// ============================================================================

/**
 * Redux Store
 *
 * Manages global application state including:
 * - Authentication state (user, tokens, loading)
 * - Additional feature slices will be added as they are implemented
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serializable check
        ignoredActions: ['auth/loginSuccess'],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['meta.arg', 'payload.timestamp'],
        // Ignore these paths in the state
        ignoredPaths: ['auth.tokens'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// ============================================================================
// TypeScript Types
// ============================================================================

/**
 * Root state type inferred from store
 */
export type RootState = ReturnType<typeof store.getState>;

/**
 * Dispatch type inferred from store
 */
export type AppDispatch = typeof store.dispatch;

export default store;
