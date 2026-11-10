import type {
  CreateGameResponse,
  JoinGameResponse,
  GameSessionView,
  InvitationInfo
} from '../types/game';

export class GameApiService {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  async createGame(playerName: string): Promise<CreateGameResponse> {
    const res = await fetch(`${this.baseUrl}/api/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to create game: ${res.statusText}`);
    }
    return res.json();
  }

  async joinGame(invitationToken: string, playerName: string): Promise<JoinGameResponse> {
    const res = await fetch(`${this.baseUrl}/api/games/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationToken, playerName })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to join game: ${res.statusText}`);
    }
    return res.json();
  }

  async getGameSession(gameId: string): Promise<GameSessionView> {
    const res = await fetch(`${this.baseUrl}/api/games/${gameId}`);
    if (!res.ok) throw new Error(`Failed to fetch game session: ${res.statusText}`);
    return res.json();
  }

  async getInvitationInfo(token: string): Promise<InvitationInfo> {
    const res = await fetch(`${this.baseUrl}/api/games/invite/${token}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Invitation link is invalid or expired.');
    }
    return res.json();
  }
}
