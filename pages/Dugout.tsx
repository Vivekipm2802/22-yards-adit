// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords, Crown, ChevronRight, Radio,
  Play, BarChart3, Clock, Trophy, MapPin, Award,
  Lightbulb
} from 'lucide-react';
import MotionButton from '../components/MotionButton';
import { useAuth } from '../AuthContext';
import { fetchLeaderboard } from '../lib/supabase';

interface DugoutProps {
  onNavigate: (page: 'DUGOUT' | 'MATCH_CENTER' | 'PERFORMANCE' | 'ARENA' | 'HISTORY' | 'TOURNAMENTS' | 'FOLLOW_MATCH') => void;
  onUpgrade?: () => void;
}

const containerVariants: any = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } }
};
const itemVariants: any = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as any } }
};

// ─── CRICKET FACTS ──────────────────────────────────────────────────
const CRICKET_FACTS = [
  { stat: '100', label: 'International centuries by Sachin Tendulkar — the all-time record across all formats', category: 'Batting' },
  { stat: '26', label: 'Balls taken by AB de Villiers for the fastest ODI century ever, against West Indies in 2015', category: 'Records' },
  { stat: '400*', label: 'Brian Lara\'s unbeaten 400 — the highest individual Test score, set in 2004 vs England', category: 'Batting' },
  { stat: '10/10', label: 'Anil Kumble took all 10 wickets in a Test innings vs Pakistan in 1999 — only the 2nd ever', category: 'Bowling' },
  { stat: '264', label: 'Rohit Sharma\'s 264 vs Sri Lanka — the highest individual ODI score in history', category: 'Batting' },
  { stat: '6×6', label: 'Yuvraj Singh hit 6 sixes in an over off Stuart Broad at the 2007 T20 World Cup', category: 'Records' },
  { stat: '800', label: 'Test wickets by Muttiah Muralitharan — the most by any bowler in cricket history', category: 'Bowling' },
  { stat: '183*', label: 'MS Dhoni smashed 183* vs Sri Lanka in 2005 — highest by an Indian wicketkeeper in ODIs', category: 'Batting' },
  { stat: '1877', label: 'The first-ever cricket Test match was played between Australia and England in Melbourne', category: 'History' },
  { stat: '49', label: 'Lowest Test total — South Africa bowled out for 49 by India at Johannesburg in 2024', category: 'Records' },
  { stat: '5', label: 'Number of Cricket World Cup wins by Australia — the most by any nation in history', category: 'History' },
  { stat: '99.94', label: 'Don Bradman\'s career Test average — widely considered the greatest statistical achievement in sport', category: 'Batting' },
  { stat: '4/12', label: 'Bumrah\'s spell in the 2023 WC semifinal — conceded just 12 runs in 4 overs vs New Zealand', category: 'Bowling' },
  { stat: '2011', label: 'India won the Cricket World Cup at home — Dhoni sealed it with a six at Wankhede Stadium', category: 'History' },
  { stat: '56', label: 'Days — the longest Test match ever played. England vs South Africa, 1939, ended as a draw', category: 'History' },
];

// ─── TODAY'S MATCHES ────────────────────────────────────────────────
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
  const t1 = pick(teams, 0); let t2 = pick(teams, 3);
  if (t2.name === t1.name) t2 = pick(teams, 5);
  const t3 = pick(teams, 7); let t4 = pick(teams, 9);
  if (t4.name === t3.name) t4 = pick(teams, 11);
  const venues = ['Wankhede, Mumbai', 'Chepauk, Chennai', 'Eden Gardens, Kolkata', 'Motera, Ahmedabad', 'Chinnaswamy, Bengaluru', 'Arun Jaitley, Delhi', 'Rajiv Gandhi, Hyderabad'];
  return [
    { team1: t1, team2: t2, time: '7:30 PM', venue: pick(venues, 1), status: 'upcoming' as const },
    { team1: t3, team2: t4, time: '3:30 PM', venue: pick(venues, 4), status: 'completed' as const, result: `${t3.name} won by ${(seed % 7) + 2} wickets` },
  ];
};

// ─── CRICKET TIPS ───────────────────────────────────────────────────
const CRICKET_TIPS = [
  { title: 'Watch the Ball Early', tip: 'Pick up the ball from the bowler\'s hand. The earlier you see it, the more time you get to judge length.', category: 'Batting' },
  { title: 'Land on the Seam', tip: 'Focus on landing the ball on the seam consistently. Even on flat pitches, seam-up deliveries extract movement.', category: 'Bowling' },
  { title: 'Stay Side-On', tip: 'Keep your body side-on at the crease. It generates pace and natural outswing to right-handers.', category: 'Bowling' },
  { title: 'Soft Hands in Defence', tip: 'Relax your grip when defending. Soft hands absorb pace and prevent edges carrying to the cordon.', category: 'Batting' },
  { title: 'Walk-In With the Bowler', tip: 'Start walking in as the bowler runs up. It keeps you alert and gives you a split-second advantage.', category: 'Fielding' },
  { title: 'Play Under Your Eyes', tip: 'Keep your head still and play the ball under your eyes. If your head falls over, balance is gone.', category: 'Batting' },
  { title: 'Hit the Top of Off', tip: 'Bowl a consistent good length on off stump. Most dismissals in cricket come from this corridor.', category: 'Bowling' },
  { title: 'Rotate the Strike', tip: 'In limited overs, singles keep the scoreboard ticking. Rotate to keep pressure off yourself.', category: 'Batting' },
  { title: 'Use the Crease', tip: 'Step across or back to create new angles. Using the crease width makes you harder to bowl to.', category: 'Batting' },
  { title: 'Set a Yorker Length', tip: 'Practice hitting the base of the stumps at the death. A good yorker is nearly impossible to hit for six.', category: 'Bowling' },
  { title: 'Read the Conditions', tip: 'Check the pitch before the toss — cracks, grass, dampness. Conditions dictate batting or bowling first.', category: 'Strategy' },
  { title: 'Follow Through Fully', tip: 'Complete your bowling action after delivery. A full follow-through improves accuracy and reduces injury.', category: 'Bowling' },
];

// ─── STUMPS SVG ─────────────────────────────────────────────────────
const StumpsSVG = () => (
  <svg width="60" height="80" viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute top-4 right-6 opacity-[0.04]">
    <rect x="15" y="12" width="3" height="68" rx="1.5" fill="white"/>
    <rect x="28" y="12" width="3" height="68" rx="1.5" fill="white"/>
    <rect x="41" y="12" width="3" height="68" rx="1.5" fill="white"/>
    <rect x="13" y="8" width="16" height="3" rx="1.5" fill="white"/>
    <rect x="30" y="8" width="16" height="3" rx="1.5" fill="white"/>
  </svg>
);

const Dugout: React.FC<DugoutProps> = ({ onNavigate, onUpgrade }) => {
  const { userData } = useAuth();

  const careerStats = useMemo(() => {
    const activePhone = userData?.phone || '';
    const globalVault = JSON.parse(localStorage.getItem('22YARDS_GLOBAL_VAULT') || '{}');
    const profileData = globalVault[activePhone] || { history: [], teams: [] };
    const history = profileData.history || [];
    const totalRuns = history.reduce((acc: number, match: any) => acc + (parseInt(match.runs) || 0), 0);
    const totalMatches = history.length;
    const totalWickets = history.reduce((acc: number, match: any) => acc + (parseInt(match.wickets) || 0), 0);
    const bestScore = history.reduce((best: number, match: any) => Math.max(best, parseInt(match.runs) || 0), 0);
    return { totalRuns, totalMatches, totalWickets, bestScore };
  }, [userData]);

  const [cloudRank, setCloudRank] = useState<string | null>(null);
  useEffect(() => {
    if (!userData?.phone) return;
    fetchLeaderboard('career_runs', 100)
      .then(leaders => {
        const idx = leaders.findIndex(l => l.phone === userData.phone);
        setCloudRank(idx >= 0 ? `#${idx + 1}` : careerStats.totalRuns > 0 ? '#-' : 'NEW');
      })
      .catch(() => setCloudRank(careerStats.totalRuns > 0 ? '#-' : 'NEW'));
  }, [userData?.phone]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  }, []);

  const firstName = userData?.name?.split(' ')[0] || 'Player';

  // Facts carousel
  const [factIdx, setFactIdx] = useState(0);
  const facts = useMemo(() => {
    const arr = [...CRICKET_FACTS];
    const seed = new Date().getDate() + new Date().getMonth() * 31;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (seed * (i + 1) + 7) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, []);
  useEffect(() => {
    const t = setInterval(() => setFactIdx(p => (p + 1) % facts.length), 5000);
    return () => clearInterval(t);
  }, [facts.length]);

  const todayMatches = useMemo(() => generateTodayMatches(), []);

  const todayTip = useMemo(() => {
    const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    return CRICKET_TIPS[doy % CRICKET_TIPS.length];
  }, []);

  const quickActions = [
    { id: 'MATCH_CENTER', label: 'Start Match', desc: 'Score a new match', icon: Play, dot: '#00F0FF' },
    { id: 'PERFORMANCE', label: 'My Stats', desc: 'View performance', icon: BarChart3, dot: '#39FF14' },
    { id: 'HISTORY', label: 'Matches', desc: 'Match history', icon: Clock, dot: '#FF6B35' },
    { id: 'TOURNAMENTS', label: 'Tournaments', desc: 'Join & compete', icon: Trophy, dot: '#BC13FE' },
  ];

  const catColor = (c: string) => {
    const m: Record<string, string> = { Batting: '#00F0FF', Bowling: '#39FF14', Records: '#FFD600', History: '#BC13FE', Fielding: '#FF6B35', Strategy: '#FFD600' };
    return m[c] || '#00F0FF';
  };

  const currentFact = facts[factIdx % facts.length];

  return (
    <motion.div
      variants={containerVariants} initial="hidden" animate="visible"
      className="max-w-6xl mx-auto px-6 py-8 space-y-0 pb-40 scroll-container"
    >
      {/* ═══════════════════════════════════════════════════════════
          HERO — Editorial, typography-first. Zeldman: "Content
          precedes design. Design in the absence of content is not
          design, it's decoration."
          ═══════════════════════════════════════════════════════════ */}
      <motion.section variants={itemVariants} className="relative mb-8">
        <StumpsSVG />

        {/* Greeting — understated, small, soft */}
        <p className="text-[12px] font-medium text-white/35 tracking-[0.04em]">{greeting}</p>

        {/* Name — the largest element on screen. Confident. */}
        <h1 className="font-heading text-[42px] text-white leading-[1] tracking-tight uppercase mt-1">{firstName}</h1>

        {/* Accent underline — short, precise */}
        <div className="w-10 h-[2px] bg-[#00F0FF]/60 rounded-full mt-3" />

        {/* Rank — floating right, subtle */}
        <div className="absolute top-0 right-0 text-right">
          <p className="text-[7px] font-bold text-white/25 uppercase tracking-[0.2em]">Rank</p>
          <p className="font-heading text-[28px] text-[#00F0FF] leading-[1] tracking-tight mt-0.5">{cloudRank ?? 'NEW'}</p>
        </div>
      </motion.section>

      {/* ═══ STATS — Horizontal scorecard with hairline dividers ═══ */}
      <motion.section variants={itemVariants} className="mb-8">
        <div className="border-t border-b border-white/[0.06] py-4">
          <div className="flex items-baseline justify-between">
            {[
              { val: careerStats.totalMatches, lbl: 'Matches', accent: false },
              { val: careerStats.totalRuns.toLocaleString(), lbl: 'Runs', accent: false },
              { val: careerStats.totalWickets, lbl: 'Wickets', accent: false },
              { val: careerStats.bestScore, lbl: 'Best', accent: true },
            ].map((s, i) => (
              <React.Fragment key={s.lbl}>
                {i > 0 && <div className="w-px h-8 bg-white/[0.06] self-center" />}
                <div className="text-center flex-1">
                  <p className={`font-numbers text-[26px] font-bold leading-none tracking-tight ${s.accent ? 'text-[#00F0FF]' : 'text-white'}`}>{s.val}</p>
                  <p className="text-[7px] font-bold text-white/25 uppercase tracking-[0.15em] mt-2">{s.lbl}</p>
                </div>
              </React.Fragment>
            ))}
          </div>
          {careerStats.totalMatches === 0 && (
            <p className="text-[10px] text-white/20 text-center mt-3 pt-3 border-t border-white/[0.04]">Play your first match to see stats here</p>
          )}
        </div>
      </motion.section>

      {/* ═══ START MATCH — Single, confident CTA ═══ */}
      <motion.section variants={itemVariants} className="mb-8">
        <button
          onClick={() => onNavigate('MATCH_CENTER')}
          className="w-full flex items-center justify-between px-5 py-4 rounded-xl border border-white/[0.06] bg-white/[0.015] active:bg-white/[0.04] transition-all group active:scale-[0.98]"
        >
          <div>
            <h2 className="text-[13px] font-black text-white uppercase tracking-[0.12em]">Start New Match</h2>
            <p className="text-[9px] text-white/30 font-medium mt-1 tracking-wide">Score, analyze and share live</p>
          </div>
          <div className="w-8 h-8 rounded-full border border-[#00F0FF]/25 flex items-center justify-center group-hover:border-[#00F0FF]/50 transition-colors">
            <ChevronRight size={14} className="text-[#00F0FF]/60" />
          </div>
        </button>
      </motion.section>

      {/* Follow Match — only when active */}
      {(() => {
        const fid = typeof localStorage !== 'undefined' ? localStorage.getItem('22Y_FOLLOWING_MATCH') : null;
        if (!fid) return null;
        return (
          <motion.section variants={itemVariants} className="mb-8">
            <button
              onClick={() => onNavigate('FOLLOW_MATCH')}
              className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl border border-[#BC13FE]/20 bg-[#BC13FE]/[0.04] active:scale-[0.98] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Radio size={18} className="text-[#BC13FE]/70" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#FF003C] animate-pulse" />
                </div>
                <div>
                  <p className="text-[11px] font-black text-white uppercase tracking-wider">Following a Match</p>
                  <p className="text-[9px] text-white/25 mt-0.5">Tap to view live scorecard</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-[#BC13FE]/30" />
            </button>
          </motion.section>
        );
      })()}

      {/* ═══ DID YOU KNOW — Pull-quote, editorial ═══ */}
      <motion.section variants={itemVariants} className="mb-8">
        <p className="text-[8px] font-bold text-white/20 uppercase tracking-[0.25em] mb-3">Did You Know</p>

        <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={factIdx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="px-5 py-5"
            >
              {/* The stat — massive, typographic centerpiece */}
              <div className="flex items-start justify-between mb-3">
                <p className="font-heading text-[36px] text-[#00F0FF] leading-[1] tracking-tight">{currentFact.stat}</p>
                <span
                  className="text-[7px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full mt-1.5"
                  style={{
                    color: catColor(currentFact.category),
                    backgroundColor: catColor(currentFact.category) + '10',
                    border: `1px solid ${catColor(currentFact.category)}20`,
                  }}
                >{currentFact.category}</span>
              </div>
              <p className="text-[11px] text-white/40 leading-[1.6]">{currentFact.label}</p>
            </motion.div>
          </AnimatePresence>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 pb-4">
            {facts.slice(0, 5).map((_, i) => (
              <button
                key={i}
                onClick={() => setFactIdx(i)}
                className="transition-all duration-300"
                style={{
                  width: i === factIdx % 5 ? 14 : 4,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: i === factIdx % 5 ? '#00F0FF' : 'rgba(255,255,255,0.1)',
                }}
              />
            ))}
          </div>
        </div>
      </motion.section>

      {/* ═══ TODAY'S MATCHES — Editorial scorecard ═══ */}
      <motion.section variants={itemVariants} className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[8px] font-bold text-white/20 uppercase tracking-[0.25em]">Today's Matches</p>
          <p className="text-[9px] text-white/15 font-medium">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
        </div>

        <div className="space-y-2">
          {todayMatches.map((m, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-5 py-4">
              {/* Status row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${m.status === 'upcoming' ? 'bg-[#FFD600]/60' : 'bg-white/15'}`} />
                  <span className={`text-[7px] font-bold uppercase tracking-[0.12em] ${m.status === 'upcoming' ? 'text-[#FFD600]/60' : 'text-white/25'}`}>
                    {m.status === 'upcoming' ? 'Upcoming' : 'Completed'}
                  </span>
                </div>
                <span className="text-[9px] text-white/20 font-medium">{m.time}</span>
              </div>

              {/* Teams — typographic, no boxes */}
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-3">
                  <span className="text-[18px] font-black text-white tracking-wide">{m.team1.name}</span>
                  <span className="text-[10px] font-medium text-white/15">vs</span>
                  <span className="text-[18px] font-black text-white tracking-wide">{m.team2.name}</span>
                </div>
                <span className="text-[8px] text-white/15 font-medium">{m.venue}</span>
              </div>

              {/* Result */}
              {m.status === 'completed' && m.result && (
                <p className="text-[9px] text-[#39FF14]/50 font-medium mt-2.5 pt-2.5 border-t border-white/[0.04]">{m.result}</p>
              )}
            </div>
          ))}
        </div>
      </motion.section>

      {/* ═══ QUICK ACTIONS — Minimal grid, dot accents ═══ */}
      <motion.section variants={itemVariants} className="mb-8">
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((a) => (
            <button
              key={a.id}
              onClick={() => onNavigate(a.id as any)}
              className="rounded-xl border border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.03] text-left group active:scale-[0.97] transition-all"
            >
              <div className="px-4 py-4">
                {/* Accent dot instead of icon box */}
                <div className="w-2 h-2 rounded-full mb-4" style={{ backgroundColor: a.dot, opacity: 0.5 }} />
                <p className="text-[11px] font-black text-white uppercase tracking-[0.1em] leading-none">{a.label}</p>
                <p className="text-[8px] text-white/20 font-medium mt-1.5">{a.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.section>

      {/* ═══ TIP OF THE DAY — Left-border accent, Zeldman pull-quote ═══ */}
      <motion.section variants={itemVariants} className="mb-8">
        <p className="text-[8px] font-bold text-white/20 uppercase tracking-[0.25em] mb-3">Tip of the Day</p>
        <div className="flex">
          {/* Left accent bar */}
          <div className="w-[2px] rounded-full shrink-0 mr-4" style={{ backgroundColor: catColor(todayTip.category), opacity: 0.4 }} />
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <h4 className="text-[12px] font-black text-white uppercase tracking-wide leading-none">{todayTip.title}</h4>
              <span
                className="text-[6px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full"
                style={{
                  color: catColor(todayTip.category),
                  backgroundColor: catColor(todayTip.category) + '10',
                  border: `1px solid ${catColor(todayTip.category)}18`,
                }}
              >{todayTip.category}</span>
            </div>
            <p className="text-[10px] text-white/30 leading-[1.7]">{todayTip.tip}</p>
          </div>
        </div>
      </motion.section>

      {/* ═══ DISCOVER ═══ */}
      <motion.section variants={itemVariants} className="space-y-2 mb-8">
        <p className="text-[8px] font-bold text-white/20 uppercase tracking-[0.25em] mb-1">Discover</p>

        <button
          onClick={() => onNavigate('ARENA')}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.03] text-left group active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]/50" />
            <div>
              <p className="text-[10px] font-black text-white uppercase tracking-[0.1em]">Find Grounds</p>
              <p className="text-[8px] text-white/20 mt-0.5">Cricket grounds near you</p>
            </div>
          </div>
          <ChevronRight size={12} className="text-white/15" />
        </button>

        <button
          onClick={() => onNavigate('PERFORMANCE')}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.03] text-left group active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#39FF14]/50" />
            <div>
              <p className="text-[10px] font-black text-white uppercase tracking-[0.1em]">Leaderboard</p>
              <p className="text-[8px] text-white/20 mt-0.5">See where you rank among players</p>
            </div>
          </div>
          <ChevronRight size={12} className="text-white/15" />
        </button>
      </motion.section>

      {/* ═══ UPGRADE ═══ */}
      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between px-5 py-4 rounded-xl border border-[#00F0FF]/10 bg-[#00F0FF]/[0.02]">
          <div>
            <h3 className="text-[12px] font-black text-white tracking-[0.1em] uppercase leading-none">Go Elite</h3>
            <p className="text-[8px] font-medium text-white/25 mt-1.5">Unlock advanced stats & rankings</p>
          </div>
          <MotionButton
            onClick={onUpgrade}
            className="bg-[#00F0FF] text-black !rounded-lg font-black text-[8px] !py-2 !px-4 tracking-[0.1em]"
          >
            UPGRADE
          </MotionButton>
        </div>
      </motion.section>

    </motion.div>
  );
};

export default Dugout;
