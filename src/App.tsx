import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArenaViewport, type ProjectedLabel } from './components/ArenaViewport.tsx';
import { GameHud, type DamageFlashState, type HitFeedbackState } from './components/GameHud.tsx';
import { LobbyModal } from './components/LobbyModal.tsx';
import { ScoreboardModal } from './components/ScoreboardModal.tsx';
import { soundEngine } from './game/audio.ts';
import type {
  ClientMessage,
  KillFeedEvent,
  LaserBeamEvent,
  MatchStatePayload,
  RoomId,
  RoomSummary,
  ServerMessage,
  TeamId,
  WeaponMode,
} from './shared/types.ts';

export default function App() {
  const [callsign, setCallsign] = useState<string>(() => {
    try {
      return localStorage.getItem('prism_callsign') || 'Striker';
    } catch {
      return 'Striker';
    }
  });
  const [selectedRoom, setSelectedRoom] = useState<RoomId>('apex-stadium');
  const [teamPreference, setTeamPreference] = useState<TeamId | 'auto'>('auto');
  const [botFill, setBotFill] = useState<boolean>(true);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(true);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MatchStatePayload | null>(null);
  const [killFeed, setKillFeed] = useState<KillFeedEvent[]>([]);
  const [projectedLabels, setProjectedLabels] = useState<ProjectedLabel[]>([]);
  const [pointerLocked, setPointerLocked] = useState<boolean>(false);
  const [showScoreboard, setShowScoreboard] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [pingMs, setPingMs] = useState<number | null>(null);

  const [hitFeedback, setHitFeedback] = useState<HitFeedbackState | null>(null);
  const [damageFlash, setDamageFlash] = useState<DamageFlashState | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingBeamsRef = useRef<LaserBeamEvent[]>([]);
  const localPosRef = useRef<{ x: number; z: number; yaw: number }>({ x: 0, z: 0, yaw: 0 });
  const hitTimerRef = useRef<number>(0);
  const dmgTimerRef = useRef<number>(0);
  const localIdRef = useRef<string | null>(null);

  // Save callsign
  useEffect(() => {
    try {
      localStorage.setItem('prism_callsign', callsign);
    } catch {
      // ignore storage errors
    }
  }, [callsign]);

  // Fetch live rooms list while in lobby
  useEffect(() => {
    if (isPlaying) return;
    let active = true;
    const fetchRooms = async () => {
      try {
        const res = await fetch('/api/rooms');
        if (!res.ok) return;
        const data = (await res.json()) as { rooms: RoomSummary[] };
        if (active) {
          setRooms(data.rooms);
          setLoadingRooms(false);
        }
      } catch {
        if (active) setLoadingRooms(false);
      }
    };
    fetchRooms();
    const interval = window.setInterval(fetchRooms, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isPlaying]);

  // Tab scoreboard listener
  useEffect(() => {
    if (!isPlaying) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setShowScoreboard(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setShowScoreboard(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isPlaying]);

  const sendWs = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  // Periodic ping telemetry
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      sendWs({ type: 'ping', t: performance.now() });
    }, 2500);
    return () => clearInterval(id);
  }, [isPlaying, sendWs]);

  const connectAndJoin = useCallback(() => {
    soundEngine.unlock();
    setIsJoining(true);
    setConnectionError(null);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      const joinMsg: ClientMessage = {
        type: 'join',
        callsign: callsign.trim() || 'Striker',
        teamPreference,
        roomId: selectedRoom,
        botFill,
      };
      ws.send(JSON.stringify(joinMsg));
    };

    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMessage;
      } catch {
        return;
      }

      if (msg.type === 'init') {
        localIdRef.current = msg.playerId;
        setLocalPlayerId(msg.playerId);
        setSnapshot(msg.snapshot);
        setKillFeed(msg.killFeed);
        setIsJoining(false);
        setIsPlaying(true);
        setShowScoreboard(false);
      } else if (msg.type === 'snapshot') {
        setSnapshot(msg.snapshot);
      } else if (msg.type === 'beam') {
        pendingBeamsRef.current.push(msg.beam);
        if (pendingBeamsRef.current.length > 48) {
          pendingBeamsRef.current.shift();
        }
      } else if (msg.type === 'killfeed') {
        setKillFeed((prev) => [msg.event, ...prev].slice(0, 8));
      } else if (msg.type === 'hit_confirm') {
        soundEngine.playHitConfirm(msg.headshot, msg.eliminated);
        setHitFeedback({
          id: Date.now(),
          headshot: msg.headshot,
          eliminated: msg.eliminated,
          victimName: msg.victimName,
          points: msg.points,
        });
        clearTimeout(hitTimerRef.current);
        hitTimerRef.current = window.setTimeout(() => setHitFeedback(null), 550);
      } else if (msg.type === 'damage_taken') {
        soundEngine.playDamageTaken(msg.eliminated);
        setDamageFlash({
          id: Date.now(),
          attackerName: msg.attackerName,
        });
        clearTimeout(dmgTimerRef.current);
        dmgTimerRef.current = window.setTimeout(() => setDamageFlash(null), 260);
      } else if (msg.type === 'pickup') {
        if (msg.playerId === localIdRef.current) {
          soundEngine.playPickup(msg.kind);
        }
      } else if (msg.type === 'pong') {
        setPingMs(Math.max(1, Math.round(performance.now() - msg.t)));
      }
    };

    ws.onerror = () => {
      setIsJoining(false);
      setConnectionError('Unable to reach the arena WebSocket server.');
    };

    ws.onclose = () => {
      setIsJoining(false);
    };
  }, [botFill, callsign, selectedRoom, teamPreference]);

  const handleLeaveMatch = useCallback(() => {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    localIdRef.current = null;
    setLocalPlayerId(null);
    setSnapshot(null);
    setKillFeed([]);
    setProjectedLabels([]);
    setShowScoreboard(false);
    setIsPlaying(false);
    setPingMs(null);
  }, []);

  const handleSendState = useCallback(
    (x: number, y: number, z: number, yaw: number, pitch: number, vx: number, vy: number, vz: number) => {
      sendWs({ type: 'state', x, y, z, yaw, pitch, vx, vy, vz });
    },
    [sendWs],
  );

  const handleFireWeapon = useCallback(
    (weapon: WeaponMode, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number) => {
      sendWs({ type: 'fire', weapon, ox, oy, oz, dx, dy, dz });
    },
    [sendWs],
  );

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleWebglError = useCallback((msg: string) => {
    setWebglError(msg);
  }, []);

  const localPlayer = useMemo(() => {
    if (!snapshot || !localPlayerId) return null;
    return snapshot.players.find((p) => p.id === localPlayerId) ?? null;
  }, [snapshot, localPlayerId]);

  const localTeam: TeamId = localPlayer?.team ?? (teamPreference === 'solar' ? 'solar' : 'cobalt');

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#07090F]">
      {/* Isolated Full-Viewport Three.js Arena */}
      <ArenaViewport
        isPlaying={isPlaying}
        localPlayerId={localPlayerId}
        localTeam={localTeam}
        snapshot={snapshot}
        pendingBeamsRef={pendingBeamsRef}
        localPosRef={localPosRef}
        onSendState={handleSendState}
        onFireWeapon={handleFireWeapon}
        onPointerLockChange={setPointerLocked}
        onProjectedLabels={setProjectedLabels}
        onWebglError={handleWebglError}
      />

      {webglError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#07090F]/95">
          <div className="max-w-md p-6 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-3">
            <h2 className="font-display text-lg font-bold text-white">Graphics Context Unavailable</h2>
            <p className="text-sm text-slate-400">{webglError}</p>
          </div>
        </div>
      )}

      {/* Lobby Overlay */}
      {!isPlaying && !webglError && (
        <LobbyModal
          callsign={callsign}
          onCallsignChange={setCallsign}
          selectedRoom={selectedRoom}
          onSelectRoom={setSelectedRoom}
          teamPreference={teamPreference}
          onTeamPreferenceChange={setTeamPreference}
          botFill={botFill}
          onBotFillChange={setBotFill}
          rooms={rooms}
          loadingRooms={loadingRooms}
          isJoining={isJoining}
          connectionError={connectionError}
          muted={muted}
          onToggleMute={handleToggleMute}
          onJoin={connectAndJoin}
        />
      )}

      {/* Active First-Person HUD */}
      {isPlaying && snapshot && (
        <GameHud
          snapshot={snapshot}
          localPlayer={localPlayer}
          killFeed={killFeed}
          projectedLabels={projectedLabels}
          pointerLocked={pointerLocked}
          hitFeedback={hitFeedback}
          damageFlash={damageFlash}
          muted={muted}
          pingMs={pingMs}
          localPosRef={localPosRef}
          onToggleMute={handleToggleMute}
          onShowScoreboard={() => setShowScoreboard((v) => !v)}
          onLeaveMatch={handleLeaveMatch}
        />
      )}

      {/* Live Scoreboard (Tab or Button) & End-of-Round Intermission */}
      {isPlaying && snapshot && (showScoreboard || snapshot.phase === 'intermission') && (
        <ScoreboardModal
          snapshot={snapshot}
          localPlayerId={localPlayerId}
          isIntermission={snapshot.phase === 'intermission'}
          onLeaveMatch={handleLeaveMatch}
        />
      )}
    </div>
  );
}
