// lib/highlights.ts
// AI-powered match highlights analysis engine

import { BallEvent, MatchState } from '../types';

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
  }[];
  keyStats: { label: string; value: string }[];
}

export function generateMatchHighlights(
  history: BallEvent[],
  teams: any,
  config: any
): MatchHighlights {
  if (!history || history.length === 0) {
    return getEmptyHighlights();
  }

  const moments: HighlightMoment[] = [];
  const batsmanStats: Record<string, any> = {};
  const bowlerStats: Record<string, any> = {};
  const playerNames: Record<string, string> = {};
  const teamAPlayers: Set<string> = new Set();
  const teamBPlayers: Set<string> = new Set();

  // Build player name map
  [teams.teamA, teams.teamB].forEach((team: any) => {
    const isTeamA = team.id === 'A';
    (team.squad || []).forEach((p: any) => {
      playerNames[p.id] = p.name;
      if (isTeamA) teamAPlayers.add(p.id);
      else teamBPlayers.add(p.id);
    });
  });

  // Analyze each ball
  history.forEach((ball, ballIndex) => {
    const batsmanId = ball.strikerId;
    const bowlerId = ball.bowlerId;
    const batsmanName = playerNames[batsmanId] || 'Unknown';
    const bowlerName = playerNames[bowlerId] || 'Unknown';

    // Initialize player stats
    if (batsmanId && !batsmanStats[batsmanId]) {
      batsmanStats[batsmanId] = {
        name: batsmanName,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        dismissalBall: null,
      };
    }
    if (bowlerId && !bowlerStats[bowlerId]) {
      bowlerStats[bowlerId] = {
        name: bowlerName,
        wickets: 0,
        runs: 0,
        balls: 0,
      };
    }

    // Track batsman stats
    if (batsmanId && batsmanStats[batsmanId]) {
      batsmanStats[batsmanId].balls += 1;
      batsmanStats[batsmanId].runs += ball.runsScored;
      if (ball.runsScored === 4) batsmanStats[batsmanId].fours += 1;
      if (ball.runsScored === 6) batsmanStats[batsmanId].sixes += 1;
    }

    // Track bowler stats
    if (bowlerId && bowlerStats[bowlerId]) {
      bowlerStats[bowlerId].balls += 1;
      bowlerStats[bowlerId].runs += ball.runsScored + ball.extras;
      if (ball.isWicket) bowlerStats[bowlerId].wickets += 1;
    }

    // Identify key moments
    const score = `${ball.teamTotalAtThisBall}/${ball.wicketsAtThisBall}`;
    const over = Math.floor(ball.ballNumber / 6);
    const ballInOver = (ball.ballNumber % 6) + 1;

    // FOUR
    if (ball.runsScored === 4 && !ball.isWicket) {
      moments.push({
        type: 'FOUR',
        ballIndex,
        innings: ball.innings || 1,
        over,
        ball: ballInOver,
        description: `${batsmanName} hits a FOUR!`,
        impact: 'MEDIUM',
        batsmanName,
        bowlerName,
        score,
        timestamp: ballIndex,
      });
    }

    // SIX
    if (ball.runsScored === 6 && !ball.isWicket) {
      moments.push({
        type: 'SIX',
        ballIndex,
        innings: ball.innings || 1,
        over,
        ball: ballInOver,
        description: `${batsmanName} smashes a SIX!`,
        impact: 'HIGH',
        batsmanName,
        bowlerName,
        score,
        timestamp: ballIndex,
      });
    }

    // WICKET
    if (ball.isWicket) {
      const wicketType = ball.wicketType || 'out';
      moments.push({
        type: 'WICKET',
        ballIndex,
        innings: ball.innings || 1,
        over,
        ball: ballInOver,
        description: `${batsmanName} is ${wicketType}!`,
        impact: 'HIGH',
        batsmanName,
        bowlerName,
        score,
        timestamp: ballIndex,
      });
      if (batsmanId && batsmanStats[batsmanId]) {
        batsmanStats[batsmanId].dismissalBall = ballIndex;
      }
    }

    // MILESTONE - 50 runs
    if (
      batsmanId &&
      batsmanStats[batsmanId].runs === 50 &&
      batsmanStats[batsmanId].balls > 0
    ) {
      moments.push({
        type: 'MILESTONE',
        ballIndex,
        innings: ball.innings || 1,
        over,
        ball: ballInOver,
        description: `${batsmanName} reaches 50!`,
        impact: 'MEDIUM',
        batsmanName,
        score,
        timestamp: ballIndex,
      });
    }
  });

  // Find maiden overs
  for (let over = 0; over < 100; over++) {
    const ballsInOver = history.filter(
      (b) => Math.floor(b.ballNumber / 6) === over
    );
    if (ballsInOver.length > 0) {
      const runsInOver = ballsInOver.reduce((sum, b) => sum + b.runsScored, 0);
      if (runsInOver === 0 && ballsInOver.length >= 6) {
        const firstBall = ballsInOver[0];
        const bowlerName =
          playerNames[firstBall.bowlerId] || 'Unknown Bowler';
        moments.push({
          type: 'MAIDEN',
          ballIndex: history.indexOf(ballsInOver[5]),
          innings: firstBall.innings || 1,
          over,
          ball: 6,
          description: `${bowlerName} bowls a MAIDEN over!`,
          impact: 'MEDIUM',
          bowlerName,
          score: `${firstBall.teamTotalAtThisBall}/${firstBall.wicketsAtThisBall}`,
          timestamp: history.indexOf(ballsInOver[5]),
        });
      }
    }
  }

  // Find turning points
  const phases = identifyPhases(history, teams);
  phases.forEach((phase) => {
    const phaseStart = phase.ballRange[0];
    if (phase.momentum !== 'EVEN') {
      moments.push({
        type: 'TURNING_POINT',
        ballIndex: phaseStart,
        innings: 1,
        over: Math.floor(phaseStart / 6),
        ball: (phaseStart % 6) + 1,
        description: phase.description,
        impact: 'HIGH',
        score: history[phaseStart]
          ? `${history[phaseStart].teamTotalAtThisBall}/${history[phaseStart].wicketsAtThisBall}`
          : '',
        timestamp: phaseStart,
      });
    }
  });

  // Find big overs
  for (let over = 0; over < 100; over++) {
    const ballsInOver = history.filter(
      (b) => Math.floor(b.ballNumber / 6) === over
    );
    if (ballsInOver.length > 0) {
      const runsInOver = ballsInOver.reduce((sum, b) => sum + b.runsScored, 0);
      if (runsInOver >= 15) {
        const firstBall = ballsInOver[0];
        moments.push({
          type: 'BIG_OVER',
          ballIndex: history.indexOf(ballsInOver[Math.min(5, ballsInOver.length - 1)]),
          innings: firstBall.innings || 1,
          over,
          ball: 6,
          description: `${runsInOver} runs in over ${over + 1}!`,
          impact: 'MEDIUM',
          score: `${firstBall.teamTotalAtThisBall}/${firstBall.wicketsAtThisBall}`,
          timestamp: history.indexOf(ballsInOver[Math.min(5, ballsInOver.length - 1)]),
        });
      }
    }
  }

  // Get best players
  const bestBatsman = getBestBatsman(batsmanStats);
  const bestBowler = getBestBowler(bowlerStats);
  const bestPartnership = getBestPartnership(history, playerNames);

  // Generate narrative
  const narrative = generateNarrative(history, bestBatsman, bestBowler, phases);

  // Generate key stats
  const keyStats = generateKeyStats(history, bestBatsman, bestBowler);

  // Sort moments by ballIndex
  moments.sort((a, b) => a.ballIndex - b.ballIndex);

  return {
    moments,
    bestBatsman,
    bestBowler,
    bestPartnership,
    matchNarrative: narrative,
    phases,
    keyStats,
  };
}

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
  let best = null;
  let maxRuns = 0;

  Object.values(stats).forEach((stat: any) => {
    if (stat.runs > maxRuns && !stat.dismissalBall) {
      maxRuns = stat.runs;
      best = stat;
    }
  });

  if (!best) {
    Object.values(stats).forEach((stat: any) => {
      if (stat.runs > maxRuns) {
        maxRuns = stat.runs;
        best = stat;
      }
    });
  }

  if (!best) {
    return { name: 'N/A', runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0 };
  }

  return {
    name: best.name,
    runs: best.runs,
    balls: best.balls,
    fours: best.fours || 0,
    sixes: best.sixes || 0,
    strikeRate: best.balls > 0 ? (best.runs / best.balls) * 100 : 0,
  };
}

function getBestBowler(stats: Record<string, any>): MatchHighlights['bestBowler'] {
  let best = null;
  let maxWickets = -1;

  Object.values(stats).forEach((stat: any) => {
    if (stat.wickets > maxWickets || (stat.wickets === maxWickets && stat.wickets > 0 && stat.runs < (best?.runs || Infinity))) {
      maxWickets = stat.wickets;
      best = stat;
    }
  });

  if (!best) {
    return { name: 'N/A', wickets: 0, runs: 0, overs: '0', economy: 0 };
  }

  const overs = Math.floor(best.balls / 6);
  const ballsRemainder = best.balls % 6;
  const oversStr = ballsRemainder > 0 ? `${overs}.${ballsRemainder}` : `${overs}`;
  const economy = best.balls > 0 ? (best.runs / best.balls) * 6 : 0;

  return {
    name: best.name,
    wickets: best.wickets,
    runs: best.runs,
    overs: oversStr,
    economy,
  };
}

function getBestPartnership(
  history: BallEvent[],
  playerNames: Record<string, string>
): MatchHighlights['bestPartnership'] {
  const partnerships: Record<string, { runs: number; balls: number }> = {};

  history.forEach((ball) => {
    const pair = [ball.strikerId, ball.fielderId].filter(Boolean).sort().join('-');
    if (pair && pair !== '-') {
      if (!partnerships[pair]) partnerships[pair] = { runs: 0, balls: 0 };
      partnerships[pair].runs += ball.runsScored;
      partnerships[pair].balls += 1;
    }
  });

  let bestPair = null;
  let maxRuns = 0;

  Object.entries(partnerships).forEach(([pair, stats]) => {
    if (stats.runs > maxRuns) {
      maxRuns = stats.runs;
      bestPair = pair;
    }
  });

  if (!bestPair) {
    return { batter1: 'N/A', batter2: 'N/A', runs: 0, balls: 0 };
  }

  const [id1, id2] = bestPair.split('-');
  return {
    batter1: playerNames[id1] || 'Unknown',
    batter2: playerNames[id2] || 'Unknown',
    runs: partnerships[bestPair].runs,
    balls: partnerships[bestPair].balls,
  };
}

function identifyPhases(
  history: BallEvent[],
  teams: any
): MatchHighlights['phases'] {
  if (history.length === 0) return [];

  const phases: MatchHighlights['phases'] = [];

  // Phase 1: Powerplay (first 2 overs equivalent, or first 6 balls)
  const powPlayBalls = history.filter((b) => Math.floor(b.ballNumber / 6) < 2);
  if (powPlayBalls.length > 0) {
    const runs = powPlayBalls.reduce((sum, b) => sum + b.runsScored, 0);
    const crr = (runs / powPlayBalls.length) * 6;
    const momentum = crr > 8 ? 'TEAM_A' : crr < 4 ? 'TEAM_B' : 'EVEN';
    phases.push({
      phase: 'Powerplay',
      description: `Start with ${runs} runs in ${powPlayBalls.length} balls (CRR: ${crr.toFixed(1)})`,
      momentum,
    });
  }

  // Phase 2: Middle overs
  const middleOvers = history.filter(
    (b) => Math.floor(b.ballNumber / 6) >= 2 && Math.floor(b.ballNumber / 6) < 4
  );
  if (middleOvers.length > 0) {
    const runs = middleOvers.reduce((sum, b) => sum + b.runsScored, 0);
    const momentum = runs >= 10 ? 'TEAM_A' : runs < 5 ? 'TEAM_B' : 'EVEN';
    phases.push({
      phase: 'Middle Overs',
      description: `Building innings with ${runs} runs in ${Math.ceil(middleOvers.length / 6)} overs`,
      momentum,
    });
  }

  // Phase 3: Death overs
  const deathOvers = history.filter((b) => Math.floor(b.ballNumber / 6) >= 4);
  if (deathOvers.length > 0) {
    const runs = deathOvers.reduce((sum, b) => sum + b.runsScored, 0);
    const momentum = runs >= 20 ? 'TEAM_A' : runs < 10 ? 'TEAM_B' : 'EVEN';
    phases.push({
      phase: 'Death Overs',
      description: `Final phase with ${runs} runs in ${Math.ceil(deathOvers.length / 6)} overs`,
      momentum,
    });
  }

  return phases;
}

function generateNarrative(
  history: BallEvent[],
  bestBatsman: MatchHighlights['bestBatsman'],
  bestBowler: MatchHighlights['bestBowler'],
  phases: MatchHighlights['phases']
): string[] {
  const narrative: string[] = [];

  if (history.length === 0) {
    narrative.push('Match analysis unavailable.');
    return narrative;
  }

  const totalRuns = history.reduce((sum, b) => sum + b.runsScored, 0);
  const totalBalls = history.length;
  const totalWickets = history.filter((b) => b.isWicket).length;
  const crr = (totalRuns / totalBalls) * 6;

  // Opening narrative
  if (phases.length > 0) {
    narrative.push(
      `The match started with ${phases[0].description.toLowerCase()}. ${
        phases[0].momentum === 'TEAM_A'
          ? 'Team A set a strong tone early.'
          : 'Team B maintained disciplined bowling early on.'
      }`
    );
  }

  // Mid-match narrative
  if (phases.length > 1) {
    narrative.push(
      `During the middle phase, ${phases[1].description.toLowerCase()}. The batting side ${
        phases[1].momentum === 'TEAM_A' ? 'accelerated' : 'faced pressure'
      }.`
    );
  }

  // Best batsman narrative
  if (bestBatsman.name !== 'N/A') {
    narrative.push(
      `${bestBatsman.name} was the star performer, scoring ${bestBatsman.runs} runs off ${bestBatsman.balls} balls with ${bestBatsman.fours} fours and ${bestBatsman.sixes} sixes at a strike rate of ${bestBatsman.strikeRate.toFixed(1)}.`
    );
  }

  // Best bowler narrative
  if (bestBowler.name !== 'N/A') {
    narrative.push(
      `On the bowling front, ${bestBowler.name} was the standout performer, taking ${bestBowler.wickets} wickets while conceding ${bestBowler.runs} runs in ${bestBowler.overs} overs with an economy of ${bestBowler.economy.toFixed(2)}.`
    );
  }

  // Death overs narrative
  if (phases.length > 2) {
    narrative.push(`In the ${phases[2].phase.toLowerCase()}, ${phases[2].description.toLowerCase()}.`);
  }

  // Overall narrative
  narrative.push(
    `The match saw a total of ${totalRuns} runs in ${totalBalls} balls with ${totalWickets} wickets falling. The overall run rate was ${crr.toFixed(2)} per over.`
  );

  return narrative;
}

function generateKeyStats(
  history: BallEvent[],
  bestBatsman: MatchHighlights['bestBatsman'],
  bestBowler: MatchHighlights['bestBowler']
): MatchHighlights['keyStats'] {
  const stats: MatchHighlights['keyStats'] = [];

  if (history.length === 0) return stats;

  const totalRuns = history.reduce((sum, b) => sum + b.runsScored, 0);
  const totalWickets = history.filter((b) => b.isWicket).length;
  const totalFours = history.filter((b) => b.runsScored === 4).length;
  const totalSixes = history.filter((b) => b.runsScored === 6).length;

  stats.push({ label: 'Total Runs', value: totalRuns.toString() });
  stats.push({ label: 'Wickets Lost', value: totalWickets.toString() });
  stats.push({ label: 'Fours Hit', value: totalFours.toString() });
  stats.push({ label: 'Sixes Hit', value: totalSixes.toString() });
  stats.push({
    label: 'Run Rate',
    value: (history.length > 0 ? ((totalRuns / history.length) * 6).toFixed(2) : '0.00') + ' per over',
  });

  if (bestBatsman.name !== 'N/A') {
    stats.push({ label: 'Top Batsman', value: `${bestBatsman.name} (${bestBatsman.runs} runs)` });
  }

  if (bestBowler.name !== 'N/A') {
    stats.push({ label: 'Top Bowler', value: `${bestBowler.name} (${bestBowler.wickets} wickets)` });
  }

  return stats;
}
