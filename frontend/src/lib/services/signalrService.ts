import * as signalR from '@microsoft/signalr';
import type {
  GameSnapshot,
  GameStateUpdate,
  CardDrawnData,
  MoveAcceptedData,
  PlayerConnectedData,
  PieceRevivedData,
  PiecesSwappedData
} from '../types/game';

export class SignalRService {
  private hubConnection: signalR.HubConnection | null = null;
  private eventHandlers: Map<string, Array<(...args: any[]) => void>> = new Map();
  private reconnectingHandlers: Array<(error?: Error) => void> = [];
  private reconnectedHandlers: Array<(connectionId?: string) => void> = [];
  private closeHandlers: Array<(error?: Error) => void> = [];

  private registerHandler(event: string, callback: (...args: any[]) => void) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(callback);
    if (this.hubConnection) {
      this.hubConnection.on(event, callback);
    }
  }

  async connect(hubUrl: string = '/hubs/game'): Promise<void> {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      return;
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .build();

    // Attach all registered event handlers
    for (const [event, callbacks] of this.eventHandlers.entries()) {
      for (const cb of callbacks) {
        this.hubConnection.on(event, cb);
      }
    }
    for (const cb of this.reconnectingHandlers) {
      this.hubConnection.onreconnecting(cb);
    }
    for (const cb of this.reconnectedHandlers) {
      this.hubConnection.onreconnected(cb);
    }
    for (const cb of this.closeHandlers) {
      this.hubConnection.onclose(cb);
    }

    await this.hubConnection.start();
  }

  get state(): signalR.HubConnectionState | 'Disconnected' {
    return this.hubConnection?.state || 'Disconnected';
  }

  async joinGameRoom(gameId: string, playerToken: string): Promise<boolean> {
    if (!this.hubConnection) throw new Error('Not connected to SignalR');
    const result = await this.hubConnection.invoke('JoinGameRoom', gameId, playerToken);
    console.log('[SignalR] JoinGameRoom invoked for', gameId, 'token:', playerToken.substring(0, 6) + '...', 'result:', result);
    return result;
  }

  async sendSignal(gameId: string, playerToken: string, signalType: string, payload: string): Promise<boolean> {
    if (!this.hubConnection) throw new Error('Not connected to SignalR');
    return this.hubConnection.invoke('SendSignal', gameId, playerToken, signalType, payload);
  }

  async drawCard(gameId: string, playerToken: string): Promise<boolean> {
    if (!this.hubConnection) throw new Error('Not connected to SignalR');
    return this.hubConnection.invoke('DrawCard', gameId, playerToken);
  }

  async submitMove(gameId: string, playerToken: string, from: string, to: string, promotion?: string): Promise<boolean> {
    if (!this.hubConnection) throw new Error('Not connected to SignalR');
    return this.hubConnection.invoke('SubmitMove', gameId, playerToken, from, to, promotion || null);
  }

  async submitRevival(gameId: string, playerToken: string, pieceType: string, targetSquare: string): Promise<boolean> {
    if (!this.hubConnection) throw new Error('Not connected to SignalR');
    return this.hubConnection.invoke('SubmitRevival', gameId, playerToken, pieceType, targetSquare);
  }

  async submitSwap(gameId: string, playerToken: string, sq1: string, sq2: string): Promise<boolean> {
    if (!this.hubConnection) throw new Error('Not connected to SignalR');
    return this.hubConnection.invoke('SubmitSwap', gameId, playerToken, sq1, sq2);
  }

  async resign(gameId: string, playerToken: string): Promise<boolean> {
    if (!this.hubConnection) throw new Error('Not connected to SignalR');
    return this.hubConnection.invoke('Resign', gameId, playerToken);
  }

  async endTurn(gameId: string, playerToken: string): Promise<boolean> {
    if (!this.hubConnection) throw new Error('Not connected to SignalR');
    return this.hubConnection.invoke('EndTurn', gameId, playerToken);
  }

  async getLegalMoves(gameId: string, playerToken: string): Promise<string[]> {
    if (!this.hubConnection) throw new Error('Not connected to SignalR');
    return this.hubConnection.invoke('GetLegalMoves', gameId, playerToken);
  }

  onGameStateSnapshot(callback: (snapshot: GameSnapshot) => void): void {
    this.registerHandler('GameStateSnapshot', callback);
  }

  onGameStateUpdated(callback: (update: GameStateUpdate) => void): void {
    this.registerHandler('GameStateUpdated', callback);
  }

  onCardDrawn(callback: (data: CardDrawnData) => void): void {
    this.registerHandler('CardDrawn', callback);
  }

  onMoveAccepted(callback: (data: MoveAcceptedData) => void): void {
    this.registerHandler('MoveAccepted', callback);
  }

  onPieceRevived(callback: (data: PieceRevivedData) => void): void {
    this.registerHandler('PieceRevived', callback);
  }

  onPiecesSwapped(callback: (data: PiecesSwappedData) => void): void {
    this.registerHandler('PiecesSwapped', callback);
  }

  onReceiveSignal(callback: (signalType: string, payload: string) => void): void {
    this.registerHandler('ReceiveSignal', callback);
  }

  onPlayerConnected(callback: (data: PlayerConnectedData) => void): void {
    this.registerHandler('PlayerConnected', callback);
  }

  onReconnecting(callback: (error?: Error) => void): void {
    this.reconnectingHandlers.push(callback);
    this.hubConnection?.onreconnecting(callback);
  }

  onReconnected(callback: (connectionId?: string) => void): void {
    this.reconnectedHandlers.push(callback);
    this.hubConnection?.onreconnected(callback);
  }

  onClose(callback: (error?: Error) => void): void {
    this.closeHandlers.push(callback);
    this.hubConnection?.onclose(callback);
  }

  async disconnect(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.hubConnection = null;
    }
  }
}
