/**
 * Custom React hook for responsive design that matches CSS media queries
 * and tracks viewport dimensions.
 *
 * This hook enables responsive component rendering and conditional logic
 * based on screen size without CSS. It uses the native window.matchMedia API
 * for efficient media query evaluation and automatically updates when the
 * viewport size changes.
 *
 * @module hooks/useMediaQuery
 *
 * @example
 * // Basic usage with custom media query
 * const isMobile = useMediaQuery('(max-width: 768px)');
 *
 * @example
 * // Using predefined breakpoint helpers
 * const isMobile = useIsMobile();
 * const isTablet = useIsTablet();
 * const isDesktop = useIsDesktop();
 *
 * @example
 * // Conditional rendering based on viewport
 * function MyComponent() {
 *   const isMobile = useIsMobile();
 *   return isMobile ? <MobileView /> : <DesktopView />;
 * }
 */

import { useState, useEffect } from 'react';

/**
 * Custom hook that matches a CSS media query and returns a boolean indicating
 * if the current viewport matches the provided media query string.
 *
 * The hook automatically listens to window resize events and updates the match
 * status when the viewport size changes. It handles SSR/SSG scenarios by checking
 * if the window object is defined.
 *
 * Material-UI Breakpoint Reference:
 * - xs: 0px (mobile) - Extra small devices
 * - sm: 600px (tablet) - Small devices
 * - md: 960px (small laptop) - Medium devices
 * - lg: 1280px (desktop) - Large devices
 * - xl: 1920px (large desktop) - Extra large devices
 *
 * @param query - Valid CSS media query string (e.g., '(min-width: 768px)')
 * @returns Boolean indicating if the current viewport matches the media query
 *
 * @example
 * const matches = useMediaQuery('(min-width: 768px)');
 * const isLandscape = useMediaQuery('(orientation: landscape)');
 * const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
 */
function useMediaQuery(query: string): boolean {
  // Handle SSR/SSG scenarios where window is undefined
  // Initialize with false as default for server-side rendering
  const getMatches = (): boolean => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia(query).matches;
    }
    return false;
  };

  // Initialize state with current match status
  const [matches, setMatches] = useState<boolean>(getMatches);

  useEffect(() => {
    // Return early if window is not defined (SSR/SSG) or matchMedia is not available
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    // Create MediaQueryList object for efficient media query evaluation
    const mediaQueryList = window.matchMedia(query);

    // Handler function to update state when media query match status changes
    const handleChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };

    // Add event listener for media query changes
    // Modern browsers use addEventListener, older browsers use addListener
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQueryList.addListener(handleChange);
    }

    // Update state with current match status in case it changed
    // between initialization and effect execution
    setMatches(mediaQueryList.matches);

    // Cleanup function to remove event listener on unmount
    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleChange);
      } else {
        // Fallback for older browsers
        mediaQueryList.removeListener(handleChange);
      }
    };
  }, [query]); // Re-run effect when query changes

  return matches;
}

/**
 * Predefined hook for mobile devices (Material-UI xs breakpoint).
 * Matches viewports with maximum width of 599px.
 *
 * @returns Boolean indicating if current viewport is mobile-sized (xs)
 *
 * @example
 * const isMobile = useIsMobile();
 * if (isMobile) {
 *   return <MobileNavigation />;
 * }
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 599px)');
}

/**
 * Predefined hook for tablet devices (Material-UI sm-md breakpoints).
 * Matches viewports between 600px and 959px width.
 *
 * @returns Boolean indicating if current viewport is tablet-sized (sm-md)
 *
 * @example
 * const isTablet = useIsTablet();
 * if (isTablet) {
 *   return <TabletLayout />;
 * }
 */
export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 600px) and (max-width: 959px)');
}

/**
 * Predefined hook for desktop devices (Material-UI lg+ breakpoint).
 * Matches viewports with minimum width of 960px.
 *
 * @returns Boolean indicating if current viewport is desktop-sized (lg+)
 *
 * @example
 * const isDesktop = useIsDesktop();
 * if (isDesktop) {
 *   return <DesktopSidebar />;
 * }
 */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 960px)');
}

/**
 * Predefined hook for extra large desktop devices (Material-UI xl breakpoint).
 * Matches viewports with minimum width of 1920px.
 *
 * @returns Boolean indicating if current viewport is extra large (xl)
 *
 * @example
 * const isXL = useIsXL();
 * if (isXL) {
 *   return <WideScreenLayout />;
 * }
 */
export function useIsXL(): boolean {
  return useMediaQuery('(min-width: 1920px)');
}

// Export useMediaQuery as default export
export default useMediaQuery;
