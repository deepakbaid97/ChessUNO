import { describe, it, expect, vi } from 'vitest';
import { parseIceServers, DEFAULT_ICE_SERVERS } from './iceConfig';

describe('ICE Configuration Handling (iceConfig)', () => {
  it('returns default STUN servers when no config is provided', () => {
    const servers = parseIceServers();
    expect(servers).toEqual(DEFAULT_ICE_SERVERS);
  });

  it('parses valid JSON array of RTCIceServer objects', () => {
    const custom = '[{"urls":["stun:stun.custom.com:3478"]}]';
    const servers = parseIceServers(custom);
    expect(servers).toEqual([{ urls: ['stun:stun.custom.com:3478'] }]);
  });

  it('warns and returns defaults on invalid JSON string', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const servers = parseIceServers('invalid-json{{{');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WebRTC Diagnostic] Failed to parse VITE_ICE_SERVERS:'),
      expect.any(Error)
    );
    expect(servers).toEqual(DEFAULT_ICE_SERVERS);
    warnSpy.mockRestore();
  });

  it('warns and returns defaults when JSON is not an array', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const servers = parseIceServers('{"urls":"stun:something"}');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WebRTC Diagnostic] VITE_ICE_SERVERS must be a JSON array of RTCIceServer objects.')
    );
    expect(servers).toEqual(DEFAULT_ICE_SERVERS);
    warnSpy.mockRestore();
  });

  it('warns and returns defaults when array items lack urls property', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const servers = parseIceServers('[{"username":"alice"}]');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WebRTC Diagnostic] Invalid RTCIceServer in VITE_ICE_SERVERS: missing "urls".')
    );
    expect(servers).toEqual(DEFAULT_ICE_SERVERS);
    warnSpy.mockRestore();
  });
});

