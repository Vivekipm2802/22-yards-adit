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

  // Quick actions - CricHeroes inspired
  const quickActions = [
    { id: 'MATCH_CENTER', label: 'Start Match', desc: 'Score a new match', icon: Play, color: '#00F0FF', bg: 'from-[#00F0FF]/40 to-[#00F0FF]/15' },
    { id: 'PERFORMANCE', label: 'My Stats', desc: 'View performance', icon: BarChart3, color: '#39FF14', bg: 'from-[#39FF14]/40 to-[#39FF14]/15' },
    { id: 'HISTORY', label: 'Matches', desc: 'Match history', icon: Clock, color: '#FF6B35', bg: 'from-[#FF6B35]/40 to-[#FF6B35]/15' },
    { id: 'TOURNAMENTS', label: 'Tournaments', desc: 'Join & compete', icon: Trophy, color: '#BC13FE', bg: 'from-[#BC13FE]/40 to-[#BC13FE]/15' },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto px-5 py-6 space-y-6 pb-40 scroll-container"
    >
      {/* HERO SECTION */}
      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-[#00F0FF]/30 shadow-[0_0_20px_rgba(0,240,255,0.15)] shrink-0">
              <img src={userData?.avatar} className="w-full h-full object-cover" alt="" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-white/60 tracking-wide">{greeting}</p>
              <h1 className="font-heading text-2xl tracking-tight text-white leading-tight uppercase">{firstName}</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">Rank</p>
            <p className="font-heading text-2xl text-[#00F0FF] leading-tight">{displayRank}</p>
          </div>
        </div>

        {/* Main CTA Start Match */}
        <button
          onClick={() => onNavigate('MATCH_CENTER')}
          className="w-full relative overflow-hidden rounded-2xl border border-[#00F0FF]/40 group active:scale-[0.98] transition-transform"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#00F0FF]/25 via-[#00F0FF]/8 to-[#00F0FF]/15" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00F0FF]/5 blur-[60px] rounded-full" />
          <div className="relative z-10 flex items-center justify-between p-5">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-xl bg-[#00F0FF]/25 flex items-center justify-center shadow-[0_0_25px_rgba(0,240,255,0.35)]">
                <Swords size={26} className="text-[#00F0FF]" />
              </div>
              <div className="text-left">
                <h2 className="font-heading text-xl text-white uppercase tracking-tight">Start New Match</h2>
                <p className="text-[10px] text-white/60 font-medium tracking-wide mt-0.5">Score, analyze and share live</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#00F0FF] flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(0,240,255,0.4)]">
              <ChevronRight size={20} className="text-black" />
            </div>
          </div>
        </button>
      </motion.section>

      {/* Follow Match Shortcut visible only when actively following */}
      {(() => {
        const followId = typeof localStorage !== 'undefined' ? localStorage.getItem('22Y_FOLLOWING_MATCH') : null;
        if (!followId) return null;
        return (
          <motion.section variants={itemVariants}>
            <button
              onClick={() => onNavigate('FOLLOW_MATCH')}
              className="w-full flex items-center justify-between p-4 rounded-2xl border border-[#BC13FE]/40 bg-[#BC13FE]/15 group active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-[#BC13FE]/20 flex items-center justify-center">
                    <Radio size={20} className="text-[#BC13FE]" />
                  </div>
                  <div className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-[#FF003C] flex items-center gap-0.5">
                    <div className="w-1 h-1 rounded-full bg-white animate-pulse" />
                    <span className="text-[6px] font-black text-white uppercase">Live</span>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-[12px] font-black text-white uppercase tracking-wider">Following a Match</p>
                  <p className="text-[9px] text-white/50 font-medium">Tap to view live scorecard</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#BC13FE]/60 group-hover:text-[#BC13FE]" />
            </button>
          </motion.section>
        );
      })()}

      {/* YOUR STATS Cricket Profile Card */}
      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">Your Cricket</h3>
          <button onClick={() => onNavigate('PERFORMANCE')} className="text-[10px] font-black text-[#00F0FF] uppercase tracking-wider flex items-center gap-1">
            View All <ChevronRight size={12} />
          </button>
        </div>
        <GlassCard className="p-5">
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="space-y-1">
              <p className="font-numbers text-2xl font-bold text-white leading-none">{careerStats.totalMatches}</p>
              <p className="text-[8px] font-black text-white/50 uppercase tracking-widest">Matches</p>
            </div>
            <div className="space-y-1">
              <p className="font-numbers text-2xl font-bold text-white leading-none">{careerStats.totalRuns.toLocaleString()}</p>
              <p className="text-[8px] font-black text-white/50 uppercase tracking-widest">Runs</p>
            </div>
            <div className="space-y-1">
              <p className="font-numbers text-2xl font-bold text-white leading-none">{careerStats.totalWickets}</p>
              <p className="text-[8px] font-black text-white/50 uppercase tracking-widest">Wickets</p>
            </div>
            <div className="space-y-1">
              <p className="font-numbers text-2xl font-bold text-[#00F0FF] leading-none">{careerStats.bestScore}</p>
              <p className="text-[8px] font-black text-white/50 uppercase tracking-widest">Best</p>
            </div>
          </div>
          {careerStats.totalMatches === 0 && (
            <div className="mt-4 pt-3 border-t border-white/5 text-center">
              <p className="text-[11px] text-white/50">Start your first match to see your stats here!</p>
            </div>
          )}
        </GlassCard>
      </motion.section>

      {/* QUICK ACTIONS CricHeroes Style Grid */}
      <motion.section variants={itemVariants}>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.id}
              onClick={() => onNavigate(action.id as any)}
              className="relative overflow-hidden rounded-2xl border border-white/15 hover:border-white/25 transition-all text-left group active:scale-[0.97]"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${action.bg} opacity-90`} />
              <div className="relative z-10 p-5 flex flex-col space-y-3">
                <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <action.icon size={22} style={{ color: isLightMode ? '#991b1b' : action.color }} strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[13px] font-black text-white uppercase tracking-wider leading-none">{action.label}</p>
                  <p className="text-[9px] text-white/50 font-medium mt-1">{action.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </motion.section>

      {/* DISCOVER Feature Cards */}
      <motion.section variants={itemVariants} className="space-y-3">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60 px-1">Discover</h3>

        {/* Arena Ground Finder */}
        <button
          onClick={() => onNavigate('ARENA')}
          className="w-full flex items-center p-4 rounded-2xl glass-premium border-white/5 hover:border-[#00F0FF]/15 transition-all text-left group active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-[#00F0FF]/10 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shrink-0">
            <MapPin size={22} style={{ color: isLightMode ? '#991b1b' : '#00F0FF' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-black text-white uppercase tracking-wider leading-none mb-1">Find Grounds</p>
            <p className="text-[9px] text-white/45 font-medium truncate">Discover cricket grounds near you</p>
          </div>
          <ChevronRight size={16} className="text-white/30 group-hover:text-[#00F0FF] shrink-0" />
        </button>

        {/* Leaderboard teaser */}
        <button
          onClick={() => onNavigate('PERFORMANCE')}
          className="w-full flex items-center p-4 rounded-2xl glass-premium border-white/5 hover:border-[#39FF14]/15 transition-all text-left group active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-[#39FF14]/10 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform shrink-0">
            <Award size={22} style={{ color: isLightMode ? '#991b1b' : '#39FF14' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-black text-white uppercase tracking-wider leading-none mb-1">Leaderboard</p>
            <p className="text-[9px] text-white/45 font-medium truncate">See where you rank among players</p>
          </div>
          <ChevronRight size={16} className="text-white/30 group-hover:text-[#39FF14] shrink-0" />
        </button>
      </motion.section>

      {/* UPGRADE Elite Squadron */}
      <motion.section variants={itemVariants}>
        <div className="relative p-[1px] rounded-2xl overflow-hidden bg-gradient-to-br from-[#00F0FF]/60 via-[#00F0FF]/25 to-[#00F0FF]/10">
          <div className="bg-[#020617] p-6 rounded-[15px] flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="absolute inset-0 bg-[#00F0FF]/20 blur-xl rounded-full" />
                <Crown size={28} className="text-[#00F0FF] relative z-10 drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]" />
              </div>
              <div>
                <h3 className="font-heading text-lg text-white tracking-tight uppercase leading-none">Go Elite</h3>
                <p className="text-[9px] font-medium text-white/50 mt-1">Unlock advanced stats and rankings</p>
              </div>
            </div>
            <MotionButton
              onClick={onUpgrade}
              className="bg-[#00F0FF] text-black !rounded-xl font-black text-[9px] !py-3 !px-5 shadow-[0_0_15px_#00F0FF33]"
            >
              UPGRADE
            </MotionButton>
          </div>
        </div>
      </motion.section>

    </motion.div>
  );
};

export default Dugout;
