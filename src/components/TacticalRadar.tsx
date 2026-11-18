import React, { useEffect, useRef } from 'react';
import { ARENA_BLOCKS, ARENA_HALF_SIZE } from '../shared/arenaMap.ts';
import type { PickupState, PlayerSnapshot, TeamId } from '../shared/types.ts';

interface TacticalRadarProps {
  localPlayerId: string | null;
  localTeam: TeamId;
  players: PlayerSnapshot[];
  pickups: PickupState[];
  localPosRef: React.MutableRefObject<{ x: number; z: number; yaw: number }>;
}

export const TacticalRadar: React.FC<TacticalRadarProps> = ({
  localPlayerId,
  localTeam,
  players,
  pickups,
  localPosRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef({ players, pickups, localPlayerId, localTeam });
  dataRef.current = { players, pickups, localPlayerId, localTeam };

  useEffect(() => {
    let raf = 0;
    const size = 164;
    const half = size / 2;
    const scale = (size - 16) / (ARENA_HALF_SIZE * 2);

    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const { players: pList, pickups: pkList, localPlayerId: myId, localTeam: myTeam } = dataRef.current;
          const me = localPosRef.current;

          ctx.clearRect(0, 0, size, size);

          // Radar circular clip
          ctx.save();
          ctx.beginPath();
          ctx.arc(half, half, half - 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(7, 10, 18, 0.88)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.clip();

          // Rotate radar so player's facing direction is UP
          ctx.translate(half, half);
          ctx.rotate(me.yaw);

          // Draw arena obstacles relative to player
          ctx.fillStyle = 'rgba(148, 163, 184, 0.24)';
          for (let i = 0; i < ARENA_BLOCKS.length; i++) {
            const b = ARENA_BLOCKS[i];
            if (b.kind === 'wall' && b.h > 10) continue; // perimeter already circular-clipped
            const rx = (b.x - me.x) * scale;
            const rz = (b.z - me.z) * scale;
            ctx.fillRect(rx - (b.w * scale) / 2, rz - (b.d * scale) / 2, b.w * scale, b.d * scale);
          }

          // Draw pickups
          for (const pk of pkList) {
            if (!pk.active) continue;
            const rx = (pk.x - me.x) * scale;
            const rz = (pk.z - me.z) * scale;
            ctx.fillStyle = pk.kind === 'overdrive' ? '#f43f5e' : '#38bdf8';
            ctx.beginPath();
            ctx.arc(rx, rz, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Draw players
          for (const p of pList) {
            if (!p.alive || p.id === myId) continue;
            const rx = (p.x - me.x) * scale;
            const rz = (p.z - me.z) * scale;
            const isAlly = p.team === myTeam;
            ctx.fillStyle = isAlly ? '#22d3ee' : '#f59e0b';
            ctx.beginPath();
            ctx.arc(rx, rz, isAlly ? 3 : 2.8, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();

          // Draw local player arrow at center pointing UP
          ctx.save();
          ctx.translate(half, half);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(4.5, 5);
          ctx.lineTo(0, 2.5);
          ctx.lineTo(-4.5, 5);
          ctx.closePath();
          ctx.fill();

          // FOV cone
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-28, -56);
          ctx.lineTo(28, -56);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [localPosRef]);

  return (
    <div className="relative flex flex-col items-center">
      <canvas
        ref={canvasRef}
        width={164}
        height={164}
        className="w-[144px] h-[144px] sm:w-[164px] sm:h-[164px] rounded-full"
      />
      <span className="mt-1 text-[11px] tracking-wide text-slate-400 font-mono-tabular">
        Arena Radar
      </span>
    </div>
  );
};
