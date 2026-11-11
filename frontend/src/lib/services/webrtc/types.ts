export interface RtcConfig {
  iceServers: RTCIceServer[];
}

export const PROTOCOL_VERSION = '1.0';

export type P2PMessageType = 'ping' | 'pong' | 'cursor' | 'chat' | 'voice-status';

export interface VoiceStatusPayload {
  speaking: boolean;
  voiceActive: boolean;
}

export interface P2PMessage<T = any> {
  id: string;
  version: string;
  type: P2PMessageType;
  sender: string;
  payload?: T;
  timestamp: number;
}

export interface QueuedCandidate {
  epoch: number;
  candidate: RTCIceCandidateInit;
}

