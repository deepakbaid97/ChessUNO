/**
 * Configuration module for Backend API and Frontend application URLs.
 * Supports environment variables (VITE_API_BASE_URL, VITE_APP_BASE_URL)
 * and dynamically adapts to the current window.location origin in browser environments.
 */

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env?.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return '';
}

export function getAppBaseUrl(): string {
  const envUrl = import.meta.env?.VITE_APP_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin.replace(/\/+$/, '');
    const pathname = window.location.pathname || '';
    const basePath = pathname.split('/join/')[0].replace(/\/+$/, '');
    return basePath ? `${origin}${basePath}` : origin;
  }
  return 'http://localhost:5173';
}

export function getHubUrl(): string {
  const apiBase = getApiBaseUrl();
  return apiBase ? `${apiBase}/hubs/game` : '/hubs/game';
}

export function buildInvitationUrl(token: string): string {
  const base = getAppBaseUrl();
  return `${base}/join/${token}`;
}

