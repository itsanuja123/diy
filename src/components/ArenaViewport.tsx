import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ARENA_CEILING,
  JUMP_PADS,
  PLAYER_EYE_HEIGHT,
  PLAYER_RADIUS,
  groundHeightAt,
  resolveHorizontalCollision,
} from '../shared/arenaMap.ts';
import type {
  LaserBeamEvent,
  MatchStatePayload,
  PlayerSnapshot,
  TeamId,
  WeaponMode,
} from '../shared/types.ts';
import { soundEngine } from '../game/audio.ts';
import {
  TEAM_HEX,
  buildArenaSceneMeshes,
  buildLaserRifleViewmodel,
  buildPickupMesh,
  buildPlayerRig,
  type LaserRifleRig,
  type PlayerRig,
} from '../game/models.ts';
import { createProceduralTextures } from '../game/textures.ts';

export interface ProjectedLabel {
  id: string;
  callsign: string;
  team: TeamId;
  healthPct: number;
  x: number;
  y: number;
  dist: number;
}

interface ActiveBeamVisual {
  mesh: THREE.Group;
  life: number;
  maxLife: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface RemoteActorState {
  rig: PlayerRig;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetYaw: number;
  targetPitch: number;
  team: TeamId;
  alive: boolean;
  hasShield: boolean;
}

interface ArenaViewportProps {
  isPlaying: boolean;
  localPlayerId: string | null;
  localTeam: TeamId;
  snapshot: MatchStatePayload | null;
  pendingBeamsRef: React.MutableRefObject<LaserBeamEvent[]>;
  localPosRef: React.MutableRefObject<{ x: number; z: number; yaw: number }>;
  onSendState: (x: number, y: number, z: number, yaw: number, pitch: number, vx: number, vy: number, vz: number) => void;
  onFireWeapon: (weapon: WeaponMode, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number) => void;
  onPointerLockChange: (locked: boolean) => void;
  onProjectedLabels: (labels: ProjectedLabel[]) => void;
  onWebglError: (msg: string) => void;
}

// Pre-allocated math helpers (Zero GC inside render loop)
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _muzzleWorld = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _beamStart = new THREE.Vector3();
const _beamEnd = new THREE.Vector3();
const _beamMid = new THREE.Vector3();
const _beamDir = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);

export const ArenaViewport: React.FC<ArenaViewportProps> = ({
  isPlaying,
  localPlayerId,
  localTeam,
  snapshot,
  pendingBeamsRef,
  localPosRef,
  onSendState,
  onFireWeapon,
  onPointerLockChange,
  onProjectedLabels,
  onWebglError,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Mutable refs so the WebGL loop reads latest props without re-mounting
  const propsRef = useRef({
    isPlaying,
    localPlayerId,
    localTeam,
    snapshot,
    onSendState,
    onFireWeapon,
    onPointerLockChange,
    onProjectedLabels,
  });
  propsRef.current = {
    isPlaying,
    localPlayerId,
    localTeam,
    snapshot,
    onSendState,
    onFireWeapon,
    onPointerLockChange,
    onProjectedLabels,
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software WebGL cleanly from GPU renderer string
    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      onWebglError('WebGL context could not be initialized on this device.');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      onWebglError('WebGL graphics context was interrupted. Attempting recovery...');
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090f);
    scene.fog = new THREE.FogExp2(0x07090f, 0.0115);

    // Mandatory studio reflection environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      76,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.08,
      180,
    );
    camera.rotation.order = 'YXZ';
    scene.add(camera);

    // 3-Point Warm/Cool Lighting Rig (<= 3 shadow casters)
    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x0f172a, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1e0, 1.45);
    keyLight.position.set(22, 34, 18);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -46;
    keyLight.shadow.camera.right = 46;
    keyLight.shadow.camera.top = 46;
    keyLight.shadow.camera.bottom = -46;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 90;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-28, 22, -26);
    scene.add(rimLight);

    // Team base & Spire accent lights (no shadow casting)
    const cobaltLight = new THREE.PointLight(0x06b6d4, 18, 34, 1.5);
    cobaltLight.position.set(-34, 6, -34);
    scene.add(cobaltLight);

    const solarLight = new THREE.PointLight(0xf59e0b, 18, 34, 1.5);
    solarLight.position.set(34, 6, 34);
    scene.add(solarLight);

    const spireLight = new THREE.PointLight(0x38bdf8, 22, 30, 1.5);
    spireLight.position.set(0, 11, 0);
    scene.add(spireLight);

    // Build Procedural Textures & Arena Meshes
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const textures = createProceduralTextures(maxAniso);
    const arenaRefs = buildArenaSceneMeshes(scene, textures);

    // Pickup Meshes
    const pickupMeshes = new Map<string, THREE.Group>();

    // Remote Player Rigs
    const remoteActors = new Map<string, RemoteActorState>();

    // First-person weapon viewmodel attached to camera
    let currentViewTeam: TeamId = propsRef.current.localTeam;
    let viewWeapon: LaserRifleRig = buildLaserRifleViewmodel(currentViewTeam);
    viewWeapon.root.position.set(0.26, -0.22, -0.34);
    camera.add(viewWeapon.root);
    viewWeapon.root.visible = false;

    const muzzleFlashLight = new THREE.PointLight(TEAM_HEX[currentViewTeam], 0, 8, 2);
    muzzleFlashLight.position.set(0.25, -0.15, -0.9);
    camera.add(muzzleFlashLight);

    // Active Laser Beams & Pooled Sparks
    const activeBeams: ActiveBeamVisual[] = [];
    const sparkPool: SparkParticle[] = [];
    const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);

    const spawnSparks = (x: number, y: number, z: number, nx: number, ny: number, nz: number, colorHex: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1 });
        const mesh = new THREE.Mesh(sparkGeo, mat);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        sparkPool.push({
          mesh,
          vx: nx * (3 + Math.random() * 5) + (Math.random() - 0.5) * 6,
          vy: ny * (3 + Math.random() * 5) + Math.random() * 4,
          vz: nz * (3 + Math.random() * 5) + (Math.random() - 0.5) * 6,
          life: 0.25 + Math.random() * 0.2,
        });
      }
    };

    const spawnLaserBeam = (beam: LaserBeamEvent) => {
      const isLocal = beam.shooterId === propsRef.current.localPlayerId;
      soundEngine.playLaser(beam.weapon, isLocal);

      _beamStart.set(beam.startX, beam.startY, beam.startZ);
      // If local player fired, originate beam visually from our first-person muzzle
      if (isLocal && viewWeapon.root.visible) {
        viewWeapon.muzzlePoint.getWorldPosition(_muzzleWorld);
        _beamStart.copy(_muzzleWorld);
      }
      _beamEnd.set(beam.endX, beam.endY, beam.endZ);

      _beamDir.subVectors(_beamEnd, _beamStart);
      const length = _beamDir.length();
      if (length < 0.05) return;
      _beamDir.normalize();

      const group = new THREE.Group();
      const colorHex = beam.weapon === 'rail' ? 0xf43f5e : TEAM_HEX[beam.team];
      const coreRadius = beam.weapon === 'rail' ? 0.055 : 0.026;
      const haloRadius = beam.weapon === 'rail' ? 0.14 : 0.068;

      const coreMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(coreRadius, coreRadius, length, 6, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
        }),
      );
      const haloMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(haloRadius, haloRadius, length, 8, 1, true),
        new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.65,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );

      group.add(coreMesh);
      group.add(haloMesh);

      _beamMid.addVectors(_beamStart, _beamEnd).multiplyScalar(0.5);
      group.position.copy(_beamMid);
      group.quaternion.setFromUnitVectors(_upVec, _beamDir);
      scene.add(group);

      const maxLife = beam.weapon === 'rail' ? 0.36 : 0.16;
      activeBeams.push({ mesh: group, life: maxLife, maxLife });

      spawnSparks(
        beam.endX,
        beam.endY,
        beam.endZ,
        beam.nx,
        beam.ny,
        beam.nz,
        colorHex,
        beam.weapon === 'rail' ? 10 : 5,
      );
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Local Player Physics State
    const playerPhys = {
      x: 0,
      y: 0,
      z: 20,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      grounded: true,
      recoilKick: 0,
      bobPhase: 0,
      lastJumpPadMs: 0,
      lastPulseMs: 0,
      lastAliveState: false,
      lastSentMs: 0,
      needsSnapToServer: true,
    };

    // Input State
    const keys: Record<string, boolean> = {};
    let mouseDownLeft = false;
    let mouseDownRight = false;

    const tryFire = (weapon: WeaponMode) => {
      const { isPlaying: playing, snapshot: snap, localPlayerId: myId, onFireWeapon: sendFire } = propsRef.current;
      if (!playing || !snap || snap.phase !== 'active') return;
      const me = snap.players.find((p) => p.id === myId);
      if (!me || !me.alive) return;

      const now = performance.now();
      const pulseDelay = me.overdriveSec > 0 ? 100 : 150;
      if (weapon === 'pulse') {
        if (now - playerPhys.lastPulseMs < pulseDelay) return;
        playerPhys.lastPulseMs = now;
      } else {
        if (me.railCharge < 0.99) return;
      }

      playerPhys.recoilKick = weapon === 'rail' ? 0.16 : 0.065;
      muzzleFlashLight.intensity = weapon === 'rail' ? 14 : 6;
      muzzleFlashLight.color.setHex(weapon === 'rail' ? 0xf43f5e : TEAM_HEX[me.team]);

      camera.getWorldDirection(_rayDir);
      sendFire(
        weapon,
        camera.position.x,
        camera.position.y,
        camera.position.z,
        _rayDir.x,
        _rayDir.y,
        _rayDir.z,
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (e.code === 'KeyE' && document.pointerLockElement === canvas) {
        tryFire('rail');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      const sensitivity = 0.0021;
      playerPhys.yaw -= e.movementX * sensitivity;
      playerPhys.pitch = Math.max(
        -Math.PI / 2 + 0.08,
        Math.min(Math.PI / 2 - 0.08, playerPhys.pitch - e.movementY * sensitivity),
      );
    };

    const onMouseDown = (e: MouseEvent) => {
      if (!propsRef.current.isPlaying) return;
      soundEngine.unlock();

      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
        return;
      }

      if (e.button === 0) {
        mouseDownLeft = true;
        tryFire('pulse');
      } else if (e.button === 2) {
        mouseDownRight = true;
        tryFire('rail');
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseDownLeft = false;
      if (e.button === 2) mouseDownRight = false;
    };

    const onContextMenu = (e: MouseEvent) => {
      if (propsRef.current.isPlaying) e.preventDefault();
    };

    const onPointerLock = () => {
      const locked = document.pointerLockElement === canvas;
      if (!locked) {
        mouseDownLeft = false;
        mouseDownRight = false;
      }
      propsRef.current.onPointerLockChange(locked);
    };

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerlockchange', onPointerLock);
    window.addEventListener('resize', onResize);

    // Main Game Loop with Software-WebGL Pacing
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let labelFrameCounter = 0;

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const elapsed = now * 0.001;

      const {
        isPlaying: playing,
        localPlayerId: myId,
        localTeam: myTeam,
        snapshot: snap,
        onSendState: sendState,
        onProjectedLabels: emitLabels,
      } = propsRef.current;

      // Update Viewmodel team color if switched
      if (myTeam !== currentViewTeam) {
        currentViewTeam = myTeam;
        camera.remove(viewWeapon.root);
        viewWeapon = buildLaserRifleViewmodel(currentViewTeam);
        viewWeapon.root.position.set(0.26, -0.22, -0.34);
        camera.add(viewWeapon.root);
      }

      // Animate Central Spire & Jump Pads
      arenaRefs.spireCrystal.rotation.y = elapsed * 0.85;
      arenaRefs.spireCrystal.position.y = 11.4 + Math.sin(elapsed * 2.1) * 0.25;
      arenaRefs.spireRingA.rotation.x = elapsed * 0.6;
      arenaRefs.spireRingA.rotation.y = elapsed * 0.9;
      arenaRefs.spireRingB.rotation.z = -elapsed * 0.7;
      for (let i = 0; i < arenaRefs.jumpPadRings.length; i++) {
        const ring = arenaRefs.jumpPadRings[i];
        ring.position.y = 0.28 + ((elapsed * 1.4 + i * 0.25) % 0.6) * 0.45;
      }

      // Sync Pickups
      if (snap) {
        for (const pk of snap.pickups) {
          let mesh = pickupMeshes.get(pk.id);
          if (!mesh) {
            mesh = buildPickupMesh(pk.kind);
            mesh.position.set(pk.x, pk.y, pk.z);
            scene.add(mesh);
            pickupMeshes.set(pk.id, mesh);
          }
          mesh.visible = pk.active;
          if (pk.active) {
            const { crystal, ring1, ring2 } = mesh.userData as {
              crystal: THREE.Mesh;
              ring1: THREE.Mesh;
              ring2: THREE.Mesh;
            };
            crystal.rotation.y = elapsed * 1.8;
            crystal.position.y = 1.05 + Math.sin(elapsed * 3) * 0.12;
            ring1.rotation.y = -elapsed * 1.2;
            ring2.rotation.z = elapsed * 1.4;
          }
        }

        // Sync Remote Players
        const seenIds = new Set<string>();
        for (const p of snap.players) {
          if (p.id === myId) continue;
          seenIds.add(p.id);
          let actor = remoteActors.get(p.id);
          if (!actor || actor.team !== p.team) {
            if (actor) scene.remove(actor.rig.root);
            const rig = buildPlayerRig(p.team, textures.contactShadow);
            rig.root.position.set(p.x, p.y, p.z);
            scene.add(rig.root);
            actor = {
              rig,
              targetX: p.x,
              targetY: p.y,
              targetZ: p.z,
              targetYaw: p.yaw,
              targetPitch: p.pitch,
              team: p.team,
              alive: p.alive,
              hasShield: p.shield > 0,
            };
            remoteActors.set(p.id, actor);
          } else {
            actor.targetX = p.x;
            actor.targetY = p.y,
            actor.targetZ = p.z;
            actor.targetYaw = p.yaw;
            actor.targetPitch = p.pitch;
            actor.alive = p.alive;
            actor.hasShield = p.shield > 0;
          }
        }
        for (const [id, actor] of remoteActors) {
          if (!seenIds.has(id)) {
            scene.remove(actor.rig.root);
            remoteActors.delete(id);
          }
        }
      }

      // Interpolate Remote Actors
      for (const actor of remoteActors.values()) {
        actor.rig.root.visible = actor.alive;
        if (!actor.alive) continue;

        const prevX = actor.rig.root.position.x;
        const prevZ = actor.rig.root.position.z;
        const alpha = 1 - Math.exp(-16 * dt);
        actor.rig.root.position.x = THREE.MathUtils.lerp(prevX, actor.targetX, alpha);
        actor.rig.root.position.y = THREE.MathUtils.lerp(actor.rig.root.position.y, actor.targetY, alpha);
        actor.rig.root.position.z = THREE.MathUtils.lerp(prevZ, actor.targetZ, alpha);

        // Shortest-angle yaw lerp
        let diff = actor.targetYaw - actor.rig.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        actor.rig.root.rotation.y += diff * alpha;
        actor.rig.armPivot.rotation.x = THREE.MathUtils.lerp(actor.rig.armPivot.rotation.x, actor.targetPitch, alpha);

        // Stride animation
        const moveAmt = Math.hypot(actor.rig.root.position.x - prevX, actor.rig.root.position.z - prevZ) / Math.max(dt, 0.001);
        const stride = moveAmt > 0.6 ? Math.sin(elapsed * 12) * 0.42 : 0;
        actor.rig.leftLeg.rotation.x = stride;
        actor.rig.rightLeg.rotation.x = -stride;
        actor.rig.shieldAura.visible = actor.hasShield;
      }

      // Consume pending laser beam events
      while (pendingBeamsRef.current.length > 0) {
        const beam = pendingBeamsRef.current.shift()!;
        spawnLaserBeam(beam);
      }

      // Update Active Beams
      for (let i = activeBeams.length - 1; i >= 0; i--) {
        const b = activeBeams[i];
        b.life -= dt;
        if (b.life <= 0) {
          scene.remove(b.mesh);
          b.mesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              (child.material as THREE.Material).dispose();
            }
          });
          activeBeams.splice(i, 1);
        } else {
          const ratio = b.life / b.maxLife;
          b.mesh.scale.set(ratio, 1, ratio);
        }
      }

      // Update Pooled Sparks
      for (let i = sparkPool.length - 1; i >= 0; i--) {
        const sp = sparkPool[i];
        sp.life -= dt;
        if (sp.life <= 0) {
          scene.remove(sp.mesh);
          (sp.mesh.material as THREE.Material).dispose();
          sparkPool.splice(i, 1);
        } else {
          sp.vy -= 14 * dt;
          sp.mesh.position.x += sp.vx * dt;
          sp.mesh.position.y += sp.vy * dt;
          sp.mesh.position.z += sp.vz * dt;
          (sp.mesh.material as THREE.MeshBasicMaterial).opacity = sp.life * 2.5;
        }
      }

      // Camera & Local Player Physics
      const me = snap?.players.find((p) => p.id === myId) ?? null;

      if (!playing || !me || !me.alive) {
        viewWeapon.root.visible = false;
        muzzleFlashLight.intensity = 0;

        if (playing && me && !me.alive) {
          playerPhys.lastAliveState = false;
          playerPhys.needsSnapToServer = true;
          // Elevated tactical spectator angle over death location
          const camAngle = elapsed * 0.45;
          camera.position.set(
            me.x + Math.cos(camAngle) * 7,
            Math.min(ARENA_CEILING - 1.5, me.y + 6.5),
            me.z + Math.sin(camAngle) * 7,
          );
          camera.lookAt(me.x, me.y + 1.2, me.z);
        } else {
          // Cinematic Arena Flyover behind Lobby Modal
          const orbitAngle = elapsed * 0.16;
          camera.position.set(Math.cos(orbitAngle) * 32, 11.5 + Math.sin(elapsed * 0.3) * 1.8, Math.sin(orbitAngle) * 32);
          camera.lookAt(0, 3.2, 0);
        }
      } else {
        // Snap local player to authoritative spawn when respawning or joining
        if (!playerPhys.lastAliveState || playerPhys.needsSnapToServer) {
          playerPhys.x = me.x;
          playerPhys.y = me.y;
          playerPhys.z = me.z;
          playerPhys.yaw = me.yaw;
          playerPhys.pitch = me.pitch;
          playerPhys.vx = 0;
          playerPhys.vy = 0;
          playerPhys.vz = 0;
          playerPhys.lastAliveState = true;
          playerPhys.needsSnapToServer = false;
        }

        // Handle auto-fire while holding Left Mouse
        if (mouseDownLeft && document.pointerLockElement === canvas) {
          tryFire('pulse');
        }
        if (mouseDownRight && document.pointerLockElement === canvas) {
          tryFire('rail');
        }

        // First-Person Movement
        const forwardInput = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
        const strafeInput = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
        const isSprinting = !!(keys['ShiftLeft'] || keys['ShiftRight']) && forwardInput > 0;

        _fwd.set(-Math.sin(playerPhys.yaw), 0, -Math.cos(playerPhys.yaw));
        _right.set(Math.cos(playerPhys.yaw), 0, -Math.sin(playerPhys.yaw));

        const wishX = _fwd.x * forwardInput + _right.x * strafeInput;
        const wishZ = _fwd.z * forwardInput + _right.z * strafeInput;
        const wishLen = Math.hypot(wishX, wishZ);

        const overdriveMult = me.overdriveSec > 0 ? 1.25 : 1.0;
        const targetSpeed = (isSprinting ? 10.6 : 7.8) * overdriveMult;

        if (wishLen > 0.01) {
          const nx = wishX / wishLen;
          const nz = wishZ / wishLen;
          const accel = playerPhys.grounded ? 18 : 7;
          playerPhys.vx = THREE.MathUtils.damp(playerPhys.vx, nx * targetSpeed, accel, dt);
          playerPhys.vz = THREE.MathUtils.damp(playerPhys.vz, nz * targetSpeed, accel, dt);
        } else {
          const friction = playerPhys.grounded ? 14 : 2.5;
          playerPhys.vx = THREE.MathUtils.damp(playerPhys.vx, 0, friction, dt);
          playerPhys.vz = THREE.MathUtils.damp(playerPhys.vz, 0, friction, dt);
        }

        // Jump
        if (keys['Space'] && playerPhys.grounded) {
          playerPhys.vy = 8.9;
          playerPhys.grounded = false;
        }

        // Gravity
        playerPhys.vy -= 22.5 * dt;

        // Horizontal step & collision
        const nextX = playerPhys.x + playerPhys.vx * dt;
        const nextZ = playerPhys.z + playerPhys.vz * dt;
        const resolved = resolveHorizontalCollision(nextX, playerPhys.y, nextZ, PLAYER_RADIUS);
        playerPhys.x = resolved.x;
        playerPhys.z = resolved.z;

        // Vertical step & floor height
        playerPhys.y += playerPhys.vy * dt;
        const floorY = groundHeightAt(playerPhys.x, playerPhys.z, playerPhys.y);
        if (playerPhys.y <= floorY) {
          playerPhys.y = floorY;
          playerPhys.vy = 0;
          playerPhys.grounded = true;
        } else {
          playerPhys.grounded = false;
        }

        // Jump Pads
        for (const jp of JUMP_PADS) {
          if (
            now - playerPhys.lastJumpPadMs > 650 &&
            Math.hypot(playerPhys.x - jp.x, playerPhys.z - jp.z) < jp.radius &&
            Math.abs(playerPhys.y - jp.y) < 0.85
          ) {
            playerPhys.vy = jp.boostY;
            playerPhys.grounded = false;
            playerPhys.lastJumpPadMs = now;
            soundEngine.playJumpPad();
          }
        }

        // Update Camera Transform & Sprint FOV
        const targetFov = isSprinting || me.overdriveSec > 0 ? 83 : 76;
        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 10, dt);
          camera.updateProjectionMatrix();
        }

        camera.position.set(playerPhys.x, playerPhys.y + PLAYER_EYE_HEIGHT, playerPhys.z);
        camera.rotation.set(playerPhys.pitch, playerPhys.yaw, 0, 'YXZ');

        // First-Person Viewmodel Bob & Recoil Kinematics
        viewWeapon.root.visible = true;
        const speedHoriz = Math.hypot(playerPhys.vx, playerPhys.vz);
        if (playerPhys.grounded && speedHoriz > 0.8) {
          playerPhys.bobPhase += dt * (isSprinting ? 13 : 9.5);
        }
        playerPhys.recoilKick = THREE.MathUtils.damp(playerPhys.recoilKick, 0, 16, dt);
        muzzleFlashLight.intensity = THREE.MathUtils.damp(muzzleFlashLight.intensity, 0, 24, dt);

        const bobX = Math.cos(playerPhys.bobPhase * 0.5) * 0.012 * Math.min(1, speedHoriz / 8);
        const bobY = Math.abs(Math.sin(playerPhys.bobPhase)) * -0.014 * Math.min(1, speedHoriz / 8);

        viewWeapon.root.position.set(
          0.26 + bobX,
          -0.22 + bobY,
          -0.34 + playerPhys.recoilKick,
        );
        viewWeapon.root.rotation.set(
          playerPhys.recoilKick * 0.9,
          isSprinting ? 0.14 : 0,
          isSprinting ? 0.12 : 0,
        );

        // Update Rail Charge Bar scale on weapon
        viewWeapon.railChargeBar.scale.z = Math.max(0.05, me.railCharge);
        viewWeapon.coreMaterial.emissiveIntensity = me.overdriveSec > 0 ? 3.5 : 2.0;

        localPosRef.current.x = playerPhys.x;
        localPosRef.current.z = playerPhys.z;
        localPosRef.current.yaw = playerPhys.yaw;

        // Send state to server at ~25Hz
        if (now - playerPhys.lastSentMs >= 40) {
          playerPhys.lastSentMs = now;
          sendState(
            playerPhys.x,
            playerPhys.y,
            playerPhys.z,
            playerPhys.yaw,
            playerPhys.pitch,
            playerPhys.vx,
            playerPhys.vy,
            playerPhys.vz,
          );
        }

        // Project HUD Nameplates every 3 frames
        labelFrameCounter++;
        if (labelFrameCounter % 3 === 0 && snap) {
          const w = canvas.clientWidth;
          const h = canvas.clientHeight;
          const labels: ProjectedLabel[] = [];
          camera.getWorldDirection(_rayDir);

          for (const p of snap.players) {
            if (p.id === myId || !p.alive) continue;
            const actor = remoteActors.get(p.id);
            if (!actor) continue;
            const px = actor.rig.root.position.x;
            const py = actor.rig.root.position.y + 2.05;
            const pz = actor.rig.root.position.z;

            const toX = px - camera.position.x;
            const toY = py - camera.position.y;
            const toZ = pz - camera.position.z;
            const dist = Math.hypot(toX, toY, toZ);
            if (dist > 44) continue;

            // Only show if in front of camera
            const dot = (toX * _rayDir.x + toY * _rayDir.y + toZ * _rayDir.z) / dist;
            if (dot < 0.35) continue;

            // Show teammates always within 40m; show enemies within 26m if roughly in sightline
            if (p.team !== myTeam && dist > 26) continue;

            _projVec.set(px, py, pz).project(camera);
            if (_projVec.z > 1) continue;

            const sx = ((_projVec.x + 1) / 2) * w;
            const sy = ((-_projVec.y + 1) / 2) * h;
            if (sx < 0 || sx > w || sy < 0 || sy > h) continue;

            labels.push({
              id: p.id,
              callsign: p.callsign,
              team: p.team,
              healthPct: Math.round(((p.health + p.shield) / (p.maxHealth + p.maxShield)) * 100),
              x: sx,
              y: sy,
              dist: Math.round(dist),
            });
          }
          emitLabels(labels);
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    if (isSoftwareGl) frameId = window.setTimeout(tick, 16);
    else frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);

      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onPointerLock);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);

      if (document.pointerLockElement === canvas) {
        document.exitPointerLock?.();
      }

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      envTex.dispose();
      textures.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, [localPosRef, onWebglError, pendingBeamsRef]);

  return <div ref={mountRef} className="fixed inset-0 w-full h-full bg-[#07090F]" />;
};
