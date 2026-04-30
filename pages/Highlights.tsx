// pages/Highlights.tsx
// Match highlights display — flat layout, no nested sub-sections

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Award,
  Target,
  BarChart3,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { generateMatchHighlights } from '../lib/highlights';
import { MatchState } from '../types';

interface HighlightsPageProps {
  match: MatchState;
  onBack: () => void;
}

const HighlightsPage: React.FC<HighlightsPageProps> = ({ match, onBack }) => {
  const highlights = useMemo(() => {
    return generateMatchHighlights(match.history, match.teams, match.config);
  }, [match]);

  const getPlayerAvatar = (player: any): string => {
    if (player?.avatar) return player.avatar;
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${player?.id || player?.name || 'unknown'}&backgroundColor=050505`;
  };

  // Build a simple player lookup from both squads
  const allPlayers = [...(match.teams.teamA?.squad || []), ...(match.teams.teamB?.squad || [])];
  const findPlayer = (name: string) => allPlayers.find(p => p.name === name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* ═══ MATCH NARRATIVE ═══ */}
      {highlights.matchNarrative.length > 0 && (
        <div className="space-y-3">
          <p className="text-[9px] font-black text-[#00F0FF] uppercase tracking-[0.2em]">Match Story</p>
          {highlights.matchNarrative.map((para, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="p-4 rounded-[20px] bg-white/[0.03] border border-white/[0.06]"
            >
              <p className="text-[10px] text-white/70 leading-relaxed">{para}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* ═══ TOP PERFORMERS ═══ */}
      <div className="grid grid-cols-2 gap-3">
        {/* Best Batsman */}
        {highlights.bestBatsman?.name && (
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="p-4 rounded-[20px] bg-[#00F0FF]/5 border border-[#00F0FF]/20 space-y-2"
          >
            <div className="flex items-center gap-1.5">
              <Award size={12} className="text-[#00F0FF]" />
              <p className="text-[8px] font-black text-[#00F0FF] uppercase tracking-wider">Top Bat</p>
            </div>
            <div className="flex items-center gap-2">
              <img src={getPlayerAvatar(findPlayer(highlights.bestBatsman.name))} className="w-8 h-8 rounded-full border border-[#00F0FF]/30" />
              <p className="text-[11px] font-black text-white leading-tight">{highlights.bestBatsman.name}</p>
            </div>
            <div className="flex flex-wrap gap-1 text-[8px] font-numbers">
              <span className="text-[#00F0FF] font-black">{highlights.bestBatsman.runs}({highlights.bestBatsman.balls})</span>
              {highlights.bestBatsman.fours > 0 && <span className="text-white/30">{highlights.bestBatsman.fours}×4</span>}
              {highlights.bestBatsman.sixes > 0 && <span className="text-white/30">{highlights.bestBatsman.sixes}×6</span>}
            </div>
            <p className="text-[7px] text-white/25 font-numbers">SR {highlights.bestBatsman.strikeRate.toFixed(1)}</p>
          </motion.div>
        )}

        {/* Best Bowler */}
        {highlights.bestBowler?.name && (
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-[20px] bg-[#FF003C]/5 border border-[#FF003C]/20 space-y-2"
          >
            <div className="flex items-center gap-1.5">
              <Target size={12} className="text-[#FF003C]" />
              <p className="text-[8px] font-black text-[#FF003C] uppercase tracking-wider">Top Bowl</p>
            </div>
            <div className="flex items-center gap-2">
              <img src={getPlayerAvatar(findPlayer(highlights.bestBowler.name))} className="w-8 h-8 rounded-full border border-[#FF003C]/30" />
              <p className="text-[11px] font-black text-white leading-tight">{highlights.bestBowler.name}</p>
            </div>
            <div className="flex gap-1 text-[8px] font-numbers">
              <span className="text-[#FF003C] font-black">{highlights.bestBowler.wickets}/{highlights.bestBowler.runs}</span>
              <span className="text-white/30">({highlights.bestBowler.overs} ov)</span>
            </div>
            <p className="text-[7px] text-white/25 font-numbers">Econ {highlights.bestBowler.economy.toFixed(1)}</p>
          </motion.div>
        )}
      </div>

      {/* ═══ MATCH STATS ═══ */}
      {highlights.keyStats.length > 0 && (
        <div className="p-4 rounded-[20px] bg-white/[0.03] border border-white/[0.06] space-y-3">
          <div className="flex items-center gap-1.5">
            <BarChart3 size={12} className="text-[#BC13FE]" />
            <p className="text-[9px] font-black text-[#BC13FE] uppercase tracking-[0.2em]">Match Stats</p>
          </div>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4">
            {highlights.keyStats.map((stat, idx) => (
              <div key={idx} className="flex justify-between text-[9px]">
                <span className="text-white/40">{stat.label}</span>
                <span className="text-white font-black font-numbers">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ MATCH PHASES ═══ */}
      {highlights.phases.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={12} className="text-[#FFD600]" />
            <p className="text-[9px] font-black text-[#FFD600] uppercase tracking-[0.2em]">Match Phases</p>
          </div>
          {highlights.phases.map((phase, idx) => {
            const borderColor =
              phase.momentum === 'TEAM_A' ? 'border-l-[#39FF14]' :
              phase.momentum === 'TEAM_B' ? 'border-l-[#FF003C]' : 'border-l-[#4DB6AC]';
            const badgeClass =
              phase.momentum === 'TEAM_A' ? 'bg-[#39FF14]/10 text-[#39FF14]' :
              phase.momentum === 'TEAM_B' ? 'bg-[#FF003C]/10 text-[#FF003C]' : 'bg-[#4DB6AC]/10 text-[#4DB6AC]';
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.08 }}
                className={`p-4 rounded-[20px] bg-white/[0.03] border border-white/[0.06] border-l-4 ${borderColor} space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-white">{phase.phase}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase ${badgeClass}`}>
                    {phase.momentumLabel || phase.momentum}
                  </span>
                </div>
                <p className="text-[9px] text-white/50 leading-relaxed">{phase.description}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ═══ KEY MOMENTS TIMELINE ═══ */}
      {highlights.moments.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <Zap size={12} className="text-[#FF6D00]" />
            <p className="text-[9px] font-black text-[#FF6D00] uppercase tracking-[0.2em]">Timeline</p>
          </div>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-3 top-0 bottom-0 w-px bg-white/10" />
            <div className="space-y-1">
              {highlights.moments.slice(0, 15).map((moment, idx) => {
                const dotColor =
                  moment.type === 'WICKET' ? 'bg-[#FF003C]' :
                  moment.type === 'SIX' ? 'bg-[#FFD600]' :
                  moment.type === 'FOUR' ? 'bg-[#00F0FF]' :
                  moment.type === 'MILESTONE' ? 'bg-[#BC13FE]' :
                  moment.type === 'MAIDEN' ? 'bg-[#4DB6AC]' :
                  moment.type === 'BIG_OVER' ? 'bg-[#39FF14]' :
                  'bg-[#FF6D00]';
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex items-start gap-3 pl-1"
                  >
                    <div className={`w-[10px] h-[10px] rounded-full ${dotColor} mt-1 shrink-0 z-10 ring-2 ring-black`} />
                    <div className="flex-1 pb-2">
                      <p className="text-[9px] font-black text-white">{moment.description}</p>
                      <p className="text-[7px] text-white/30">
                        Inn {moment.innings} · Ov {moment.over + 1}.{moment.ball}
                        {moment.score && ` · ${moment.score}`}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default HighlightsPage;
