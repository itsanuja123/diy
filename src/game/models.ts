import * as THREE from 'three';
import {
  ARENA_BLOCKS,
  ARENA_CEILING,
  ARENA_HALF_SIZE,
  JUMP_PADS,
  type ArenaBlock,
} from '../shared/arenaMap.ts';
import type { TeamId } from '../shared/types.ts';
import type { ProceduralTextureSet } from './textures.ts';

export const TEAM_HEX: Record<TeamId, number> = {
  cobalt: 0x06b6d4,
  solar: 0xf59e0b,
};

export interface PlayerRig {
  root: THREE.Group;
  armPivot: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  shieldAura: THREE.Mesh;
  muzzlePoint: THREE.Object3D;
  emissiveMaterials: THREE.MeshStandardMaterial[];
}

export interface LaserRifleRig {
  root: THREE.Group;
  coreMesh: THREE.Mesh;
  coreMaterial: THREE.MeshStandardMaterial;
  railChargeBar: THREE.Mesh;
  muzzlePoint: THREE.Object3D;
}

export function buildLaserRifleViewmodel(team: TeamId): LaserRifleRig {
  const accentColor = TEAM_HEX[team];
  const root = new THREE.Group();

  const matteChassisMat = new THREE.MeshStandardMaterial({
    color: 0x161c26,
    roughness: 0.72,
    metalness: 0.25,
  });
  const brushedTitaniumMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.26,
    metalness: 0.9,
  });
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 2.2,
    roughness: 0.2,
    metalness: 0.1,
  });
  const opticGlassMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
    metalness: 0.2,
  });

  // 1. Main Receiver Hull
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.48), matteChassisMat);
  receiver.position.set(0, 0, -0.15);
  root.add(receiver);

  // 2. Brushed Titanium Upper Shroud
  const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.055, 0.42), brushedTitaniumMat);
  shroud.position.set(0, 0.065, -0.2);
  root.add(shroud);

  // 3. Twin Emitter Barrel Prongs
  const upperBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.026, 0.34), brushedTitaniumMat);
  upperBarrel.position.set(0, 0.045, -0.5);
  root.add(upperBarrel);

  const lowerBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.03, 0.3), matteChassisMat);
  lowerBarrel.position.set(0, -0.015, -0.48);
  root.add(lowerBarrel);

  // 4. Glowing Plasma Core Conduit
  const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.38, 10), coreMaterial);
  coreMesh.rotation.x = Math.PI / 2;
  coreMesh.position.set(0, 0.018, -0.34);
  root.add(coreMesh);

  // 5. Left & Right Cooling Fins
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.06, 0.18), brushedTitaniumMat);
    fin.position.set(side * 0.054, 0.02, -0.22);
    root.add(fin);
  }

  // 6. Holographic Sight Frame & Optic Lens
  const sightRing = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.005, 8, 20), matteChassisMat);
  sightRing.position.set(0, 0.118, -0.12);
  root.add(sightRing);

  const opticDot = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), opticGlassMat);
  opticDot.position.set(0, 0.118, -0.12);
  root.add(opticDot);

  // 7. Side Rail-Charge Telemetry Strip
  const railChargeBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, 0.016, 0.22),
    coreMaterial.clone(),
  );
  railChargeBar.position.set(-0.048, 0.048, -0.18);
  root.add(railChargeBar);

  // 8. Angled Foregrip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.055), matteChassisMat);
  grip.position.set(0, -0.09, -0.04);
  grip.rotation.x = 0.28;
  root.add(grip);

  // 9. Muzzle Emitter Tip
  const muzzleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.04, 12), coreMaterial);
  muzzleTip.rotation.x = Math.PI / 2;
  muzzleTip.position.set(0, 0.018, -0.66);
  root.add(muzzleTip);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.018, -0.7);
  root.add(muzzlePoint);

  return { root, coreMesh, coreMaterial, railChargeBar, muzzlePoint };
}

export function buildPlayerRig(team: TeamId, contactShadowTex: THREE.Texture): PlayerRig {
  const accent = TEAM_HEX[team];
  const root = new THREE.Group();
  const emissiveMaterials: THREE.MeshStandardMaterial[] = [];

  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x1a2233,
    roughness: 0.65,
    metalness: 0.3,
  });
  const alloyMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.28,
    metalness: 0.85,
  });
  const teamGlowMat = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 1.9,
    roughness: 0.25,
    metalness: 0.1,
  });
  emissiveMaterials.push(teamGlowMat);

  // Grounding Contact Shadow
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 1.3),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.6,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  // 1-2. Left & Right Leg Struts (pivoted at hip y = 0.8)
  const legGeo = new THREE.BoxGeometry(0.22, 0.78, 0.24);
  const leftLeg = new THREE.Mesh(legGeo, armorMat);
  leftLeg.position.set(-0.16, 0.4, 0);
  leftLeg.castShadow = true;
  root.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, armorMat);
  rightLeg.position.set(0.16, 0.4, 0);
  rightLeg.castShadow = true;
  root.add(rightLeg);

  // 3. Armored Torso Chassis
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.64, 0.32), armorMat);
  torso.position.set(0, 1.08, 0);
  torso.castShadow = true;
  root.add(torso);

  // 4. Front & Back Laser-Tag Vest Target Sensors
  const frontSensor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.04), teamGlowMat);
  frontSensor.position.set(0, 1.12, -0.17);
  root.add(frontSensor);

  const backSensor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.05), teamGlowMat);
  backSensor.position.set(0, 1.1, 0.17);
  root.add(backSensor);

  // 5-6. Shoulder Pauldrons (Brushed Alloy)
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.34), alloyMat);
    pauldron.position.set(side * 0.36, 1.31, 0);
    pauldron.castShadow = true;
    root.add(pauldron);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.36), teamGlowMat);
    trim.position.set(side * 0.44, 1.31, 0);
    root.add(trim);
  }

  // 7. Helmet & Visor Slit
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.36), alloyMat);
  helmet.position.set(0, 1.58, 0);
  helmet.castShadow = true;
  root.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.05), teamGlowMat);
  visor.position.set(0, 1.59, -0.17);
  root.add(visor);

  // 8. Aiming Arm + Laser Carbine Pivot
  const armPivot = new THREE.Group();
  armPivot.position.set(0.28, 1.24, -0.05);
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.65), alloyMat);
  gunBody.position.set(0, -0.04, -0.32);
  armPivot.add(gunBody);

  const gunStrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.56), teamGlowMat);
  gunStrip.position.set(0, 0.03, -0.34);
  armPivot.add(gunStrip);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, -0.02, -0.66);
  armPivot.add(muzzlePoint);
  root.add(armPivot);

  // 9. Energy Shield Shimmer Shell
  const shieldAura = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 1.85, 14, 1, true),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  shieldAura.position.y = 0.95;
  root.add(shieldAura);

  return { root, armPivot, leftLeg, rightLeg, shieldAura, muzzlePoint, emissiveMaterials };
}

export function buildPickupMesh(kind: 'shield' | 'overdrive'): THREE.Group {
  const group = new THREE.Group();
  const color = kind === 'overdrive' ? 0xf43f5e : 0x38bdf8;

  const coreMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.2,
    roughness: 0.15,
    metalness: 0.2,
  });

  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), coreMat);
  crystal.position.y = 1.05;
  group.add(crystal);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.25,
    metalness: 0.85,
  });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 8, 24), ringMat);
  ring1.position.y = 1.05;
  group.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.025, 8, 24), coreMat);
  ring2.position.y = 1.05;
  ring2.rotation.x = Math.PI / 2;
  group.add(ring2);

  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.78, 0.12, 16),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.7 }),
  );
  pad.position.y = 0.06;
  group.add(pad);

  group.userData = { crystal, ring1, ring2 };
  return group;
}

export interface ArenaVisualRefs {
  spireCrystal: THREE.Mesh;
  spireRingA: THREE.Mesh;
  spireRingB: THREE.Mesh;
  jumpPadRings: THREE.Mesh[];
}

function buildSlopedRampMesh(b: ArenaBlock, mat: THREE.Material): THREE.Mesh {
  // Build a right-wedge prism geometry aligned to b.w, b.h, b.d
  const hw = b.w / 2;
  const hd = b.d / 2;
  const h = b.h;

  // Define slope vertices depending on rampDir (direction going UP)
  let positions: Float32Array;
  if (b.rampDir === 's') {
    // Low at -Z, High at +Z
    positions = new Float32Array([
      // Top sloped face (2 tris)
      -hw, 0, -hd,  -hw, h, hd,  hw, h, hd,
      -hw, 0, -hd,  hw, h, hd,  hw, 0, -hd,
      // Back face (+Z)
      -hw, 0, hd,  hw, 0, hd,  hw, h, hd,
      -hw, 0, hd,  hw, h, hd,  -hw, h, hd,
      // Left side (-X)
      -hw, 0, -hd,  -hw, 0, hd,  -hw, h, hd,
      // Right side (+X)
      hw, 0, -hd,  hw, h, hd,  hw, 0, hd,
    ]);
  } else if (b.rampDir === 'n') {
    // Low at +Z, High at -Z
    positions = new Float32Array([
      -hw, h, -hd,  -hw, 0, hd,  hw, 0, hd,
      -hw, h, -hd,  hw, 0, hd,  hw, h, -hd,
      -hw, 0, -hd,  -hw, h, -hd,  hw, h, -hd,
      -hw, 0, -hd,  hw, h, -hd,  hw, 0, -hd,
      -hw, 0, -hd,  -hw, 0, hd,  -hw, h, -hd,
      hw, 0, -hd,  hw, h, -hd,  hw, 0, hd,
    ]);
  } else if (b.rampDir === 'e') {
    // Low at -X, High at +X
    positions = new Float32Array([
      -hw, 0, -hd,  -hw, 0, hd,  hw, h, hd,
      -hw, 0, -hd,  hw, h, hd,  hw, h, -hd,
      hw, 0, -hd,  hw, 0, hd,  hw, h, hd,
      hw, 0, -hd,  hw, h, hd,  hw, h, -hd,
      -hw, 0, -hd,  hw, h, -hd,  hw, 0, -hd,
      -hw, 0, hd,  hw, 0, hd,  hw, h, hd,
    ]);
  } else {
    // 'w': Low at +X, High at -X
    positions = new Float32Array([
      -hw, h, -hd,  -hw, h, hd,  hw, 0, hd,
      -hw, h, -hd,  hw, 0, hd,  hw, 0, -hd,
      -hw, 0, -hd,  -hw, h, -hd,  -hw, h, hd,
      -hw, 0, -hd,  -hw, h, hd,  -hw, 0, hd,
      -hw, 0, -hd,  -hw, h, -hd,  hw, 0, -hd,
      -hw, 0, hd,  hw, 0, hd,  -hw, h, hd,
    ]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // Generate simple planar UVs from XZ
  const uvs = new Float32Array((positions.length / 3) * 2);
  for (let i = 0; i < positions.length / 3; i++) {
    uvs[i * 2] = (positions[i * 3] + hw) / 2;
    uvs[i * 2 + 1] = (positions[i * 3 + 2] + hd) / 2;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(b.x, b.y, b.z);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

export function buildArenaSceneMeshes(scene: THREE.Scene, textures: ProceduralTextureSet): ArenaVisualRefs {
  // Arena Floor
  const floorMat = new THREE.MeshStandardMaterial({
    map: textures.floorColor,
    emissive: 0xffffff,
    emissiveMap: textures.floorEmissive,
    emissiveIntensity: 0.9,
    roughness: 0.42,
    metalness: 0.55,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_HALF_SIZE * 2 + 4, ARENA_HALF_SIZE * 2 + 4), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Stadium Roof Truss Beams (Atmospheric overhead architecture)
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x0b0f19,
    roughness: 0.75,
    metalness: 0.4,
  });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_HALF_SIZE * 2 + 4, ARENA_HALF_SIZE * 2 + 4), roofMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ARENA_CEILING;
  scene.add(ceiling);

  const lightStripMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });
  for (let z = -32; z <= 32; z += 16) {
    const truss = new THREE.Mesh(new THREE.BoxGeometry(88, 0.7, 1.2), roofMat);
    truss.position.set(0, ARENA_CEILING - 0.5, z);
    scene.add(truss);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(72, 0.14, 0.28), lightStripMat);
    strip.position.set(0, ARENA_CEILING - 0.9, z);
    scene.add(strip);
  }

  // Materials for blocks
  const wallMatNeutral = new THREE.MeshStandardMaterial({
    map: textures.wallColor,
    color: 0xcbd5e1,
    roughness: 0.58,
    metalness: 0.45,
  });
  const platformMat = new THREE.MeshStandardMaterial({
    map: textures.wallColor,
    color: 0x94a3b8,
    roughness: 0.38,
    metalness: 0.65,
  });
  const rampMat = new THREE.MeshStandardMaterial({
    map: textures.rampColor,
    roughness: 0.5,
    metalness: 0.35,
  });
  const railingMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.42,
    roughness: 0.15,
    metalness: 0.2,
  });

  const cobaltTrimMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.7,
    roughness: 0.25,
  });
  const solarTrimMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.7,
    roughness: 0.25,
  });
  const neutralTrimMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.75,
    roughness: 0.3,
  });

  for (const b of ARENA_BLOCKS) {
    if (b.kind === 'ramp') {
      scene.add(buildSlopedRampMesh(b, rampMat));
      continue;
    }

    const mat =
      b.kind === 'railing'
        ? railingMat
        : b.kind === 'platform'
          ? platformMat
          : wallMatNeutral;

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
    mesh.position.set(b.x, b.y + b.h / 2, b.z);
    mesh.castShadow = b.kind !== 'railing';
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Add emissive architectural light trim bands on pillars, platforms, and spawn walls
    if (b.kind === 'pillar' || b.kind === 'platform' || (b.kind === 'wall' && b.h < 10)) {
      const trimMat =
        b.teamTint === 'cobalt'
          ? cobaltTrimMat
          : b.teamTint === 'solar'
            ? solarTrimMat
            : neutralTrimMat;
      const trim = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.08, 0.14, b.d + 0.08), trimMat);
      trim.position.set(b.x, b.y + Math.min(b.h - 0.15, 2.2), b.z);
      scene.add(trim);
    }
  }

  // Central Reactor Spire Holographic Crown
  const spireCrystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.15, 0),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 2.0,
      roughness: 0.15,
      metalness: 0.3,
    }),
  );
  spireCrystal.position.set(0, 11.4, 0);
  scene.add(spireCrystal);

  const spireRingMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.25,
    metalness: 0.85,
  });
  const spireRingA = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.09, 10, 32), spireRingMat);
  spireRingA.position.set(0, 11.4, 0);
  scene.add(spireRingA);

  const spireRingB = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.06, 10, 32), lightStripMat);
  spireRingB.position.set(0, 11.4, 0);
  spireRingB.rotation.x = Math.PI / 2;
  scene.add(spireRingB);

  // Kinetic Jump Pads
  const jumpPadRings: THREE.Mesh[] = [];
  const jpBaseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.75 });
  const jpRingMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 2.0,
    roughness: 0.2,
  });

  for (const jp of JUMP_PADS) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(jp.radius, jp.radius + 0.2, 0.18, 20), jpBaseMat);
    base.position.set(jp.x, jp.y + 0.09, jp.z);
    scene.add(base);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(jp.radius * 0.72, 0.08, 8, 24), jpRingMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(jp.x, jp.y + 0.32, jp.z);
    scene.add(ring);
    jumpPadRings.push(ring);
  }

  return { spireCrystal, spireRingA, spireRingB, jumpPadRings };
}
