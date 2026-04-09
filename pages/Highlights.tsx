// pages/Highlights.tsx
// AI-powered match highlights display and analysis

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Share2,
  Download,
  TrendingUp,
  Zap,
  Award,
  Target,
  BarChart3,
  Clock,
} from 'lucide-react';
import { MatchHighlights, HighlightMoment, generateMatchHighlights } from '../lib/highlights';
import { MatchState } from '../types';

const CYBER_COLORS = {
  bg: '#050505',
  surface: '#121212',
  cyan: '#00F0FF',
  red: '#FF003C',
  purple: '#BC13FE',
  gold: '#FFD600',
  green: '#39FF14',
  grey: '#1A1A1A',
  teal: '#4DB6AC',
  textDim: '#666666',
  orange: '#FF6D00'
};

interface HighlightsPageProps {
  match: MatchState;
  onBack: () => void;
}

const HighlightsPage: React.FC<HighlightsPageProps> = ({ match, onBack }) => {
  const [currentMomentIndex, setCurrentMomentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'MOMENTS' | 'NARRATIVE' | 'STATS' | 'PHASES'>('MOMENTS');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Generate highlights
  const highlights = useMemo(() => {
    return generateMatchHighlights(match.history, match.teams, match.config);
  }, [match]);

  const currentMoment = highlights.moments[currentMomentIndex];

  const handleNextMoment = () => {
    if (currentMomentIndex < highlights.moments.length - 1) {
      setCurrentMomentIndex(currentMomentIndex + 1);
    }
  };

  const handlePrevMoment = () => {
    if (currentMomentIndex > 0) {
      setCurrentMomentIndex(currentMomentIndex - 1);
    }
  };

  const copyShareLink = () => {
    const text = `Check out the highlights from this incredible match! ${window.location.origin}?watch=${match.matchId}`;
    navigator.clipboard.writeText(text);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const getMomentColor = (type: HighlightMoment['type']) => {
    switch (type) {
      case 'SIX':
        return CYBER_COLORS.gold;
      case 'WICKET':
        return CYBER_COLORS.red;
      case 'FOUR':
        return CYBER_COLORS.cyan;
      case 'MILESTONE':
        return CYBER_COLORS.purple;
      case 'TURNING_POINT':
        return CYBER_COLORS.orange;
      case 'BIG_OVER':
        return CYBER_COLORS.green;
      case 'MAIDEN':
        return CYBER_COLORS.teal;
      case 'PARTNERSHIP':
        return CYBER_COLORS.cyan;
      default:
        return CYBER_COLORS.cyan;
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: CYBER_COLORS.bg }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 p-4 border-b flex items-center justify-between"
        style={{ backgroundColor: CYBER_COLORS.surface, borderColor: CYBER_COLORS.grey }}
      >
        <button
          onClick={onBack}
          className="p-2 rounded-lg transition-colors hover:opacity-70"
          style={{ backgroundColor: CYBER_COLORS.grey }}
        >
          <ChevronLeft size={24} color={CYBER_COLORS.cyan} />
        </button>

        <h1 className="font-heading text-xl uppercase italic" style={{ color: CYBER_COLORS.cyan }}>
          Match Highlights
        </h1>

        <button
          onClick={() => setShareOpen(!shareOpen)}
          className="p-2 rounded-lg transition-colors hover:opacity-70"
          style={{ backgroundColor: CYBER_COLORS.grey }}
        >
          <Share2 size={24} color={CYBER_COLORS.cyan} />
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
              <motion.div
                className="rounded-2xl p-6 max-w-sm w-full"
                style={{ backgroundColor: CYBER_COLORS.surface }}
              >
                <p className="text-white mb-4 text-sm">
                  Share these highlights with your friends!
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}?watch=${match.matchId}`}
                    className="flex-1 px-3 py-2 rounded-lg bg-black text-white text-xs border"
                    style={{ borderColor: CYBER_COLORS.cyan }}
                  />
                  <button
                    onClick={copyShareLink}
                    className="px-4 py-2 rounded-lg font-bold transition-all"
                    style={{
                      backgroundColor: shareCopied ? CYBER_COLORS.green : CYBER_COLORS.cyan,
                      color: shareCopied ? 'white' : CYBER_COLORS.bg,
                    }}
                  >
                    {shareCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button
                  onClick={() => setShareOpen(false)}
                  className="w-full mt-4 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: CYBER_COLORS.grey, color: 'white' }}
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(['MOMENTS', 'NARRATIVE', 'STATS', 'PHASES'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setCurrentMomentIndex(0);
              }}
              className="px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap text-sm"
              style={{
                backgroundColor: activeTab === tab ? CYBER_COLORS.cyan : CYBER_COLORS.grey,
                color: activeTab === tab ? CYBER_COLORS.bg : 'white',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* MOMENTS TAB */}
        {activeTab === 'MOMENTS' && (
          <div className="space-y-6">
            {highlights.moments.length === 0 ? (
              <div
                className="p-8 rounded-xl text-center"
                style={{ backgroundColor: CYBER_COLORS.grey }}
              >
                <p style={{ color: CYBER_COLORS.textDim }}>No key moments recorded in this match</p>
              </div>
            ) : (
              <>
                {/* Current Moment Display */}
                <motion.div
                  key={currentMomentIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="rounded-2xl p-6"
                  style={{
                    backgroundColor: CYBER_COLORS.surface,
                    borderLeft: `6px solid ${getMomentColor(currentMoment.type)}`,
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-bold uppercase"
                          style={{
                            backgroundColor: getMomentColor(currentMoment.type) + '22',
                            color: getMomentColor(currentMoment.type),
                          }}
                        >
                          {currentMoment.type}
                        </span>
                        <span className="text-xs" style={{ color: CYBER_COLORS.textDim }}>
                          Over {currentMoment.over + 1}.{currentMoment.ball}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-1">{currentMoment.description}</h3>
                      {currentMoment.score && (
                        <p style={{ color: CYBER_COLORS.cyan }} className="font-numbers text-lg">
                          Score: {currentMoment.score}
                        </p>
                      )}
                    </div>
                    <div
                      className="px-4 py-2 rounded-lg"
                      style={{
                        backgroundColor: getMomentColor(currentMoment.type) + '22',
                      }}
                    >
                      <p
                        className="text-xs font-bold"
                        style={{ color: getMomentColor(currentMoment.type) }}
                      >
                        {currentMoment.impact}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {currentMoment.batsmanName && (
                      <div>
                        <p style={{ color: CYBER_COLORS.textDim }} className="text-xs uppercase">
                          Batsman
                        </p>
                        <p className="font-bold text-white">{currentMoment.batsmanName}</p>
                      </div>
                    )}
                    {currentMoment.bowlerName && (
                      <div>
                        <p style={{ color: CYBER_COLORS.textDim }} className="text-xs uppercase">
                          Bowler
                        </p>
                        <p className="font-bold text-white">{currentMoment.bowlerName}</p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Navigation */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={handlePrevMoment}
                    disabled={currentMomentIndex === 0}
                    className="p-3 rounded-lg transition-all disabled:opacity-30"
                    style={{ backgroundColor: CYBER_COLORS.grey }}
                  >
                    <ChevronLeft size={24} color={CYBER_COLORS.cyan} />
                  </button>

                  <p style={{ color: CYBER_COLORS.textDim }} className="text-sm">
                    {currentMomentIndex + 1} / {highlights.moments.length}
                  </p>

                  <button
                    onClick={handleNextMoment}
                    disabled={currentMomentIndex === highlights.moments.length - 1}
                    className="p-3 rounded-lg transition-all disabled:opacity-30"
                    style={{ backgroundColor: CYBER_COLORS.grey }}
                  >
                    <ChevronRight size={24} color={CYBER_COLORS.cyan} />
                  </button>
                </div>

                {/* Moments Timeline */}
                <div className="space-y-2">
                  <p style={{ color: CYBER_COLORS.textDim }} className="text-xs uppercase font-bold">
                    All Moments
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {highlights.moments.map((moment, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentMomentIndex(idx)}
                        className={`p-3 rounded-lg text-xs font-bold uppercase transition-all ${
                          idx === currentMomentIndex ? 'ring-2' : ''
                        }`}
                        style={{
                          backgroundColor: idx === currentMomentIndex
                            ? getMomentColor(moment.type)
                            : CYBER_COLORS.grey,
                          color: idx === currentMomentIndex ? CYBER_COLORS.bg : 'white',
                          ringColor: getMomentColor(moment.type),
                        }}
                      >
                        {moment.type.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* NARRATIVE TAB */}
        {activeTab === 'NARRATIVE' && (
          <div className="space-y-4">
            <div className="space-y-4">
              {highlights.matchNarrative.map((para, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: CYBER_COLORS.grey }}
                >
                  <p className="text-white leading-relaxed text-sm">{para}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'STATS' && (
          <div className="grid gap-4">
            {/* Best Batsman */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-2xl"
              style={{
                backgroundColor: CYBER_COLORS.surface,
                borderTop: `4px solid ${CYBER_COLORS.cyan}`,
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <Award size={24} color={CYBER_COLORS.cyan} />
                <h3 className="font-bold text-white">Top Batsman</h3>
              </div>
              <p className="text-2xl font-bold text-white mb-4">{highlights.bestBatsman.name}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p style={{ color: CYBER_COLORS.textDim }} className="text-xs">
                    Runs
                  </p>
                  <p className="text-xl font-bold" style={{ color: CYBER_COLORS.green }}>
                    {highlights.bestBatsman.runs}
                  </p>
                </div>
                <div>
                  <p style={{ color: CYBER_COLORS.textDim }} className="text-xs">
                    Balls
                  </p>
                  <p className="text-xl font-bold" style={{ color: CYBER_COLORS.cyan }}>
                    {highlights.bestBatsman.balls}
                  </p>
                </div>
                <div>
                  <p style={{ color: CYBER_COLORS.textDim }} className="text-xs">
                    Fours
                  </p>
                  <p className="text-xl font-bold" style={{ color: CYBER_COLORS.cyan }}>
                    {highlights.bestBatsman.fours}
                  </p>
                </div>
                <div>
                  <p style={{ color: CYBER_COLORS.textDim }} className="text-xs">
                    Sixes
                  </p>
                  <p className="text-xl font-bold" style={{ color: CYBER_COLORS.gold }}>
                    {highlights.bestBatsman.sixes}
                  </p>
                </div>
              </div>
              <div
                className="mt-4 pt-4 border-t"
                style={{ borderColor: CYBER_COLORS.grey }}
              >
                <p style={{ color: CYBER_COLORS.textDim }} className="text-xs mb-1">
                  Strike Rate
                </p>
                <p className="text-lg font-bold" style={{ color: CYBER_COLORS.orange }}>
                  {highlights.bestBatsman.strikeRate.toFixed(1)}
                </p>
              </div>
            </motion.div>

            {/* Best Bowler */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-6 rounded-2xl"
              style={{
                backgroundColor: CYBER_COLORS.surface,
                borderTop: `4px solid ${CYBER_COLORS.red}`,
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <Target size={24} color={CYBER_COLORS.red} />
                <h3 className="font-bold text-white">Top Bowler</h3>
              </div>
              <p className="text-2xl font-bold text-white mb-4">{highlights.bestBowler.name}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p style={{ color: CYBER_COLORS.textDim }} className="text-xs">
                    Wickets
                  </p>
                  <p className="text-xl font-bold" style={{ color: CYBER_COLORS.red }}>
                    {highlights.bestBowler.wickets}
                  </p>
                </div>
                <div>
                  <p style={{ color: CYBER_COLORS.textDim }} className="text-xs">
                    Runs Conceded
                  </p>
                  <p className="text-xl font-bold" style={{ color: CYBER_COLORS.cyan }}>
                    {highlights.bestBowler.runs}
                  </p>
                </div>
                <div>
                  <p style={{ color: CYBER_COLORS.textDim }} className="text-xs">
                    Overs
                  </p>
                  <p className="text-xl font-bold" style={{ color: CYBER_COLORS.cyan }}>
                    {highlights.bestBowler.overs}
                  </p>
                </div>
                <div>
                  <p style={{ color: CYBER_COLORS.textDim }} className="text-xs">
                    Economy
                  </p>
                  <p className="text-xl font-bold" style={{ color: CYBER_COLORS.orange }}>
                    {highlights.bestBowler.economy.toFixed(2)}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Key Stats */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-6 rounded-2xl"
              style={{
                backgroundColor: CYBER_COLORS.surface,
                borderTop: `4px solid ${CYBER_COLORS.purple}`,
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 size={24} color={CYBER_COLORS.purple} />
                <h3 className="font-bold text-white">Match Stats</h3>
              </div>
              <div className="space-y-3">
                {highlights.keyStats.map((stat, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <p style={{ color: CYBER_COLORS.textDim }} className="text-sm">
                      {stat.label}
                    </p>
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
            {highlights.phases.map((phase, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-6 rounded-2xl"
                style={{
                  backgroundColor: CYBER_COLORS.surface,
                  borderLeft: `4px solid ${
                    phase.momentum === 'TEAM_A'
                      ? CYBER_COLORS.green
                      : phase.momentum === 'TEAM_B'
                      ? CYBER_COLORS.red
                      : CYBER_COLORS.teal
                  }`,
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">{phase.phase}</h3>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor:
                        phase.momentum === 'TEAM_A'
                          ? CYBER_COLORS.green + '22'
                          : phase.momentum === 'TEAM_B'
                          ? CYBER_COLORS.red + '22'
                          : CYBER_COLORS.teal + '22',
                      color:
                        phase.momentum === 'TEAM_A'
                          ? CYBER_COLORS.green
                          : phase.momentum === 'TEAM_B'
                          ? CYBER_COLORS.red
                          : CYBER_COLORS.teal,
                    }}
                  >
                    {phase.momentum}
                  </span>
                </div>
                <p style={{ color: CYBER_COLORS.textDim }} className="text-sm">
                  {phase.description}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HighlightsPage;
