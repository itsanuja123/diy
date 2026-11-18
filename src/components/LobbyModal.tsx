import React from 'react';
import { Crosshair, Shield, Users, Volume2, VolumeX, Zap } from 'lucide-react';
import type { RoomId, RoomSummary, TeamId } from '../shared/types.ts';

interface LobbyModalProps {
  callsign: string;
  onCallsignChange: (name: string) => void;
  selectedRoom: RoomId;
  onSelectRoom: (id: RoomId) => void;
  teamPreference: TeamId | 'auto';
  onTeamPreferenceChange: (team: TeamId | 'auto') => void;
  botFill: boolean;
  onBotFillChange: (fill: boolean) => void;
  rooms: RoomSummary[];
  loadingRooms: boolean;
  isJoining: boolean;
  connectionError: string | null;
  muted: boolean;
  onToggleMute: () => void;
  onJoin: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const LobbyModal: React.FC<LobbyModalProps> = ({
  callsign,
  onCallsignChange,
  selectedRoom,
  onSelectRoom,
  teamPreference,
  onTeamPreferenceChange,
  botFill,
  onBotFillChange,
  rooms,
  loadingRooms,
  isJoining,
  connectionError,
  muted,
  onToggleMute,
  onJoin,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJoin();
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-4 sm:p-6 bg-[#07090F]/75 pointer-events-auto overflow-y-auto">
      <div className="w-full max-w-[920px] bg-[#0B101C]/95 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Clean Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/90">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Prism Arena
            </h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Massive multiplayer first-person laser tag · Live WebSocket combat
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleMute}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{muted ? 'Audio Muted' : 'Audio On'}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Player Setup */}
          <div className="lg:col-span-5 p-6 space-y-5 border-b lg:border-b-0 lg:border-r border-slate-800/90">
            <div>
              <label htmlFor="callsign-input" className="block text-xs font-medium text-slate-300 mb-2">
                Player Callsign
              </label>
              <input
                id="callsign-input"
                type="text"
                maxLength={16}
                value={callsign}
                onChange={(e) => onCallsignChange(e.target.value)}
                placeholder="Enter callsign"
                className="w-full px-3.5 py-2.5 text-sm text-white bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-300 mb-2">
                Team Assignment
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
                {(
                  [
                    { id: 'auto', label: 'Auto' },
                    { id: 'cobalt', label: 'Cobalt' },
                    { id: 'solar', label: 'Solar' },
                  ] as const
                ).map((opt) => {
                  const active = teamPreference === opt.id;
                  const activeCls =
                    opt.id === 'cobalt'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : opt.id === 'solar'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-white border border-slate-700';
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onTeamPreferenceChange(opt.id)}
                      className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        active ? activeCls : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between py-2.5 px-3.5 bg-slate-900/80 border border-slate-800 rounded-lg">
              <div>
                <div className="text-xs font-medium text-slate-200">Arena Bot Backfill</div>
                <div className="text-xs text-slate-400">Fill empty slots with AI combatants</div>
              </div>
              <button
                type="button"
                onClick={() => onBotFillChange(!botFill)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  botFill
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {botFill ? 'Enabled' : 'PvP Only'}
              </button>
            </div>

            {/* Compact Controls Summary */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs text-slate-400">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                  Pulse Laser / Rail Beam
                </span>
                <span className="font-mono-tabular text-slate-300">Left Click / Right Click or E</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Move / Sprint / Jump
                </span>
                <span className="font-mono-tabular text-slate-300">WASD / Shift / Space</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  Scoreboard / Unlock Cursor
                </span>
                <span className="font-mono-tabular text-slate-300">Tab / Esc</span>
              </div>
            </div>
          </div>

          {/* Right Column: Live Arenas & Join */}
          <div className="lg:col-span-7 p-6 flex flex-col justify-between space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-300">Select Live Arena</span>
                <span className="text-xs text-slate-400 font-mono-tabular">
                  {loadingRooms ? 'Refreshing...' : `${rooms.length} Active Arenas`}
                </span>
              </div>

              <div className="space-y-2.5">
                {rooms.map((room) => {
                  const selected = selectedRoom === room.id;
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => onSelectRoom(room.id)}
                      className={`w-full text-left p-4 rounded-lg border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-slate-900 border-cyan-400/70'
                          : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-display text-base font-semibold text-white">
                            {room.name}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {room.subtitle} · {room.humanCount} {room.humanCount === 1 ? 'player' : 'players'} live
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-center justify-end gap-1.5 text-xs font-mono-tabular text-slate-200">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {room.totalCombatants}/{room.maxCombatants}
                            </span>
                          </div>
                          <div className="mt-1 text-xs font-mono-tabular text-slate-400">
                            <span className="text-cyan-400">{room.cobaltScore}</span>
                            <span className="mx-1.5 text-slate-600">-</span>
                            <span className="text-amber-400">{room.solarScore}</span>
                            <span className="mx-1.5 text-slate-600">·</span>
                            <span>{formatTime(room.timeRemainingSec)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {connectionError && (
              <div className="px-3.5 py-2.5 text-xs text-red-300 bg-red-950/60 border border-red-800/70 rounded-lg">
                {connectionError}
              </div>
            )}

            <div className="flex items-center justify-between gap-4 pt-2">
              <p className="text-xs text-slate-400">
                Open another browser tab to battle head-to-head in real time.
              </p>
              <button
                type="submit"
                disabled={isJoining}
                className="px-6 py-2.5 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isJoining ? 'Connecting...' : 'Enter Arena'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
