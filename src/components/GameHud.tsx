import React from 'react';
import { LogOut, Trophy, Volume2, VolumeX } from 'lucide-react';
import type { KillFeedEvent, MatchStatePayload, PlayerSnapshot } from '../shared/types.ts';
import type { ProjectedLabel } from './ArenaViewport.tsx';
import { TacticalRadar } from './TacticalRadar.tsx';

export interface HitFeedbackState {
  id: number;
  headshot: boolean;
  eliminated: boolean;
  victimName: string;
  points: number;
}

export interface DamageFlashState {
  id: number;
  attackerName: string;
}

interface GameHudProps {
  snapshot: MatchStatePayload;
  localPlayer: PlayerSnapshot | null;
  killFeed: KillFeedEvent[];
  projectedLabels: ProjectedLabel[];
  pointerLocked: boolean;
  hitFeedback: HitFeedbackState | null;
  damageFlash: DamageFlashState | null;
  muted: boolean;
  pingMs: number | null;
  localPosRef: React.MutableRefObject<{ x: number; z: number; yaw: number }>;
  onToggleMute: () => void;
  onShowScoreboard: () => void;
  onLeaveMatch: () => void;
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const GameHud: React.FC<GameHudProps> = ({
  snapshot,
  localPlayer,
  killFeed,
  projectedLabels,
  pointerLocked,
  hitFeedback,
  damageFlash,
  muted,
  pingMs,
  localPosRef,
  onToggleMute,
  onShowScoreboard,
  onLeaveMatch,
}) => {
  const isAlive = localPlayer?.alive ?? false;
  const railReady = (localPlayer?.railCharge ?? 0) >= 0.99;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none overflow-hidden">
      {/* Damage Vignette */}
      {damageFlash && (
        <div
          key={damageFlash.id}
          className="fixed inset-0 border-[12px] border-red-500/40 pointer-events-none"
        />
      )}

      {/* Projected 3D Player Nameplates */}
      {isAlive &&
        projectedLabels.map((lbl) => (
          <div
            key={lbl.id}
            style={{
              transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)`,
            }}
            className="fixed top-0 left-0 flex flex-col items-center pointer-events-none"
          >
            <span
              className={`text-[11px] font-medium whitespace-nowrap drop-shadow ${
                lbl.team === 'cobalt' ? 'text-cyan-300' : 'text-amber-300'
              }`}
            >
              {lbl.callsign} · {lbl.dist}m
            </span>
            <div className="w-12 h-1 mt-0.5 bg-slate-900/90 rounded-full overflow-hidden">
              <div
                className={`h-full ${lbl.team === 'cobalt' ? 'bg-cyan-400' : 'bg-amber-400'}`}
                style={{ width: `${lbl.healthPct}%` }}
              />
            </div>
          </div>
        ))}

      {/* Top Row: Radar (Left) | Match Score & Clock (Center) | Killfeed & Quick Actions (Right) */}
      <div className="flex items-start justify-between p-4 sm:p-5 gap-4">
        {/* Top Left: Rotating Radar */}
        <div className="hidden sm:block">
          {localPlayer && (
            <TacticalRadar
              localPlayerId={localPlayer.id}
              localTeam={localPlayer.team}
              players={snapshot.players}
              pickups={snapshot.pickups}
              localPosRef={localPosRef}
            />
          )}
        </div>

        {/* Top Center: Scoreboard Header */}
        <div className="mx-auto flex items-center gap-4 px-5 py-2.5 bg-[#090D16]/85 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-medium text-cyan-400">Cobalt</span>
            <span className="font-display text-2xl font-bold text-white font-mono-tabular">
              {snapshot.cobaltScore}
            </span>
          </div>

          <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-md text-center">
            <div className="font-mono-tabular text-sm font-bold text-slate-100">
              {formatClock(snapshot.timeRemainingSec)}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="font-display text-2xl font-bold text-white font-mono-tabular">
              {snapshot.solarScore}
            </span>
            <span className="text-xs font-medium text-amber-400">Solar</span>
          </div>
        </div>

        {/* Top Right: Action Buttons (when unlocked) & Killfeed */}
        <div className="flex flex-col items-end gap-2.5 min-w-[210px]">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {pingMs !== null && (
              <span className="px-2 py-1 text-[11px] font-mono-tabular text-slate-400 bg-[#090D16]/85 border border-slate-800 rounded-md">
                {pingMs} ms
              </span>
            )}
            <button
              type="button"
              onClick={onShowScoreboard}
              title="Scoreboard (Tab)"
              className="p-2 text-slate-300 bg-[#090D16]/85 border border-slate-800 rounded-lg hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
            >
              <Trophy className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              title="Toggle Audio"
              className="p-2 text-slate-300 bg-[#090D16]/85 border border-slate-800 rounded-lg hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onLeaveMatch}
              title="Leave Arena"
              className="p-2 text-slate-300 bg-[#090D16]/85 border border-slate-800 rounded-lg hover:text-red-300 hover:border-red-800 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Kill Feed */}
          <div className="flex flex-col items-end gap-1">
            {killFeed.slice(0, 5).map((ev) => (
              <div
                key={ev.id}
                className="px-2.5 py-1 bg-[#090D16]/80 border border-slate-800/80 rounded-md text-[11px] whitespace-nowrap"
              >
                <span className={ev.attackerTeam === 'cobalt' ? 'text-cyan-300 font-medium' : 'text-amber-300 font-medium'}>
                  {ev.attackerName}
                </span>
                <span className="mx-1.5 text-slate-500">
                  {ev.headshot ? 'headshot' : ev.weapon === 'rail' ? 'railed' : 'tagged'}
                </span>
                <span className={ev.victimTeam === 'cobalt' ? 'text-cyan-300 font-medium' : 'text-amber-300 font-medium'}>
                  {ev.victimName}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Center Crosshair & Hit Feedback */}
      {isAlive && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative flex items-center justify-center">
            {/* Precision Reticle */}
            <div className="w-1.5 h-1.5 rounded-full bg-white shadow" />
            <div className="absolute w-3 h-[1.5px] -left-4 bg-white/75" />
            <div className="absolute w-3 h-[1.5px] -right-4 bg-white/75" />
            <div className="absolute h-3 w-[1.5px] -top-4 bg-white/75" />
            <div className="absolute h-3 w-[1.5px] -bottom-4 bg-white/75" />

            {/* Hitmarker X */}
            {hitFeedback && (
              <div
                key={hitFeedback.id}
                className={`absolute w-6 h-6 flex items-center justify-center ${
                  hitFeedback.eliminated || hitFeedback.headshot ? 'text-red-400' : 'text-cyan-300'
                }`}
              >
                <span className="absolute w-5 h-[2px] bg-current rotate-45" />
                <span className="absolute w-5 h-[2px] bg-current -rotate-45" />
              </div>
            )}
          </div>

          {hitFeedback && (
            <div className="absolute mt-16 text-xs font-mono-tabular font-semibold text-white bg-[#090D16]/85 px-2.5 py-1 rounded border border-slate-800">
              {hitFeedback.eliminated
                ? `Tagged ${hitFeedback.victimName} +${hitFeedback.points}`
                : `${hitFeedback.headshot ? 'Headshot ' : ''}+${hitFeedback.points}`}
            </div>
          )}
        </div>
      )}

      {/* Respawn Overlay when Tagged */}
      {localPlayer && !isAlive && snapshot.phase === 'active' && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="px-6 py-4 bg-[#090D16]/90 border border-slate-800 rounded-xl text-center">
            <div className="font-display text-lg font-bold text-red-400">Vest Offline</div>
            <div className="mt-1 text-sm text-slate-300 font-mono-tabular">
              Respawning in {localPlayer.respawnInSec.toFixed(1)}s
            </div>
          </div>
        </div>
      )}

      {/* Pointer Lock Prompt */}
      {isAlive && !pointerLocked && snapshot.phase === 'active' && (
        <div className="fixed inset-x-0 bottom-28 flex justify-center pointer-events-none">
          <div className="px-5 py-2.5 bg-[#090D16]/90 border border-cyan-500/40 rounded-lg text-xs text-slate-200">
            Click anywhere on the arena to lock aim · Press <span className="font-mono-tabular text-cyan-300">Esc</span> to release cursor
          </div>
        </div>
      )}

      {/* Bottom Bar: Health/Shield (Left) & Weapon Telemetry (Right) */}
      {localPlayer && (
        <div className="fixed inset-x-0 bottom-0 flex items-end justify-between p-4 sm:p-5 gap-4">
          {/* Bottom Left: Shield & Hull Integrity */}
          <div className="w-64 p-3.5 bg-[#090D16]/85 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className={localPlayer.team === 'cobalt' ? 'font-medium text-cyan-300' : 'font-medium text-amber-300'}>
                {localPlayer.callsign}
              </span>
              <span className="font-mono-tabular text-slate-400">
                Tags {localPlayer.tags} · Score {localPlayer.score}
              </span>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-mono-tabular text-sky-300 mb-1">
                <span>Shield</span>
                <span>{localPlayer.shield}/{localPlayer.maxShield}</span>
              </div>
              <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400 transition-[width] duration-75"
                  style={{ width: `${(localPlayer.shield / localPlayer.maxShield) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-mono-tabular text-slate-200 mb-1">
                <span>Integrity</span>
                <span>{localPlayer.health}/{localPlayer.maxHealth}</span>
              </div>
              <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-75 ${
                    localPlayer.health > 35 ? 'bg-emerald-400' : 'bg-red-500'
                  }`}
                  style={{ width: `${(localPlayer.health / localPlayer.maxHealth) * 100}%` }}
                />
              </div>
            </div>

            {localPlayer.overdriveSec > 0 && (
              <div className="text-[11px] font-mono-tabular text-rose-400 font-semibold">
                Overdrive Active · {localPlayer.overdriveSec.toFixed(1)}s
              </div>
            )}
          </div>

          {/* Bottom Right: Weapon Status & Controls */}
          <div className="p-3.5 bg-[#090D16]/85 border border-slate-800 rounded-xl text-right space-y-2">
            <div className="flex items-center justify-end gap-3 text-xs">
              <span className="text-slate-400">Pulse Carbine · Ready</span>
              <span className="text-slate-600">|</span>
              <span className={`font-mono-tabular font-semibold ${railReady ? 'text-rose-400' : 'text-slate-400'}`}>
                Rail Beam · {railReady ? 'Charged (RMB / E)' : `${Math.round(localPlayer.railCharge * 100)}%`}
              </span>
            </div>
            <div className="w-56 ml-auto h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className={`h-full transition-[width] duration-75 ${railReady ? 'bg-rose-500' : 'bg-slate-500'}`}
                style={{ width: `${localPlayer.railCharge * 100}%` }}
              />
            </div>
            <div className="hidden md:block text-[11px] text-slate-400 font-mono-tabular">
              WASD Move · Shift Sprint · Space Jump · Tab Scoreboard
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
