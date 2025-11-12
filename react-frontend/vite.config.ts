import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // React plugin configuration with automatic JSX runtime for React 18
  plugins: [
    react({
      // Use the automatic JSX runtime (React 17+)
      jsxRuntime: 'automatic',
      // Babel configuration for additional transformations if needed
      babel: {
        plugins: [],
      },
    }),
  ],

  // Module resolution configuration
  resolve: {
    // Path aliases for cleaner imports
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Development server configuration
  server: {
    // Port for development server
    port: 5173,
    // Don't fail if port is already in use, find next available port
    strictPort: false,
    // Listen on all local IPs (useful for mobile testing)
    host: true,
    // API proxy configuration to forward /api requests to Moodle backend
    // Disabled during E2E tests to allow MSW to intercept requests
    proxy: process.env.E2E_TEST ? undefined : {
      '/api': {
        target: 'http://localhost',
        changeOrigin: true,
        // Preserve the /api prefix when forwarding
        rewrite: (path) => path,
      },
    },
    // Enable CORS during development
    cors: true,
  },

  // Production build configuration
  build: {
    // Target modern browsers with ES2020 support
    target: 'es2020',
    // Output directory for production build
    outDir: 'dist',
    // Generate source maps for production debugging
    sourcemap: true,
    // Rollup-specific options
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: (id) => {
          // Vendor chunk for node_modules dependencies
          if (id.includes('node_modules')) {
            // Split large libraries into separate chunks
            if (id.includes('@mui/material') || id.includes('@mui/icons-material')) {
              return 'vendor-mui';
            }
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('@reduxjs/toolkit') || id.includes('react-redux')) {
              return 'vendor-redux';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-react-query';
            }
            if (id.includes('react-router-dom')) {
              return 'vendor-router';
            }
            // All other vendor dependencies
            return 'vendor';
          }
        },
        // Asset file naming pattern
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const extType = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/woff|woff2|eot|ttf|otf/i.test(extType)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        // Chunk file naming pattern
        chunkFileNames: 'assets/js/[name]-[hash].js',
        // Entry file naming pattern
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    // Increase chunk size warning limit to 500KB (optimized bundles may exceed default)
    chunkSizeWarningLimit: 500,
    // Minify with esbuild for faster builds
    minify: 'esbuild',
    // Enable CSS code splitting
    cssCodeSplit: true,
  },

  // Define global constants for compatibility
  define: {
    // Provide empty process.env for libraries that check for it
    'process.env': {},
  },

  // Dependency optimization configuration
  optimizeDeps: {
    // Pre-bundle these dependencies for faster cold starts
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      '@mui/icons-material',
      '@reduxjs/toolkit',
      'react-redux',
      '@tanstack/react-query',
    ],
    // Exclude any dependencies that shouldn't be pre-bundled
    exclude: [],
  },

  // Environment variable configuration
  envPrefix: 'VITE_',

  // Preview server configuration (for testing production builds locally)
  preview: {
    port: 4173,
    strictPort: false,
    host: true,
    cors: true,
  },
});
