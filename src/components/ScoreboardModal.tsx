import React from 'react';
import type { MatchStatePayload, PlayerSnapshot } from '../shared/types.ts';

interface ScoreboardModalProps {
  snapshot: MatchStatePayload;
  localPlayerId: string | null;
  isIntermission: boolean;
  onLeaveMatch?: () => void;
}

function TeamTable({
  title,
  accentClass,
  score,
  players,
  localPlayerId,
}: {
  title: string;
  accentClass: string;
  score: number;
  players: PlayerSnapshot[];
  localPlayerId: string | null;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="flex-1 min-w-0 bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <span className={`font-display text-sm font-bold ${accentClass}`}>{title}</span>
        <span className="font-mono-tabular text-lg font-bold text-white">{score}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800/80 text-[11px] text-slate-400">
              <th className="py-2 px-4 font-medium">Combatant</th>
              <th className="py-2 px-2 font-medium text-right">Tags</th>
              <th className="py-2 px-2 font-medium text-right">Tagged</th>
              <th className="py-2 px-4 font-medium text-right">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-xs">
            {sorted.map((p) => {
              const isMe = p.id === localPlayerId;
              return (
                <tr
                  key={p.id}
                  className={isMe ? 'bg-white/10 text-white font-semibold' : 'text-slate-300'}
                >
                  <td className="py-2 px-4 truncate max-w-[170px]">
                    <span>{p.callsign}</span>
                    {p.isBot && <span className="ml-1.5 text-[10px] text-slate-500">AI</span>}
                    {isMe && <span className="ml-1.5 text-[10px] text-cyan-300">(You)</span>}
                  </td>
                  <td className="py-2 px-2 text-right font-mono-tabular">{p.tags}</td>
                  <td className="py-2 px-2 text-right font-mono-tabular text-slate-400">{p.taggedCount}</td>
                  <td className="py-2 px-4 text-right font-mono-tabular font-semibold">{p.score}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const ScoreboardModal: React.FC<ScoreboardModalProps> = ({
  snapshot,
  localPlayerId,
  isIntermission,
  onLeaveMatch,
}) => {
  const cobaltPlayers = snapshot.players.filter((p) => p.team === 'cobalt');
  const solarPlayers = snapshot.players.filter((p) => p.team === 'solar');

  const winnerText =
    snapshot.cobaltScore > snapshot.solarScore
      ? 'Cobalt Vanguard Wins'
      : snapshot.solarScore > snapshot.cobaltScore
        ? 'Solar Flare Wins'
        : 'Match Drawn';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#07090F]/80 pointer-events-auto">
      <div className="w-full max-w-[880px] bg-[#0B101C]/95 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              {isIntermission ? winnerText : `${snapshot.roomName} Scoreboard`}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono-tabular">
              {isIntermission
                ? `Next round starts in ${snapshot.intermissionSec}s`
                : `Target Score ${snapshot.targetScore} · ${snapshot.players.length} Combatants`}
            </p>
          </div>
          {onLeaveMatch && (
            <button
              type="button"
              onClick={onLeaveMatch}
              className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Return to Lobby
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <TeamTable
            title="Cobalt Vanguard"
            accentClass="text-cyan-400"
            score={snapshot.cobaltScore}
            players={cobaltPlayers}
            localPlayerId={localPlayerId}
          />
          <TeamTable
            title="Solar Flare"
            accentClass="text-amber-400"
            score={snapshot.solarScore}
            players={solarPlayers}
            localPlayerId={localPlayerId}
          />
        </div>
      </div>
    </div>
  );
};
