/**
 * Environment Configuration Module
 * 
 * This module provides type-safe access to Vite environment variables and runtime configuration.
 * All configuration values are immutable and validated on application startup.
 * 
 * Environment variables are prefixed with VITE_ to be exposed to the client.
 * Reference: Moodle's config-dist.php for configuration patterns adapted to modern React/Vite approach.
 * 
 * @module config/env
 */

/**
 * Extended ImportMetaEnv interface to include all custom Vite environment variables.
 * All variables are readonly strings that must be parsed/converted to appropriate types.
 */
interface ImportMetaEnv {
  // API Configuration
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TIMEOUT: string;
  
  // JWT Configuration
  readonly VITE_JWT_ACCESS_TOKEN_EXPIRY: string;
  readonly VITE_JWT_REFRESH_TOKEN_EXPIRY: string;
  
  // Feature Flags
  readonly VITE_ENABLE_FEATURE_DASHBOARD: string;
  readonly VITE_ENABLE_FEATURE_COURSES: string;
  readonly VITE_ENABLE_FEATURE_ASSIGNMENTS: string;
  readonly VITE_ENABLE_FEATURE_QUIZZES: string;
  readonly VITE_ENABLE_FEATURE_GRADEBOOK: string;
  readonly VITE_ENABLE_FEATURE_FORUMS: string;
  readonly VITE_ENABLE_FEATURE_MESSAGING: string;
  
  // Application Configuration
  readonly VITE_APP_TITLE: string;
  readonly VITE_LOG_LEVEL: string;
  
  // Vite built-in variables
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

/**
 * Extend ImportMeta interface to include typed env property
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Retrieves an environment variable as a string with a default fallback value.
 * 
 * @param key - The environment variable key to retrieve
 * @param defaultValue - The default value to return if the variable is undefined or empty
 * @returns The environment variable value or the default value
 * 
 * @example
 * ```typescript
 * const apiUrl = getEnvVar('VITE_API_BASE_URL', '/api/v1');
 * ```
 */
export function getEnvVar(key: string, defaultValue: string): string {
  const value = import.meta.env[key];
  
  // Return default if undefined, null, or empty string
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  
  // Convert to string if not already
  return String(value);
}

/**
 * Retrieves an environment variable as a boolean with a default fallback value.
 * Supports multiple boolean representations: 'true', 'false', '1', '0', 'yes', 'no'.
 * 
 * @param key - The environment variable key to retrieve
 * @param defaultValue - The default value to return if the variable is undefined or invalid
 * @returns The parsed boolean value or the default value
 * 
 * @example
 * ```typescript
 * const isEnabled = getEnvBoolean('VITE_ENABLE_FEATURE_DASHBOARD', true);
 * ```
 */
export function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = import.meta.env[key];
  
  // Return default if undefined or null
  if (value === undefined || value === null) {
    return defaultValue;
  }
  
  // Convert to string and normalize
  const stringValue = String(value).toLowerCase().trim();
  
  // Parse boolean representations
  if (stringValue === 'true' || stringValue === '1' || stringValue === 'yes') {
    return true;
  }
  
  if (stringValue === 'false' || stringValue === '0' || stringValue === 'no' || stringValue === '') {
    return false;
  }
  
  // If unrecognized value, log warning and return default
  if (import.meta.env.DEV) {
    console.warn(`Invalid boolean value for ${key}: "${value}". Using default: ${defaultValue}`);
  }
  
  return defaultValue;
}

/**
 * Retrieves an environment variable as a number with a default fallback value.
 * Validates that the parsed value is a valid number.
 * 
 * @param key - The environment variable key to retrieve
 * @param defaultValue - The default value to return if the variable is undefined or invalid
 * @returns The parsed numeric value or the default value
 * 
 * @example
 * ```typescript
 * const timeout = getEnvNumber('VITE_API_TIMEOUT', 30000);
 * ```
 */
export function getEnvNumber(key: string, defaultValue: number): number {
  const value = import.meta.env[key];
  
  // Return default if undefined or null
  if (value === undefined || value === null) {
    return defaultValue;
  }
  
  // Convert to string and parse
  const stringValue = String(value).trim();
  
  // Return default if empty string
  if (stringValue === '') {
    return defaultValue;
  }
  
  // Parse to number
  const parsedValue = Number(stringValue);
  
  // Validate that it's a valid number (not NaN or Infinity)
  if (isNaN(parsedValue) || !isFinite(parsedValue)) {
    if (import.meta.env.DEV) {
      console.warn(`Invalid numeric value for ${key}: "${value}". Using default: ${defaultValue}`);
    }
    return defaultValue;
  }
  
  return parsedValue;
}

/**
 * API Configuration
 * 
 * Configuration for all API requests including base URL, timeout, and credentials handling.
 * These values are used to configure the Axios instance in the API client.
 * 
 * @property baseURL - The base URL for all API requests (default: '/api/v1')
 * @property timeout - Request timeout in milliseconds (default: 30000ms / 30 seconds)
 * @property withCredentials - Whether to send credentials (cookies) with requests (default: true)
 */
export const apiConfig = {
  baseURL: getEnvVar('VITE_API_BASE_URL', '/api/v1'),
  timeout: getEnvNumber('VITE_API_TIMEOUT', 30000),
  withCredentials: true
} as const;

/**
 * JWT Configuration
 * 
 * Configuration for JSON Web Token authentication including token expiration times
 * and storage method. These values align with backend JWT token generation settings.
 * 
 * @property accessTokenExpiry - Access token lifetime in seconds (default: 3600s / 1 hour)
 * @property refreshTokenExpiry - Refresh token lifetime in seconds (default: 604800s / 7 days)
 * @property tokenStorageMethod - Where to store tokens: 'cookie' is recommended for security
 */
export const jwtConfig = {
  accessTokenExpiry: getEnvNumber('VITE_JWT_ACCESS_TOKEN_EXPIRY', 3600),
  refreshTokenExpiry: getEnvNumber('VITE_JWT_REFRESH_TOKEN_EXPIRY', 604800),
  tokenStorageMethod: 'cookie' as const
} as const;

/**
 * Feature Flags Configuration
 * 
 * Controls which features are enabled in the application for gradual rollout.
 * Administrators can enable/disable features without code deployment.
 * These flags must align with backend feature flags in PHP config.php.
 * 
 * @property dashboard - Enable React dashboard interface
 * @property courses - Enable React course catalog and detail pages
 * @property assignments - Enable React assignment submission and grading
 * @property quizzes - Enable React quiz taking interface
 * @property gradebook - Enable React gradebook views
 * @property forums - Enable React forum discussions
 * @property messaging - Enable React messaging and notifications
 */
export const featureFlags = {
  dashboard: getEnvBoolean('VITE_ENABLE_FEATURE_DASHBOARD', true),
  courses: getEnvBoolean('VITE_ENABLE_FEATURE_COURSES', true),
  assignments: getEnvBoolean('VITE_ENABLE_FEATURE_ASSIGNMENTS', true),
  quizzes: getEnvBoolean('VITE_ENABLE_FEATURE_QUIZZES', true),
  gradebook: getEnvBoolean('VITE_ENABLE_FEATURE_GRADEBOOK', true),
  forums: getEnvBoolean('VITE_ENABLE_FEATURE_FORUMS', true),
  messaging: getEnvBoolean('VITE_ENABLE_FEATURE_MESSAGING', true)
} as const;

/**
 * Application Configuration
 * 
 * General application settings including title, environment detection, and logging.
 * 
 * @property title - Application title displayed in browser tab and header
 * @property isDevelopment - True when running in development mode
 * @property isProduction - True when running in production mode
 * @property mode - The current Vite mode (e.g., 'development', 'production', 'staging')
 * @property logLevel - Logging level: 'debug', 'info', 'warn', 'error'
 */
export const appConfig = {
  title: getEnvVar('VITE_APP_TITLE', 'Moodle LMS'),
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  mode: import.meta.env.MODE,
  logLevel: getEnvVar('VITE_LOG_LEVEL', 'info')
} as const;

/**
 * Validates all environment variables and configuration settings.
 * Should be called during application initialization to fail fast on misconfiguration.
 * 
 * In development mode, logs warnings for missing optional variables.
 * In production mode, throws errors for missing critical variables.
 * 
 * @throws {Error} When critical environment variables are missing or invalid in production
 * 
 * @example
 * ```typescript
 * // In main.tsx
 * validateEnvironment();
 * ```
 */
export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate API base URL format
  if (apiConfig.baseURL) {
    // Check if it's a valid URL path or full URL
    const urlPattern = /^(\/[\w/-]*|https?:\/\/.+)$/;
    if (!urlPattern.test(apiConfig.baseURL)) {
      errors.push(`Invalid API base URL format: "${apiConfig.baseURL}". Must be a path like "/api/v1" or full URL like "https://api.example.com"`);
    }
  } else {
    warnings.push('API base URL is empty. Using default "/api/v1"');
  }
  
  // Validate API timeout is reasonable (between 1 second and 5 minutes)
  if (apiConfig.timeout < 1000) {
    warnings.push(`API timeout is very low: ${apiConfig.timeout}ms. Recommended minimum is 1000ms.`);
  } else if (apiConfig.timeout > 300000) {
    warnings.push(`API timeout is very high: ${apiConfig.timeout}ms. Recommended maximum is 300000ms (5 minutes).`);
  }
  
  // Validate JWT token expiry times
  if (jwtConfig.accessTokenExpiry < 300) {
    warnings.push(`Access token expiry is very short: ${jwtConfig.accessTokenExpiry}s. Recommended minimum is 300s (5 minutes).`);
  }
  
  if (jwtConfig.refreshTokenExpiry < jwtConfig.accessTokenExpiry) {
    errors.push(`Refresh token expiry (${jwtConfig.refreshTokenExpiry}s) must be greater than access token expiry (${jwtConfig.accessTokenExpiry}s).`);
  }
  
  // Validate log level
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(appConfig.logLevel)) {
    warnings.push(`Invalid log level: "${appConfig.logLevel}". Valid values are: ${validLogLevels.join(', ')}. Using "info".`);
  }
  
  // Validate at least one feature is enabled
  const enabledFeatures = Object.entries(featureFlags).filter(([_, enabled]) => enabled);
  if (enabledFeatures.length === 0) {
    warnings.push('No features are enabled. The application may not function correctly.');
  }
  
  // In production, critical errors should prevent application startup
  if (appConfig.isProduction && errors.length > 0) {
    const errorMessage = 'Environment validation failed:\n' + errors.map(e => `  - ${e}`).join('\n');
    throw new Error(errorMessage);
  }
  
  // Log all errors and warnings in development
  if (appConfig.isDevelopment) {
    if (errors.length > 0) {
      console.error('Environment configuration errors:');
      errors.forEach(error => console.error(`  ❌ ${error}`));
    }
    
    if (warnings.length > 0) {
      console.warn('Environment configuration warnings:');
      warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`));
    }
    
    if (errors.length === 0 && warnings.length === 0) {
      console.info('✅ Environment configuration validated successfully');
      console.info('Configuration summary:');
      console.info(`  - Environment: ${appConfig.mode}`);
      console.info(`  - API Base URL: ${apiConfig.baseURL}`);
      console.info(`  - API Timeout: ${apiConfig.timeout}ms`);
      console.info(`  - Access Token Expiry: ${jwtConfig.accessTokenExpiry}s`);
      console.info(`  - Refresh Token Expiry: ${jwtConfig.refreshTokenExpiry}s`);
      console.info(`  - Enabled Features: ${enabledFeatures.map(([name]) => name).join(', ')}`);
    }
  }
}
