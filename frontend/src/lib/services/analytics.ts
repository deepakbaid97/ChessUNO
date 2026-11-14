declare global {
  interface Window {
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
  }
}

let activeMeasurementId: string | null = null;

/**
 * Returns whether Google Analytics is currently initialized and enabled.
 */
export function isAnalyticsEnabled(): boolean {
  return typeof window !== 'undefined' && !!activeMeasurementId && typeof window.gtag === 'function';
}

/**
 * Initializes Google Analytics 4 if a valid Measurement ID is configured.
 * @param explicitId Optional explicit GA4 Measurement ID (overrides VITE_GA_MEASUREMENT_ID).
 */
export function initAnalytics(explicitId?: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const measurementId = explicitId || (import.meta.env?.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim();
  if (!measurementId) {
    activeMeasurementId = null;
    return false;
  }

  activeMeasurementId = measurementId;

  // Initialize dataLayer and gtag stub if not already present
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }

  // Prevent duplicate script injection
  const scriptId = 'ga-gtag-script';
  if (!document.getElementById(scriptId)) {
    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
  }

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: false // SPA views are tracked explicitly via trackScreen / trackPageView
  });

  return true;
}

/**
 * Track SPA view / screen transition (e.g. 'LOBBY', 'WAITING', 'JOIN', 'GAME').
 */
export function trackScreen(screenName: string): void {
  if (!isAnalyticsEnabled() || !window.gtag) return;

  window.gtag('event', 'screen_view', {
    screen_name: screenName,
    page_title: `Chess UNO - ${screenName}`
  });
}

/**
 * Track page view with URL path and title.
 */
export function trackPageView(pagePath: string = window.location.pathname, pageTitle?: string): void {
  if (!isAnalyticsEnabled() || !window.gtag || !activeMeasurementId) return;

  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: pageTitle || document.title
  });
}

/**
 * Track custom game-specific analytics events.
 */
export function trackGameEvent(eventName: string, params: Record<string, any> = {}): void {
  if (!isAnalyticsEnabled() || !window.gtag) return;

  window.gtag('event', eventName, params);
}

/**
 * Helper to reset analytics state during unit tests.
 */
export function resetAnalyticsForTesting(): void {
  activeMeasurementId = null;
  if (typeof window !== 'undefined') {
    delete (window as any).gtag;
    delete (window as any).dataLayer;
    const script = document.getElementById('ga-gtag-script');
    if (script && script.parentNode) {
      script.parentNode.removeChild(script);
    }
  }
}
