/**
 * Suspense boundary fallback for the (app) route group.
 * Returns null intentionally — the NavigationLoader overlay in the root
 * layout already covers this state as a single continuous loading experience.
 * Showing anything here would create a visible second loading indicator.
 */
export default function Loading() {
  return null;
}
