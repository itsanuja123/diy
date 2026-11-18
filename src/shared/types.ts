export type TeamId = 'cobalt' | 'solar';
export type WeaponMode = 'pulse' | 'rail';

export type RoomId = 'apex-stadium' | 'reactor-zero' | 'vanguard-blitz';

export interface RoomSummary {
  id: RoomId;
  name: string;
  subtitle: string;
  humanCount: number;
  totalCombatants: number;
  maxCombatants: number;
  cobaltScore: number;
  solarScore: number;
  timeRemainingSec: number;
}

export interface PlayerSnapshot {
  id: string;
  callsign: string;
  team: TeamId;
  isBot: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vy: number;
  vz: number;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  score: number;
  tags: number;
  taggedCount: number;
  streak: number;
  alive: boolean;
  respawnInSec: number;
  overdriveSec: number;
  railCharge: number; // 0..1
}

export interface PickupState {
  id: string;
  kind: 'shield' | 'overdrive';
  x: number;
  y: number;
  z: number;
  active: boolean;
  respawnInSec: number;
}

export interface KillFeedEvent {
  id: string;
  timestamp: number;
  attackerId: string;
  attackerName: string;
  attackerTeam: TeamId;
  victimId: string;
  victimName: string;
  victimTeam: TeamId;
  weapon: WeaponMode;
  headshot: boolean;
}

export interface LaserBeamEvent {
  id: string;
  shooterId: string;
  team: TeamId;
  weapon: WeaponMode;
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
  nx: number;
  ny: number;
  nz: number;
  hitPlayerId: string | null;
  headshot: boolean;
}

export interface MatchStatePayload {
  roomId: RoomId;
  roomName: string;
  phase: 'active' | 'intermission';
  timeRemainingSec: number;
  intermissionSec: number;
  cobaltScore: number;
  solarScore: number;
  targetScore: number;
  players: PlayerSnapshot[];
  pickups: PickupState[];
}

export interface ClientJoinMessage {
  type: 'join';
  callsign: string;
  teamPreference: TeamId | 'auto';
  roomId: RoomId;
  botFill: boolean;
}

export interface ClientStateMessage {
  type: 'state';
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface ClientFireMessage {
  type: 'fire';
  weapon: WeaponMode;
  ox: number;
  oy: number;
  oz: number;
  dx: number;
  dy: number;
  dz: number;
}

export interface ClientSwitchRoomMessage {
  type: 'switch_room';
  roomId: RoomId;
  teamPreference: TeamId | 'auto';
  botFill: boolean;
}

export interface ClientPingMessage {
  type: 'ping';
  t: number;
}

export type ClientMessage =
  | ClientJoinMessage
  | ClientStateMessage
  | ClientFireMessage
  | ClientSwitchRoomMessage
  | ClientPingMessage;

export interface ServerInitMessage {
  type: 'init';
  playerId: string;
  snapshot: MatchStatePayload;
  killFeed: KillFeedEvent[];
}

export interface ServerSnapshotMessage {
  type: 'snapshot';
  snapshot: MatchStatePayload;
}

export interface ServerBeamMessage {
  type: 'beam';
  beam: LaserBeamEvent;
}

export interface ServerHitConfirmMessage {
  type: 'hit_confirm';
  victimId: string;
  victimName: string;
  damage: number;
  headshot: boolean;
  eliminated: boolean;
  points: number;
}

export interface ServerDamageTakenMessage {
  type: 'damage_taken';
  attackerId: string;
  attackerName: string;
  attackerTeam: TeamId;
  damage: number;
  remainingHealth: number;
  remainingShield: number;
  eliminated: boolean;
  fromX: number;
  fromZ: number;
}

export interface ServerKillFeedMessage {
  type: 'killfeed';
  event: KillFeedEvent;
}

export interface ServerPickupMessage {
  type: 'pickup';
  pickupId: string;
  kind: 'shield' | 'overdrive';
  playerId: string;
}

export interface ServerPongMessage {
  type: 'pong';
  t: number;
}

export type ServerMessage =
  | ServerInitMessage
  | ServerSnapshotMessage
  | ServerBeamMessage
  | ServerHitConfirmMessage
  | ServerDamageTakenMessage
  | ServerKillFeedMessage
  | ServerPickupMessage
  | ServerPongMessage;
