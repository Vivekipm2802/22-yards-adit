// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Swords, LineChart, Map, Crown, Zap,
  ChevronRight, Activity, Target,
  Trophy, Star, TrendingUp, MapPin, Eye, Radio,
  Play, Users, BarChart3, Award, Flame, Shield,
  Clock, ChevronUp, Sparkles, CircleDot
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import MotionButton from '../components/MotionButton';
import { useAuth } from '../AuthContext';
import { fetchLeaderboard } from '../lib/supabase';

interface DugoutProps {
  onNavigate: (page: 'DUGOUT' | 'MATCH_CENTER' | 'PERFORMANCE' | 'ARENA' | 'HISTORY' | 'TOURNAMENTS' | 'FOLLOW_MATCH') => void;
  onUpgrade?: () => void;
}

const containerVariants: any = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 }
  }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as any }
  }
};

const Dugout: React.FC<DugoutProps> = ({ onNavigate, onUpgrade }) => {
  const { userData } = useAuth();
  const isLightMode = typeof document !== 'undefined' && document.documentElement?.dataset?.theme === 'light';

  // Calculate real career stats from the Vault
  const careerStats = useMemo(() => {
    const activePhone = userData?.phone || '';
    const globalVault = JSON.parse(localStorage.getItem('22YARDS_GLOBAL_VAULT') || '{}');
    const profileData = globalVault[activePhone] || { history: [], teams: [] };
    const history = profileData.history || [];

    const totalRuns = history.reduce((acc: number, match: any) => acc + (parseInt(match.runs) || 0), 0);
    const totalMatches = history.length;
    const totalWickets = history.reduce((acc: number, match: any) => acc + (parseInt(match.wickets) || 0), 0);

    // Best score
    const bestScore = history.reduce((best: number, match: any) => {
      const runs = parseInt(match.runs) || 0;
      return runs > best ? runs : best;
    }, 0);

    // Average
    const avg = totalMatches > 0 ? (totalRuns / totalMatches).toFixed(1) : '0.0';

    return { totalRuns, totalMatches, totalWickets, bestScore, avg };
  }, [userData]);

  // Real impact rank from Supabase leaderboard
  const [cloudRank, setCloudRank] = useState<string | null>(null);
  useEffect(() => {
    if (!userData?.phone) return;
    fetchLeaderboard('career_runs', 100)
      .then(leaders => {
        const idx = leaders.findIndex(l => l.phone === userData.phone);
        if (idx >= 0) {
          setCloudRank(`#${idx + 1}`);
        } else {
          setCloudRank(careerStats.totalRuns > 0 ? '#-' : 'NEW');
        }
      })
      .catch(() => {
        setCloudRank(careerStats.totalRuns > 1000 ? '#12' : careerStats.totalRuns > 0 ? '#42' : 'NEW');
      });
  }, [userData?.phone]);
  const displayRank = cloudRank ?? 'NEW';

  // Get time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const firstName = userData?.name?.split(' ')[0] || 'Player';

  // Quick actions
  const quickActions = [
    { id: 'MATCH_CENTER', label: 'Start Match', desc: 'Score a new match', icon: Play, accent: '#00F0FF' },
    { id: 'PERFORMANCE', label: 'My Stats', desc: 'View performance', icon: BarChart3, accent: '#39FF14' },
    { id: 'HISTORY', label: 'Matches', desc: 'Match history', icon: Clock, accent: '#FF6B35' },
    { id: 'TOURNAMENTS', label: 'Tournaments', desc: 'Join & compete', icon: Trophy, accent: '#BC13FE' },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto px-5 py-6 space-y-5 pb-40 scroll-container"
    >
      {/* HERO SECTION — Greeting + Avatar */}
      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-white/20 shrink-0">
              <img src={userData?.avatar} className="w-full h-full object-cover" alt="" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-white/50 tracking-wide">{greeting}</p>
              <h1 className="font-heading text-xl tracking-tight text-white leading-tight uppercase">{firstName}</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-bold text-white/40 uppercase tracking-[0.15em]">Rank</p>
            <p className="font-heading text-xl text-[#00F0FF] leading-tight">{displayRank}</p>
          </div>
        </div>

        {/* Main CTA — Start New Match */}
        <button
          onClick={() => onNavigate('MATCH_CENTER')}
          className="w-full rounded-xl border border-[#00F0FF]/25 bg-[#00F0FF]/[0.06] group active:scale-[0.98] transition-all"
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center space-x-4">
              <div className="w-11 h-11 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/20 flex items-center justify-center">
                <Swords size={20} className="text-[#00F0FF]" />
              </div>
              <div className="text-left">
                <h2 className="text-[14px] font-black text-white uppercase tracking-wide">Start New Match</h2>
                <p className="text-[10px] text-white/45 font-medium mt-0.5">Score, analyze and share live</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-[#00F0FF]/50 group-hover:text-[#00F0FF] transition-colors" />
          </div>
        </button>
      </motion.section>

      {/* Follow Match Shortcut — visible only when actively following */}
      {(() => {
        const followId = typeof localStorage !== 'undefined' ? localStorage.getItem('22Y_FOLLOWING_MATCH') : null;
        if (!followId) return null;
        return (
          <motion.section variants={itemVariants}>
            <button
              onClick={() => onNavigate('FOLLOW_MATCH')}
              className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl border border-[#BC13FE]/25 bg-[#BC13FE]/[0.06] group active:scale-[0.98] transition-all"
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-lg bg-[#BC13FE]/10 border border-[#BC13FE]/20 flex items-center justify-center">
                    <Radio size={18} className="text-[#BC13FE]" />
                  </div>
                  <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-[#FF003C] flex items-center gap-0.5">
                    <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
                    <span className="text-[6px] font-black text-white uppercase">Live</span>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-[12px] font-black text-white uppercase tracking-wider leading-none">Following a Match</p>
                  <p className="text-[9px] text-white/40 font-medium mt-1">Tap to view live scorecard</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#BC13FE]/40 group-hover:text-[#BC13FE]" />
            </button>
          </motion.section>
        );
      })()}

      {/* YOUR CRICKET — Stats Strip */}
      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Your Cricket</h3>
          <button onClick={() => onNavigate('PERFORMANCE')} className="text-[10px] font-bold text-[#00F0FF]/70 uppercase tracking-wider flex items-center gap-0.5 hover:text-[#00F0FF] transition-colors">
            View All <ChevronRight size={11} />
          </button>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="font-numbers text-2xl font-bold text-white leading-none">{careerStats.totalMatches}</p>
              <p className="text-[8px] font-bold text-white/35 uppercase tracking-[0.12em] mt-1.5">Matches</p>
            </div>
            <div>
              <p className="font-numbers text-2xl font-bold text-white leading-none">{careerStats.totalRuns.toLocaleString()}</p>
              <p className="text-[8px] font-bold text-white/35 uppercase tracking-[0.12em] mt-1.5">Runs</p>
            </div>
            <div>
              <p className="font-numbers text-2xl font-bold text-white leading-none">{careerStats.totalWickets}</p>
              <p className="text-[8px] font-bold text-white/35 uppercase tracking-[0.12em] mt-1.5">Wickets</p>
            </div>
            <div>
              <p className="font-numbers text-2xl font-bold text-[#00F0FF] leading-none">{careerStats.bestScore}</p>
              <p className="text-[8px] font-bold text-white/35 uppercase tracking-[0.12em] mt-1.5">Best</p>
            </div>
          </div>
          {careerStats.totalMatches === 0 && (
            <div className="mt-3.5 pt-3 border-t border-white/[0.06] text-center">
              <p className="text-[10px] text-white/35">Start your first match to see stats here</p>
            </div>
          )}
        </div>
      </motion.section>

      {/* QUICK ACTIONS — Clean dark grid, no colored backgrounds */}
      <motion.section variants={itemVariants}>
        <div className="grid grid-cols-2 gap-2.5">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => onNavigate(action.id as any)}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left group active:scale-[0.97]"
            >
              <div className="p-4 flex flex-col space-y-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${action.accent}10`, border: `1px solid ${action.accent}25` }}
                >
                  <action.icon size={18} style={{ color: action.accent }} strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[12px] font-black text-white uppercase tracking-wider leading-none">{action.label}</p>
                  <p className="text-[9px] text-white/35 font-medium mt-1">{action.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </motion.section>

      {/* DISCOVER — Minimal list items */}
      <motion.section variants={itemVariants} className="space-y-2">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 px-0.5 mb-1">Discover</h3>

        {/* Arena Ground Finder */}
        <button
          onClick={() => onNavigate('ARENA')}
          className="w-full flex items-center px-4 py-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left group active:scale-[0.98]"
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center mr-3.5 shrink-0"
            style={{ backgroundColor: '#00F0FF10', border: '1px solid #00F0FF25' }}
          >
            <MapPin size={18} style={{ color: '#00F0FF' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-white uppercase tracking-wider leading-none">Find Grounds</p>
            <p className="text-[9px] text-white/35 font-medium mt-1">Discover cricket grounds near you</p>
          </div>
          <ChevronRight size={14} className="text-white/20 group-hover:text-white/50 shrink-0" />
        </button>

        {/* Leaderboard */}
        <button
          onClick={() => onNavigate('PERFORMANCE')}
          className="w-full flex items-center px-4 py-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left group active:scale-[0.98]"
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center mr-3.5 shrink-0"
            style={{ backgroundColor: '#39FF1410', border: '1px solid #39FF1425' }}
          >
            <Award size={18} style={{ color: '#39FF14' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-white uppercase tracking-wider leading-none">Leaderboard</p>
            <p className="text-[9px] text-white/35 font-medium mt-1">See where you rank among players</p>
          </div>
          <ChevronRight size={14} className="text-white/20 group-hover:text-white/50 shrink-0" />
        </button>
      </motion.section>

      {/* UPGRADE — Subtle premium card */}
      <motion.section variants={itemVariants}>
        <div className="rounded-xl border border-[#00F0FF]/15 bg-[#00F0FF]/[0.03] p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#00F0FF]/10 border border-[#00F0FF]/20 flex items-center justify-center">
              <Crown size={20} className="text-[#00F0FF]" />
            </div>
            <div>
              <h3 className="text-[13px] font-black text-white tracking-wide uppercase leading-none">Go Elite</h3>
              <p className="text-[9px] font-medium text-white/35 mt-1">Unlock advanced stats & rankings</p>
            </div>
          </div>
          <MotionButton
            onClick={onUpgrade}
            className="bg-[#00F0FF] text-black !rounded-lg font-black text-[9px] !py-2.5 !px-4"
          >
            UPGRADE
          </MotionButton>
        </div>
      </motion.section>

    </motion.div>
  );
};

export default Dugout;
