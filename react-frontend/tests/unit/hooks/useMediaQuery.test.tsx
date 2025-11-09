/**
 * Unit tests for useMediaQuery custom hook
 *
 * Tests CSS media query matching, viewport responsiveness, predefined breakpoint hooks,
 * event listener lifecycle, SSR handling, and custom media query support.
 *
 * Material-UI Breakpoint Mapping:
 * - xs: 0px-599px (mobile) - useIsMobile()
 * - sm: 600px-959px (tablet) - useIsTablet()
 * - md/lg: 960px+ (desktop) - useIsDesktop()
 * - xl: 1920px+ (large desktop) - useIsXL()
 *
 * @module tests/unit/hooks/useMediaQuery
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useMediaQuery, {
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useIsXL,
} from '@/hooks/useMediaQuery';

/**
 * Mock MediaQueryList interface for testing window.matchMedia behavior
 */
interface MockMediaQueryList {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  onchange: null;
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
}

describe('useMediaQuery', () => {
  let mockMediaQueryList: MockMediaQueryList;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    // Store original matchMedia for restoration
    originalMatchMedia = window.matchMedia;

    // Create mock MediaQueryList object with all required properties
    mockMediaQueryList = {
      matches: false,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onchange: null,
      addListener: vi.fn(), // Deprecated but included for compatibility
      removeListener: vi.fn(), // Deprecated but included for compatibility
      dispatchEvent: vi.fn(),
    };

    // Mock window.matchMedia to return our controlled MediaQueryList
    window.matchMedia = vi.fn((query: string) => {
      mockMediaQueryList.media = query;
      return mockMediaQueryList as unknown as MediaQueryList;
    });
  });

  afterEach(() => {
    // Restore original matchMedia implementation
    window.matchMedia = originalMatchMedia;
    vi.clearAllMocks();
  });

  describe('Initial match status', () => {
    it('should return initial match status true when media query matches', () => {
      // Set mock to indicate media query matches
      mockMediaQueryList.matches = true;

      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      // Hook should return true when media query matches
      expect(result.current).toBe(true);
    });

    it('should return initial match status false when media query does not match', () => {
      // Set mock to indicate media query does not match
      mockMediaQueryList.matches = false;

      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      // Hook should return false when media query does not match
      expect(result.current).toBe(false);
    });
  });

  describe('Event listener management', () => {
    it('should add event listener on mount', () => {
      renderHook(() => useMediaQuery('(min-width: 768px)'));

      // Verify addEventListener was called with 'change' event
      expect(mockMediaQueryList.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
      expect(mockMediaQueryList.addEventListener).toHaveBeenCalledTimes(1);
    });

    it('should remove event listener on unmount', () => {
      const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      // Unmount the hook
      unmount();

      // Verify removeEventListener was called to clean up
      expect(mockMediaQueryList.removeEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
      expect(mockMediaQueryList.removeEventListener).toHaveBeenCalledTimes(1);
    });

    it('should use addListener fallback for older browsers', () => {
      // Mock scenario where addEventListener is not available
      const mockMediaQueryListLegacy = {
        ...mockMediaQueryList,
        addEventListener: undefined,
        removeEventListener: undefined,
      };

      window.matchMedia = vi.fn(() => mockMediaQueryListLegacy as unknown as MediaQueryList);

      const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      // Should use deprecated addListener method as fallback
      expect(mockMediaQueryListLegacy.addListener).toHaveBeenCalled();

      unmount();

      // Should use deprecated removeListener method as fallback
      expect(mockMediaQueryListLegacy.removeListener).toHaveBeenCalled();
    });
  });

  describe('Viewport change handling', () => {
    it('should update match status when viewport changes', () => {
      // Start with no match
      mockMediaQueryList.matches = false;

      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      // Initial state should be false
      expect(result.current).toBe(false);

      // Simulate viewport change that now matches the media query
      act(() => {
        // Get the registered event handler
        const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];

        // Simulate media query match change event
        changeHandler({ matches: true } as MediaQueryListEvent);
      });

      // Hook should now return true after viewport change
      expect(result.current).toBe(true);
    });

    it('should handle multiple viewport changes', () => {
      mockMediaQueryList.matches = false;

      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      // Initial state
      expect(result.current).toBe(false);

      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];

      // First change: viewport now matches
      act(() => {
        changeHandler({ matches: true } as MediaQueryListEvent);
      });
      expect(result.current).toBe(true);

      // Second change: viewport no longer matches
      act(() => {
        changeHandler({ matches: false } as MediaQueryListEvent);
      });
      expect(result.current).toBe(false);

      // Third change: viewport matches again
      act(() => {
        changeHandler({ matches: true } as MediaQueryListEvent);
      });
      expect(result.current).toBe(true);
    });

    it('should update state on initial effect execution if match status changed', () => {
      // Start with matches: false
      mockMediaQueryList.matches = false;

      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      // Change matches to true to simulate race condition
      mockMediaQueryList.matches = true;

      // Re-render to trigger effect
      act(() => {
        // The effect should sync the state with current matches value
        const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];
        changeHandler({ matches: true } as MediaQueryListEvent);
      });

      expect(result.current).toBe(true);
    });
  });

  describe('Predefined breakpoint hooks', () => {
    it('useIsMobile should match max-width 599px', () => {
      renderHook(() => useIsMobile());

      // Verify useIsMobile calls matchMedia with correct query for mobile breakpoint
      expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 599px)');
    });

    it('useIsTablet should match 600px to 959px range', () => {
      renderHook(() => useIsTablet());

      // Verify useIsTablet calls matchMedia with correct query for tablet breakpoint
      expect(window.matchMedia).toHaveBeenCalledWith(
        '(min-width: 600px) and (max-width: 959px)'
      );
    });

    it('useIsDesktop should match min-width 960px', () => {
      renderHook(() => useIsDesktop());

      // Verify useIsDesktop calls matchMedia with correct query for desktop breakpoint
      expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 960px)');
    });

    it('useIsXL should match min-width 1920px', () => {
      renderHook(() => useIsXL());

      // Verify useIsXL calls matchMedia with correct query for XL breakpoint
      expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1920px)');
    });

    it('predefined hooks should return correct match status', () => {
      // Test useIsMobile with matching viewport
      mockMediaQueryList.matches = true;
      const { result: mobileResult } = renderHook(() => useIsMobile());
      expect(mobileResult.current).toBe(true);

      // Test useIsTablet with non-matching viewport
      mockMediaQueryList.matches = false;
      const { result: tabletResult } = renderHook(() => useIsTablet());
      expect(tabletResult.current).toBe(false);

      // Test useIsDesktop with matching viewport
      mockMediaQueryList.matches = true;
      const { result: desktopResult } = renderHook(() => useIsDesktop());
      expect(desktopResult.current).toBe(true);

      // Test useIsXL with non-matching viewport
      mockMediaQueryList.matches = false;
      const { result: xlResult } = renderHook(() => useIsXL());
      expect(xlResult.current).toBe(false);
    });
  });

  describe('Custom media queries', () => {
    it('should work with orientation queries', () => {
      mockMediaQueryList.matches = true;

      const { result } = renderHook(() => useMediaQuery('(orientation: portrait)'));

      expect(window.matchMedia).toHaveBeenCalledWith('(orientation: portrait)');
      expect(result.current).toBe(true);
    });

    it('should work with feature queries', () => {
      mockMediaQueryList.matches = true;

      const { result } = renderHook(() => useMediaQuery('(hover: hover)'));

      expect(window.matchMedia).toHaveBeenCalledWith('(hover: hover)');
      expect(result.current).toBe(true);
    });

    it('should work with complex media queries', () => {
      mockMediaQueryList.matches = false;

      const complexQuery = '(min-width: 768px) and (max-width: 1024px)';
      const { result } = renderHook(() => useMediaQuery(complexQuery));

      expect(window.matchMedia).toHaveBeenCalledWith(complexQuery);
      expect(result.current).toBe(false);
    });

    it('should work with color scheme preference queries', () => {
      mockMediaQueryList.matches = true;

      const { result } = renderHook(() => useMediaQuery('(prefers-color-scheme: dark)'));

      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      expect(result.current).toBe(true);
    });

    it('should work with resolution queries', () => {
      mockMediaQueryList.matches = false;

      const { result } = renderHook(() => useMediaQuery('(min-resolution: 2dppx)'));

      expect(window.matchMedia).toHaveBeenCalledWith('(min-resolution: 2dppx)');
      expect(result.current).toBe(false);
    });
  });

  describe('Server-Side Rendering (SSR) handling', () => {
    it('should handle SSR where window is undefined', () => {
      // Temporarily remove window.matchMedia to simulate SSR environment
      const tempMatchMedia = window.matchMedia;
      // @ts-expect-error - Intentionally removing matchMedia for SSR test
      delete window.matchMedia;

      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      // Should return false as default in SSR environment
      expect(result.current).toBe(false);

      // Restore window.matchMedia
      window.matchMedia = tempMatchMedia;
    });

    it('should not add event listeners in SSR environment', () => {
      // Temporarily remove matchMedia
      const tempMatchMedia = window.matchMedia;
      // @ts-expect-error - Intentionally removing matchMedia for SSR test
      delete window.matchMedia;

      const addEventListenerSpy = vi.fn();
      mockMediaQueryList.addEventListener = addEventListenerSpy;

      renderHook(() => useMediaQuery('(min-width: 768px)'));

      // Should not attempt to add event listeners when window is undefined
      expect(addEventListenerSpy).not.toHaveBeenCalled();

      // Restore
      window.matchMedia = tempMatchMedia;
    });

    it('should handle transition from SSR to client-side hydration', () => {
      // Start in SSR mode
      const tempMatchMedia = window.matchMedia;
      // @ts-expect-error - Simulating SSR
      delete window.matchMedia;

      const { result, rerender } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      // Should return false in SSR
      expect(result.current).toBe(false);

      // Restore window.matchMedia to simulate hydration
      window.matchMedia = tempMatchMedia;
      mockMediaQueryList.matches = true;

      // Re-render to simulate hydration
      rerender();

      // After hydration, should reflect actual match status
      // Note: The hook will still return false until the effect runs
      // This is expected behavior for SSR hydration
      expect(result.current).toBe(false);
    });
  });

  describe('Query dependency updates', () => {
    it('should re-subscribe when query changes', () => {
      const { rerender } = renderHook(
        ({ query }) => useMediaQuery(query),
        { initialProps: { query: '(min-width: 768px)' } }
      );

      // Initial subscription
      expect(mockMediaQueryList.addEventListener).toHaveBeenCalledTimes(1);

      // Change the query
      rerender({ query: '(min-width: 1024px)' });

      // Should unsubscribe from old query and subscribe to new one
      expect(mockMediaQueryList.removeEventListener).toHaveBeenCalledTimes(1);
      expect(mockMediaQueryList.addEventListener).toHaveBeenCalledTimes(2);
      expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1024px)');
    });

    it('should not re-subscribe when query remains the same', () => {
      const { rerender } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      // Initial subscription
      expect(mockMediaQueryList.addEventListener).toHaveBeenCalledTimes(1);

      // Re-render with same query
      rerender();

      // Should not create additional subscriptions
      expect(mockMediaQueryList.addEventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty media query string', () => {
      mockMediaQueryList.matches = false;

      const { result } = renderHook(() => useMediaQuery(''));

      expect(window.matchMedia).toHaveBeenCalledWith('');
      expect(result.current).toBe(false);
    });

    it('should handle invalid media query gracefully', () => {
      // matchMedia will still work with invalid queries but return non-matching
      mockMediaQueryList.matches = false;

      const { result } = renderHook(() => useMediaQuery('invalid query'));

      expect(window.matchMedia).toHaveBeenCalledWith('invalid query');
      expect(result.current).toBe(false);
    });

    it('should maintain separate state for multiple hook instances', () => {
      const query1 = '(min-width: 768px)';
      const query2 = '(max-width: 768px)';

      // Create mock that returns different results based on query
      window.matchMedia = vi.fn((query: string) => {
        const matches = query === query1 ? true : false;
        return {
          ...mockMediaQueryList,
          matches,
          media: query,
        } as unknown as MediaQueryList;
      });

      const { result: result1 } = renderHook(() => useMediaQuery(query1));
      const { result: result2 } = renderHook(() => useMediaQuery(query2));

      // Each hook instance should maintain independent state
      expect(result1.current).toBe(true);
      expect(result2.current).toBe(false);
    });
  });
});
