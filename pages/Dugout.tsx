// @ts-nocheck
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords, Crown, ChevronRight, Radio,
  Play, BarChart3, Clock, Trophy, MapPin, Award,
  Lightbulb, Zap, Target, TrendingUp, Wifi, WifiOff
} from 'lucide-react';
import MotionButton from '../components/MotionButton';
import { useAuth } from '../AuthContext';
import { fetchLeaderboard } from '../lib/supabase';

// ─── CRICKET API CONFIG ────────────────────────────────────────────
// Sign up free at https://cricketdata.org to get your API key.
// Replace the empty string below with your key (GUID format).
const CRIC_API_KEY = 'c1556ae3-98ce-486b-bc41-bb040cad03bb';
const CRIC_API_BASE = 'https://api.cricapi.com/v1';
const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

interface DugoutProps {
  onNavigate: (page: 'DUGOUT' | 'MATCH_CENTER' | 'PERFORMANCE' | 'ARENA' | 'HISTORY' | 'TOURNAMENTS' | 'FOLLOW_MATCH') => void;
  onUpgrade?: () => void;
}

const fadeIn: any = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 1, 0.5, 1] as any } }
};
const stagger: any = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } }
};

// ─── STATIC DATA ───────────────────────────────────────────────────
const FACTS = [
  { stat: '100', text: 'International centuries by Sachin Tendulkar — the all-time record across all formats', tag: 'Batting' },
  { stat: '26', text: 'Balls taken by AB de Villiers for the fastest ODI century ever, vs West Indies (2015)', tag: 'Records' },
  { stat: '400*', text: 'Brian Lara\'s unbeaten 400 — highest individual Test score, set in 2004 vs England', tag: 'Batting' },
  { stat: '10/10', text: 'Anil Kumble took all 10 wickets in a Test innings vs Pakistan (1999) — only the 2nd ever', tag: 'Bowling' },
  { stat: '264', text: 'Rohit Sharma\'s 264 vs Sri Lanka — highest individual ODI score in history', tag: 'Batting' },
  { stat: '6×6', text: 'Yuvraj Singh hit 6 sixes in an over off Stuart Broad at the 2007 T20 World Cup', tag: 'Records' },
  { stat: '800', text: 'Test wickets by Muttiah Muralitharan — the most by any bowler in cricket history', tag: 'Bowling' },
  { stat: '183*', text: 'MS Dhoni smashed 183* vs Sri Lanka — highest by an Indian wicketkeeper in ODIs', tag: 'Batting' },
  { stat: '99.94', text: 'Don Bradman\'s career Test average — the greatest statistical feat in any sport', tag: 'Batting' },
  { stat: '49', text: 'Lowest Test total — South Africa bowled out for 49 by India at Johannesburg (2024)', tag: 'Records' },
  { stat: '2011', text: 'India won the Cricket World Cup at home — Dhoni sealed it with a six at Wankhede', tag: 'History' },
  { stat: '5', text: 'Cricket World Cup wins by Australia — the most by any nation in history', tag: 'History' },
  { stat: '56', text: 'Days — the longest Test match ever. England vs South Africa, 1939. Ended as a draw', tag: 'History' },
  { stat: '4/12', text: 'Bumrah conceded just 12 runs in 4 overs vs New Zealand in the 2023 WC semifinal', tag: 'Bowling' },
];

const TIPS = [
  { title: 'Watch the Ball Early', tip: 'Pick up the ball from the bowler\'s hand. The earlier you see it, the more time you get to judge length.', tag: 'Batting' },
  { title: 'Land on the Seam', tip: 'Focus on landing the ball on the seam. Even on flat pitches, a seam-up delivery can extract movement.', tag: 'Bowling' },
  { title: 'Stay Side-On', tip: 'Keep your body side-on at the crease. It generates pace and natural outswing to right-handers.', tag: 'Bowling' },
  { title: 'Soft Hands', tip: 'Relax your grip when defending. Soft hands absorb pace and prevent edges carrying to the cordon.', tag: 'Batting' },
  { title: 'Walk In With the Bowler', tip: 'Start walking in as the bowler runs up. It keeps you alert and gives you a split-second edge.', tag: 'Fielding' },
  { title: 'Play Under Your Eyes', tip: 'Keep your head still and play the ball under your eyes. Head falling over means balance gone.', tag: 'Batting' },
  { title: 'Hit the Top of Off', tip: 'Bowl a good length on off stump consistently. Most dismissals come from this corridor.', tag: 'Bowling' },
  { title: 'Rotate the Strike', tip: 'Singles keep the scoreboard ticking in limited overs. Rotate strike to keep pressure off.', tag: 'Batting' },
  { title: 'Use the Crease', tip: 'Step across or back to create new angles. Using crease width makes you harder to bowl to.', tag: 'Batting' },
  { title: 'Yorker Length', tip: 'Practice hitting the base of the stumps at the death. A good yorker is nearly unhittable.', tag: 'Bowling' },
  { title: 'Read Conditions', tip: 'Check the pitch before the toss — cracks, grass, dampness. Conditions dictate bat or bowl first.', tag: 'Strategy' },
];

// ─── IPL TEAM METADATA ─────────────────────────────────────────────
const IPL_TEAMS: Record<string, { abbr: string; color: string }> = {
  'Mumbai Indians': { abbr: 'MI', color: '#004BA0' },
  'Chennai Super Kings': { abbr: 'CSK', color: '#FDB913' },
  'Royal Challengers Bengaluru': { abbr: 'RCB', color: '#EC1C24' },
  'Royal Challengers Bangalore': { abbr: 'RCB', color: '#EC1C24' },
  'Kolkata Knight Riders': { abbr: 'KKR', color: '#3A225D' },
  'Delhi Capitals': { abbr: 'DC', color: '#17479E' },
  'Sunrisers Hyderabad': { abbr: 'SRH', color: '#F26522' },
  'Gujarat Titans': { abbr: 'GT', color: '#1C1C2B' },
  'Rajasthan Royals': { abbr: 'RR', color: '#EA1A85' },
  'Punjab Kings': { abbr: 'PBKS', color: '#DD1F2D' },
  'Lucknow Super Giants': { abbr: 'LSG', color: '#A72056' },
};

// ─── HELPERS ────────────────────────────────────────────────────────
const getTeamMeta = (name: string) => {
  // Check IPL teams first
  for (const [full, meta] of Object.entries(IPL_TEAMS)) {
    if (name.toLowerCase().includes(full.toLowerCase()) || full.toLowerCase().includes(name.toLowerCase())) {
      return { abbr: meta.abbr, color: meta.color, full };
    }
  }
  // Abbreviate country/team names
  const abbr = name.length > 5 ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4) : name.toUpperCase();
  return { abbr, color: '#6366F1', full: name };
};

// Priority: IPL > International > T20 League > Other
const matchPriority = (m: any): number => {
  const type = (m.matchType || '').toLowerCase();
  const name = (m.name || m.series_id || '').toLowerCase();
  if (name.includes('indian premier league') || name.includes('ipl')) return 0;
  if (type === 'test' || type === 'odi' || type === 't20i') return 1;
  if (name.includes('big bash') || name.includes('psl') || name.includes('cpl') || name.includes('bbl')) return 2;
  return 3;
};

interface LiveMatch {
  id: string;
  team1: { name: string; abbr: string; color: string; score?: string };
  team2: { name: string; abbr: string; color: string; score?: string };
  status: 'upcoming' | 'live' | 'completed';
  statusText: string;
  venue: string;
  time: string;
  result?: string;
  matchType: string;
}

// ─── FALLBACK: Simulated matches when API unavailable ──────────────
const generateFallbackMatches = (): LiveMatch[] => {
  const teams = [
    { name: 'Mumbai Indians', abbr: 'MI', color: '#004BA0' },
    { name: 'Chennai Super Kings', abbr: 'CSK', color: '#FDB913' },
    { name: 'Royal Challengers', abbr: 'RCB', color: '#EC1C24' },
    { name: 'Kolkata Knight Riders', abbr: 'KKR', color: '#3A225D' },
    { name: 'Delhi Capitals', abbr: 'DC', color: '#17479E' },
    { name: 'Sunrisers Hyderabad', abbr: 'SRH', color: '#F26522' },
    { name: 'Gujarat Titans', abbr: 'GT', color: '#1C1C2B' },
    { name: 'Rajasthan Royals', abbr: 'RR', color: '#EA1A85' },
    { name: 'Punjab Kings', abbr: 'PBKS', color: '#DD1F2D' },
    { name: 'Lucknow Super Giants', abbr: 'LSG', color: '#A72056' },
  ];
  const seed = new Date().getDate() + new Date().getMonth() * 31;
  const p = (o: number) => teams[(seed + o) % teams.length];
  const t1 = p(0); let t2 = p(3); if (t2.abbr === t1.abbr) t2 = p(5);
  const t3 = p(7); let t4 = p(9); if (t4.abbr === t3.abbr) t4 = p(11);
  const venues = ['Wankhede, Mumbai', 'Chepauk, Chennai', 'Eden Gardens, Kolkata', 'Motera, Ahmedabad', 'Chinnaswamy, Bengaluru'];
  return [
    { id: 'f1', team1: t1, team2: t2, status: 'upcoming', statusText: 'Upcoming', time: '7:30 PM', venue: venues[(seed + 1) % venues.length], matchType: 'IPL' },
    { id: 'f2', team1: t3, team2: t4, status: 'completed', statusText: 'Completed', time: '3:30 PM', venue: venues[(seed + 4) % venues.length], matchType: 'IPL', result: `${t3.abbr} won by ${(seed % 7) + 2} wickets` },
  ];
};

// ─── TAG COLORS ─────────────────────────────────────────────────────
const tagCol = (t: string) => ({ Batting: '#00F0FF', Bowling: '#39FF14', Records: '#FFD600', History: '#BC13FE', Fielding: '#FF6B35', Strategy: '#FFD600' }[t] || '#00F0FF');

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════
const Dugout: React.FC<DugoutProps> = ({ onNavigate, onUpgrade }) => {
  const { userData } = useAuth();
  const isLight = typeof document !== 'undefined' && document.documentElement?.dataset?.theme === 'light';

  // ── Career stats
  const stats = useMemo(() => {
    const phone = userData?.phone || '';
    const vault = JSON.parse(localStorage.getItem('22YARDS_GLOBAL_VAULT') || '{}');
    const hist = (vault[phone] || { history: [] }).history || [];
    return {
      matches: hist.length,
      runs: hist.reduce((a: number, m: any) => a + (parseInt(m.runs) || 0), 0),
      wickets: hist.reduce((a: number, m: any) => a + (parseInt(m.wickets) || 0), 0),
      best: hist.reduce((b: number, m: any) => Math.max(b, parseInt(m.runs) || 0), 0),
    };
  }, [userData]);

  // ── Rank
  const [rank, setRank] = useState<string | null>(null);
  useEffect(() => {
    if (!userData?.phone) return;
    fetchLeaderboard('career_runs', 100)
      .then(l => { const i = l.findIndex(x => x.phone === userData.phone); setRank(i >= 0 ? `#${i + 1}` : stats.runs > 0 ? '#-' : 'NEW'); })
      .catch(() => setRank(stats.runs > 0 ? '#-' : 'NEW'));
  }, [userData?.phone]);

  // ── Greeting
  const greeting = useMemo(() => { const h = new Date().getHours(); return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'; }, []);
  const name = userData?.name?.split(' ')[0] || 'Player';

  // ── Facts carousel
  const [fi, setFi] = useState(0);
  const facts = useMemo(() => {
    const arr = [...FACTS]; const s = new Date().getDate() + new Date().getMonth() * 31;
    for (let i = arr.length - 1; i > 0; i--) { const j = (s * (i + 1) + 7) % (i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }, []);
  useEffect(() => { const t = setInterval(() => setFi(p => (p + 1) % facts.length), 5000); return () => clearInterval(t); }, [facts.length]);
  const fact = facts[fi % facts.length];

  // ── Tip of the day
  const tip = useMemo(() => { const d = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000); return TIPS[d % TIPS.length]; }, []);

  // ═══════════════════════════════════════════════════════════════
  // LIVE CRICKET DATA — Fetches from CricAPI with 3-min polling
  // ═══════════════════════════════════════════════════════════════
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [isLiveData, setIsLiveData] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasLiveMatch, setHasLiveMatch] = useState(false);

  const parseApiMatches = useCallback((data: any[]): LiveMatch[] => {
    if (!data || !Array.isArray(data)) return [];

    const parsed: LiveMatch[] = data
      .filter(m => m.teamInfo && m.teamInfo.length >= 2)
      .map(m => {
        const t1name = m.teamInfo[0]?.name || m.teams?.[0] || 'Team A';
        const t2name = m.teamInfo[1]?.name || m.teams?.[1] || 'Team B';
        const t1meta = getTeamMeta(t1name);
        const t2meta = getTeamMeta(t2name);

        // Parse scores from the score array
        let t1score = '';
        let t2score = '';
        if (m.score && Array.isArray(m.score)) {
          m.score.forEach((s: any) => {
            const inningsStr = `${s.r || 0}/${s.w || 0} (${s.o || 0})`;
            if (s.inning?.toLowerCase().includes(t1name.toLowerCase().split(' ')[0])) {
              t1score = t1score ? `${t1score} & ${inningsStr}` : inningsStr;
            } else if (s.inning?.toLowerCase().includes(t2name.toLowerCase().split(' ')[0])) {
              t2score = t2score ? `${t2score} & ${inningsStr}` : inningsStr;
            }
          });
        }

        // Determine match status
        let status: 'upcoming' | 'live' | 'completed' = 'upcoming';
        if (m.matchStarted && !m.matchEnded) status = 'live';
        else if (m.matchEnded) status = 'completed';

        // Status text
        let statusText = 'Upcoming';
        if (status === 'live') statusText = m.status || 'Live';
        else if (status === 'completed') statusText = 'Completed';

        // Parse time
        let time = '';
        if (m.dateTimeGMT) {
          try {
            const dt = new Date(m.dateTimeGMT);
            time = dt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
          } catch { time = ''; }
        }

        // Match type label
        let matchType = (m.matchType || '').toUpperCase();
        const seriesName = (m.name || '').toLowerCase();
        if (seriesName.includes('ipl') || seriesName.includes('indian premier league')) matchType = 'IPL';

        return {
          id: m.id || Math.random().toString(),
          team1: { name: t1name, abbr: t1meta.abbr, color: t1meta.color, score: t1score || undefined },
          team2: { name: t2name, abbr: t2meta.abbr, color: t2meta.color, score: t2score || undefined },
          status,
          statusText,
          venue: m.venue || '',
          time,
          result: status === 'completed' ? (m.status || '') : undefined,
          matchType,
          _priority: matchPriority(m),
        } as LiveMatch & { _priority: number };
      });

    // Sort by priority: IPL first, then international, then others
    // Within each priority: live > upcoming > completed
    const statusOrder = { live: 0, upcoming: 1, completed: 2 };
    parsed.sort((a: any, b: any) => {
      if (a._priority !== b._priority) return a._priority - b._priority;
      return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
    });

    // Return top 4 matches
    return parsed.slice(0, 4).map(({ _priority, ...rest }: any) => rest);
  }, []);

  const fetchLiveMatches = useCallback(async () => {
    if (!CRIC_API_KEY) {
      setMatches(generateFallbackMatches());
      setIsLiveData(false);
      return;
    }

    try {
      const resp = await fetch(`${CRIC_API_BASE}/currentMatches?apikey=${CRIC_API_KEY}&offset=0`);
      if (!resp.ok) throw new Error(`API returned ${resp.status}`);
      const json = await resp.json();

      if (json.status !== 'success' || !json.data) {
        throw new Error(json.info || 'API error');
      }

      const parsed = parseApiMatches(json.data);
      if (parsed.length > 0) {
        setMatches(parsed);
        setIsLiveData(true);
        setLastUpdated(new Date());
        setHasLiveMatch(parsed.some(m => m.status === 'live'));
      } else {
        // No matches from API — use fallback
        setMatches(generateFallbackMatches());
        setIsLiveData(false);
      }
    } catch (err) {
      console.warn('[22Yards] Cricket API fetch failed, using fallback:', err);
      setMatches(generateFallbackMatches());
      setIsLiveData(false);
    }
  }, [parseApiMatches]);

  // Initial fetch + polling
  useEffect(() => {
    fetchLiveMatches();
    const interval = setInterval(fetchLiveMatches, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchLiveMatches]);

  // ── Shared card class — works in both dark and light mode via glass-premium
  const card = 'glass-premium rounded-2xl';

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-6xl mx-auto px-4 py-5 space-y-4 pb-40 scroll-container">

      {/* ╔═══════════════════════════════════════════════════════════╗
          ║  HERO BANNER — Avatar, greeting, rank, Start Match CTA  ║
          ╚═══════════════════════════════════════════════════════════╝ */}
      <motion.section variants={fadeIn} className={`${card} p-5 relative overflow-hidden`}>
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#00F0FF]/[0.04] via-transparent to-[#39FF14]/[0.02] pointer-events-none" />

        <div className="relative z-10">
          {/* Top row: Avatar + name + rank */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#00F0FF]/30 shrink-0">
                <img src={userData?.avatar} className="w-full h-full object-cover" alt="" />
              </div>
              <div>
                <p className="text-[11px] font-medium opacity-50">{greeting}</p>
                <h1 className="font-heading text-2xl tracking-tight uppercase leading-tight">{name}</h1>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[7px] font-bold opacity-30 uppercase tracking-[0.2em]">Rank</p>
              <p className="font-heading text-2xl text-[#00F0FF] leading-tight">{rank ?? 'NEW'}</p>
            </div>
          </div>

          {/* Stats row — 4 columns inside the hero card */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {[
              { v: stats.matches, l: 'Matches', c: false },
              { v: stats.runs.toLocaleString(), l: 'Runs', c: false },
              { v: stats.wickets, l: 'Wickets', c: false },
              { v: stats.best, l: 'Best', c: true },
            ].map(s => (
              <div key={s.l} className="text-center py-2 rounded-xl bg-white/[0.04] dark:bg-white/[0.04]" style={isLight ? { backgroundColor: 'rgba(0,0,0,0.03)' } : {}}>
                <p className={`font-numbers text-xl font-bold leading-none ${s.c ? 'text-[#00F0FF]' : ''}`}>{s.v}</p>
                <p className="text-[7px] font-bold opacity-30 uppercase tracking-[0.1em] mt-1">{s.l}</p>
              </div>
            ))}
          </div>
          {stats.matches === 0 && (
            <p className="text-[10px] opacity-30 text-center mb-4">Play your first match to see stats here</p>
          )}

          {/* CTA Button */}
          <button
            onClick={() => onNavigate('MATCH_CENTER')}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-[#00F0FF] text-black font-black text-[11px] uppercase tracking-[0.15em] active:scale-[0.97] transition-transform"
          >
            <Swords size={16} strokeWidth={2.5} />
            Start New Match
          </button>
        </div>
      </motion.section>

      {/* Follow Match (only when active) */}
      {(() => {
        const fid = typeof localStorage !== 'undefined' ? localStorage.getItem('22Y_FOLLOWING_MATCH') : null;
        if (!fid) return null;
        return (
          <motion.section variants={fadeIn}>
            <button
              onClick={() => onNavigate('FOLLOW_MATCH')}
              className={`${card} w-full flex items-center justify-between px-5 py-4 active:scale-[0.98] transition-transform`}
              style={{ borderColor: '#BC13FE30' }}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Radio size={20} className="text-[#BC13FE]" />
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#FF003C] animate-pulse border-2 border-[#020617]" />
                </div>
                <div>
                  <p className="text-[12px] font-black uppercase tracking-wider leading-none">Following a Match</p>
                  <p className="text-[9px] opacity-40 mt-1">Tap to view live scorecard</p>
                </div>
              </div>
              <ChevronRight size={16} className="opacity-30" />
            </button>
          </motion.section>
        );
      })()}

      {/* ╔═══════════════════════════════════════════════════════════╗
          ║  DID YOU KNOW — Fact carousel in its own card            ║
          ╚═══════════════════════════════════════════════════════════╝ */}
      <motion.section variants={fadeIn}>
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[9px] font-bold opacity-35 uppercase tracking-[0.2em]">Did You Know</p>
          <div className="flex gap-1">
            {facts.slice(0, 5).map((_, i) => (
              <button key={i} onClick={() => setFi(i)} className="transition-all duration-300"
                style={{ width: i === fi % 5 ? 14 : 5, height: 4, borderRadius: 2, backgroundColor: i === fi % 5 ? '#00F0FF' : (isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)') }}
              />
            ))}
          </div>
        </div>
        <div className={`${card} overflow-hidden`}>
          <AnimatePresence mode="wait">
            <motion.div key={fi} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}
              className="p-5 flex gap-4 items-start"
            >
              {/* Big stat number */}
              <div className="shrink-0 w-[72px] h-[72px] rounded-xl flex items-center justify-center"
                style={{ backgroundColor: isLight ? 'rgba(0,240,255,0.06)' : 'rgba(0,240,255,0.08)', border: `1px solid ${isLight ? 'rgba(0,240,255,0.12)' : 'rgba(0,240,255,0.15)'}` }}
              >
                <span className="font-heading text-[22px] text-[#00F0FF] leading-none">{fact.stat}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="inline-block text-[7px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full mb-2"
                  style={{ color: tagCol(fact.tag), backgroundColor: tagCol(fact.tag) + '12', border: `1px solid ${tagCol(fact.tag)}25` }}
                >{fact.tag}</span>
                <p className="text-[11px] opacity-55 leading-[1.55]">{fact.text}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.section>

      {/* ╔═══════════════════════════════════════════════════════════╗
          ║  TODAY'S MATCHES — Live data with 3-min polling          ║
          ╚═══════════════════════════════════════════════════════════╝ */}
      <motion.section variants={fadeIn}>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <p className="text-[9px] font-bold opacity-35 uppercase tracking-[0.2em]">
              {isLiveData ? "Live Matches" : "Today's Matches"}
            </p>
            {isLiveData ? (
              <span className="flex items-center gap-1 text-[7px] font-bold text-[#39FF14] opacity-60">
                <Wifi size={8} /> LIVE
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[7px] font-bold opacity-20">
                <WifiOff size={8} /> DEMO
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && isLiveData && (
              <p className="text-[7px] opacity-20">
                Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </p>
            )}
            <p className="text-[9px] opacity-25">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {matches.map((m, i) => (
            <div key={m.id || i} className={`${card} px-5 py-4`}>
              {/* Status bar */}
              <div className="flex items-center justify-between mb-3">
                {m.status === 'live' ? (
                  <span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-wider text-[#FF003C]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF003C] animate-pulse" />
                    <span className="bg-[#FF003C]/10 border border-[#FF003C]/20 px-2.5 py-1 rounded-full">Live</span>
                  </span>
                ) : m.status === 'upcoming' ? (
                  <span className="text-[8px] font-bold uppercase tracking-wider text-[#FFD600] bg-[#FFD600]/10 border border-[#FFD600]/20 px-2.5 py-1 rounded-full">Upcoming</span>
                ) : (
                  <span className="text-[8px] font-bold uppercase tracking-wider opacity-35 bg-white/[0.05] border border-white/[0.08] px-2.5 py-1 rounded-full"
                    style={isLight ? { backgroundColor: 'rgba(0,0,0,0.04)', borderColor: 'rgba(0,0,0,0.08)' } : {}}>Completed</span>
                )}
                <div className="flex items-center gap-2">
                  {m.matchType && (
                    <span className="text-[7px] font-bold opacity-20 uppercase">{m.matchType}</span>
                  )}
                  <span className="text-[10px] opacity-30">{m.time}</span>
                </div>
              </div>

              {/* Teams — with color badges and live scores */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 flex-1">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black text-white"
                      style={{ backgroundColor: m.team1.color + '25', border: `2px solid ${m.team1.color}40` }}>
                      {m.team1.abbr}
                    </div>
                    {m.team1.score && (
                      <p className="text-[9px] font-bold text-[#00F0FF]">{m.team1.score}</p>
                    )}
                  </div>
                  <span className="text-[11px] font-bold opacity-20">vs</span>
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black text-white"
                      style={{ backgroundColor: m.team2.color + '25', border: `2px solid ${m.team2.color}40` }}>
                      {m.team2.abbr}
                    </div>
                    {m.team2.score && (
                      <p className="text-[9px] font-bold text-[#00F0FF]">{m.team2.score}</p>
                    )}
                  </div>
                </div>
                <p className="text-[9px] opacity-25 text-right max-w-[120px] truncate">{m.venue}</p>
              </div>

              {/* Live status text */}
              {m.status === 'live' && m.statusText && m.statusText !== 'Live' && (
                <p className="text-[10px] text-[#FFD600] font-medium mt-3 pt-3 border-t border-white/[0.06] opacity-80"
                  style={isLight ? { borderColor: 'rgba(0,0,0,0.06)' } : {}}>
                  {m.statusText}
                </p>
              )}

              {/* Completed result */}
              {m.status === 'completed' && m.result && (
                <p className="text-[10px] text-[#39FF14] font-medium mt-3 pt-3 border-t border-white/[0.06] opacity-70"
                  style={isLight ? { borderColor: 'rgba(0,0,0,0.06)' } : {}}>
                  {m.result}
                </p>
              )}
            </div>
          ))}
        </div>
      </motion.section>

      {/* ╔═══════════════════════════════════════════════════════════╗
          ║  QUICK ACTIONS — 2x2 grid with icons                    ║
          ╚═══════════════════════════════════════════════════════════╝ */}
      <motion.section variants={fadeIn}>
        <p className="text-[9px] font-bold opacity-35 uppercase tracking-[0.2em] mb-2 px-1">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { id: 'MATCH_CENTER', label: 'Start Match', desc: 'Score a new match', icon: Play, color: '#00F0FF' },
            { id: 'PERFORMANCE', label: 'My Stats', desc: 'View performance', icon: BarChart3, color: '#39FF14' },
            { id: 'HISTORY', label: 'Matches', desc: 'Match history', icon: Clock, color: '#FF6B35' },
            { id: 'TOURNAMENTS', label: 'Tournaments', desc: 'Join & compete', icon: Trophy, color: '#BC13FE' },
          ].map(a => (
            <button key={a.id} onClick={() => onNavigate(a.id as any)}
              className={`${card} text-left active:scale-[0.96] transition-transform`}>
              <div className="p-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: a.color + '12', border: `1px solid ${a.color}25` }}>
                  <a.icon size={17} style={{ color: a.color }} strokeWidth={2} />
                </div>
                <p className="text-[11px] font-black uppercase tracking-wider leading-none">{a.label}</p>
                <p className="text-[8px] opacity-30 mt-1">{a.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.section>

      {/* ╔═══════════════════════════════════════════════════════════╗
          ║  TIP OF THE DAY                                          ║
          ╚═══════════════════════════════════════════════════════════╝ */}
      <motion.section variants={fadeIn}>
        <p className="text-[9px] font-bold opacity-35 uppercase tracking-[0.2em] mb-2 px-1">Tip of the Day</p>
        <div className={`${card} p-5`} style={{ borderColor: tagCol(tip.tag) + '20' }}>
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#FFD600' + '12', border: `1px solid #FFD60025` }}>
              <Lightbulb size={18} className="text-[#FFD600]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <h4 className="text-[12px] font-black uppercase tracking-wide leading-none">{tip.title}</h4>
                <span className="text-[7px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full"
                  style={{ color: tagCol(tip.tag), backgroundColor: tagCol(tip.tag) + '10', border: `1px solid ${tagCol(tip.tag)}20` }}>
                  {tip.tag}
                </span>
              </div>
              <p className="text-[10px] opacity-40 leading-[1.65]">{tip.tip}</p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ╔═══════════════════════════════════════════════════════════╗
          ║  DISCOVER                                                ║
          ╚═══════════════════════════════════════════════════════════╝ */}
      <motion.section variants={fadeIn}>
        <p className="text-[9px] font-bold opacity-35 uppercase tracking-[0.2em] mb-2 px-1">Discover</p>
        <div className="space-y-2.5">
          {[
            { id: 'ARENA', label: 'Find Grounds', desc: 'Cricket grounds near you', icon: MapPin, color: '#00F0FF' },
            { id: 'PERFORMANCE', label: 'Leaderboard', desc: 'See where you rank among players', icon: Award, color: '#39FF14' },
          ].map(d => (
            <button key={d.id} onClick={() => onNavigate(d.id as any)}
              className={`${card} w-full flex items-center px-4 py-3.5 active:scale-[0.98] transition-transform text-left group`}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mr-3.5 shrink-0"
                style={{ backgroundColor: d.color + '10', border: `1px solid ${d.color}20` }}>
                <d.icon size={17} style={{ color: d.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black uppercase tracking-wider leading-none">{d.label}</p>
                <p className="text-[8px] opacity-30 mt-1">{d.desc}</p>
              </div>
              <ChevronRight size={14} className="opacity-20 shrink-0" />
            </button>
          ))}
        </div>
      </motion.section>

      {/* ╔═══════════════════════════════════════════════════════════╗
          ║  GO ELITE                                                ║
          ╚═══════════════════════════════════════════════════════════╝ */}
      <motion.section variants={fadeIn}>
        <div className={`${card} p-5 flex items-center justify-between`} style={{ borderColor: 'rgba(0,240,255,0.15)' }}>
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/20 flex items-center justify-center">
              <Crown size={18} className="text-[#00F0FF]" />
            </div>
            <div>
              <h3 className="text-[12px] font-black uppercase tracking-wider leading-none">Go Elite</h3>
              <p className="text-[8px] opacity-30 mt-1">Unlock advanced stats & rankings</p>
            </div>
          </div>
          <MotionButton onClick={onUpgrade} className="bg-[#00F0FF] text-black !rounded-xl font-black text-[8px] !py-2.5 !px-4 tracking-[0.1em]">
            UPGRADE
          </MotionButton>
        </div>
      </motion.section>

    </motion.div>
  );
};

export default Dugout;
