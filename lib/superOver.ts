/**
 * Super Over Implementation for 22YARDS Cricket Scoring App
 * Follows CricHeroes Super Over rules
 */

export interface SuperOverState {
  isActive: boolean;
  superOverNumber: number; // 1, 2, etc. (if multiple super overs needed)
  phase: 'SETUP_TEAM1' | 'BATTING_TEAM1' | 'BREAK' | 'SETUP_TEAM2' | 'BATTING_TEAM2' | 'RESULT';
  // Team 1 = team that batted 2nd in main match (bats first in SO)
  team1Id: string; // TeamID
  team2Id: string;
  team1Batsmen: string[]; // 3 player IDs
  team1Bowler: string; // player ID
  team2Batsmen: string[];
  team2Bowler: string;
  team1Score: { runs: number; wickets: number; balls: number };
  team2Score: { runs: number; wickets: number; balls: number };
  team1History: any[]; // BallEvent[]
  team2History: any[];
  currentBatting: 1 | 2; // which team is currently batting
  crease: { strikerId: string | null; nonStrikerId: string | null; bowlerId: string | null };
  result: {
    winner: string | null; // team name
    winnerId: string | null; // TeamID
    margin: string;
    method: string; // 'Super Over' or 'Boundary Count'
  } | null;
}

export interface BallEvent {
  ballNumber: number;
  runs: number;
  runsScored: number;
  type: string; // 'LEGAL', 'WIDE', 'NO_BALL', etc.
  wicket: boolean;
  wicketType?: string;
  strikerId: string;
  bowlerId: string;
  playerId?: string;
}

/**
 * Create initial super over state from a tied match
 * At end of match, teams have been swapped for innings 2, so:
 * - teams.battingTeamId = team that batted SECOND in main match (bats first in Super Over)
 * - teams.bowlingTeamId = team that batted FIRST in main match (bats second in Super Over)
 */
export function createSuperOverState(
  teams: {
    teamA: any; // { id: 'A', name: string, squad: Player[], ... }
    teamB: any;
    battingTeamId: 'A' | 'B'; // team that batted in innings 2
    bowlingTeamId: 'A' | 'B'; // team that batted in innings 1
  },
  mainMatchHistory: any[],
  superOverNumber: number = 1
): SuperOverState {
  // Get teams by ID (either 'A' or 'B')
  const battingTeam = teams[`team${teams.battingTeamId}`];
  const bowlingTeam = teams[`team${teams.bowlingTeamId}`];

  const team1Id = teams.battingTeamId; // team that batted second in main match bats first in SO
  const team2Id = teams.bowlingTeamId; // team that batted first in main match bats second in SO

  const superOverState: SuperOverState = {
    isActive: true,
    superOverNumber,
    phase: 'SETUP_TEAM1',
    // Team that batted second (battingTeamId) bats first in Super Over (Team1)
    // Team that batted first (bowlingTeamId) bats second in Super Over (Team2)
    team1Id,
    team2Id,
    team1Batsmen: [],
    team1Bowler: '',
    team2Batsmen: [],
    team2Bowler: '',
    team1Score: { runs: 0, wickets: 0, balls: 0 },
    team2Score: { runs: 0, wickets: 0, balls: 0 },
    team1History: [],
    team2History: [],
    currentBatting: 1,
    crease: {
      strikerId: null,
      nonStrikerId: null,
      bowlerId: null,
    },
    result: null,
  };

  return superOverState;
}

/**
 * Check if a super over innings should end
 * Innings ends when:
 * - 6 balls have been bowled (balls >= 6)
 * - 2 wickets have fallen (wickets >= 2)
 */
export function shouldEndSuperOverInnings(score: {
  runs: number;
  wickets: number;
  balls: number;
}): boolean {
  // Wickets >= 2 means only 1 batsman left (3 nominated, 2 out)
  if (score.wickets >= 2) {
    return true;
  }

  // 6 balls completed
  if (score.balls >= 6) {
    return true;
  }

  return false;
}

/**
 * Count boundaries from match history
 * Counts fours (runsScored === 4) and sixes (runsScored === 6)
 */
export function countBoundaries(history: any[]): {
  fours: number;
  sixes: number;
  total: number;
} {
  let fours = 0;
  let sixes = 0;

  for (const ball of history) {
    // Only count legal deliveries for boundaries
    if (ball.type === 'LEGAL' || ball.type === 'legal') {
      if (ball.runsScored === 4) {
        fours++;
      } else if (ball.runsScored === 6) {
        sixes++;
      }
    }
  }

  return {
    fours,
    sixes,
    total: fours + sixes,
  };
}

/**
 * Determine super over result after both teams have batted
 * Winner is team with higher score
 * Tiebreaker: boundary count from entire match (main + super over)
 * If still tied: Match Tied (another super over can be played)
 */
export function determineSuperOverResult(
  state: SuperOverState,
  teams: {
    teamA: any; // { id: 'A', name: string, squad: Player[], ... }
    teamB: any;
    battingTeamId?: 'A' | 'B';
    bowlingTeamId?: 'A' | 'B';
  }
): {
  winner: string;
  winnerId: string | null;
  margin: string;
  method: string;
} {
  const team1Runs = state.team1Score.runs;
  const team2Runs = state.team2Score.runs;

  // Determine team names for result
  // state.team1Id and state.team2Id are 'A' or 'B'
  const team1 = teams[`team${state.team1Id}`];
  const team2 = teams[`team${state.team2Id}`];

  const team1Name = team1?.name || `Team ${state.team1Id}`;
  const team2Name = team2?.name || `Team ${state.team2Id}`;

  // Team 1 has higher score - Team 1 wins
  if (team1Runs > team2Runs) {
    return {
      winner: team1Name,
      winnerId: state.team1Id,
      margin: `${team1Runs - team2Runs} runs`,
      method: 'Super Over',
    };
  }

  // Team 2 has higher score - Team 2 wins
  if (team2Runs > team1Runs) {
    return {
      winner: team2Name,
      winnerId: state.team2Id,
      margin: `${team2Runs - team1Runs} runs`,
      method: 'Super Over',
    };
  }

  // Super Over is tied - use boundary count tiebreaker
  // Combine both teams' histories from super over with original match history
  const team1BoundaryCount = countBoundaries(state.team1History);
  const team2BoundaryCount = countBoundaries(state.team2History);

  if (team1BoundaryCount.total > team2BoundaryCount.total) {
    return {
      winner: team1Name,
      winnerId: state.team1Id,
      margin: `${team1BoundaryCount.total} boundaries vs ${team2BoundaryCount.total}`,
      method: 'Boundary Count',
    };
  }

  if (team2BoundaryCount.total > team1BoundaryCount.total) {
    return {
      winner: team2Name,
      winnerId: state.team2Id,
      margin: `${team2BoundaryCount.total} boundaries vs ${team1BoundaryCount.total}`,
      method: 'Boundary Count',
    };
  }

  // Still tied after boundary count - another super over needed
  return {
    winner: 'Match Tied',
    winnerId: null,
    margin: 'Super Over required',
    method: 'Tied',
  };
}

/**
 * Update super over state after a ball is bowled
 * Handles score updates, wickets, and phase transitions
 */
export function updateSuperOverAfterBall(
  state: SuperOverState,
  ballEvent: BallEvent
): SuperOverState {
  const newState = { ...state };
  const currentTeamNumber = state.currentBatting;
  const score = currentTeamNumber === 1 ? newState.team1Score : newState.team2Score;
  const history = currentTeamNumber === 1 ? newState.team1History : newState.team2History;

  // Update score
  score.runs += ballEvent.runs;
  score.balls++;

  // Handle wicket
  if (ballEvent.wicket) {
    score.wickets++;
  }

  // Add to history
  history.push(ballEvent);

  // Check if innings should end
  if (shouldEndSuperOverInnings(score)) {
    // Move to next phase
    if (currentTeamNumber === 1) {
      newState.phase = 'BREAK';
      newState.currentBatting = 2;
    } else {
      newState.phase = 'RESULT';
      newState.currentBatting = 0 as any; // innings complete
    }
  }

  return newState;
}

/**
 * Transition super over to next phase
 */
export function transitionSuperOverPhase(state: SuperOverState): SuperOverState {
  const newState = { ...state };

  switch (state.phase) {
    case 'SETUP_TEAM1':
      if (state.team1Batsmen.length === 3 && state.team1Bowler) {
        newState.phase = 'BATTING_TEAM1';
      }
      break;

    case 'BATTING_TEAM1':
      newState.phase = 'BREAK';
      break;

    case 'BREAK':
      if (state.team2Batsmen.length === 3 && state.team2Bowler) {
        newState.phase = 'BATTING_TEAM2';
      } else {
        newState.phase = 'SETUP_TEAM2';
      }
      break;

    case 'SETUP_TEAM2':
      if (state.team2Batsmen.length === 3 && state.team2Bowler) {
        newState.phase = 'BATTING_TEAM2';
      }
      break;

    case 'BATTING_TEAM2':
      newState.phase = 'RESULT';
      break;

    case 'RESULT':
      // No transition from result
      break;
  }

  return newState;
}

/**
 * Set batting lineup for a super over team
 */
export function setSuperOverLineup(
  state: SuperOverState,
  teamNumber: 1 | 2,
  batsmen: string[], // 3 player IDs
  bowler: string
): SuperOverState {
  const newState = { ...state };

  if (teamNumber === 1) {
    newState.team1Batsmen = batsmen.slice(0, 3); // max 3 batsmen
    newState.team1Bowler = bowler;
  } else {
    newState.team2Batsmen = batsmen.slice(0, 3);
    newState.team2Bowler = bowler;
  }

  return newState;
}

/**
 * Get current striker and non-striker for super over
 */
export function getSuperOverCrease(
  state: SuperOverState
): { strikerId: string | null; nonStrikerId: string | null } {
  const currentTeamNumber = state.currentBatting;
  const batsmen = currentTeamNumber === 1 ? state.team1Batsmen : state.team2Batsmen;
  const history = currentTeamNumber === 1 ? state.team1History : state.team2History;

  if (batsmen.length === 0) {
    return { strikerId: null, nonStrikerId: null };
  }

  // Determine striker and non-striker based on history
  const ballsEvenNumber = history.length % 2 === 0;

  if (history.length === 0) {
    // First ball
    return {
      strikerId: batsmen[0],
      nonStrikerId: batsmen[1] || null,
    };
  }

  // Determine whose turn it is at crease
  if (ballsEvenNumber) {
    return {
      strikerId: batsmen[0],
      nonStrikerId: batsmen[1] || null,
    };
  } else {
    return {
      strikerId: batsmen[1] || batsmen[0],
      nonStrikerId: batsmen[0],
    };
  }
}

/**
 * Validate super over state completeness
 */
export function validateSuperOverState(state: SuperOverState): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!state.team1Id) {
    errors.push('Team 1 ID is missing');
  }

  if (!state.team2Id) {
    errors.push('Team 2 ID is missing');
  }

  if (state.phase !== 'SETUP_TEAM1' && state.team1Batsmen.length !== 3) {
    errors.push('Team 1 must have exactly 3 batsmen');
  }

  if (state.phase !== 'SETUP_TEAM1' && !state.team1Bowler) {
    errors.push('Team 1 must have a bowler');
  }

  if (
    (state.phase === 'BATTING_TEAM2' || state.phase === 'RESULT') &&
    state.team2Batsmen.length !== 3
  ) {
    errors.push('Team 2 must have exactly 3 batsmen');
  }

  if ((state.phase === 'BATTING_TEAM2' || state.phase === 'RESULT') && !state.team2Bowler) {
    errors.push('Team 2 must have a bowler');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
