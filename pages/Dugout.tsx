// @ts-nocheck
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords, LineChart, Map, Crown, Zap,
  ChevronRight, Activity, Target,
  Trophy, Star, TrendingUp, MapPin, Eye, Radio,
  Play, Users, BarChart3, Award, Flame, Shield,
  Clock, ChevronUp, Sparkles, CircleDot, Lightbulb,
  ChevronLeft, Info
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

// ─── CRICKET FACTS DATABASE ─────────────────────────────────────────
const CRICKET_FACTS = [
  { stat: '100', label: 'International centuries by Sachin Tendulkar — the all-time record across all formats', category: 'Batting' },
  { stat: '26', label: 'Balls taken by AB de Villiers for the fastest ODI century ever (2015 vs West Indies)', category: 'Records' },
  { stat: '400*', label: 'Brian Lara\'s unbeaten 400 — highest individual Test score, set in 2004 vs England', category: 'Batting' },
  { stat: '10/10', label: 'Anil Kumble took all 10 wickets in a Test innings vs Pakistan (1999) — only the 2nd ever', category: 'Bowling' },
  { stat: '264', label: 'Rohit Sharma\'s 264 vs Sri Lanka — highest individual ODI score in history', category: 'Batting' },
  { stat: '6×6', label: 'Yuvraj Singh hit 6 sixes in an over off Stuart Broad at the 2007 T20 World Cup', category: 'Records' },
  { stat: '800', label: 'Test wickets by Muttiah Muralitharan — the most by any bowler in cricket history', category: 'Bowling' },
  { stat: '183*', label: 'MS Dhoni smashed 183* vs Sri Lanka in 2005 — the highest by an Indian wicketkeeper', category: 'Batting' },
  { stat: '1st', label: 'The first cricket Test match was played between Australia and England in 1877 in Melbourne', category: 'History' },
  { stat: '49', label: 'Lowest Test total — South Africa bowled out for 49 by India at Johannesburg (2024)', category: 'Records' },
  { stat: '5', label: 'Number of Cricket World Cup wins by Australia — the most by any nation', category: 'History' },
  { stat: '99.94', label: 'Don Bradman\'s career Test average — widely considered the greatest statistical achievement in any sport', category: 'Batting' },
  { stat: '4/12', label: 'Bumrah\'s spell in the 2023 WC semifinal — he conceded just 12 runs in 4 overs vs New Zealand', category: 'Bowling' },
  { stat: '12', label: 'Minutes — the shortest completed Test innings in history (England vs Australia, 1902)', category: 'History' },
  { stat: '2011', label: 'India won the Cricket World Cup at home — Dhoni sealed it with a six at Wankhede', category: 'History' },
];

// ─── TODAY'S MATCHES (simulated schedule) ───────────────────────────
const generateTodayMatches = () => {
  const teams = [
    { name: 'MI', full: 'Mumbai Indians', color: '#004BA0' },
    { name: 'CSK', full: 'Chennai Super Kings', color: '#FDB913' },
    { name: 'RCB', full: 'Royal Challengers', color: '#EC1C24' },
    { name: 'KKR', full: 'Kolkata Knight Riders', color: '#3A225D' },
    { name: 'DC', full: 'Delhi Capitals', color: '#17479E' },
    { name: 'SRH', full: 'Sunrisers Hyderabad', color: '#F26522' },
    { name: 'GT', full: 'Gujarat Titans', color: '#1C1C2B' },
    { name: 'RR', full: 'Rajasthan Royals', color: '#EA1A85' },
    { name: 'PBKS', full: 'Punjab Kings', color: '#DD1F2D' },
    { name: 'LSG', full: 'Lucknow Super Giants', color: '#A72056' },
  ];
  const day = new Date().getDate();
  const month = new Date().getMonth();
  const seed = day + month * 31;
  const pick = (arr: any[], offset: number) => arr[(seed + offset) % arr.length];

  const t1 = pick(teams, 0);
  let t2 = pick(teams, 3);
  if (t2.name === t1.name) t2 = pick(teams, 5);
  const t3 = pick(teams, 7);
  let t4 = pick(teams, 9);
  if (t4.name === t3.name) t4 = pick(teams, 11);

  const venues = ['Wankhede, Mumbai', 'M.A. Chidambaram, Chennai', 'Eden Gardens, Kolkata', 'Narendra Modi, Ahmedabad', 'M. Chinnaswamy, Bengaluru', 'Arun Jaitley, Delhi', 'Rajiv Gandhi, Hyderabad'];
  return [
    { team1: t1, team2: t2, time: '7:30 PM', venue: pick(venues, 1), status: 'upcoming' as const },
    { team1: t3, team2: t4, time: '3:30 PM', venue: pick(venues, 4), status: 'completed' as const, result: `${t3.name} won by ${(seed % 7) + 2} wickets` },
  ];
};

// ─── CRICKET TIPS DATABASE ──────────────────────────────────────────
const CRICKET_TIPS = [
  { title: 'Watch the Ball Early', tip: 'Pick up the ball from the bowler\'s hand. The earlier you see it, the more time you have to judge length and play your shot.', category: 'Batting' },
  { title: 'Land on the Seam', tip: 'Focus on landing the ball on the seam consistently. Even on flat pitches, a seam-up delivery can extract movement.', category: 'Bowling' },
  { title: 'Stay Side-On', tip: 'When bowling, keep your body side-on at the crease. It helps generate pace and natural outswing to right-handers.', category: 'Bowling' },
  { title: 'Soft Hands in Defence', tip: 'Relax your grip when defending. Soft hands absorb pace and prevent edges from carrying to the slip cordon.', category: 'Batting' },
  { title: 'Walk-In With the Bowler', tip: 'Start walking in as the bowler runs up. It keeps you on your toes and gives you a split-second advantage.', category: 'Fielding' },
  { title: 'Play Under Your Eyes', tip: 'Keep your head still and play the ball under your eyes. If your head falls over, your balance is gone.', category: 'Batting' },
  { title: 'Hit the Top of Off', tip: 'Bowl a consistent good length on off stump. The most dismissals in cricket history come from this corridor.', category: 'Bowling' },
  { title: 'Rotate the Strike', tip: 'In limited overs, singles keep the scoreboard ticking. Rotate strike to keep the pressure off yourself.', category: 'Batting' },
  { title: 'Backup Every Ball', tip: 'Always back up throws at the non-striker\'s end. Lazy backing up costs run-out opportunities.', category: 'Fielding' },
  { title: 'Use the Crease', tip: 'Step across or back to create new angles. Using the crease width makes you harder to bowl to.', category: 'Batting' },
  { title: 'Set a Yorker Length', tip: 'Practice hitting the base of the stumps in death overs. A good yorker is almost impossible to hit for six.', category: 'Bowling' },
  { title: 'Ground Your Bat', tip: 'When running between wickets, always ground your bat past the crease. A dive is the last resort, not the first.', category: 'Running' },
  { title: 'Read the Conditions', tip: 'Check the pitch before the toss — cracks, grass, dampness. Conditions dictate whether to bat or bowl first.', category: 'Strategy' },
  { title: 'Follow Through Fully', tip: 'Complete your bowling action — don\'t stop at delivery. A full follow-through improves accuracy and reduces injury.', category: 'Bowling' },
];

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
    const bestScore = history.reduce((best: number, match: any) => {
      const runs = parseInt(match.runs) || 0;
      return runs > best ? runs : best;
    }, 0);
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
        if (idx >= 0) setCloudRank(`#${idx + 1}`);
        else setCloudRank(careerStats.totalRuns > 0 ? '#-' : 'NEW');
      })
      .catch(() => {
        setCloudRank(careerStats.totalRuns > 1000 ? '#12' : careerStats.totalRuns > 0 ? '#42' : 'NEW');
      });
  }, [userData?.phone]);
  const displayRank = cloudRank ?? 'NEW';

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const firstName = userData?.name?.split(' ')[0] || 'Player';

  // ─── FACTS CAROUSEL STATE ──────────────────────────────────────
  const [factIndex, setFactIndex] = useState(0);
  const shuffledFacts = useMemo(() => {
    const arr = [...CRICKET_FACTS];
    // Fisher-Yates shuffle seeded by day
    const seed = new Date().getDate() + new Date().getMonth() * 31;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (seed * (i + 1) + 7) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);

  // Auto-rotate facts every 5s
  useEffect(() => {
    const timer = setInterval(() => {
      setFactIndex(prev => (prev + 1) % shuffledFacts.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [shuffledFacts.length]);

  // ─── TODAY'S MATCHES ───────────────────────────────────────────
  const todayMatches = useMemo(() => generateTodayMatches(), []);

  // ─── TIP OF THE DAY ───────────────────────────────────────────
  const todayTip = useMemo(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return CRICKET_TIPS[dayOfYear % CRICKET_TIPS.length];
  }, []);

  // Quick actions
  const quickActions = [
    { id: 'MATCH_CENTER', label: 'Start Match', desc: 'Score a new match', icon: Play, accent: '#00F0FF' },
    { id: 'PERFORMANCE', label: 'My Stats', desc: 'View performance', icon: BarChart3, accent: '#39FF14' },
    { id: 'HISTORY', label: 'Matches', desc: 'Match history', icon: Clock, accent: '#FF6B35' },
    { id: 'TOURNAMENTS', label: 'Tournaments', desc: 'Join & compete', icon: Trophy, accent: '#BC13FE' },
  ];

  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'Batting': return '#00F0FF';
      case 'Bowling': return '#39FF14';
      case 'Records': return '#FFD600';
      case 'History': return '#BC13FE';
      case 'Fielding': return '#FF6B35';
      case 'Running': return '#FF6B35';
      case 'Strategy': return '#FFD600';
      default: return '#00F0FF';
    }
  };

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

        {/* Main CTA */}
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

      {/* Follow Match Shortcut */}
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

      {/* ═══ CRICKET FACTS CAROUSEL ═══ */}
      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Did You Know</h3>
          <div className="flex items-center gap-1.5">
            {shuffledFacts.slice(0, 5).map((_, i) => (
              <button
                key={i}
                onClick={() => setFactIndex(i)}
                className="transition-all"
                style={{
                  width: i === factIndex % 5 ? 16 : 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: i === factIndex % 5 ? '#00F0FF' : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={factIndex}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="p-4 flex items-start gap-4"
            >
              <div className="shrink-0 w-16 h-16 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                <span className="font-heading text-xl text-[#00F0FF] leading-none">{shuffledFacts[factIndex % shuffledFacts.length].stat}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className="inline-block text-[7px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full mb-1.5"
                  style={{
                    color: categoryColor(shuffledFacts[factIndex % shuffledFacts.length].category),
                    backgroundColor: categoryColor(shuffledFacts[factIndex % shuffledFacts.length].category) + '15',
                    border: `1px solid ${categoryColor(shuffledFacts[factIndex % shuffledFacts.length].category)}30`,
                  }}
                >
                  {shuffledFacts[factIndex % shuffledFacts.length].category}
                </span>
                <p className="text-[11px] text-white/60 leading-relaxed">{shuffledFacts[factIndex % shuffledFacts.length].label}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.section>

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

      {/* ═══ TODAY'S MATCHES ═══ */}
      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Today's Matches</h3>
          <span className="text-[9px] font-medium text-white/25">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
        </div>
        <div className="space-y-2">
          {todayMatches.map((match, i) => (
            <div key={i} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {match.status === 'upcoming' ? (
                    <span className="text-[7px] font-bold uppercase tracking-wider text-[#FFD600] bg-[#FFD600]/10 border border-[#FFD600]/25 px-2 py-0.5 rounded-full">Upcoming</span>
                  ) : (
                    <span className="text-[7px] font-bold uppercase tracking-wider text-white/40 bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 rounded-full">Completed</span>
                  )}
                </div>
                <span className="text-[9px] text-white/30 font-medium">{match.time}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-black text-white"
                    style={{ backgroundColor: match.team1.color + '30', border: `1px solid ${match.team1.color}50` }}
                  >
                    {match.team1.name}
                  </div>
                  <span className="text-[10px] font-bold text-white/25 uppercase">vs</span>
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-black text-white"
                    style={{ backgroundColor: match.team2.color + '30', border: `1px solid ${match.team2.color}50` }}
                  >
                    {match.team2.name}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-white/30">{match.venue}</p>
                </div>
              </div>

              {match.status === 'completed' && match.result && (
                <p className="text-[9px] text-[#39FF14]/70 font-medium mt-2.5 pt-2.5 border-t border-white/[0.05]">{match.result}</p>
              )}
            </div>
          ))}
        </div>
      </motion.section>

      {/* QUICK ACTIONS */}
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

      {/* ═══ TIP OF THE DAY ═══ */}
      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Tip of the Day</h3>
          <span
            className="text-[7px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full"
            style={{
              color: categoryColor(todayTip.category),
              backgroundColor: categoryColor(todayTip.category) + '12',
              border: `1px solid ${categoryColor(todayTip.category)}25`,
            }}
          >
            {todayTip.category}
          </span>
        </div>
        <div className="rounded-xl border border-[#FFD600]/15 bg-[#FFD600]/[0.03] p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFD600]/10 border border-[#FFD600]/20 flex items-center justify-center shrink-0 mt-0.5">
              <Lightbulb size={16} className="text-[#FFD600]" />
            </div>
            <div>
              <h4 className="text-[12px] font-black text-white uppercase tracking-wide leading-none">{todayTip.title}</h4>
              <p className="text-[10px] text-white/50 leading-relaxed mt-1.5">{todayTip.tip}</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* DISCOVER */}
      <motion.section variants={itemVariants} className="space-y-2">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 px-0.5 mb-1">Discover</h3>

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

      {/* UPGRADE */}
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
