import { describe, it, expect } from 'vitest';
import {
  getApiBaseUrl,
  getAppBaseUrl,
  getHubUrl,
  buildInvitationUrl
} from './apiConfig';

describe('apiConfig', () => {
  it('defaults getApiBaseUrl to empty string when not set in env', () => {
    expect(getApiBaseUrl()).toBe('');
  });

  it('adapts getAppBaseUrl to browser origin or fallback', () => {
    const appUrl = getAppBaseUrl();
    expect(appUrl).toBeTruthy();
    expect(appUrl.startsWith('http')).toBe(true);
  });

  it('constructs default hub URL as relative /hubs/game', () => {
    expect(getHubUrl()).toBe('/hubs/game');
  });

  it('builds full invitation URL with join token using current frontend base', () => {
    const token = 'test-token-xyz';
    const inviteUrl = buildInvitationUrl(token);
    expect(inviteUrl).toContain(`/join/${token}`);
    expect(inviteUrl.startsWith('http')).toBe(true);
  });
});

