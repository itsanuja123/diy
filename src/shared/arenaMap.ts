import type { TeamId } from './types.ts';

export const ARENA_HALF_SIZE = 46;
export const ARENA_CEILING = 18;
export const PLAYER_RADIUS = 0.48;
export const PLAYER_EYE_HEIGHT = 1.62;
export const PLAYER_HEIGHT = 1.85;

export interface ArenaBlock {
  id: string;
  x: number;
  y: number; // bottom Y
  z: number;
  w: number;
  h: number;
  d: number;
  kind: 'wall' | 'pillar' | 'platform' | 'ramp' | 'spire' | 'railing';
  teamTint?: TeamId | 'neutral';
  rampDir?: 'n' | 's' | 'e' | 'w'; // direction going UP
}

export interface JumpPadDef {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  boostY: number;
}

export interface PickupDef {
  id: string;
  kind: 'shield' | 'overdrive';
  x: number;
  y: number;
  z: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  yaw: number;
  team: TeamId;
}

export const ARENA_BLOCKS: ArenaBlock[] = [
  // Perimeter Arena Walls
  { id: 'wall-n', x: 0, y: 0, z: -47, w: 96, h: 16, d: 2, kind: 'wall', teamTint: 'neutral' },
  { id: 'wall-s', x: 0, y: 0, z: 47, w: 96, h: 16, d: 2, kind: 'wall', teamTint: 'neutral' },
  { id: 'wall-w', x: -47, y: 0, z: 0, w: 2, h: 16, d: 96, kind: 'wall', teamTint: 'neutral' },
  { id: 'wall-e', x: 47, y: 0, z: 0, w: 2, h: 16, d: 96, kind: 'wall', teamTint: 'neutral' },

  // Central Reactor Platform (elevated octagon-like deck)
  { id: 'center-deck', x: 0, y: 0, z: 0, w: 14, h: 2.4, d: 14, kind: 'platform', teamTint: 'neutral' },
  { id: 'center-spire', x: 0, y: 2.4, z: 0, w: 2.6, h: 7.5, d: 2.6, kind: 'spire', teamTint: 'neutral' },

  // 4 Ramps onto Central Deck
  { id: 'ramp-c-n', x: 0, y: 0, z: -10.5, w: 4.8, h: 2.4, d: 7, kind: 'ramp', rampDir: 's', teamTint: 'neutral' },
  { id: 'ramp-c-s', x: 0, y: 0, z: 10.5, w: 4.8, h: 2.4, d: 7, kind: 'ramp', rampDir: 'n', teamTint: 'neutral' },
  { id: 'ramp-c-w', x: -10.5, y: 0, z: 0, w: 7, h: 2.4, d: 4.8, kind: 'ramp', rampDir: 'e', teamTint: 'neutral' },
  { id: 'ramp-c-e', x: 10.5, y: 0, z: 0, w: 7, h: 2.4, d: 4.8, kind: 'ramp', rampDir: 'w', teamTint: 'neutral' },

  // West Elevated Catwalk & Ramps (Cobalt side flank)
  { id: 'catwalk-w', x: -25, y: 2.9, z: 0, w: 5.5, h: 0.5, d: 24, kind: 'platform', teamTint: 'cobalt' },
  { id: 'catwalk-w-col1', x: -25, y: 0, z: -9, w: 1.8, h: 2.9, d: 1.8, kind: 'pillar', teamTint: 'cobalt' },
  { id: 'catwalk-w-col2', x: -25, y: 0, z: 9, w: 1.8, h: 2.9, d: 1.8, kind: 'pillar', teamTint: 'cobalt' },
  { id: 'ramp-w-n', x: -25, y: 0, z: -16.5, w: 4.5, h: 3.4, d: 9, kind: 'ramp', rampDir: 's', teamTint: 'cobalt' },
  { id: 'ramp-w-s', x: -25, y: 0, z: 16.5, w: 4.5, h: 3.4, d: 9, kind: 'ramp', rampDir: 'n', teamTint: 'cobalt' },
  { id: 'rail-w-e', x: -22.4, y: 3.4, z: 0, w: 0.3, h: 0.9, d: 20, kind: 'railing', teamTint: 'cobalt' },

  // East Elevated Catwalk & Ramps (Solar side flank)
  { id: 'catwalk-e', x: 25, y: 2.9, z: 0, w: 5.5, h: 0.5, d: 24, kind: 'platform', teamTint: 'solar' },
  { id: 'catwalk-e-col1', x: 25, y: 0, z: -9, w: 1.8, h: 2.9, d: 1.8, kind: 'pillar', teamTint: 'solar' },
  { id: 'catwalk-e-col2', x: 25, y: 0, z: 9, w: 1.8, h: 2.9, d: 1.8, kind: 'pillar', teamTint: 'solar' },
  { id: 'ramp-e-n', x: 25, y: 0, z: -16.5, w: 4.5, h: 3.4, d: 9, kind: 'ramp', rampDir: 's', teamTint: 'solar' },
  { id: 'ramp-e-s', x: 25, y: 0, z: 16.5, w: 4.5, h: 3.4, d: 9, kind: 'ramp', rampDir: 'n', teamTint: 'solar' },
  { id: 'rail-e-w', x: 22.4, y: 3.4, z: 0, w: 0.3, h: 0.9, d: 20, kind: 'railing', teamTint: 'solar' },

  // Cobalt Spawn Bay Baffles (North-West Corner)
  { id: 'spawn-cb-1', x: -34, y: 0, z: -30, w: 9, h: 3.8, d: 1.8, kind: 'wall', teamTint: 'cobalt' },
  { id: 'spawn-cb-2', x: -30, y: 0, z: -36, w: 1.8, h: 3.8, d: 7, kind: 'wall', teamTint: 'cobalt' },
  { id: 'bunker-nw', x: -16, y: 0, z: -22, w: 6, h: 3.2, d: 2.2, kind: 'pillar', teamTint: 'cobalt' },

  // Solar Spawn Bay Baffles (South-East Corner)
  { id: 'spawn-sl-1', x: 34, y: 0, z: 30, w: 9, h: 3.8, d: 1.8, kind: 'wall', teamTint: 'solar' },
  { id: 'spawn-sl-2', x: 30, y: 0, z: 36, w: 1.8, h: 3.8, d: 7, kind: 'wall', teamTint: 'solar' },
  { id: 'bunker-se', x: 16, y: 0, z: 22, w: 6, h: 3.2, d: 2.2, kind: 'pillar', teamTint: 'solar' },

  // Symmetrical Mid-Field Tactical Pillars & Cover Monoliths
  { id: 'cover-ne-1', x: 16, y: 0, z: -22, w: 6, h: 3.2, d: 2.2, kind: 'pillar', teamTint: 'neutral' },
  { id: 'cover-sw-1', x: -16, y: 0, z: 22, w: 6, h: 3.2, d: 2.2, kind: 'pillar', teamTint: 'neutral' },

  { id: 'pillar-nw', x: -14, y: 0, z: -12, w: 2.6, h: 8, d: 2.6, kind: 'pillar', teamTint: 'cobalt' },
  { id: 'pillar-ne', x: 14, y: 0, z: -12, w: 2.6, h: 8, d: 2.6, kind: 'pillar', teamTint: 'neutral' },
  { id: 'pillar-sw', x: -14, y: 0, z: 12, w: 2.6, h: 8, d: 2.6, kind: 'pillar', teamTint: 'neutral' },
  { id: 'pillar-se', x: 14, y: 0, z: 12, w: 2.6, h: 8, d: 2.6, kind: 'pillar', teamTint: 'solar' },

  // North & South Corridor Barriers
  { id: 'bar-n-1', x: 0, y: 0, z: -31, w: 12, h: 2.6, d: 2, kind: 'wall', teamTint: 'neutral' },
  { id: 'bar-n-2', x: -12, y: 0, z: -37, w: 2.2, h: 4.5, d: 6, kind: 'pillar', teamTint: 'cobalt' },
  { id: 'bar-n-3', x: 12, y: 0, z: -37, w: 2.2, h: 4.5, d: 6, kind: 'pillar', teamTint: 'solar' },

  { id: 'bar-s-1', x: 0, y: 0, z: 31, w: 12, h: 2.6, d: 2, kind: 'wall', teamTint: 'neutral' },
  { id: 'bar-s-2', x: -12, y: 0, z: 37, w: 2.2, h: 4.5, d: 6, kind: 'pillar', teamTint: 'cobalt' },
  { id: 'bar-s-3', x: 12, y: 0, z: 37, w: 2.2, h: 4.5, d: 6, kind: 'pillar', teamTint: 'solar' },

  // Outer Corner Heavy Towers (NE & SW flank objectives)
  { id: 'tower-ne', x: 34, y: 0, z: -34, w: 5.5, h: 6.5, d: 5.5, kind: 'pillar', teamTint: 'neutral' },
  { id: 'tower-sw', x: -34, y: 0, z: 34, w: 5.5, h: 6.5, d: 5.5, kind: 'pillar', teamTint: 'neutral' },

  // Low Tactical Waist Cover near Center
  { id: 'low-n', x: 0, y: 0, z: -20, w: 6, h: 1.35, d: 1.4, kind: 'railing', teamTint: 'neutral' },
  { id: 'low-s', x: 0, y: 0, z: 20, w: 6, h: 1.35, d: 1.4, kind: 'railing', teamTint: 'neutral' },
];

export const JUMP_PADS: JumpPadDef[] = [
  { id: 'jp-w', x: -19, y: 0, z: 0, radius: 1.9, boostY: 14.5 },
  { id: 'jp-e', x: 19, y: 0, z: 0, radius: 1.9, boostY: 14.5 },
  { id: 'jp-sw', x: -24, y: 0, z: 27, radius: 1.9, boostY: 13.5 },
  { id: 'jp-ne', x: 24, y: 0, z: -27, radius: 1.9, boostY: 13.5 },
];

export const PICKUP_DEFS: PickupDef[] = [
  { id: 'pk-overdrive-center', kind: 'overdrive', x: 0, y: 2.4, z: 4.2 },
  { id: 'pk-overdrive-n', kind: 'overdrive', x: 0, y: 0, z: -36 },
  { id: 'pk-shield-w', kind: 'shield', x: -25, y: 3.4, z: 0 },
  { id: 'pk-shield-e', kind: 'shield', x: 25, y: 3.4, z: 0 },
  { id: 'pk-shield-ne', kind: 'shield', x: 28, y: 0, z: -28 },
  { id: 'pk-shield-sw', kind: 'shield', x: -28, y: 0, z: 28 },
];

export const SPAWN_POINTS: SpawnPoint[] = [
  // Cobalt (North-West / West)
  { x: -39, y: 0, z: -39, yaw: -Math.PI * 0.75, team: 'cobalt' },
  { x: -41, y: 0, z: -28, yaw: -Math.PI * 0.55, team: 'cobalt' },
  { x: -27, y: 0, z: -41, yaw: -Math.PI * 0.85, team: 'cobalt' },
  { x: -39, y: 0, z: -12, yaw: -Math.PI * 0.5, team: 'cobalt' },
  { x: -18, y: 0, z: -39, yaw: Math.PI, team: 'cobalt' },
  { x: -38, y: 0, z: 10, yaw: -Math.PI * 0.4, team: 'cobalt' },

  // Solar (South-East / East)
  { x: 39, y: 0, z: 39, yaw: Math.PI * 0.25, team: 'solar' },
  { x: 41, y: 0, z: 28, yaw: Math.PI * 0.45, team: 'solar' },
  { x: 27, y: 0, z: 41, yaw: Math.PI * 0.15, team: 'solar' },
  { x: 39, y: 0, z: 12, yaw: Math.PI * 0.5, team: 'solar' },
  { x: 18, y: 0, z: 39, yaw: 0, team: 'solar' },
  { x: 38, y: 0, z: -10, yaw: Math.PI * 0.6, team: 'solar' },
];

export const BOT_WAYPOINTS: Array<{ x: number; z: number }> = [
  { x: 0, z: 4 },
  { x: 0, z: -4 },
  { x: 0, z: -24 },
  { x: 0, z: 24 },
  { x: -25, z: 0 },
  { x: 25, z: 0 },
  { x: -25, z: -12 },
  { x: 25, z: 12 },
  { x: -19, z: 16 },
  { x: 19, z: -16 },
  { x: -34, z: 22 },
  { x: 34, z: -22 },
  { x: -10, z: -34 },
  { x: 10, z: 34 },
];

export function getRampSurfaceY(block: ArenaBlock, x: number, z: number): number {
  const halfW = block.w / 2;
  const halfD = block.d / 2;
  let t = 0;
  if (block.rampDir === 's') {
    t = (z - (block.z - halfD)) / block.d;
  } else if (block.rampDir === 'n') {
    t = ((block.z + halfD) - z) / block.d;
  } else if (block.rampDir === 'e') {
    t = (x - (block.x - halfW)) / block.w;
  } else if (block.rampDir === 'w') {
    t = ((block.x + halfW) - x) / block.w;
  }
  const clamped = Math.max(0, Math.min(1, t));
  return block.y + clamped * block.h;
}

/**
 * Computes the walkable floor height at (x, z) reachable from currentY.
 */
export function groundHeightAt(x: number, z: number, currentY: number): number {
  let maxFloor = 0;
  for (let i = 0; i < ARENA_BLOCKS.length; i++) {
    const b = ARENA_BLOCKS[i];
    const halfW = b.w / 2 + 0.15;
    const halfD = b.d / 2 + 0.15;
    if (x < b.x - halfW || x > b.x + halfW || z < b.z - halfD || z > b.z + halfD) {
      continue;
    }

    if (b.kind === 'ramp') {
      const rampTop = getRampSurfaceY(b, x, z);
      if (rampTop <= currentY + 0.9 && rampTop > maxFloor) {
        maxFloor = rampTop;
      }
    } else if (b.kind === 'platform') {
      const topY = b.y + b.h;
      if (topY <= currentY + 0.65 && topY > maxFloor) {
        maxFloor = topY;
      }
    }
  }
  return maxFloor;
}

/**
 * Resolves horizontal circle-vs-AABB collisions for a player at (x, y, z).
 */
export function resolveHorizontalCollision(
  x: number,
  y: number,
  z: number,
  radius: number = PLAYER_RADIUS,
): { x: number; z: number } {
  let px = Math.max(-ARENA_HALF_SIZE + radius, Math.min(ARENA_HALF_SIZE - radius, x));
  let pz = Math.max(-ARENA_HALF_SIZE + radius, Math.min(ARENA_HALF_SIZE - radius, z));

  const feetStep = y + 0.55; // allows stepping onto ramps & low ledges
  const headY = y + PLAYER_HEIGHT;

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < ARENA_BLOCKS.length; i++) {
      const b = ARENA_BLOCKS[i];
      if (b.kind === 'ramp') continue; // ramps are walkable slopes

      const topY = b.y + b.h;
      if (topY <= feetStep || b.y >= headY) continue;

      const minX = b.x - b.w / 2;
      const maxX = b.x + b.w / 2;
      const minZ = b.z - b.d / 2;
      const maxZ = b.z + b.d / 2;

      const closestX = Math.max(minX, Math.min(px, maxX));
      const closestZ = Math.max(minZ, Math.min(pz, maxZ));

      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const overlap = radius - dist;
          px += (dx / dist) * overlap;
          pz += (dz / dist) * overlap;
        } else {
          // Inside box center fallback: push out along nearest edge
          const leftPen = Math.abs(px - minX);
          const rightPen = Math.abs(maxX - px);
          const topPen = Math.abs(pz - minZ);
          const botPen = Math.abs(maxZ - pz);
          const minPen = Math.min(leftPen, rightPen, topPen, botPen);
          if (minPen === leftPen) px = minX - radius;
          else if (minPen === rightPen) px = maxX + radius;
          else if (minPen === topPen) pz = minZ - radius;
          else pz = maxZ + radius;
        }
      }
    }
  }

  return { x: px, z: pz };
}

export interface ArenaRayHit {
  dist: number;
  nx: number;
  ny: number;
  nz: number;
}

/**
 * Exact slab raycast against all solid arena blocks (walls, pillars, platforms, spires, railings).
 */
export function raycastArena(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number = 140,
): ArenaRayHit {
  let closestDist = maxDist;
  let hitNx = 0;
  let hitNy = 1;
  let hitNz = 0;

  // Floor plane y = 0
  if (dy < -1e-6 && oy > 0) {
    const tFloor = -oy / dy;
    if (tFloor > 0 && tFloor < closestDist) {
      closestDist = tFloor;
      hitNx = 0;
      hitNy = 1;
      hitNz = 0;
    }
  }

  // Ceiling plane y = ARENA_CEILING
  if (dy > 1e-6 && oy < ARENA_CEILING) {
    const tCeil = (ARENA_CEILING - oy) / dy;
    if (tCeil > 0 && tCeil < closestDist) {
      closestDist = tCeil;
      hitNx = 0;
      hitNy = -1;
      hitNz = 0;
    }
  }

  for (let i = 0; i < ARENA_BLOCKS.length; i++) {
    const b = ARENA_BLOCKS[i];
    if (b.kind === 'ramp') continue; // ramps handled simply as sloped visual/walkable; skip AABB shadow for crisp shots

    const minX = b.x - b.w / 2;
    const maxX = b.x + b.w / 2;
    const minY = b.y;
    const maxY = b.y + b.h;
    const minZ = b.z - b.d / 2;
    const maxZ = b.z + b.d / 2;

    let tmin = 0;
    let tmax = closestDist;
    let nx = 0;
    let ny = 0;
    let nz = 0;

    // X slab
    if (Math.abs(dx) < 1e-8) {
      if (ox < minX || ox > maxX) continue;
    } else {
      const invD = 1 / dx;
      let t1 = (minX - ox) * invD;
      let t2 = (maxX - ox) * invD;
      let s = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        s = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        nx = s;
        ny = 0;
        nz = 0;
      }
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    // Y slab
    if (Math.abs(dy) < 1e-8) {
      if (oy < minY || oy > maxY) continue;
    } else {
      const invD = 1 / dy;
      let t1 = (minY - oy) * invD;
      let t2 = (maxY - oy) * invD;
      let s = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        s = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        nx = 0;
        ny = s;
        nz = 0;
      }
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    // Z slab
    if (Math.abs(dz) < 1e-8) {
      if (oz < minZ || oz > maxZ) continue;
    } else {
      const invD = 1 / dz;
      let t1 = (minZ - oz) * invD;
      let t2 = (maxZ - oz) * invD;
      let s = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        s = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        nx = 0;
        ny = 0;
        nz = s;
      }
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) continue;
    }

    if (tmin > 0 && tmin < closestDist) {
      closestDist = tmin;
      hitNx = nx;
      hitNy = ny;
      hitNz = nz;
    }
  }

  return { dist: closestDist, nx: hitNx, ny: hitNy, nz: hitNz };
}
