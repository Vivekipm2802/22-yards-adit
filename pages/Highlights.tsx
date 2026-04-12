// pages/Highlights.tsx
// Match highlights display — uses Tailwind classes so light-mode CSS overrides work

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Share2,
  Award,
  Target,
  BarChart3,
} from 'lucide-react';
import { HighlightMoment, generateMatchHighlights } from '../lib/highlights';
import { MatchState } from '../types';

interface HighlightsPageProps {
  match: MatchState;
  onBack: () => void;
}

const getMomentColor = (type: HighlightMoment['type']) => {
  switch (type) {
    case 'SIX': return { text: 'text-[#FFD600]', bg: 'bg-[#FFD600]/10', border: 'border-[#FFD600]' };
    case 'WICKET': return { text: 'text-[#FF003C]', bg: 'bg-[#FF003C]/10', border: 'border-[#FF003C]' };
    case 'FOUR': return { text: 'text-[#00F0FF]', bg: 'bg-[#00F0FF]/10', border: 'border-[#00F0FF]' };
    case 'MILESTONE': return { text: 'text-[#BC13FE]', bg: 'bg-[#BC13FE]/10', border: 'border-[#BC13FE]' };
    case 'TURNING_POINT': return { text: 'text-[#FF6D00]', bg: 'bg-[#FF6D00]/10', border: 'border-[#FF6D00]' };
    case 'BIG_OVER': return { text: 'text-[#39FF14]', bg: 'bg-[#39FF14]/10', border: 'border-[#39FF14]' };
    case 'MAIDEN': return { text: 'text-[#4DB6AC]', bg: 'bg-[#4DB6AC]/10', border: 'border-[#4DB6AC]' };
    case 'PARTNERSHIP': return { text: 'text-[#00F0FF]', bg: 'bg-[#00F0FF]/10', border: 'border-[#00F0FF]' };
    default: return { text: 'text-[#00F0FF]', bg: 'bg-[#00F0FF]/10', border: 'border-[#00F0FF]' };
  }
};

const HighlightsPage: React.FC<HighlightsPageProps> = ({ match, onBack }) => {
  const [currentMomentIndex, setCurrentMomentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'MOMENTS' | 'NARRATIVE' | 'STATS' | 'PHASES'>('MOMENTS');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const highlights = useMemo(() => {
    return generateMatchHighlights(match.history, match.teams, match.config);
  }, [match]);

  const currentMoment = highlights.moments.length > 0 ? highlights.moments[currentMomentIndex] : null;

  const copyShareLink = () => {
    const text = `Check out the highlights from this incredible match! ${window.location.origin}?watch=${match.matchId}`;
    navigator.clipboard.writeText(text);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Header */}
      <div className="sticky top-0 z-40 p-4 border-b border-white/10 bg-[#121212] flex items-center justify-between">
        <button onClick={onBack} className="p-2 rounded-lg bg-[#1A1A1A] hover:opacity-70 transition-colors">
          <ChevronLeft size={24} className="text-[#00F0FF]" />
        </button>
        <h1 className="font-heading text-xl uppercase italic text-[#00F0FF]">Match Highlights</h1>
        <button onClick={() => setShareOpen(!shareOpen)} className="p-2 rounded-lg bg-[#1A1A1A] hover:opacity-70 transition-colors">
          <Share2 size={24} className="text-[#00F0FF]" />
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {/* Share Modal */}
        <AnimatePresence>
          {shareOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            >
              <motion.div className="rounded-2xl p-6 max-w-sm w-full bg-[#121212]">
                <p className="text-white mb-4 text-sm">Share these highlights with your friends!</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}?watch=${match.matchId}`}
                    className="flex-1 px-3 py-2 rounded-lg bg-black text-white text-xs border border-[#00F0FF]"
                  />
                  <button
                    onClick={copyShareLink}
                    className={`px-4 py-2 rounded-lg font-bold transition-all ${shareCopied ? 'bg-[#39FF14] text-white' : 'bg-[#00F0FF] text-black'}`}
                  >
                    {shareCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={() => setShareOpen(false)}
                  className="w-full mt-4 py-2 rounded-lg bg-[#1A1A1A] text-white transition-colors"
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(['MOMENTS', 'NARRATIVE', 'STATS', 'PHASES'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setCurrentMomentIndex(0); }}
              className={`px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap text-sm ${
                activeTab === tab ? 'bg-[#00F0FF] text-black' : 'bg-[#1A1A1A] text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* MOMENTS TAB */}
        {activeTab === 'MOMENTS' && (
          <div className="space-y-6">
            {highlights.moments.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#1A1A1A] text-center">
                <p className="text-white/40">No key moments recorded in this match</p>
              </div>
            ) : (
              <>
                {currentMoment && (() => {
                  const colors = getMomentColor(currentMoment.type);
                  return (
                    <motion.div
                      key={currentMomentIndex}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={`rounded-2xl p-6 bg-[#121212] border-l-[6px] ${colors.border}`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${colors.bg} ${colors.text}`}>
                              {currentMoment.type.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-white/40">
                              Inn {currentMoment.innings} | Ov {currentMoment.over + 1}.{currentMoment.ball}
                            </span>
                          </div>
                          <h3 className="text-2xl font-bold text-white mb-1">{currentMoment.description}</h3>
                          {currentMoment.score && (
                            <p className="text-[#00F0FF] font-numbers text-lg">Score: {currentMoment.score}</p>
                          )}
                        </div>
                        <div className={`px-4 py-2 rounded-lg ${colors.bg}`}>
                          <p className={`text-xs font-bold ${colors.text}`}>{currentMoment.impact}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        {currentMoment.batsmanName && (
                          <div>
                            <p className="text-white/40 text-xs uppercase">Batsman</p>
                            <p className="font-bold text-white">{currentMoment.batsmanName}</p>
                          </div>
                        )}
                        {currentMoment.bowlerName && (
                          <div>
                            <p className="text-white/40 text-xs uppercase">Bowler</p>
                            <p className="font-bold text-white">{currentMoment.bowlerName}</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })()}

                {/* Navigation */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentMomentIndex(i => Math.max(0, i - 1))}
                    disabled={currentMomentIndex === 0}
                    className="p-3 rounded-lg bg-[#1A1A1A] transition-all disabled:opacity-30"
                  >
                    <ChevronLeft size={24} className="text-[#00F0FF]" />
                  </button>
                  <p className="text-white/40 text-sm">{currentMomentIndex + 1} / {highlights.moments.length}</p>
                  <button
                    onClick={() => setCurrentMomentIndex(i => Math.min(highlights.moments.length - 1, i + 1))}
                    disabled={currentMomentIndex === highlights.moments.length - 1}
                    className="p-3 rounded-lg bg-[#1A1A1A] transition-all disabled:opacity-30"
                  >
                    <ChevronRight size={24} className="text-[#00F0FF]" />
                  </button>
                </div>

                {/* Moments Timeline */}
                <div className="space-y-2">
                  <p className="text-white/40 text-xs uppercase font-bold">All Moments</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {highlights.moments.map((moment, idx) => {
                      const mc = getMomentColor(moment.type);
                      return (
                        <button
                          key={idx}
                          onClick={() => setCurrentMomentIndex(idx)}
                          className={`p-3 rounded-lg text-xs font-bold uppercase transition-all ${
                            idx === currentMomentIndex
                              ? `${mc.bg} ${mc.text} ring-2 ring-current`
                              : 'bg-[#1A1A1A] text-white'
                          }`}
                        >
                          {moment.type.replace('_', ' ').slice(0, 6)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* NARRATIVE TAB */}
        {activeTab === 'NARRATIVE' && (
          <div className="space-y-4">
            {highlights.matchNarrative.map((para, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-4 rounded-xl bg-[#1A1A1A]"
              >
                <p className="text-white leading-relaxed text-sm">{para}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'STATS' && (
          <div className="grid gap-4">
            {/* Best Batsman */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-2xl bg-[#121212] border-t-4 border-[#00F0FF]"
            >
              <div className="flex items-center gap-3 mb-4">
                <Award size={24} className="text-[#00F0FF]" />
                <h3 className="font-bold text-white">Top Batsman</h3>
              </div>
              <p className="text-2xl font-bold text-white mb-4">{highlights.bestBatsman.name}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/40 text-xs">Runs</p>
                  <p className="text-xl font-bold text-[#39FF14]">{highlights.bestBatsman.runs}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Balls</p>
                  <p className="text-xl font-bold text-[#00F0FF]">{highlights.bestBatsman.balls}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Fours</p>
                  <p className="text-xl font-bold text-[#00F0FF]">{highlights.bestBatsman.fours}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Sixes</p>
                  <p className="text-xl font-bold text-[#FFD600]">{highlights.bestBatsman.sixes}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-white/40 text-xs mb-1">Strike Rate</p>
                <p className="text-lg font-bold text-[#FF6D00]">{highlights.bestBatsman.strikeRate.toFixed(1)}</p>
              </div>
            </motion.div>

            {/* Best Bowler */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-6 rounded-2xl bg-[#121212] border-t-4 border-[#FF003C]"
            >
              <div className="flex items-center gap-3 mb-4">
                <Target size={24} className="text-[#FF003C]" />
                <h3 className="font-bold text-white">Top Bowler</h3>
              </div>
              <p className="text-2xl font-bold text-white mb-4">{highlights.bestBowler.name}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/40 text-xs">Wickets</p>
                  <p className="text-xl font-bold text-[#FF003C]">{highlights.bestBowler.wickets}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Runs Conceded</p>
                  <p className="text-xl font-bold text-[#00F0FF]">{highlights.bestBowler.runs}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Overs</p>
                  <p className="text-xl font-bold text-[#00F0FF]">{highlights.bestBowler.overs}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Economy</p>
                  <p className="text-xl font-bold text-[#FF6D00]">{highlights.bestBowler.economy.toFixed(2)}</p>
                </div>
              </div>
            </motion.div>

            {/* Key Stats */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-6 rounded-2xl bg-[#121212] border-t-4 border-[#BC13FE]"
            >
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 size={24} className="text-[#BC13FE]" />
                <h3 className="font-bold text-white">Match Stats</h3>
              </div>
              <div className="space-y-3">
                {highlights.keyStats.map((stat, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <p className="text-white/40 text-sm">{stat.label}</p>
                    <p className="font-bold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* PHASES TAB */}
        {activeTab === 'PHASES' && (
          <div className="space-y-4">
            {highlights.phases.map((phase, idx) => {
              const momentumClass =
                phase.momentum === 'TEAM_A' ? 'border-[#39FF14]' :
                phase.momentum === 'TEAM_B' ? 'border-[#FF003C]' : 'border-[#4DB6AC]';
              const badgeBg =
                phase.momentum === 'TEAM_A' ? 'bg-[#39FF14]/10 text-[#39FF14]' :
                phase.momentum === 'TEAM_B' ? 'bg-[#FF003C]/10 text-[#FF003C]' : 'bg-[#4DB6AC]/10 text-[#4DB6AC]';
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`p-6 rounded-2xl bg-[#121212] border-l-4 ${momentumClass}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-bold text-white">{phase.phase}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeBg}`}>
                      {phase.momentumLabel || phase.momentum}
                    </span>
                  </div>
                  <p className="text-white/40 text-sm">{phase.description}</p>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HighlightsPage;
