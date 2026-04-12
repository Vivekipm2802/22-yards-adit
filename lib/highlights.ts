// lib/highlights.ts
// Match highlights analysis engine — produces moments, narrative, stats, and phases

import { BallEvent } from '../types';

export interface HighlightMoment {
  type: 'FOUR' | 'SIX' | 'WICKET' | 'MILESTONE' | 'TURNING_POINT' | 'BIG_OVER' | 'MAIDEN' | 'PARTNERSHIP';
  ballIndex: number;
  innings: number;
  over: number;
  ball: number;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  batsmanName?: string;
  bowlerName?: string;
  score?: string;
  clipBlob?: Blob;
  timestamp?: number;
}

export interface MatchHighlights {
  moments: HighlightMoment[];
  bestBatsman: {
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    strikeRate: number;
  };
  bestBowler: {
    name: string;
    wickets: number;
    runs: number;
    overs: string;
    economy: number;
  };
  bestPartnership: {
    batter1: string;
    batter2: string;
    runs: number;
    balls: number;
  };
  matchNarrative: string[];
  phases: {
    phase: string;
    description: string;
    momentum: 'TEAM_A' | 'TEAM_B' | 'EVEN';
    momentumLabel?: string;
    ballRange: [number, number];
  }[];
  keyStats: { label: string; value: string }[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function isLegalDelivery(b: BallEvent): boolean {
  return b.type === 'LEGAL' || b.type === 'BYE' || b.type === 'LB';
}

function buildPlayerNames(teams: any): Record<string, string> {
  const map: Record<string, string> = {};
  [teams.teamA, teams.teamB].forEach((t: any) => {
    (t?.squad || []).forEach((p: any) => { map[p.id] = p.name; });
  });
  return map;
}

function teamName(teams: any, id: string): string {
  if (id === 'A') return teams.teamA?.name || 'Team A';
  return teams.teamB?.name || 'Team B';
}

// ─── main entry ──────────────────────────────────────────────────────────────

export function generateMatchHighlights(
  history: BallEvent[],
  teams: any,
  config: any
): MatchHighlights {
  if (!history || history.length === 0) return getEmptyHighlights();

  const playerNames = buildPlayerNames(teams);
  const moments: HighlightMoment[] = [];

  // --- per-player stats (keyed by playerId) ---------------------------------
  const batStats: Record<string, { name: string; runs: number; balls: number; fours: number; sixes: number; isOut: boolean }> = {};
  const bowlStats: Record<string, { name: string; wickets: number; runsConceded: number; legalBalls: number }> = {};

  // --- per-innings tracking --------------------------------------------------
  const inn1 = history.filter(b => (b.innings || 1) === 1);
  const inn2 = history.filter(b => (b.innings || 1) === 2);

  // process each ball
  history.forEach((ball, ballIndex) => {
    const batId = ball.strikerId;
    const bowId = ball.bowlerId;
    const batName = playerNames[batId] || 'Unknown';
    const bowName = playerNames[bowId] || 'Unknown';
    const legal = isLegalDelivery(ball);

    // Batsman stats — only count legal balls
    if (batId) {
      if (!batStats[batId]) batStats[batId] = { name: batName, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false };
      if (legal) batStats[batId].balls += 1;
      // Runs: don't credit byes/leg byes to batsman
      const batRuns = (ball.type === 'BYE' || ball.type === 'LB') ? 0 : ball.runsScored;
      batStats[batId].runs += batRuns;
      if (batRuns === 4) batStats[batId].fours += 1;
      if (batRuns === 6) batStats[batId].sixes += 1;
      if (ball.isWicket) batStats[batId].isOut = true;
    }

    // Bowler stats — only legal balls count toward over tally
    if (bowId) {
      if (!bowlStats[bowId]) bowlStats[bowId] = { name: bowName, wickets: 0, runsConceded: 0, legalBalls: 0 };
      if (legal) bowlStats[bowId].legalBalls += 1;
      bowlStats[bowId].runsConceded += ball.runsScored + ball.extras;
      if (ball.isWicket) bowlStats[bowId].wickets += 1;
    }

    // --- Key moments --------------------------------------------------------
    const inn = ball.innings || 1;
    const over = Math.floor(ball.ballNumber / 6);
    const ballInOver = (ball.ballNumber % 6) + 1;
    const score = `${ball.teamTotalAtThisBall ?? '?'}/${ball.wicketsAtThisBall ?? '?'}`;

    if (ball.runsScored === 4 && !ball.isWicket && ball.type !== 'BYE' && ball.type !== 'LB') {
      moments.push({ type: 'FOUR', ballIndex, innings: inn, over, ball: ballInOver, description: `${batName} hits a FOUR!`, impact: 'MEDIUM', batsmanName: batName, bowlerName: bowName, score, timestamp: ballIndex });
    }
    if (ball.runsScored === 6 && !ball.isWicket) {
      moments.push({ type: 'SIX', ballIndex, innings: inn, over, ball: ballInOver, description: `${batName} smashes a SIX!`, impact: 'HIGH', batsmanName: batName, bowlerName: bowName, score, timestamp: ballIndex });
    }
    if (ball.isWicket) {
      const wt = ball.wicketType || 'out';
      moments.push({ type: 'WICKET', ballIndex, innings: inn, over, ball: ballInOver, description: `${batName} is ${wt}!`, impact: 'HIGH', batsmanName: batName, bowlerName: bowName, score, timestamp: ballIndex });
    }

    // Milestones — check cumulative runs at multiples of 50
    if (batId && batStats[batId]) {
      const r = batStats[batId].runs;
      if (r > 0 && r % 50 === 0 && batRuns !== 0) {
        // Only fire once per milestone — guard with ballIndex uniqueness (it's always unique)
        moments.push({ type: 'MILESTONE', ballIndex, innings: inn, over, ball: ballInOver, description: `${batName} reaches ${r}!`, impact: r >= 100 ? 'HIGH' : 'MEDIUM', batsmanName: batName, score, timestamp: ballIndex });
      }
    }

    // local helper ref
    var batRuns = (ball.type === 'BYE' || ball.type === 'LB') ? 0 : ball.runsScored;
  });

  // --- Maiden overs (per innings) -------------------------------------------
  [inn1, inn2].forEach((innBalls, innIdx) => {
    const inn = innIdx + 1;
    const maxOver = innBalls.length > 0 ? Math.floor(innBalls[innBalls.length - 1].ballNumber / 6) : 0;
    for (let ov = 0; ov <= maxOver; ov++) {
      const overBalls = innBalls.filter(b => Math.floor(b.ballNumber / 6) === ov);
      const legalCount = overBalls.filter(isLegalDelivery).length;
      if (legalCount < 6) continue;
      const runsInOver = overBalls.reduce((s, b) => s + b.runsScored + b.extras, 0);
      if (runsInOver === 0) {
        const bowName = playerNames[overBalls[0].bowlerId] || 'Unknown Bowler';
        const lastBall = overBalls[overBalls.length - 1];
        moments.push({
          type: 'MAIDEN', ballIndex: history.indexOf(lastBall), innings: inn, over: ov, ball: 6,
          description: `${bowName} bowls a MAIDEN over!`, impact: 'MEDIUM', bowlerName: bowName,
          score: `${lastBall.teamTotalAtThisBall ?? '?'}/${lastBall.wicketsAtThisBall ?? '?'}`, timestamp: history.indexOf(lastBall),
        });
      }
    }
  });

  // --- Big overs (per innings) ----------------------------------------------
  [inn1, inn2].forEach((innBalls, innIdx) => {
    const inn = innIdx + 1;
    const maxOver = innBalls.length > 0 ? Math.floor(innBalls[innBalls.length - 1].ballNumber / 6) : 0;
    for (let ov = 0; ov <= maxOver; ov++) {
      const overBalls = innBalls.filter(b => Math.floor(b.ballNumber / 6) === ov);
      if (overBalls.length === 0) continue;
      const runsInOver = overBalls.reduce((s, b) => s + b.runsScored + b.extras, 0);
      if (runsInOver >= 15) {
        const lastBall = overBalls[overBalls.length - 1];
        moments.push({
          type: 'BIG_OVER', ballIndex: history.indexOf(lastBall), innings: inn, over: ov, ball: 6,
          description: `${runsInOver} runs in over ${ov + 1} (Inn ${inn})!`, impact: 'MEDIUM',
          score: `${lastBall.teamTotalAtThisBall ?? '?'}/${lastBall.wicketsAtThisBall ?? '?'}`, timestamp: history.indexOf(lastBall),
        });
      }
    }
  });

  // --- best players ---------------------------------------------------------
  const bestBatsman = getBestBatsman(batStats);
  const bestBowler = getBestBowler(bowlStats);
  const bestPartnership = getBestPartnership(history, playerNames);

  // --- phases (per innings) -------------------------------------------------
  const battingTeam1Id = teams.battingTeamId; // who batted first may not be stored — approximate
  const teamAName = teams.teamA?.name || 'Team A';
  const teamBName = teams.teamB?.name || 'Team B';
  const phases = identifyPhases(inn1, inn2, config, teamAName, teamBName);

  // --- phases as turning points ---------------------------------------------
  phases.forEach((phase) => {
    if (phase.momentum !== 'EVEN') {
      const startIdx = phase.ballRange[0];
      const ball = history[startIdx];
      if (ball) {
        moments.push({
          type: 'TURNING_POINT', ballIndex: startIdx, innings: ball.innings || 1,
          over: Math.floor(ball.ballNumber / 6), ball: (ball.ballNumber % 6) + 1,
          description: phase.description, impact: 'HIGH',
          score: `${ball.teamTotalAtThisBall ?? '?'}/${ball.wicketsAtThisBall ?? '?'}`, timestamp: startIdx,
        });
      }
    }
  });

  // --- narrative & stats ----------------------------------------------------
  const narrative = generateNarrative(inn1, inn2, bestBatsman, bestBowler, phases, teamAName, teamBName, config);
  const keyStats = generateKeyStats(inn1, inn2, bestBatsman, bestBowler, teamAName, teamBName);

  moments.sort((a, b) => a.ballIndex - b.ballIndex);

  return { moments, bestBatsman, bestBowler, bestPartnership, matchNarrative: narrative, phases, keyStats };
}

// ─── sub-functions ───────────────────────────────────────────────────────────

function getEmptyHighlights(): MatchHighlights {
  return {
    moments: [],
    bestBatsman: { name: 'N/A', runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0 },
    bestBowler: { name: 'N/A', wickets: 0, runs: 0, overs: '0', economy: 0 },
    bestPartnership: { batter1: 'N/A', batter2: 'N/A', runs: 0, balls: 0 },
    matchNarrative: ['No match data available.'],
    phases: [],
    keyStats: [],
  };
}

function getBestBatsman(stats: Record<string, any>): MatchHighlights['bestBatsman'] {
  // Simply pick the batsman with the most runs
  let best: any = null;
  Object.values(stats).forEach((s: any) => {
    if (!best || s.runs > best.runs || (s.runs === best.runs && s.balls < best.balls)) {
      best = s;
    }
  });
  if (!best) return { name: 'N/A', runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0 };
  return {
    name: best.name, runs: best.runs, balls: best.balls,
    fours: best.fours || 0, sixes: best.sixes || 0,
    strikeRate: best.balls > 0 ? (best.runs / best.balls) * 100 : 0,
  };
}

function getBestBowler(stats: Record<string, any>): MatchHighlights['bestBowler'] {
  let best: any = null;
  Object.values(stats).forEach((s: any) => {
    if (!best || s.wickets > best.wickets || (s.wickets === best.wickets && s.wickets > 0 && s.runsConceded < best.runsConceded)) {
      best = s;
    }
  });
  if (!best) return { name: 'N/A', wickets: 0, runs: 0, overs: '0', economy: 0 };
  const overs = Math.floor(best.legalBalls / 6);
  const rem = best.legalBalls % 6;
  const oversStr = rem > 0 ? `${overs}.${rem}` : `${overs}`;
  const economy = best.legalBalls > 0 ? (best.runsConceded / best.legalBalls) * 6 : 0;
  return { name: best.name, wickets: best.wickets, runs: best.runsConceded, overs: oversStr, economy };
}

function getBestPartnership(history: BallEvent[], playerNames: Record<string, string>): MatchHighlights['bestPartnership'] {
  // Track partnerships by following wickets within each innings
  let bestRuns = 0;
  let bestPair: [string, string] = ['N/A', 'N/A'];
  let bestBalls = 0;

  [1, 2].forEach(inn => {
    const innBalls = history.filter(b => (b.innings || 1) === inn);
    let partRuns = 0;
    let partBalls = 0;
    let currentStriker = '';
    // We don't have non-striker on BallEvent, so track partnership as runs between wickets for a striker
    innBalls.forEach((b, idx) => {
      if (b.strikerId !== currentStriker) {
        // striker changed — could be new partnership or just rotation
        currentStriker = b.strikerId;
      }
      partRuns += b.runsScored + b.extras;
      if (isLegalDelivery(b)) partBalls += 1;
      if (b.isWicket) {
        if (partRuns > bestRuns) {
          bestRuns = partRuns;
          bestBalls = partBalls;
          bestPair = [playerNames[b.strikerId] || 'Unknown', 'Partnership'];
        }
        partRuns = 0;
        partBalls = 0;
      }
    });
    // trailing partnership
    if (partRuns > bestRuns && innBalls.length > 0) {
      bestRuns = partRuns;
      bestBalls = partBalls;
      bestPair = [playerNames[innBalls[innBalls.length - 1].strikerId] || 'Unknown', 'Partnership'];
    }
  });

  return { batter1: bestPair[0], batter2: bestPair[1], runs: bestRuns, balls: bestBalls };
}

function identifyPhases(
  inn1: BallEvent[],
  inn2: BallEvent[],
  config: any,
  teamAName: string,
  teamBName: string,
): MatchHighlights['phases'] {
  const phases: MatchHighlights['phases'] = [];
  const matchOvers = config?.overs || 20;

  // Helper: analyze a single innings
  const analyzeInnings = (balls: BallEvent[], innLabel: string, battingTeamName: string, bowlingTeamName: string) => {
    if (balls.length === 0) return;
    const totalLegal = balls.filter(isLegalDelivery).length;
    const totalOvers = Math.ceil(totalLegal / 6);

    // Powerplay: first ~30% of overs (min 1)
    const ppOvers = Math.max(1, Math.floor(matchOvers * 0.3));
    const ppBalls = balls.filter(b => Math.floor(b.ballNumber / 6) < ppOvers);
    if (ppBalls.length > 0) {
      const runs = ppBalls.reduce((s, b) => s + b.runsScored + b.extras, 0);
      const legal = ppBalls.filter(isLegalDelivery).length;
      const crr = legal > 0 ? (runs / legal) * 6 : 0;
      const momentum = crr > 8 ? 'TEAM_A' : crr < 4 ? 'TEAM_B' : 'EVEN';
      phases.push({
        phase: `${innLabel} Powerplay`,
        description: `${runs} runs in ${Math.ceil(legal / 6)} overs (CRR: ${crr.toFixed(1)})`,
        momentum,
        momentumLabel: momentum === 'TEAM_A' ? battingTeamName : momentum === 'TEAM_B' ? bowlingTeamName : 'Even',
        ballRange: [0, ppBalls.length - 1],
      });
    }

    // Middle: ~30-70% of overs
    const midStart = ppOvers;
    const midEnd = Math.floor(matchOvers * 0.7);
    const midBalls = balls.filter(b => {
      const ov = Math.floor(b.ballNumber / 6);
      return ov >= midStart && ov < midEnd;
    });
    if (midBalls.length > 0) {
      const runs = midBalls.reduce((s, b) => s + b.runsScored + b.extras, 0);
      const legal = midBalls.filter(isLegalDelivery).length;
      const crr = legal > 0 ? (runs / legal) * 6 : 0;
      const momentum = crr > 7 ? 'TEAM_A' : crr < 4 ? 'TEAM_B' : 'EVEN';
      phases.push({
        phase: `${innLabel} Middle Overs`,
        description: `Building innings with ${runs} runs in ${Math.ceil(legal / 6)} overs (CRR: ${crr.toFixed(1)})`,
        momentum,
        momentumLabel: momentum === 'TEAM_A' ? battingTeamName : momentum === 'TEAM_B' ? bowlingTeamName : 'Even',
        ballRange: [ppBalls.length, ppBalls.length + midBalls.length - 1],
      });
    }

    // Death: last 30%
    const deathBalls = balls.filter(b => Math.floor(b.ballNumber / 6) >= midEnd);
    if (deathBalls.length > 0) {
      const runs = deathBalls.reduce((s, b) => s + b.runsScored + b.extras, 0);
      const legal = deathBalls.filter(isLegalDelivery).length;
      const crr = legal > 0 ? (runs / legal) * 6 : 0;
      const momentum = crr > 9 ? 'TEAM_A' : crr < 5 ? 'TEAM_B' : 'EVEN';
      phases.push({
        phase: `${innLabel} Death Overs`,
        description: `Final phase with ${runs} runs in ${Math.ceil(legal / 6)} overs (CRR: ${crr.toFixed(1)})`,
        momentum,
        momentumLabel: momentum === 'TEAM_A' ? battingTeamName : momentum === 'TEAM_B' ? bowlingTeamName : 'Even',
        ballRange: [ppBalls.length + midBalls.length, ppBalls.length + midBalls.length + deathBalls.length - 1],
      });
    }
  };

  analyzeInnings(inn1, '1st Inn', teamAName, teamBName);
  analyzeInnings(inn2, '2nd Inn', teamBName, teamAName);

  return phases;
}

function generateNarrative(
  inn1: BallEvent[],
  inn2: BallEvent[],
  bestBatsman: MatchHighlights['bestBatsman'],
  bestBowler: MatchHighlights['bestBowler'],
  phases: MatchHighlights['phases'],
  teamAName: string,
  teamBName: string,
  config: any,
): string[] {
  const narrative: string[] = [];

  // Innings 1 summary
  if (inn1.length > 0) {
    const runs1 = inn1.reduce((s, b) => s + b.runsScored + b.extras, 0);
    const wkts1 = inn1.filter(b => b.isWicket).length;
    const legal1 = inn1.filter(isLegalDelivery).length;
    const overs1 = `${Math.floor(legal1 / 6)}.${legal1 % 6}`;
    narrative.push(`${teamAName} posted ${runs1}/${wkts1} in ${overs1} overs.`);
  }

  // Innings 2 summary
  if (inn2.length > 0) {
    const runs2 = inn2.reduce((s, b) => s + b.runsScored + b.extras, 0);
    const wkts2 = inn2.filter(b => b.isWicket).length;
    const legal2 = inn2.filter(isLegalDelivery).length;
    const overs2 = `${Math.floor(legal2 / 6)}.${legal2 % 6}`;
    narrative.push(`In reply, ${teamBName} managed ${runs2}/${wkts2} in ${overs2} overs.`);
  }

  // Best performers
  if (bestBatsman.name !== 'N/A') {
    narrative.push(
      `${bestBatsman.name} was the star with the bat, scoring ${bestBatsman.runs} off ${bestBatsman.balls} balls (${bestBatsman.fours} fours, ${bestBatsman.sixes} sixes) at a strike rate of ${bestBatsman.strikeRate.toFixed(1)}.`
    );
  }
  if (bestBowler.name !== 'N/A') {
    narrative.push(
      `${bestBowler.name} led the bowling, taking ${bestBowler.wickets} wickets for ${bestBowler.runs} runs in ${bestBowler.overs} overs (economy ${bestBowler.economy.toFixed(2)}).`
    );
  }

  // Overall
  const totalRuns = [...inn1, ...inn2].reduce((s, b) => s + b.runsScored + b.extras, 0);
  const totalWickets = [...inn1, ...inn2].filter(b => b.isWicket).length;
  const totalLegal = [...inn1, ...inn2].filter(isLegalDelivery).length;
  const crr = totalLegal > 0 ? (totalRuns / totalLegal) * 6 : 0;
  narrative.push(`The match produced ${totalRuns} runs and ${totalWickets} wickets at an overall rate of ${crr.toFixed(2)} per over.`);

  return narrative;
}

function generateKeyStats(
  inn1: BallEvent[],
  inn2: BallEvent[],
  bestBatsman: MatchHighlights['bestBatsman'],
  bestBowler: MatchHighlights['bestBowler'],
  teamAName: string,
  teamBName: string,
): MatchHighlights['keyStats'] {
  const stats: MatchHighlights['keyStats'] = [];
  const all = [...inn1, ...inn2];
  if (all.length === 0) return stats;

  // Per-innings scores
  if (inn1.length > 0) {
    const r = inn1.reduce((s, b) => s + b.runsScored + b.extras, 0);
    const w = inn1.filter(b => b.isWicket).length;
    stats.push({ label: `${teamAName}`, value: `${r}/${w}` });
  }
  if (inn2.length > 0) {
    const r = inn2.reduce((s, b) => s + b.runsScored + b.extras, 0);
    const w = inn2.filter(b => b.isWicket).length;
    stats.push({ label: `${teamBName}`, value: `${r}/${w}` });
  }

  const totalFours = all.filter(b => b.runsScored === 4 && b.type !== 'BYE' && b.type !== 'LB').length;
  const totalSixes = all.filter(b => b.runsScored === 6).length;
  stats.push({ label: 'Fours Hit', value: totalFours.toString() });
  stats.push({ label: 'Sixes Hit', value: totalSixes.toString() });

  const totalLegal = all.filter(isLegalDelivery).length;
  const totalRuns = all.reduce((s, b) => s + b.runsScored + b.extras, 0);
  stats.push({ label: 'Run Rate', value: (totalLegal > 0 ? ((totalRuns / totalLegal) * 6).toFixed(2) : '0.00') + ' per over' });

  const extras = all.reduce((s, b) => s + b.extras, 0);
  stats.push({ label: 'Extras', value: extras.toString() });

  if (bestBatsman.name !== 'N/A') {
    stats.push({ label: 'Top Batsman', value: `${bestBatsman.name} (${bestBatsman.runs})` });
  }
  if (bestBowler.name !== 'N/A') {
    stats.push({ label: 'Top Bowler', value: `${bestBowler.name} (${bestBowler.wickets}w)` });
  }

  return stats;
}
