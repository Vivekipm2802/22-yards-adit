// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Star, Calendar, Zap, Award, Target, Crown,
  TrendingUp, History, Info, Smartphone, Cloud, Users, ShieldCheck,
  ChevronRight, ChevronLeft, X, Swords, Disc, User, Hash, Download
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import MotionButton from '../components/MotionButton';
import { fetchPlayerByPhone } from '../lib/supabase';

const Archive: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'MATCHES' | 'SQUADS'>('MATCHES');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [viewingMatch, setViewingMatch] = useState<any | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [vaultInfo, setVaultInfo] = useState({ name: '', phone: '' });

  useEffect(() => {
    const savedData = localStorage.getItem('22YARDS_USER_DATA');
    if (savedData) {
      const user = JSON.parse(savedData);
      const globalVault = JSON.parse(localStorage.getItem('22YARDS_GLOBAL_VAULT') || '{}');
      const vaultData = globalVault[user.phone];

      // FIX (Bug 2): merge cloud archive_vault so guests who signed up after a match
      // (or log in on a new device) still see their match history.
      const localHist = (vaultData?.history || []).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

      // BUG A FIX: Create merged history upfront to avoid race condition
      // where team extraction uses only local history before cloud merges
      let mergedHistForTeams = localHist;
      fetchPlayerByPhone(user.phone).then(cloudProfile => {
        const cloudHist = (cloudProfile?.archive_vault && Array.isArray(cloudProfile.archive_vault))
          ? cloudProfile.archive_vault : [];
        const seen = new Set();
        const merged = [...cloudHist, ...localHist].filter(m => {
          if (!m?.id || seen.has(m.id)) return false;
          seen.add(m.id); return true;
        }).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        mergedHistForTeams = merged;  // Update reference for team extraction
        setHistory(merged);
      }).catch(() => {
        const sorted = [...localHist].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        mergedHistForTeams = sorted;
        setHistory(sorted);
      });

      if (vaultData) {
        // Use the merged history (will be updated when cloud fetch completes)
        const hist = mergedHistForTeams;

        // Sync team names if registered ID matches a match ID context
        let rawTeams = vaultData.teams || [];

        // If no explicit teams are registered, extract unique squads from match history
        if (rawTeams.length === 0 && hist.length > 0) {
          const uniqueTeamsMap = new Map();
          hist.forEach(m => {
            if (m.fullScorecard) {
              const sc = m.fullScorecard;
              // Support both old format (battingTeam/bowlingTeam) and new format (innings1/innings2)
              const team1Name = sc.battingTeam?.name || sc.innings1?.teamName;
              const team1Squad = sc.battingTeam?.squad || sc.innings1?.batters;
              const team2Name = sc.bowlingTeam?.name || sc.innings2?.teamName;
              const team2Squad = sc.bowlingTeam?.squad || sc.innings2?.batters;

              if (team1Name && !uniqueTeamsMap.has(team1Name)) {
                uniqueTeamsMap.set(team1Name, { id: m.id, name: team1Name, players: team1Squad || [] });
              }
              if (team2Name && !uniqueTeamsMap.has(team2Name)) {
                uniqueTeamsMap.set(team2Name, { id: m.id + '_bowl', name: team2Name, players: team2Squad || [] });
              }
            }
          });
          rawTeams = Array.from(uniqueTeamsMap.values());
        }

        const syncedTeams = rawTeams.map(team => {
           const matchingMatch = hist.find(m => m.id === team.id);
           if (matchingMatch && matchingMatch.fullScorecard) {
              const sc = matchingMatch.fullScorecard;
              const matchedName = sc.battingTeam?.name || sc.innings1?.teamName;
              const matchedSquad = sc.battingTeam?.squad || sc.innings1?.batters;
              return {
                ...team,
                name: matchedName || team.name,
                players: matchedSquad || team.players
              };
           }
           return team;
        });

        setTeams(syncedTeams);
        setVaultInfo({ name: vaultData.name, phone: user.phone });
      }
    }
  }, []);

  return (
    <div className="h-full bg-black text-white overflow-hidden flex flex-col relative">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Vault Status Bar */}
        <div className="px-6 pt-6 flex items-center justify-between shrink-0">
           <div className="flex items-center space-x-3 bg-[#39FF14]/5 border border-[#39FF14]/20 px-4 py-2 rounded-full">
              <Cloud size={14} className="text-[#39FF14]" />
              <span className="text-[9px] font-black text-[#39FF14] uppercase tracking-widest">
             {isSyncing ? '🚳 SYNCING...' : `Vault: +91 ${vaultInfo.phone}`}
           </span>
           </div>
        </div>

        <section className="p-6 pt-8 space-y-8 flex-1 flex flex-col overflow-hidden">
          <div className="space-y-1 shrink-0">
            <h2 className="font-heading text-6xl tracking-tighter uppercase leading-none">ARCHIVE</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Career Repository</p>
          </div>

          {/* Tab Selection */}
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 shrink-0">
            <button 
              onClick={() => setActiveTab('MATCHES')}
              className={`flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest transition-all ${activeTab === 'MATCHES' ? 'bg-white text-black shadow-lg' : 'text-white/20'}`}
            >
              BATTLES
            </button>
            <button 
              onClick={() => setActiveTab('SQUADS')}
              className={`flex-1 py-4 rounded-xl text-[10px] font-black tracking-widest transition-all ${activeTab === 'SQUADS' ? 'bg-white text-black shadow-lg' : 'text-white/20'}`}
            >
              SQUADS
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
            <AnimatePresence mode="wait">
              {activeTab === 'MATCHES' ? (
                <motion.div key="matches" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                   {history.length === 0 ? (
                     <EmptyState icon={History} label="No Battles Recorded" />
                   ) : (
                     history.map((match) => (
                       <motion.div
                        key={match.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setViewingMatch(match)}
                        className="cursor-pointer"
                       >
                         <GlassCard className="p-5 border-white/5 hover:border-[#00F0FF]/30 transition-all">
                            <div className="flex items-center justify-between">
                               <div className="flex items-center space-x-3 flex-1 min-w-0">
                                  <div className={`w-1.5 h-14 rounded-full ${match.result === 'WON' ? 'bg-[#39FF14]' : match.result === 'TIED' ? 'bg-[#FFD600]' : 'bg-[#FF003C]'} opacity-60 shrink-0`} />
                                  <div className="flex-1 min-w-0">
                                     <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">{match.date}</p>
                                     <h4 className="font-heading text-2xl tracking-tight leading-tight uppercase truncate">vs {match.opponent}</h4>
                                     {/* Team scores side-by-side */}
                                     {(match.myTeamScore !== undefined) ? (
                                       <div className="flex items-center space-x-2 mt-1">
                                         <span className="font-numbers text-sm font-black text-white">{match.myTeamScore}/{match.myTeamWickets ?? ''}</span>
                                         <span className="text-[8px] text-white/20 font-bold">({match.myTeamOvers ?? ''})</span>
                                         <span className="text-white/20 text-[9px]">vs</span>
                                         <span className="font-numbers text-sm font-black text-white/60">{match.oppTeamScore}/{match.oppTeamWickets ?? ''}</span>
                                         <span className="text-[8px] text-white/20 font-bold">({match.oppTeamOvers ?? ''})</span>
                                       </div>
                                     ) : (
                                       <p className="text-[9px] text-white/20 font-bold mt-0.5">Score: {match.runs} runs</p>
                                     )}
                                  </div>
                               </div>
                               <div className="text-right shrink-0 ml-2">
                                  <span className={`text-[9px] font-black px-2 py-1 rounded-full border ${match.result === 'WON' ? 'text-[#39FF14] border-[#39FF14]/30 bg-[#39FF14]/10' : match.result === 'TIED' ? 'text-[#FFD600] border-[#FFD600]/30 bg-[#FFD600]/10' : 'text-[#FF003C] border-[#FF003C]/30 bg-[#FF003C]/10'} uppercase tracking-[0.2em]`}>{match.result}</span>
                               </div>
                            </div>
                         </GlassCard>
                       </motion.div>
                     ))
                   )}
                </motion.div>
              ) : (
                <motion.div key="teams" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                   {teams.length === 0 ? (
                     <EmptyState icon={Users} label="No Registered Squads" />
                   ) : (
                     teams.map((team) => (
                       <div key={team.id} className="space-y-2">
                         <motion.button 
                           onClick={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)}
                           className="w-full text-left outline-none"
                         >
                           <GlassCard className={`p-6 border-white/5 hover:bg-white/[0.03] transition-all ${expandedTeamId === team.id ? 'border-[#00F0FF]/30 bg-white/[0.03]' : ''}`}>
                              <div className="flex justify-between items-center">
                                 <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 rounded-xl bg-black border border-white/10 flex items-center justify-center font-heading text-xl text-[#00F0FF]">
                                      {team.name.charAt(0)}
                                    </div>
                                    <div>
                                      <h4 className="font-heading text-3xl uppercase tracking-tighter leading-none">{team.name}</h4>
                                      <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mt-1">Operational Squadron</p>
                                    </div>
                                 </div>
                                 <div className="flex items-center space-x-3">
                                    <div className="text-right">
                                      <p className="font-numbers text-lg font-black text-white">{team.players?.length || 0}</p>
                                      <p className="text-[7px] font-black text-white/20 uppercase">Athletes</p>
                                    </div>
                                    <ChevronRight size={14} className={`text-white/20 transition-transform ${expandedTeamId === team.id ? 'rotate-90 text-[#00F0FF]' : ''}`} />
                                 </div>
                              </div>
                           </GlassCard>
                         </motion.button>
                         
                         <AnimatePresence>
                           {expandedTeamId === team.id && (
                             <motion.div 
                               initial={{ height: 0, opacity: 0 }}
                               animate={{ height: 'auto', opacity: 1 }}
                               exit={{ height: 0, opacity: 0 }}
                               className="overflow-hidden px-2"
                             >
                               <div className="p-4 bg-[#111] rounded-2xl border border-white/5 space-y-2 mb-2">
                                 <p className="text-[8px] font-black text-[#00F0FF] uppercase tracking-[0.4em] mb-4 text-center">ACTIVE SQUADRON ROSTER</p>
                                 {(team.players || [])?.map((p: any, i: number) => (
                                   <div key={i} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/5">
                                      <div className="flex items-center space-x-3">
                                         <div className="w-8 h-8 rounded-lg bg-black border border-white/10 flex items-center justify-center">
                                            {p.isCaptain ? <Crown size={12} className="text-[#FFD600]" /> : <User size={12} className="text-white/20" />}
                                         </div>
                                         <div className="flex flex-col">
                                            <span className="text-xs font-black text-white uppercase tracking-tight">{p.name}</span>
                                            <span className="text-[7px] font-bold text-[#00F0FF] uppercase tracking-widest">
                                               {p.isCaptain ? 'Captain' : (p.isWicketKeeper ? 'Wicket Keeper' : 'Player')}
                                            </span>
                                         </div>
                                      </div>
                                      <div className="flex items-center text-white/30 space-x-1">
                                         <Smartphone size={8} />
                                         <span className="font-numbers text-[10px] font-bold">{p.phone ? `+91 ${p.phone.slice(-4).padStart(p.phone.length, '*')} ` : 'HIDDEN'}</span>
                                      </div>
                                   </div>
                                 ))}
                               </div>
                             </motion.div>
                           )}
                         </AnimatePresence>
                       </div>
                     ))
                   )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {viewingMatch && (
          <ScorecardView 
            match={viewingMatch} 
            onBack={() => setViewingMatch(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const generateScorecardPDF = async (match: any) => {
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentW = pw - 2 * margin;
    let y = 12;

    // Reference template colors (matches MatchCenter scorecard)
    const headerGreen: [number, number, number] = [112, 159, 93];
    const lightGreen: [number, number, number] = [197, 220, 167];
    const borderGray: [number, number, number] = [210, 210, 210];
    const rowDivider: [number, number, number] = [235, 235, 235];
    const textBlack: [number, number, number] = [40, 40, 40];
    const textGray: [number, number, number] = [120, 120, 120];

    const ensureSpace = (needed: number) => {
      if (y + needed > ph - 14) {
        doc.addPage();
        y = 12;
      }
    };

    const batCol = [0.48, 0.09, 0.09, 0.10, 0.10, 0.14].map(f => contentW * f);
    const bowlCol = [0.48, 0.09, 0.09, 0.10, 0.10, 0.14].map(f => contentW * f);

    const sc = match.fullScorecard;
    const tA = sc?.battingTeam?.name || 'Team A';
    const tB = sc?.bowlingTeam?.name || 'Team B';

    // Top divider — title — divider
    doc.setDrawColor(...borderGray);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pw - margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(20);
    doc.setTextColor(...textBlack);
    doc.text(`${tA} v/s ${tB}`, pw / 2, y, { align: 'center' });
    y += 4;
    doc.line(margin, y, pw - margin, y);
    y += 6;

    // Result line
    const resultLine = sc?.matchResult || (match.result ? `Result: ${match.result}` : '');
    if (resultLine) {
      doc.setFontSize(10);
      doc.setTextColor(...textBlack);
      doc.text(resultLine, margin, y);
      y += 3;
      doc.setDrawColor(...borderGray);
      doc.line(margin, y, pw - margin, y);
      y += 4;
    }

    if (!sc) {
      doc.setTextColor(...textGray); doc.setFontSize(10);
      doc.text('No detailed scorecard available.', pw / 2, y + 15, { align: 'center' });
      doc.save(`22YARDS_${(match.opponent || 'Match').replace(/\s+/g, '_')}.pdf`);
      return;
    }

    const renderInnings = (
      teamName: string,
      batSquad: any[],
      bowlSquad: any[],
      total: any,
      extras: any,
      fow: any[],
    ) => {
      const balls = total?.balls || 0;
      const runs = total?.runs || 0;
      const wickets = total?.wickets || 0;
      const overs = `${Math.floor(balls / 6)}.${balls % 6}`;
      const scoreStr = `${runs}-${wickets} (${overs})`;

      // Team header bar
      ensureSpace(10);
      doc.setFillColor(...headerGreen);
      doc.rect(margin, y, contentW, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text(teamName, margin + 2, y + 5);
      doc.text(scoreStr, pw - margin - 2, y + 5, { align: 'right' });
      y += 7;

      // Batting column header
      doc.setFillColor(...lightGreen);
      doc.rect(margin, y, contentW, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...textBlack);
      const batHeaders = ['Batsman', 'R', 'B', '4s', '6s', 'SR'];
      batHeaders.forEach((h, i) => {
        if (i === 0) {
          doc.text(h, margin + 2, y + 4);
        } else {
          const rightEdge = margin + batCol.slice(0, i + 1).reduce((a, b) => a + b, 0) - 2;
          doc.text(h, rightEdge, y + 4, { align: 'right' });
        }
      });
      y += 6;

      // Batter rows (only those who actually batted)
      const batters = (batSquad || []).filter((p: any) =>
        (p.runs || 0) > 0 || (p.balls || 0) > 0 || p.outDetail
      );
      batters.forEach((p: any) => {
        const dismissal = p.outDetail || ((p.balls || 0) > 0 ? 'not out' : '');
        const rowH = dismissal ? 10 : 7;
        ensureSpace(rowH + 2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...textBlack);
        doc.text(String(p.name || ''), margin + 2, y + 4);

        const sr = (p.balls || 0) > 0 ? (((p.runs || 0) / (p.balls || 0)) * 100).toFixed(2) : '0.00';
        const vals = [String(p.runs || 0), String(p.balls || 0), String(p.fours || 0), String(p.sixes || 0), sr];
        vals.forEach((v, i) => {
          const rightEdge = margin + batCol.slice(0, i + 2).reduce((a, b) => a + b, 0) - 2;
          doc.text(v, rightEdge, y + 4, { align: 'right' });
        });

        if (dismissal) {
          doc.setFontSize(8);
          doc.setTextColor(...textGray);
          doc.text(String(dismissal), margin + 2, y + 8);
        }
        y += rowH;
        doc.setDrawColor(...rowDivider);
        doc.setLineWidth(0.2);
        doc.line(margin, y, pw - margin, y);
      });

      // Extras row
      const ex = extras || {};
      const totalEx = ex.total ?? ((ex.byes || 0) + (ex.legByes || 0) + (ex.wides || 0) + (ex.noBalls || 0) + (ex.penalties || 0));
      ensureSpace(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...textBlack);
      doc.text('Extras', margin + 2, y + 5);
      doc.text(
        `(${totalEx}) ${ex.byes || 0} B, ${ex.legByes || 0} LB, ${ex.wides || 0} WD, ${ex.noBalls || 0} NB, ${ex.penalties || 0} P`,
        pw - margin - 2, y + 5, { align: 'right' }
      );
      y += 7;
      doc.setDrawColor(...rowDivider);
      doc.line(margin, y, pw - margin, y);

      // Total row
      const rr = balls > 0 ? ((runs / balls) * 6).toFixed(2) : '0.00';
      ensureSpace(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Total', margin + 2, y + 5);
      doc.text(`${runs}-${wickets} (${overs}) ${rr}`, pw - margin - 2, y + 5, { align: 'right' });
      y += 7;
      doc.setDrawColor(...rowDivider);
      doc.line(margin, y, pw - margin, y);

      // Bowler header
      ensureSpace(10);
      doc.setFillColor(...lightGreen);
      doc.rect(margin, y, contentW, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...textBlack);
      const bowlHeaders = ['Bowler', 'O', 'M', 'R', 'W', 'ER'];
      bowlHeaders.forEach((h, i) => {
        if (i === 0) {
          doc.text(h, margin + 2, y + 4);
        } else {
          const rightEdge = margin + bowlCol.slice(0, i + 1).reduce((a, b) => a + b, 0) - 2;
          doc.text(h, rightEdge, y + 4, { align: 'right' });
        }
      });
      y += 6;

      // Bowler rows
      const bowlers = (bowlSquad || []).filter((p: any) =>
        (p.balls_bowled || p.ballsBowled || 0) > 0 || (p.wickets || 0) > 0
      );
      bowlers.forEach((p: any) => {
        ensureSpace(8);
        const bb = p.balls_bowled || p.ballsBowled || 0;
        const rc = p.runs_conceded || p.runsConceded || 0;
        const ov = `${Math.floor(bb / 6)}.${bb % 6}`;
        const econ = bb > 0 ? ((rc / bb) * 6).toFixed(2) : '0.00';
        const maidens = p.maidens || 0;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...textBlack);
        doc.text(String(p.name || ''), margin + 2, y + 5);
        const vals = [ov, String(maidens), String(rc), String(p.wickets || 0), econ];
        vals.forEach((v, i) => {
          const rightEdge = margin + bowlCol.slice(0, i + 2).reduce((a, b) => a + b, 0) - 2;
          doc.text(v, rightEdge, y + 5, { align: 'right' });
        });
        y += 7;
        doc.setDrawColor(...rowDivider);
        doc.line(margin, y, pw - margin, y);
      });

      // Fall of Wickets
      if (fow && fow.length > 0) {
        ensureSpace(10);
        doc.setFillColor(...headerGreen);
        doc.rect(margin, y, contentW, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text('Fall of wickets', margin + 2, y + 4);
        doc.text('Score', pw / 2, y + 4, { align: 'center' });
        doc.text('Over', pw - margin - 2, y + 4, { align: 'right' });
        y += 6;

        fow.forEach((wkt: any) => {
          ensureSpace(7);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(...textBlack);
          doc.text(String(wkt.batterName || 'Unknown'), margin + 2, y + 5);
          doc.text(String(wkt.score || ''), pw / 2, y + 5, { align: 'center' });
          doc.text(String(wkt.over || ''), pw - margin - 2, y + 5, { align: 'right' });
          y += 7;
          doc.setDrawColor(...rowDivider);
          doc.line(margin, y, pw - margin, y);
        });
      }

      y += 3;
    };

    // Innings 1 = batting team bats, bowling team bowls
    renderInnings(
      tA,
      sc.battingTeam?.squad || [],
      sc.bowlingTeam?.squad || [],
      sc.inn1Total || { runs: match.myTeamScore || 0, wickets: match.myTeamWickets || 0, balls: 0 },
      sc.inn1Extras,
      sc.inn1FoW || []
    );

    // Innings 2 = teams flipped
    renderInnings(
      tB,
      sc.bowlingTeam?.squad || [],
      sc.battingTeam?.squad || [],
      sc.inn2Total || { runs: match.oppTeamScore || 0, wickets: match.oppTeamWickets || 0, balls: 0 },
      sc.inn2Extras,
      sc.inn2FoW || []
    );

    // Man of the Match — prefer awards.mvp, else compute from all players
    let motm: any = sc.awards?.mvp || null;
    if (!motm) {
      const allPlayers = [...(sc.battingTeam?.squad || []), ...(sc.bowlingTeam?.squad || [])];
      if (allPlayers.length > 0) {
        motm = allPlayers.reduce((best: any, p: any) => {
          const impact = (p.runs || 0) + (p.wickets || 0) * 25 + (p.catches || 0) * 10 + (p.stumpings || 0) * 10 + (p.run_outs || 0) * 10;
          const bestImpact = (best.runs || 0) + (best.wickets || 0) * 25 + (best.catches || 0) * 10 + (best.stumpings || 0) * 10 + (best.run_outs || 0) * 10;
          return impact > bestImpact ? p : best;
        }, allPlayers[0]);
      }
    }

    if (motm?.name) {
      ensureSpace(18);
      doc.setFillColor(...headerGreen);
      doc.rect(margin, y, contentW, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text('Man of the Match', margin + 2, y + 5);
      y += 7;

      ensureSpace(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...textBlack);
      doc.text(String(motm.name), margin + 2, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...textGray);
      const parts: string[] = [];
      if ((motm.runs || 0) > 0 || (motm.balls || 0) > 0) parts.push(`${motm.runs || 0}(${motm.balls || 0})`);
      if ((motm.wickets || 0) > 0) parts.push(`${motm.wickets}-${motm.runs_conceded || motm.runsConceded || 0}`);
      if (parts.length > 0) {
        doc.text(parts.join(' · '), pw - margin - 2, y + 5, { align: 'right' });
      }
      y += 7;
      doc.setDrawColor(...rowDivider);
      doc.line(margin, y, pw - margin, y);
    }

    // Footer on every page
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const footerY = ph - 8;
      doc.setDrawColor(...borderGray);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 3, pw - margin, footerY - 3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...textGray);
      doc.text('Powered by 22 Yards (www.22yards.app)', pw / 2, footerY, { align: 'center' });
    }

    doc.save(`22YARDS_${(match.opponent || 'Match').replace(/\s+/g, '_')}_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.pdf`);
  } catch (e) {
    console.error('PDF generation failed:', e);
    alert('PDF generation failed. Please try again.');
  }
};

const ScorecardView = ({ match, onBack }) => {
  const [scTab, setScTab] = useState<'PERSONAL' | 'TEAM_A' | 'TEAM_B'>('PERSONAL');
  // Normalize scorecard to always have battingTeam/bowlingTeam (supports both old and new format)
  const rawSc = match.fullScorecard || null;
  const scorecard = rawSc ? {
    ...rawSc,
    battingTeam: rawSc.battingTeam || { name: rawSc.innings1?.teamName || 'TEAM A', squad: rawSc.innings1?.batters || [] },
    bowlingTeam: rawSc.bowlingTeam || { name: rawSc.innings2?.teamName || 'TEAM B', squad: rawSc.innings2?.batters || [] },
    inn1Total: rawSc.inn1Total || { runs: rawSc.innings1?.runs || match.myTeamScore || 0, wickets: rawSc.innings1?.wickets || match.myTeamWickets || 0, balls: rawSc.innings1?.balls || 0 },
    inn2Total: rawSc.inn2Total || { runs: rawSc.innings2?.runs || match.oppTeamScore || 0, wickets: rawSc.innings2?.wickets || match.oppTeamWickets || 0, balls: rawSc.innings2?.balls || 0 },
  } : null;
  const target = match.targetScore || match.target || (match.innings1Score ? match.innings1Score + 1 : null);

  const getWicketDetailHistorical = (player) => {
    if (player.outDetail) return player.outDetail;
    if ((player.balls || 0) > 0) return 'not out';
    return 'dnb';
  };

  return (
    <motion.div 
      initial={{ x: '100%' }} 
      animate={{ x: 0 }} 
      exit={{ x: '100%' }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-[2000] bg-[#050505] flex flex-col"
    >
      <div className="h-16 flex items-center px-6 border-b border-white/5 bg-black shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 text-[#00F0FF] hover:bg-white/5 rounded-full transition-all">
          <ChevronLeft size={20} />
        </button>
        <div className="ml-4 overflow-hidden flex-1">
           <h3 className="font-heading text-2xl uppercase tracking-widest italic truncate">vs {match.opponent}</h3>
           <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.5em]">{match.date}</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => generateScorecardPDF(match)}
            className="p-2 text-white/40 hover:text-[#FF003C] transition-colors"
            title="Download PDF Scorecard"
          >
            <Download size={18} />
          </button>
          <div className={`px-3 py-1.5 rounded-full ${match.result === 'WON' ? 'bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/20' : match.result === 'TIED' ? 'bg-[#FFD600]/10 text-[#FFD600] border-[#FFD600]/20' : 'bg-[#FF003C]/10 text-[#FF003C] border-[#FF003C]/20'} border text-[9px] font-black uppercase tracking-widest`}>
            {match.result}
          </div>
        </div>
      </div>

      {target && (
        <div className="px-6 py-6 bg-white/[0.02] border-b border-white/5 shrink-0 space-y-4">
           <div className="flex justify-between items-end">
              <div className="space-y-0.5">
                 <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em]">Chase Telemetry</p>
                 <h4 className="text-xl font-numbers font-black text-white">Target: {target}</h4>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-[#39FF14] uppercase tracking-widest">Score: {match.runs}</p>
              </div>
           </div>
           <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#39FF14]/10 to-transparent" />
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (match.runs / target) * 100)}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-[#39FF14] to-[#00F0FF] relative shadow-[0_0_15px_#39FF14]"
              />
           </div>
        </div>
      )}

      <div className="flex bg-black p-4 space-x-2 shrink-0 overflow-x-auto no-scrollbar border-b border-white/5">
        <ScTabBtn active={scTab === 'PERSONAL'} onClick={() => setScTab('PERSONAL')} icon={Target} label="PERSONAL IMPACT" />
        {scorecard && (
          <>
            <ScTabBtn active={scTab === 'TEAM_A'} onClick={() => setScTab('TEAM_A')} icon={Swords} label={scorecard?.battingTeam?.name || scorecard?.innings1?.teamName || 'TEAM A'} />
            <ScTabBtn active={scTab === 'TEAM_B'} onClick={() => setScTab('TEAM_B')} icon={Disc} label={scorecard?.bowlingTeam?.name || scorecard?.innings2?.teamName || 'TEAM B'} />
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 no-scrollbar pb-32">
        <AnimatePresence mode="wait">
          {scTab === 'PERSONAL' && (
            <motion.div key="personal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
               <div className="grid grid-cols-2 gap-4">
                  <StatBlock label="Runs Scored" value={match.runs} sub={`${match.ballsFaced || 0} Balls faced`} color="#00F0FF" />
                  <StatBlock label="Strike Rate" value={match.ballsFaced > 0 ? ((match.runs/match.ballsFaced)*100).toFixed(1) : '0.0'} sub="Personal Velocity" color="#39FF14" />
                  <StatBlock label="Wickets" value={match.wicketsTaken || 0} sub={`${match.runsConceded || 0} Runs conceded`} color="#FF003C" />
                  <StatBlock label="Economy" value={match.ballsBowled > 0 ? ((match.runsConceded/match.ballsBowled)*6).toFixed(2) : '0.00'} sub="Defense Factor" color="#FFD600" />
               </div>
               <GlassCard className="p-6 border-white/5 space-y-4">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] mb-4">FIELDING TELEMETRY</p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                     <div><p className="font-numbers text-3xl font-black">{match.catches || 0}</p><p className="text-[8px] font-bold text-white/20 uppercase">Catches</p></div>
                     <div><p className="font-numbers text-3xl font-black">{match.stumpings || 0}</p><p className="text-[8px] font-bold text-white/20 uppercase">Stumpings</p></div>
                     <div><p className="font-numbers text-3xl font-black">{match.runOuts || 0}</p><p className="text-[8px] font-bold text-white/20 uppercase">Run Outs</p></div>
                  </div>
               </GlassCard>
            </motion.div>
          )}
          {(scTab === 'TEAM_A' || scTab === 'TEAM_B') && scorecard && (
            <motion.div key={scTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-10">
              {scTab === 'TEAM_A' ? (
                /* ── Inn-1 batting team: show their batting (inn-1) AND bowling (inn-2) ── */
                <>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-[#00F0FF] uppercase tracking-[0.4em]">BATTING - INN 1</h4>
                    <div className="bg-[#121212] border border-white/5 rounded-3xl overflow-hidden">
                      <div className="grid grid-cols-5 p-4 border-b border-white/5 text-[8px] font-black uppercase text-white/40 tracking-widest">
                        <span className="col-span-2">Athlete</span><span>R</span><span>B</span><span className="text-right">4s/6s</span>
                      </div>
                      {scorecard.battingTeam.squad.map((p, i) => (
                        <div key={i} className="grid grid-cols-5 p-4 border-b border-white/5 last:border-0 items-center">
                          <div className="col-span-2 flex flex-col pr-2">
                            <span className="text-xs font-black uppercase truncate">{p.name}</span>
                            <span className="text-[8px] text-white/20 italic">{getWicketDetailHistorical(p)}</span>
                          </div>
                          <span className="font-numbers font-bold">{p.runs || 0}</span>
                          <span className="font-numbers text-white/30">{p.balls || 0}</span>
                          <span className="font-numbers text-[10px] text-white/30 text-right">{p.fours || 0}/{p.sixes || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Inn-2 bowling for this team */}
                  {scorecard.battingTeam.squad.filter(p => (p.balls_bowled || p.ballsBowled || 0) > 0 || (p.wickets || 0) > 0).length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-[#FF003C] uppercase tracking-[0.4em]">BOWLING - INN 2</h4>
                      <div className="bg-[#121212] border border-white/5 rounded-3xl overflow-hidden">
                        <div className="grid grid-cols-5 p-4 border-b border-white/5 text-[8px] font-black uppercase text-white/40 tracking-widest">
                          <span className="col-span-2">Bowler</span><span>O</span><span>R</span><span className="text-right">W/Eco</span>
                        </div>
                        {scorecard.battingTeam.squad.filter(p => (p.balls_bowled || p.ballsBowled || 0) > 0 || (p.wickets || 0) > 0).map((p, i) => {
                          const bb = p.balls_bowled || p.ballsBowled || 0;
                          const rc = p.runs_conceded || p.runsConceded || 0;
                          const overs = `${Math.floor(bb / 6)}.${bb % 6}`;
                          const econ = bb > 0 ? (rc / bb * 6).toFixed(1) : '-';
                          return (
                            <div key={i} className="grid grid-cols-5 p-4 border-b border-white/5 last:border-0 items-center">
                              <div className="col-span-2 flex flex-col pr-2">
                                <span className="text-xs font-black uppercase truncate">{p.name}</span>
                                {p.maidens > 0 && <span className="text-[8px] text-[#39FF14]/60 uppercase tracking-widest">{p.maidens}M</span>}
                              </div>
                              <span className="font-numbers font-bold text-white/80">{overs}</span>
                              <span className="font-numbers text-white/30">{rc}</span>
                              <span className="font-numbers text-[10px] text-right">
                                <span className="text-[#FF003C]">{p.wickets || 0}</span>
                                <span className="text-white/30">/{econ}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* ── Inn-1 bowling team: show their bowling (inn-1) AND batting (inn-2) ── */
                <>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-[#FF003C] uppercase tracking-[0.4em]">BOWLING - INN 1</h4>
                    <div className="bg-[#121212] border border-white/5 rounded-3xl overflow-hidden">
                      <div className="grid grid-cols-5 p-4 border-b border-white/5 text-[8px] font-black uppercase text-white/40 tracking-widest">
                        <span className="col-span-2">Bowler</span><span>O</span><span>R</span><span className="text-right">W/Eco</span>
                      </div>
                      {scorecard.bowlingTeam.squad.filter(p => (p.balls_bowled || p.ballsBowled || 0) > 0 || (p.wickets || 0) > 0).map((p, i) => {
                        const bb = p.balls_bowled || p.ballsBowled || 0;
                        const rc = p.runs_conceded || p.runsConceded || 0;
                        const overs = `${Math.floor(bb / 6)}.${bb % 6}`;
                        const econ = bb > 0 ? (rc / bb * 6).toFixed(1) : '-';
                        return (
                          <div key={i} className="grid grid-cols-5 p-4 border-b border-white/5 last:border-0 items-center">
                            <div className="col-span-2 flex flex-col pr-2">
                              <span className="text-xs font-black uppercase truncate">{p.name}</span>
                              {p.maidens > 0 && <span className="text-[8px] text-[#39FF14]/60 uppercase tracking-widest">{p.maidens}M</span>}
                            </div>
                            <span className="font-numbers font-bold text-white/80">{overs}</span>
                            <span className="font-numbers text-white/30">{rc}</span>
                            <span className="font-numbers text-[10px] text-right">
                              <span className="text-[#FF003C]">{p.wickets || 0}</span>
                              <span className="text-white/30">/{econ}</span>
                            </span>
                          </div>
                        );
                      })}
                      {scorecard.bowlingTeam.squad.filter(p => (p.balls_bowled || p.ballsBowled || 0) > 0 || (p.wickets || 0) > 0).length === 0 && (
                        <div className="p-6 text-center text-[9px] text-white/20 uppercase tracking-widest">No bowling data recorded</div>
                      )}
                    </div>
                  </div>
                  {/* Inn-2 batting for this team */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-[#00F0FF] uppercase tracking-[0.4em]">BATTING - INN 2</h4>
                    <div className="bg-[#121212] border border-white/5 rounded-3xl overflow-hidden">
                      <div className="grid grid-cols-5 p-4 border-b border-white/5 text-[8px] font-black uppercase text-white/40 tracking-widest">
                        <span className="col-span-2">Athlete</span><span>R</span><span>B</span><span className="text-right">4s/6s</span>
                      </div>
                      {scorecard.bowlingTeam.squad.map((p, i) => (
                        <div key={i} className="grid grid-cols-5 p-4 border-b border-white/5 last:border-0 items-center">
                          <div className="col-span-2 flex flex-col pr-2">
                            <span className="text-xs font-black uppercase truncate">{p.name}</span>
                            <span className="text-[8px] text-white/20 italic">{getWicketDetailHistorical(p)}</span>
                          </div>
                          <span className="font-numbers font-bold">{p.runs || 0}</span>
                          <span className="font-numbers text-white/30">{p.balls || 0}</span>
                          <span className="font-numbers text-[10px] text-white/30 text-right">{p.fours || 0}/{p.sixes || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/90 backdrop-blur-xl border-t border-white/5 z-[2100]">
         <MotionButton onClick={onBack} className="w-full bg-[#00F0FF] text-black !rounded-2xl !py-6 font-black tracking-[0.5em] text-[10px]">RETURN TO ARCHIVE</MotionButton>
      </div>
    </motion.div>
  );
};

const ScTabBtn = ({ active, onClick, icon: Icon, label }) => (
  <button onClick={onClick} className={`flex-shrink-0 flex items-center space-x-2 px-6 py-4 rounded-xl text-[10px] font-black tracking-widest transition-all ${active ? 'bg-white text-black shadow-lg shadow-white/5' : 'text-white/20 hover:text-white/40'}`}>
    <Icon size={12} /><span className="uppercase truncate max-w-[100px]">{label}</span>
  </button>
);

const StatBlock = ({ label, value, sub, color }) => (
  <GlassCard className="p-5 border-l-2" style={{ borderLeftColor: color }}>
     <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">{label}</p>
     <p className="font-numbers text-4xl font-black text-white leading-none mb-1">{value}</p>
     <p className="text-[8px] font-bold text-white/40 uppercase tracking-tighter">{sub}</p>
  </GlassCard>
);

const EmptyState = ({ icon: Icon, label }: { icon: any, label: string }) => (
  <div className="flex flex-col items-center justify-center py-20 px-12 text-center bg-[#050505] border-2 border-dashed border-white/5 rounded-[40px] opacity-40">
     <Icon size={48} className="mb-6 text-white/20" />
     <p className="font-heading text-2xl uppercase tracking-[0.4em] leading-tight">{label}</p>
  </div>
);

export default Archive;
