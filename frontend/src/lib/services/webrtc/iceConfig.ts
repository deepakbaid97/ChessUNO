export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' }
];

export function parseIceServers(rawConfig?: string): RTCIceServer[] {
  if (!rawConfig || typeof rawConfig !== 'string' || !rawConfig.trim()) {
    return [...DEFAULT_ICE_SERVERS];
  }

  try {
    const parsed = JSON.parse(rawConfig);
    if (!Array.isArray(parsed)) {
      console.warn(
        '[WebRTC Diagnostic] VITE_ICE_SERVERS must be a JSON array of RTCIceServer objects. Falling back to default STUN servers.'
      );
      return [...DEFAULT_ICE_SERVERS];
    }

    for (const server of parsed) {
      if (!server || typeof server !== 'object' || (!server.urls && !server.url)) {
        console.warn(
          '[WebRTC Diagnostic] Invalid RTCIceServer in VITE_ICE_SERVERS: missing "urls". Falling back to default STUN servers.'
        );
        return [...DEFAULT_ICE_SERVERS];
      }
    }

    return parsed;
  } catch (err) {
    console.warn('[WebRTC Diagnostic] Failed to parse VITE_ICE_SERVERS:', err);
    return [...DEFAULT_ICE_SERVERS];
  }
}

