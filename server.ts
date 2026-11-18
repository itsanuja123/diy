import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  ARENA_HALF_SIZE,
  BOT_WAYPOINTS,
  JUMP_PADS,
  PICKUP_DEFS,
  PLAYER_EYE_HEIGHT,
  PLAYER_RADIUS,
  SPAWN_POINTS,
  groundHeightAt,
  raycastArena,
  resolveHorizontalCollision,
} from './src/shared/arenaMap.ts';
import type {
  ClientMessage,
  KillFeedEvent,
  LaserBeamEvent,
  MatchStatePayload,
  PickupState,
  PlayerSnapshot,
  RoomId,
  RoomSummary,
  ServerMessage,
  TeamId,
  WeaponMode,
} from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MATCH_DURATION_SEC = 300;
const INTERMISSION_DURATION_SEC = 10;
const RESPAWN_DELAY_SEC = 3.5;

const BOT_CALLSIGNS = [
  'Valkyrie', 'Cipher', 'Kestrel', 'Hyperion', 'Sable', 'Helios',
  'Specter', 'Zenith', 'Nova', 'Stryker', 'Orion', 'Atlas',
  'Echo', 'Talon', 'Tempest', 'Mirage', 'Vector', 'Axiom',
  'Pulse', 'Vortex', 'Aegis', 'Rift', 'Quasar', 'Drifter',
];

interface ServerPlayer extends PlayerSnapshot {
  ws: WebSocket | null;
  lastFireMs: number;
  lastDamagedMs: number;
  jumpPadCooldownMs: number;
  waypointIndex: number;
  strafeSign: number;
  strafeSwitchMs: number;
  aiBurstCooldownMs: number;
}

interface RoomConfig {
  id: RoomId;
  name: string;
  subtitle: string;
  maxCombatants: number;
  targetScore: number;
}

const ROOM_CONFIGS: RoomConfig[] = [
  {
    id: 'apex-stadium',
    name: 'Apex Stadium',
    subtitle: '16-Combatant Standard Arena',
    maxCombatants: 16,
    targetScore: 4000,
  },
  {
    id: 'reactor-zero',
    name: 'Reactor Zero',
    subtitle: '24-Combatant High-Density Surge',
    maxCombatants: 24,
    targetScore: 6500,
  },
  {
    id: 'vanguard-blitz',
    name: 'Vanguard Blitz',
    subtitle: '12-Combatant Tactical Skirmish',
    maxCombatants: 12,
    targetScore: 3000,
  },
];

interface ArenaRoom {
  config: RoomConfig;
  phase: 'active' | 'intermission';
  timeRemainingSec: number;
  intermissionSec: number;
  cobaltScore: number;
  solarScore: number;
  botFill: boolean;
  players: Map<string, ServerPlayer>;
  pickups: PickupState[];
  killFeed: KillFeedEvent[];
  botCounter: number;
  eventCounter: number;
}

const rooms = new Map<RoomId, ArenaRoom>();
const clientRooms = new Map<WebSocket, { roomId: RoomId; playerId: string }>();

function createRoom(config: RoomConfig): ArenaRoom {
  const room: ArenaRoom = {
    config,
    phase: 'active',
    timeRemainingSec: MATCH_DURATION_SEC,
    intermissionSec: 0,
    cobaltScore: 0,
    solarScore: 0,
    botFill: true,
    players: new Map(),
    pickups: PICKUP_DEFS.map((p) => ({
      id: p.id,
      kind: p.kind,
      x: p.x,
      y: p.y,
      z: p.z,
      active: true,
      respawnInSec: 0,
    })),
    killFeed: [],
    botCounter: 1,
    eventCounter: 1,
  };
  balanceRoomBots(room);
  return room;
}

function getSpawnForTeam(team: TeamId, existingPlayers: Iterable<ServerPlayer>): { x: number; y: number; z: number; yaw: number } {
  const candidates = SPAWN_POINTS.filter((s) => s.team === team);
  let best = candidates[Math.floor(Math.random() * candidates.length)];
  let bestMinDist = -1;

  for (const sp of candidates) {
    let minEnemyDist = 999;
    for (const p of existingPlayers) {
      if (!p.alive || p.team === team) continue;
      const d = Math.hypot(p.x - sp.x, p.z - sp.z);
      if (d < minEnemyDist) minEnemyDist = d;
    }
    if (minEnemyDist > bestMinDist) {
      bestMinDist = minEnemyDist;
      best = sp;
    }
  }

  return {
    x: best.x + (Math.random() - 0.5) * 1.4,
    y: best.y,
    z: best.z + (Math.random() - 0.5) * 1.4,
    yaw: best.yaw,
  };
}

function pickBalancedTeam(room: ArenaRoom, preference: TeamId | 'auto'): TeamId {
  if (preference === 'cobalt' || preference === 'solar') {
    return preference;
  }
  let cobaltHumans = 0;
  let solarHumans = 0;
  for (const p of room.players.values()) {
    if (!p.isBot) {
      if (p.team === 'cobalt') cobaltHumans++;
      else solarHumans++;
    }
  }
  if (cobaltHumans < solarHumans) return 'cobalt';
  if (solarHumans < cobaltHumans) return 'solar';

  let cobaltTotal = 0;
  let solarTotal = 0;
  for (const p of room.players.values()) {
    if (p.team === 'cobalt') cobaltTotal++;
    else solarTotal++;
  }
  return cobaltTotal <= solarTotal ? 'cobalt' : 'solar';
}

function createBot(room: ArenaRoom, team: TeamId): ServerPlayer {
  const idx = room.botCounter++;
  const name = `${BOT_CALLSIGNS[(idx - 1) % BOT_CALLSIGNS.length]}-${String(idx).padStart(2, '0')}`;
  const spawn = getSpawnForTeam(team, room.players.values());
  return {
    id: `bot-${room.config.id}-${idx}`,
    callsign: name,
    team,
    isBot: true,
    ws: null,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    yaw: spawn.yaw,
    pitch: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    health: 100,
    maxHealth: 100,
    shield: 50,
    maxShield: 50,
    score: 0,
    tags: 0,
    taggedCount: 0,
    streak: 0,
    alive: true,
    respawnInSec: 0,
    overdriveSec: 0,
    railCharge: 1,
    lastFireMs: 0,
    lastDamagedMs: 0,
    jumpPadCooldownMs: 0,
    waypointIndex: Math.floor(Math.random() * BOT_WAYPOINTS.length),
    strafeSign: Math.random() < 0.5 ? 1 : -1,
    strafeSwitchMs: Date.now() + 1500 + Math.random() * 2000,
    aiBurstCooldownMs: Date.now() + 800 + Math.random() * 1000,
  };
}

function balanceRoomBots(room: ArenaRoom) {
  if (!room.botFill) {
    for (const [id, p] of room.players) {
      if (p.isBot) room.players.delete(id);
    }
    return;
  }

  const targetTotal = room.config.maxCombatants;
  const targetPerTeam = Math.floor(targetTotal / 2);

  // Remove excess bots if humans joined
  while (room.players.size > targetTotal) {
    const botToRemove = Array.from(room.players.values()).find((p) => p.isBot);
    if (!botToRemove) break;
    room.players.delete(botToRemove.id);
  }

  // Count team sizes
  const countTeams = () => {
    let c = 0;
    let s = 0;
    for (const p of room.players.values()) {
      if (p.team === 'cobalt') c++;
      else s++;
    }
    return { c, s };
  };

  let { c, s } = countTeams();

  // Rebalance bots if teams are uneven by more than 1
  while (c > targetPerTeam && s < targetPerTeam) {
    const bot = Array.from(room.players.values()).find((p) => p.isBot && p.team === 'cobalt');
    if (!bot) break;
    room.players.delete(bot.id);
    c--;
  }
  while (s > targetPerTeam && c < targetPerTeam) {
    const bot = Array.from(room.players.values()).find((p) => p.isBot && p.team === 'solar');
    if (!bot) break;
    room.players.delete(bot.id);
    s--;
  }

  // Fill up to targetPerTeam each
  while (c < targetPerTeam && room.players.size < targetTotal) {
    const bot = createBot(room, 'cobalt');
    room.players.set(bot.id, bot);
    c++;
  }
  while (s < targetPerTeam && room.players.size < targetTotal) {
    const bot = createBot(room, 'solar');
    room.players.set(bot.id, bot);
    s++;
  }
}

function sendToSocket(ws: WebSocket | null, msg: ServerMessage) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function broadcastToRoom(room: ArenaRoom, msg: ServerMessage) {
  const payload = JSON.stringify(msg);
  for (const p of room.players.values()) {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(payload);
    }
  }
}

function serializePlayer(p: ServerPlayer): PlayerSnapshot {
  return {
    id: p.id,
    callsign: p.callsign,
    team: p.team,
    isBot: p.isBot,
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    pitch: p.pitch,
    vx: p.vx,
    vy: p.vy,
    vz: p.vz,
    health: Math.round(p.health),
    maxHealth: p.maxHealth,
    shield: Math.round(p.shield),
    maxShield: p.maxShield,
    score: p.score,
    tags: p.tags,
    taggedCount: p.taggedCount,
    streak: p.streak,
    alive: p.alive,
    respawnInSec: Math.max(0, Number(p.respawnInSec.toFixed(1))),
    overdriveSec: Math.max(0, Number(p.overdriveSec.toFixed(1))),
    railCharge: Math.min(1, Math.max(0, Number(p.railCharge.toFixed(2)))),
  };
}

function buildSnapshot(room: ArenaRoom): MatchStatePayload {
  return {
    roomId: room.config.id,
    roomName: room.config.name,
    phase: room.phase,
    timeRemainingSec: Math.max(0, Math.ceil(room.timeRemainingSec)),
    intermissionSec: Math.max(0, Math.ceil(room.intermissionSec)),
    cobaltScore: room.cobaltScore,
    solarScore: room.solarScore,
    targetScore: room.config.targetScore,
    players: Array.from(room.players.values()).map(serializePlayer),
    pickups: room.pickups,
  };
}

/**
 * Ray vs vertical cylinder/capsule + head sphere intersection for accurate FPS hit detection.
 */
function raycastPlayerHitbox(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  target: ServerPlayer,
  maxDist: number,
): { dist: number; headshot: boolean } | null {
  const rad = 0.44;
  const footY = target.y;
  const topY = target.y + 1.82;
  const headCenterY = target.y + 1.56;
  const headRadius = 0.25;

  // Check head sphere first
  const hx = ox - target.x;
  const hy = oy - headCenterY;
  const hz = oz - target.z;
  const bHead = hx * dx + hy * dy + hz * dz;
  const cHead = hx * hx + hy * hy + hz * hz - headRadius * headRadius;
  const discHead = bHead * bHead - cHead;
  if (discHead >= 0) {
    const tHead = -bHead - Math.sqrt(discHead);
    if (tHead > 0.15 && tHead < maxDist) {
      return { dist: tHead, headshot: true };
    }
  }

  // Check vertical torso/legs cylinder in XZ
  const a = dx * dx + dz * dz;
  if (a < 1e-6) return null;
  const rx = ox - target.x;
  const rz = oz - target.z;
  const b = 2 * (rx * dx + rz * dz);
  const c = rx * rx + rz * rz - rad * rad;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;

  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);
  const t = t1 > 0.15 ? t1 : t2;
  if (t <= 0.15 || t >= maxDist) return null;

  const hitY = oy + dy * t;
  if (hitY < footY || hitY > topY) return null;

  return { dist: t, headshot: hitY >= target.y + 1.42 };
}

function handleFire(room: ArenaRoom, shooter: ServerPlayer, weapon: WeaponMode, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number) {
  if (room.phase !== 'active' || !shooter.alive) return;

  const now = Date.now();
  const pulseCooldown = shooter.overdriveSec > 0 ? 95 : 145;
  if (weapon === 'pulse') {
    if (now - shooter.lastFireMs < pulseCooldown) return;
  } else {
    if (shooter.railCharge < 0.99) return;
    shooter.railCharge = 0;
  }
  shooter.lastFireMs = now;

  // Normalize ray direction
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-5) return;
  const ndx = dx / len;
  const ndy = dy / len;
  const ndz = dz / len;

  // Clamp origin near shooter's eye
  const eyeY = shooter.y + PLAYER_EYE_HEIGHT;
  const distFromEye = Math.hypot(ox - shooter.x, oy - eyeY, oz - shooter.z);
  const safeOx = distFromEye > 1.5 ? shooter.x : ox;
  const safeOy = distFromEye > 1.5 ? eyeY : oy;
  const safeOz = distFromEye > 1.5 ? shooter.z : oz;

  const arenaHit = raycastArena(safeOx, safeOy, safeOz, ndx, ndy, ndz, 130);
  let bestDist = arenaHit.dist;
  let hitPlayer: ServerPlayer | null = null;
  let isHeadshot = false;

  for (const candidate of room.players.values()) {
    if (!candidate.alive || candidate.id === shooter.id || candidate.team === shooter.team) continue;
    const hit = raycastPlayerHitbox(safeOx, safeOy, safeOz, ndx, ndy, ndz, candidate, bestDist);
    if (hit && hit.dist < bestDist) {
      bestDist = hit.dist;
      hitPlayer = candidate;
      isHeadshot = hit.headshot;
    }
  }

  const endX = safeOx + ndx * bestDist;
  const endY = safeOy + ndy * bestDist;
  const endZ = safeOz + ndz * bestDist;

  // Offset visual start slightly right/down for muzzle look
  const rightX = Math.cos(shooter.yaw);
  const rightZ = -Math.sin(shooter.yaw);
  const startX = shooter.x + rightX * 0.22 + ndx * 0.45;
  const startY = shooter.y + PLAYER_EYE_HEIGHT - 0.14 + ndy * 0.45;
  const startZ = shooter.z + rightZ * 0.22 + ndz * 0.45;

  const beamEvent: LaserBeamEvent = {
    id: `bm-${room.eventCounter++}`,
    shooterId: shooter.id,
    team: shooter.team,
    weapon,
    startX,
    startY,
    startZ,
    endX,
    endY,
    endZ,
    nx: hitPlayer ? -ndx : arenaHit.nx,
    ny: hitPlayer ? 0.2 : arenaHit.ny,
    nz: hitPlayer ? -ndz : arenaHit.nz,
    hitPlayerId: hitPlayer ? hitPlayer.id : null,
    headshot: isHeadshot,
  };

  broadcastToRoom(room, { type: 'beam', beam: beamEvent });

  if (hitPlayer) {
    const baseDmg = weapon === 'rail' ? 78 : 34;
    const mult = (isHeadshot ? 1.5 : 1.0) * (shooter.overdriveSec > 0 ? 1.4 : 1.0);
    const damage = Math.round(baseDmg * mult);

    hitPlayer.lastDamagedMs = now;
    let remainingDmg = damage;
    if (hitPlayer.shield > 0) {
      const absorbed = Math.min(hitPlayer.shield, remainingDmg);
      hitPlayer.shield -= absorbed;
      remainingDmg -= absorbed;
    }
    if (remainingDmg > 0) {
      hitPlayer.health = Math.max(0, hitPlayer.health - remainingDmg);
    }

    const eliminated = hitPlayer.health <= 0;
    let pointsAwarded = 15; // hit points

    if (eliminated) {
      hitPlayer.alive = false;
      hitPlayer.respawnInSec = RESPAWN_DELAY_SEC;
      hitPlayer.taggedCount++;
      hitPlayer.streak = 0;
      hitPlayer.overdriveSec = 0;

      shooter.tags++;
      shooter.streak++;
      pointsAwarded = 100 + (isHeadshot ? 50 : 0) + Math.min(150, (shooter.streak - 1) * 25);
      shooter.score += pointsAwarded;

      if (shooter.team === 'cobalt') room.cobaltScore += pointsAwarded;
      else room.solarScore += pointsAwarded;

      const kf: KillFeedEvent = {
        id: `kf-${room.eventCounter++}`,
        timestamp: now,
        attackerId: shooter.id,
        attackerName: shooter.callsign,
        attackerTeam: shooter.team,
        victimId: hitPlayer.id,
        victimName: hitPlayer.callsign,
        victimTeam: hitPlayer.team,
        weapon,
        headshot: isHeadshot,
      };
      room.killFeed.unshift(kf);
      if (room.killFeed.length > 8) room.killFeed.pop();
      broadcastToRoom(room, { type: 'killfeed', event: kf });

      if (room.cobaltScore >= room.config.targetScore || room.solarScore >= room.config.targetScore) {
        room.phase = 'intermission';
        room.intermissionSec = INTERMISSION_DURATION_SEC;
      }
    } else {
      shooter.score += pointsAwarded;
    }

    sendToSocket(shooter.ws, {
      type: 'hit_confirm',
      victimId: hitPlayer.id,
      victimName: hitPlayer.callsign,
      damage,
      headshot: isHeadshot,
      eliminated,
      points: pointsAwarded,
    });

    sendToSocket(hitPlayer.ws, {
      type: 'damage_taken',
      attackerId: shooter.id,
      attackerName: shooter.callsign,
      attackerTeam: shooter.team,
      damage,
      remainingHealth: Math.round(hitPlayer.health),
      remainingShield: Math.round(hitPlayer.shield),
      eliminated,
      fromX: shooter.x,
      fromZ: shooter.z,
    });
  }
}

function resetMatch(room: ArenaRoom) {
  room.phase = 'active';
  room.timeRemainingSec = MATCH_DURATION_SEC;
  room.intermissionSec = 0;
  room.cobaltScore = 0;
  room.solarScore = 0;
  room.killFeed = [];
  for (const pk of room.pickups) {
    pk.active = true;
    pk.respawnInSec = 0;
  }
  for (const p of room.players.values()) {
    const sp = getSpawnForTeam(p.team, room.players.values());
    p.x = sp.x;
    p.y = sp.y;
    p.z = sp.z;
    p.yaw = sp.yaw;
    p.pitch = 0;
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.health = 100;
    p.shield = 50;
    p.score = 0;
    p.tags = 0;
    p.taggedCount = 0;
    p.streak = 0;
    p.alive = true;
    p.respawnInSec = 0;
    p.overdriveSec = 0;
    p.railCharge = 1;
  }
}

function updateBotAI(room: ArenaRoom, bot: ServerPlayer, dt: number, now: number) {
  if (!bot.alive) return;

  // Find closest visible enemy
  let nearestEnemy: ServerPlayer | null = null;
  let nearestDist = 42;

  for (const other of room.players.values()) {
    if (!other.alive || other.team === bot.team) continue;
    const dx = other.x - bot.x;
    const dy = (other.y + 1.2) - (bot.y + PLAYER_EYE_HEIGHT);
    const dz = other.z - bot.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < nearestDist) {
      const wallHit = raycastArena(bot.x, bot.y + PLAYER_EYE_HEIGHT, bot.z, dx / d, dy / d, dz / d, d);
      if (wallHit.dist >= d - 0.5) {
        nearestDist = d;
        nearestEnemy = other;
      }
    }
  }

  // Movement target: enemy strafe or waypoint
  if (now > bot.strafeSwitchMs) {
    bot.strafeSign = Math.random() < 0.5 ? 1 : -1;
    bot.strafeSwitchMs = now + 1200 + Math.random() * 1800;
  }

  let moveDirX = 0;
  let moveDirZ = 0;
  let targetYaw = bot.yaw;
  let targetPitch = 0;

  if (nearestEnemy) {
    const ex = nearestEnemy.x - bot.x;
    const ey = (nearestEnemy.y + 1.25) - (bot.y + PLAYER_EYE_HEIGHT);
    const ez = nearestEnemy.z - bot.z;
    const horizDist = Math.hypot(ex, ez) || 1;
    targetYaw = Math.atan2(-ex, -ez);
    targetPitch = Math.atan2(ey, horizDist);

    const fwdX = ex / horizDist;
    const fwdZ = ez / horizDist;
    const rightX = -fwdZ;
    const rightZ = fwdX;

    const approach = nearestDist > 16 ? 0.65 : nearestDist < 8 ? -0.45 : 0.1;
    moveDirX = fwdX * approach + rightX * bot.strafeSign * 0.75;
    moveDirZ = fwdZ * approach + rightZ * bot.strafeSign * 0.75;

    // Fire burst with realistic spread
    if (now > bot.aiBurstCooldownMs && nearestDist < 36) {
      const useRail = bot.railCharge >= 1 && Math.random() < 0.25;
      const spread = useRail ? 0.035 : 0.065;
      const aimYaw = targetYaw + (Math.random() - 0.5) * spread;
      const aimPitch = targetPitch + (Math.random() - 0.5) * spread;
      const cosP = Math.cos(aimPitch);
      const aimDx = -Math.sin(aimYaw) * cosP;
      const aimDy = Math.sin(aimPitch);
      const aimDz = -Math.cos(aimYaw) * cosP;
      handleFire(room, bot, useRail ? 'rail' : 'pulse', bot.x, bot.y + PLAYER_EYE_HEIGHT, bot.z, aimDx, aimDy, aimDz);
      bot.aiBurstCooldownMs = now + (useRail ? 450 : 210 + Math.random() * 240);
    }
  } else {
    const wp = BOT_WAYPOINTS[bot.waypointIndex % BOT_WAYPOINTS.length];
    const wx = wp.x - bot.x;
    const wz = wp.z - bot.z;
    const wDist = Math.hypot(wx, wz);
    if (wDist < 2.2) {
      bot.waypointIndex = (bot.waypointIndex + 1 + Math.floor(Math.random() * 3)) % BOT_WAYPOINTS.length;
    } else {
      moveDirX = wx / wDist;
      moveDirZ = wz / wDist;
      targetYaw = Math.atan2(-moveDirX, -moveDirZ);
    }
  }

  // Smooth yaw & pitch
  let yawDiff = targetYaw - bot.yaw;
  while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
  while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
  bot.yaw += yawDiff * Math.min(1, dt * 8);
  bot.pitch += (targetPitch - bot.pitch) * Math.min(1, dt * 8);

  const moveLen = Math.hypot(moveDirX, moveDirZ);
  const speed = bot.overdriveSec > 0 ? 8.8 : 6.6;
  if (moveLen > 0.01) {
    bot.vx = (moveDirX / moveLen) * speed;
    bot.vz = (moveDirZ / moveLen) * speed;
  } else {
    bot.vx = 0;
    bot.vz = 0;
  }

  // Gravity & floor height
  bot.vy -= 22 * dt;
  const nextX = bot.x + bot.vx * dt;
  const nextZ = bot.z + bot.vz * dt;
  let nextY = bot.y + bot.vy * dt;

  const floorY = groundHeightAt(nextX, nextZ, bot.y);
  if (nextY <= floorY) {
    nextY = floorY;
    bot.vy = 0;
  }

  // Jump pads
  for (const jp of JUMP_PADS) {
    if (now > bot.jumpPadCooldownMs && Math.hypot(nextX - jp.x, nextZ - jp.z) < jp.radius && Math.abs(nextY - jp.y) < 0.8) {
      bot.vy = jp.boostY;
      bot.jumpPadCooldownMs = now + 800;
    }
  }

  const resolved = resolveHorizontalCollision(nextX, nextY, nextZ, PLAYER_RADIUS);
  // If blocked while patrolling, pick another waypoint
  if (!nearestEnemy && Math.hypot(resolved.x - bot.x, resolved.z - bot.z) < 0.03) {
    bot.waypointIndex = Math.floor(Math.random() * BOT_WAYPOINTS.length);
  }
  bot.x = resolved.x;
  bot.y = nextY;
  bot.z = resolved.z;
}

function tickRooms(dt: number) {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.phase === 'active') {
      room.timeRemainingSec -= dt;
      if (room.timeRemainingSec <= 0) {
        room.timeRemainingSec = 0;
        room.phase = 'intermission';
        room.intermissionSec = INTERMISSION_DURATION_SEC;
      }
    } else {
      room.intermissionSec -= dt;
      if (room.intermissionSec <= 0) {
        resetMatch(room);
      }
    }

    // Update pickups
    for (const pk of room.pickups) {
      if (!pk.active) {
        pk.respawnInSec -= dt;
        if (pk.respawnInSec <= 0) {
          pk.active = true;
          pk.respawnInSec = 0;
        }
      }
    }

    // Update players & bots
    for (const p of room.players.values()) {
      if (p.overdriveSec > 0) p.overdriveSec = Math.max(0, p.overdriveSec - dt);
      if (p.railCharge < 1) {
        const rate = p.overdriveSec > 0 ? 0.6 : 0.38;
        p.railCharge = Math.min(1, p.railCharge + dt * rate);
      }

      if (!p.alive) {
        p.respawnInSec -= dt;
        if (p.respawnInSec <= 0 && room.phase === 'active') {
          const sp = getSpawnForTeam(p.team, room.players.values());
          p.x = sp.x;
          p.y = sp.y;
          p.z = sp.z;
          p.yaw = sp.yaw;
          p.pitch = 0;
          p.vx = 0;
          p.vy = 0;
          p.vz = 0;
          p.health = 100;
          p.shield = 50;
          p.alive = true;
          p.respawnInSec = 0;
        }
        continue;
      }

      // Passive shield recharge after 4.5s out of combat
      if (now - p.lastDamagedMs > 4500 && p.shield < p.maxShield) {
        p.shield = Math.min(p.maxShield, p.shield + 9 * dt);
      }

      if (p.isBot && room.phase === 'active') {
        updateBotAI(room, p, dt, now);
      }

      // Pickup collision
      for (const pk of room.pickups) {
        if (!pk.active) continue;
        if (Math.hypot(p.x - pk.x, p.z - pk.z) < 1.65 && Math.abs(p.y - pk.y) < 1.8) {
          pk.active = false;
          pk.respawnInSec = pk.kind === 'overdrive' ? 20 : 12;
          if (pk.kind === 'shield') {
            p.shield = p.maxShield;
            p.health = Math.min(p.maxHealth, p.health + 35);
          } else {
            p.overdriveSec = 12;
            p.railCharge = 1;
          }
          broadcastToRoom(room, {
            type: 'pickup',
            pickupId: pk.id,
            kind: pk.kind,
            playerId: p.id,
          });
        }
      }
    }

    // Broadcast authoritative snapshot if at least 1 human is in the room
    let hasHumans = false;
    for (const p of room.players.values()) {
      if (!p.isBot) {
        hasHumans = true;
        break;
      }
    }
    if (hasHumans) {
      broadcastToRoom(room, {
        type: 'snapshot',
        snapshot: buildSnapshot(room),
      });
    }
  }
}

async function startServer() {
  for (const cfg of ROOM_CONFIGS) {
    rooms.set(cfg.id, createRoom(cfg));
  }

  const app = express();
  app.use(express.json());

  app.get('/api/rooms', (_req, res) => {
    const summaries: RoomSummary[] = [];
    for (const room of rooms.values()) {
      let humanCount = 0;
      for (const p of room.players.values()) {
        if (!p.isBot) humanCount++;
      }
      summaries.push({
        id: room.config.id,
        name: room.config.name,
        subtitle: room.config.subtitle,
        humanCount,
        totalCombatants: room.players.size,
        maxCombatants: room.config.maxCombatants,
        cobaltScore: room.cobaltScore,
        solarScore: room.solarScore,
        timeRemainingSec: Math.ceil(room.timeRemainingSec),
      });
    }
    res.json({ rooms: summaries });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }

      if (msg.type === 'ping') {
        sendToSocket(ws, { type: 'pong', t: msg.t });
        return;
      }

      if (msg.type === 'join') {
        // Leave existing room if already connected
        const prev = clientRooms.get(ws);
        if (prev) {
          const oldRoom = rooms.get(prev.roomId);
          if (oldRoom) {
            oldRoom.players.delete(prev.playerId);
            balanceRoomBots(oldRoom);
          }
        }

        const room = rooms.get(msg.roomId) || rooms.get('apex-stadium')!;
        room.botFill = msg.botFill;

        const cleanName = (msg.callsign || 'Striker').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 16) || 'Striker';
        const team = pickBalancedTeam(room, msg.teamPreference);
        const playerId = `ply-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const sp = getSpawnForTeam(team, room.players.values());

        const humanPlayer: ServerPlayer = {
          id: playerId,
          callsign: cleanName,
          team,
          isBot: false,
          ws,
          x: sp.x,
          y: sp.y,
          z: sp.z,
          yaw: sp.yaw,
          pitch: 0,
          vx: 0,
          vy: 0,
          vz: 0,
          health: 100,
          maxHealth: 100,
          shield: 50,
          maxShield: 50,
          score: 0,
          tags: 0,
          taggedCount: 0,
          streak: 0,
          alive: true,
          respawnInSec: 0,
          overdriveSec: 0,
          railCharge: 1,
          lastFireMs: 0,
          lastDamagedMs: 0,
          jumpPadCooldownMs: 0,
          waypointIndex: 0,
          strafeSign: 1,
          strafeSwitchMs: 0,
          aiBurstCooldownMs: 0,
        };

        room.players.set(playerId, humanPlayer);
        balanceRoomBots(room);
        clientRooms.set(ws, { roomId: room.config.id, playerId });

        sendToSocket(ws, {
          type: 'init',
          playerId,
          snapshot: buildSnapshot(room),
          killFeed: room.killFeed,
        });
        return;
      }

      const binding = clientRooms.get(ws);
      if (!binding) return;
      const room = rooms.get(binding.roomId);
      if (!room) return;
      const player = room.players.get(binding.playerId);
      if (!player) return;

      if (msg.type === 'state') {
        if (!player.alive) return;
        const clampedX = Math.max(-ARENA_HALF_SIZE, Math.min(ARENA_HALF_SIZE, msg.x));
        const clampedZ = Math.max(-ARENA_HALF_SIZE, Math.min(ARENA_HALF_SIZE, msg.z));
        const clampedY = Math.max(0, Math.min(16, msg.y));
        const resolved = resolveHorizontalCollision(clampedX, clampedY, clampedZ, PLAYER_RADIUS);
        player.x = resolved.x;
        player.y = clampedY;
        player.z = resolved.z;
        player.yaw = msg.yaw;
        player.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, msg.pitch));
        player.vx = msg.vx;
        player.vy = msg.vy;
        player.vz = msg.vz;
      } else if (msg.type === 'fire') {
        handleFire(room, player, msg.weapon, msg.ox, msg.oy, msg.oz, msg.dx, msg.dy, msg.dz);
      }
    });

    ws.on('close', () => {
      const binding = clientRooms.get(ws);
      if (binding) {
        const room = rooms.get(binding.roomId);
        if (room) {
          room.players.delete(binding.playerId);
          balanceRoomBots(room);
        }
        clientRooms.delete(ws);
      }
    });
  });

  // 20Hz authoritative simulation loop
  const TICK_MS = 50;
  setInterval(() => {
    tickRooms(TICK_MS / 1000);
  }, TICK_MS);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Prism Arena server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
