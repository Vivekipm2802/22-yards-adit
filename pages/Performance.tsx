// @ts-nocheck
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar, AreaChart, Area, PieChart, Pie
} from 'recharts';
import { 
  Trophy, Target, Zap, 
  Activity, Star, ShieldCheck,
  Disc, Swords, Shield, Crown, Crosshair,
  Flame, Hash, CheckCircle2, Circle, ArrowUpRight, TrendingUp,
  Award, MousePointer2, UserCheck, Timer, BarChart3, Globe,
  RefreshCw, Smartphone, ClipboardList
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { fetchPlayerByPhone } from '../lib/supabase';
import { useAuth } from '../AuthContext';

const Performance: React.FC<{ userAvatar?: string }> = ({ userAvatar }) => {
  const { userData } = useAuth();
  const [cloudProfile, setCloudProfile] = useState<any>(null);
  const [activeDisc, setActiveDisc] = useState<'BATTING' | 'BOWLING' | 'FIELDING' | 'CAPTAINCY'>('BATTING');
  const [activeRunFilter, setActiveRunFilter] = useState('ALL');

  // Fetch live Supabase profile for accurate cloud-synced stats
  useEffect(() => {
    if (!userData?.phone) return;
    fetchPlayerByPhone(userData.phone)
      .then(profile => { if (profile) setCloudProfile(profile); })
      .catch(() => {}); // Silently fall back to localStorage
  }, [userData?.phone]);

  const stats = useMemo(() => {
    const activePhone = userData?.phone || '';
    const globalVault = JSON.parse(localStorage.getItem('22YARDS_GLOBAL_VAULT') || '{}');
    const localHistory = globalVault[activePhone]?.history || [];
    // FIX (Bug 2): merge cloud archive_vault with local history so that guests who
    // registered after a match (or signed in on a new device) still see their history.
    const cloudHistory = (cloudProfile?.archive_vault && Array.isArray(cloudProfile.archive_vault))
      ? cloudProfile.archive_vault
      : [];
    const seenMatchIds = new Set<string>();
    const userHistory = [...cloudHistory, ...localHistory].filter((m: any) => {
      if (!m?.id || seenMatchIds.has(m.id)) return false;
      seenMatchIds.add(m.id);
      return true;
    });

    const data = {
      totalRuns: 0,
      totalBallsFaced: 0,
      totalWickets: 0,
      totalBallsBowled: 0,
      totalRunsConceded: 0,
      matches: userHistory.length,
      inningsPlayed: 0,
      threeWhauls: 0,
      fiveWhauls: 0,
      catches: 0,
      stumpings: 0,
      runOuts: 0,
      tossesWon: 0,
      tossesContested: 0,
      winsAsCaptain: 0,
      matchesAsCaptain: 0,
      fours: 0,
      sixes: 0,
      distribution: {
        '1': { shots: 0, totalRuns: 0, color: '#FACC15', label: 'SINGLES+' }, // B-10: includes 2s & 3s
        '2': { shots: 0, totalRuns: 0, color: '#3B82F6', label: 'DOUBLES' },
        '3': { shots: 0, totalRuns: 0, color: '#60A5FA', label: 'TRIPLES' },
        '4': { shots: 0, totalRuns: 0, color: '#8B5CF6', label: 'FOURS' },
        '5': { shots: 0, totalRuns: 0, color: '#FFD700', label: 'FIVES' },
        '6': { shots: 0, totalRuns: 0, color: '#EF4444', label: 'SIXES' },
      },
      uid: ""
    };

    const hash = activePhone.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
    data.uid = cloudProfile?.player_id || `22Y-${Math.abs(hash % 9999).toString().padStart(4, '0')}-${String.fromCharCode(65 + (Math.abs(hash) % 26))}` // B-02 fix: was hash2 (undefined variable)

    userHistory.forEach((m: any) => {
      // Batting - Proper Innings based tracking
      const runs = parseInt(m.runs || 0);
      const balls = parseInt(m.ballsFaced || 0);
      data.totalRuns += runs;
      data.totalBallsFaced += balls;
      if (balls > 0 || runs > 0) data.inningsPlayed++;
      
      const s6 = parseInt(m.sixes || 0);
      const s4 = parseInt(m.fours || 0);
      data.sixes += s6;
      data.fours += s4;

      data.distribution['6'].shots += s6; data.distribution['6'].totalRuns += s6 * 6;
      data.distribution['4'].shots += s4; data.distribution['4'].totalRuns += s4 * 4;
      
      // B-10 fix: remaining runs after boundaries counted as "singles & others"
      // (per-ball breakdown needs individual ball events â not yet stored in match record)
      const remainingRuns = runs - (s6 * 6) - (s4 * 4);
      if (remainingRuns > 0) {
        data.distribution['1'].shots += remainingRuns;
        data.distribution['1'].totalRuns += remainingRuns;
      }

      // Bowling
      const wickets = parseInt(m.wicketsTaken || 0);
      data.totalWickets += wickets;
      if (wickets >= 3) data.threeWhauls++;  // B-07 fix: >= 3 not === 3
      if (wickets >= 5) data.fiveWhauls++;
      data.totalBallsBowled += parseInt(m.ballsBowled || 0);
      data.totalRunsConceded += parseInt(m.runsConceded || 0);

      // Fielding
      data.catches += parseInt(m.catches || 0);
      data.stumpings += parseInt(m.stumpings || 0);
      data.runOuts += parseInt(m.runOuts || 0);

      // Leadership
      if (m.asCaptain) {
        data.matchesAsCaptain++;
        if (m.matchWon) data.winsAsCaptain++;
        data.tossesContested++;
        if (m.tossWon) data.tossesWon++;
      }
    });

    return data;
  }, [userData, cloudProfile]);

  // Core Analytics Formulas
  const strikeRate = stats.totalBallsFaced > 0 ? ((stats.totalRuns / stats.totalBallsFaced) * 100).toFixed(1) : "0.0";
  const battingAverage = stats.inningsPlayed > 0 ? (stats.totalRuns / stats.inningsPlayed).toFixed(2) : "0.00";
  
  // Fielding Impact Calculation: Weighted defensive index per appearance
  // Formula: (Catches * 1.0 + Stumpings * 1.2 + RunOuts * 1.2) - scaled for aesthetic presentation
  const fieldingImpactVal = stats.matches > 0 
    ? ((stats.catches * 1 + stats.stumpings * 1.2 + stats.runOuts * 1.2) / stats.matches) 
    : 0;
  const fieldingImpact = (fieldingImpactVal * 10).toFixed(1) + " Pts";

  const visibleShots = useMemo(() => {
    const shots = [];
    const types = ['1', '2', '3', '4', '5', '6'];
    types.forEach(type => {
      if (activeRunFilter !== 'ALL' && activeRunFilter !== type) return;
      const dist = stats.distribution[type as keyof typeof stats.distribution] || { shots: 0, color: '#fff' };
      const count = dist.shots;
      const color = dist.color;
      for (let i = 0; i < count; i++) {
        const deg = Math.random() * 360;
        let length = type === '6' ? 260 + Math.random() * 60 : type === '4' ? 225 + Math.random() * 10 : 50 + Math.random() * 100;
        shots.push({ id: `${type}-${i}`, runs: parseInt(type), deg, length, color });
      }
    });
    return shots;
  }, [activeRunFilter, stats]);

  const bowlingEconomy = stats.totalBallsBowled > 0 ? ((stats.totalRunsConceded / stats.totalBallsBowled) * 6).toFixed(2) : "0.00";
  // Cloud override: use Supabase values when available (more accurate for multi-device)
  const bestFigures = cloudProfile?.best_figures || `${stats.totalWickets > 0 ? stats.totalWickets : 0}/0`;
  const cloudEliteRank = cloudProfile?.elite_rank || null;
  const bowlingAverage = stats.totalWickets > 0 ? (stats.totalRunsConceded / stats.totalWickets).toFixed(2) : "0.00";
  const tossWinRate = stats.tossesContested > 0 ? ((stats.tossesWon / stats.tossesContested) * 100).toFixed(1) : "0.0";
  const captaincyWinRate = stats.matchesAsCaptain > 0 ? ((stats.winsAsCaptain / stats.matchesAsCaptain) * 100).toFixed(1) : "0.0";
  
  const eliteRankLocal = useMemo(() => {
    const wins = stats.winsAsCaptain;
    if (wins >= 20) return "General";
    if (wins >= 10) return "Colonel";
    if (wins >= 5) return "Major";
    if (wins >= 2) return "Captain";
    if (wins >= 1) return "Lieutenant";
    return "Cadet";
  }, [stats.winsAsCaptain]);
  const eliteRank = cloudEliteRank || eliteRankLocal;

  const FIELD_POSITIONS = [
    { label: 'Long On', deg: 75 }, { label: 'Long Off', deg: 105 }, { label: 'Extra Cover', deg: 150 },
    { label: 'Point', deg: 180 }, { label: 'Gully', deg: 210 }, { label: 'Third Man', deg: 270 },
    { label: 'Fine Leg', deg: 330 }, { label: 'Square Leg', deg: 0 }, { label: 'Mid Wicket', deg: 45 }
  ];

  return (
    <div className="h-full bg-[#020617] text-white flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-8 pb-40">
        <section className="flex flex-col items-center space-y-4 pt-4 relative text-center">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-[#00F0FF]/5 blur-[100px] pointer-events-none" />
          <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-[#00F0FF] via-transparent to-[#39FF14] relative z-10">
            <div className="w-full h-full rounded-full bg-[#020617] p-1 overflow-hidden">
              <img src={userAvatar || userData?.avatar} className="w-full h-full object-cover rounded-full saturate-125" alt="Avatar" />
            </div>
            {stats.matchesAsCaptain > 0 && (<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1 -right-1 w-8 h-8 bg-[#FFD600] rounded-full border-4 border-[#020617] flex items-center justify-center text-black shadow-lg"><Crown size={14} /></motion.div>)}
          </div>
          <div className="space-y-1">
            <div className="bg-white/5 px-3 py-1 rounded-full border border-white/10 flex items-center justify-center space-x-1 mb-2 mx-auto w-fit"><Hash size={10} className="text-[#00F0FF]" /><span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase">{stats.uid}</span></div>
            <div className="flex items-center justify-center space-x-2"><h1 className="font-heading text-6xl italic leading-none tracking-tighter uppercase">{userData?.name || 'NEW PLAYER'}</h1></div>
            <div className="flex items-center justify-center space-x-2"><p className="text-[9px] font-black uppercase text-[#00F0FF] tracking-[0.4em]">{userData?.role || 'UNRANKED'}</p>{stats.matchesAsCaptain > 0 && (<><span className="text-white/10 text-[8px]">â¢</span><p className="text-[9px] font-black uppercase text-[#FFD600] tracking-[0.4em]">COMMANDER STATUS</p></>)}</div>
          </div>
        </section>

        <div className="flex bg-white/5 p-1 rounded-2xl overflow-x-auto no-scrollbar border border-white/5 shrink-0 z-50">
          {[{ id: 'BATTING', label: 'Batting', icon: Swords }, { id: 'BOWLING', label: 'Bowling', icon: Disc }, { id: 'FIELDING', label: 'Fielding', icon: Shield }, { id: 'CAPTAINCY', label: 'Leadership', icon: Crown }].map((d) => (
            <button key={d.id} onClick={() => setActiveDisc(d.id as any)} className={`flex-shrink-0 flex items-center space-x-2 px-6 py-4 rounded-xl text-[10px] font-black tracking-widest transition-all ${activeDisc === d.id ? 'bg-white text-black shadow-2xl' : 'text-white/20 hover:text-white/40'}`}><d.icon size={14} /><span className="uppercase">{d.label}</span></button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeDisc === 'BATTING' && (
            <motion.div key="batting" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <MetricBlock label="Career Runs" value={stats.totalRuns} sub="Verified Profile Aggregate" icon={Trophy} color="#FFD700" />
                <MetricBlock label="Strike Rate" value={strikeRate} sub="(Runs / Balls faced) * 100" icon={Zap} color="#00F0FF" />
                <MetricBlock label="Average" value={battingAverage} sub="Runs per Innings" icon={Target} color="#39FF14" />
                <MetricBlock label="Total Fours" value={stats.fours} sub="Precision Strikes" icon={Zap} color="#8B5CF6" />
                <MetricBlock label="Total Sixes" value={stats.sixes} sub="Aerial Superiority" icon={Flame} color="#EF4444" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between"><h3 className="font-heading text-4xl italic uppercase text-white leading-none">ARENA SPECTRUM</h3><div className="bg-[#FF1744]/10 border border-[#FF1744]/30 px-3 py-1 rounded-full"><span className="text-[8px] font-black text-[#FF1744] uppercase tracking-[0.3em]">UNDER CONSTRUCTION</span></div></div>
                <GlassCard className="p-4 relative bg-black shadow-2xl overflow-visible border-[#00F0FF]/10 min-h-[550px]">
                   <div className="relative w-full aspect-[1/1.25] mt-12">
                      <svg viewBox="0 -120 500 1000" className="w-full h-full overflow-visible">
                          <defs><radialGradient id="floodlight" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#00F0FF" stopOpacity="0.6" /><stop offset="100%" stopColor="#00F0FF" stopOpacity="0" /></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="5" result="coloredBlur" /><feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
                          <circle cx="20" cy="-50" r="80" fill="url(#floodlight)" className="animate-pulse" /><circle cx="480" cy="-50" r="80" fill="url(#floodlight)" className="animate-pulse" style={{ animationDelay: '1s' }} /><circle cx="20" cy="850" r="100" fill="url(#floodlight)" className="animate-pulse" style={{ animationDelay: '0.5s' }} /><circle cx="480" cy="850" r="100" fill="url(#floodlight)" className="animate-pulse" style={{ animationDelay: '1.5s' }} />
                          <ellipse cx="250" cy="380" rx="275" ry="290" fill="#020617" stroke="#1e293b" strokeWidth="12" /><ellipse cx="250" cy="380" rx="225" ry="240" fill="#064e3b" stroke="white" strokeWidth="5" />
                          {FIELD_POSITIONS.map((pos) => { const rad = (pos.deg * Math.PI) / 180; const xPos = 250 + Math.cos(rad) * 255; const yPos = 380 + Math.sin(rad) * 270; return (<text key={pos.label} x={xPos} y={yPos} textAnchor="middle" fill="white" fontSize="12" fontWeight="900" className="uppercase tracking-widest opacity-30" style={{ fontFamily: 'Teko, sans-serif' }}>{pos.label}</text>); })}
                          {visibleShots.map((shot) => { const rad = (shot.deg * Math.PI) / 180; const xEnd = 250 + Math.cos(rad) * shot.length; const yEnd = 380 + Math.sin(rad) * shot.length; return <line key={shot.id} x1="250" y1="380" x2={xEnd} y2={yEnd} stroke={shot.color} strokeWidth={shot.runs >= 4 ? 4 : 1.5} filter="url(#glow)" />; })}
                      </svg>
                   </div>
                </GlassCard>
              </div>
            </motion.div>
          )}

          {activeDisc === 'BOWLING' && (
            <motion.div key="bowling" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <MetricBlock label="Total Wickets" value={stats.totalWickets} sub="Career Dismissals" icon={Disc} color="#39FF14" />
                <MetricBlock label="Economy Rate" value={bowlingEconomy} sub="Runs per Over" icon={Activity} color="#00F0FF" />
                <MetricBlock label="Average" value={bowlingAverage} sub="Runs per Wicket" icon={BarChart3} color="#FFD700" />
                <MetricBlock label="Best Figures" value={`${stats.threeWhauls}x3W / ${stats.fiveWhauls}x5W`} sub="Haul Frequency" icon={Award} color="#FF1744" />
              </div>
              <GlassCard className="p-6 border-white/5 space-y-4">
                <div className="flex items-center space-x-3"><Flame size={16} className="text-[#39FF14]" /><h4 className="text-[10px] font-black uppercase tracking-[0.3em]">Execution Telemetry</h4></div>
                <div className="grid grid-cols-2 gap-4"><div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center"><p className="text-[8px] font-black text-white/30 uppercase mb-1">3W HAULS</p><p className="font-numbers text-3xl font-bold">{stats.threeWhauls}</p></div><div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center"><p className="text-[8px] font-black text-white/30 uppercase mb-1">5W HAULS</p><p className="font-numbers text-3xl font-bold">{stats.fiveWhauls}</p></div></div>
              </GlassCard>
            </motion.div>
          )}

          {activeDisc === 'FIELDING' && (
            <motion.div key="fielding" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <MetricBlock label="Total Catches" value={stats.catches} sub="Verified Takes" icon={MousePointer2} color="#FFD700" />
                <MetricBlock label="Stumpings" value={stats.stumpings} sub="Lightning Reflexes" icon={Zap} color="#00F0FF" />
                <MetricBlock label="Run Outs" value={stats.runOuts} sub="Direct Hits" icon={Target} color="#39FF14" />
                <MetricBlock label="Fielding Impact" value={fieldingImpact} sub="Command Value Generated" icon={ShieldCheck} color="#BC13FE" />
              </div>
            </motion.div>
          )}

          {activeDisc === 'CAPTAINCY' && (
            <motion.div key="captaincy" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <MetricBlock label="Toss win rate" value={`${tossWinRate}%`} sub="Tactical Fortune (As Capt)" icon={RefreshCw} color="#00F0FF" />
                <MetricBlock label="Captaincy win rate" value={`${captaincyWinRate}%`} sub="Squad Victory Ratio" icon={Crown} color="#FFD600" />
                <MetricBlock label="Matches led" value={stats.matchesAsCaptain} sub="Active Assignments" icon={UserCheck} color="#39FF14" />
                <MetricBlock label="Elite rank" value={eliteRank} sub="Leadership Status" icon={Globe} color="#FF1744" />
              </div>
              <GlassCard className="p-6 border-white/5"><div className="flex items-center justify-between mb-4"><p className="text-[9px] font-black text-white/20 uppercase tracking-[0.5em]">Command History</p><div className="px-3 py-1 rounded-full bg-[#FFD600]/10 border border-[#FFD600]/20"><p className="text-[7px] font-bold text-[#FFD600] uppercase tracking-widest">Rank: {eliteRank}</p></div></div><div className="flex justify-around items-center"><div className="text-center"><p className="font-numbers text-4xl font-bold text-white leading-none">{stats.winsAsCaptain}</p><p className="text-[8px] font-bold text-[#39FF14] uppercase mt-1">Victories</p></div><div className="w-[1px] h-12 bg-white/5" /><div className="text-center"><p className="font-numbers text-4xl font-bold text-white leading-none">{stats.matchesAsCaptain - stats.winsAsCaptain}</p><p className="text-[8px] font-bold text-[#FF1744] uppercase mt-1">Defeats</p></div></div><div className="mt-6 pt-6 border-t border-white/5 space-y-2"><div className="flex justify-between items-end"><p className="text-[7px] font-black text-white/20 uppercase tracking-widest">Rank Progress</p><p className="text-[7px] font-black text-white/40 uppercase">{stats.winsAsCaptain} / 20 Wins</p></div><div className="h-1 bg-white/5 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (stats.winsAsCaptain / 20) * 100)}%` }} className="h-full bg-gradient-to-r from-[#FF1744] to-[#FFD600]" /></div></div></GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="space-y-4 pb-20"><div className="px-1 flex justify-between items-end"><div className="space-y-0.5"><h3 className="font-heading text-4xl italic uppercase text-white leading-none">OPPOSITION TELEMETRY</h3><p className="text-[8px] font-black text-[#FF1744] uppercase tracking-[0.3em]">Opposition Resistance Level</p></div></div><GlassCard className="p-4 overflow-hidden h-40 border-[#FF1744]/20"><ResponsiveContainer width="100%" height="100%"><AreaChart data={MOCK_OPP_TREND}><defs><linearGradient id="oppTrendGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#FF1744" stopOpacity={0.4}/><stop offset="95%" stopColor="#FF1744" stopOpacity={0}/></linearGradient></defs><Area type="monotone" dataKey="resistance" stroke="#FF1744" strokeWidth={4} fill="url(#oppTrendGrad)" /></AreaChart></ResponsiveContainer></GlassCard></section>
      </div>
    </div>
  );
};

const MetricBlock: React.FC<{ label: string, value: string | number, sub: string, icon: any, color: string }> = ({ label, value, sub, icon: Icon, color }) => (
  <GlassCard className="p-4 border-l-2" style={{ borderLeftColor: color }}><p className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em] mb-0.5">{label}</p><p className="font-numbers text-2xl font-bold text-white tracking-tighter leading-none mb-0.5">{value}</p><p className="text-[6px] font-black text-white/10 uppercase tracking-widest">{sub}</p><div className="mt-2 flex items-center"><Icon size={10} style={{ color }} className="mr-1 opacity-60" /><span className="text-[6px] font-black text-white/20 uppercase">Sensor Data Logged</span></div></GlassCard>
);

const MOCK_OPP_TREND = [{ resistance: 20 }, { resistance: 45 }, { resistance: 30 }, { resistance: 80 }, { resistance: 50 }, { resistance: 90 }, { resistance: 60 }];

export default Performance;
