// src/utils/navigation.ts
import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * Custom hook to handle Back button navigation across production stage detail pages.
 *
 * It checks if the user navigated from a legitimate production route (via location.state.from),
 * and if so, returns there (preserving table/card views, searches, or global orders view).
 * Otherwise, it reliably falls back to the stage's registered listing route.
 *
 * @param defaultFallback - The stage listing route (e.g. '/production/stitching')
 * @returns A click handler for the Back button
 */
export function useStageBackNavigation(defaultFallback: string) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = useCallback(() => {
    const fromUrl = (location.state as any)?.from;

    // Validate that fromUrl is an internal production route and not the current page itself
    if (
      typeof fromUrl === 'string' &&
      fromUrl.startsWith('/production') &&
      !fromUrl.startsWith(location.pathname)
    ) {
      navigate(fromUrl);
    } else {
      navigate(defaultFallback);
    }
  }, [navigate, location.state, location.pathname, defaultFallback]);

  return handleBack;
}
