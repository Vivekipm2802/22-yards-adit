export type PlayerID = string;
export type TeamID = string;

export interface Player {
  id: PlayerID;
  name: string;
  phone: string;
  runs: number;
  balls: number;
  fours?: number;
  sixes?: number;
  wickets: number;
  catches: number;
  run_outs: number;
  stumpings?: number;
  runs_conceded?: number;
  balls_bowled?: number;
  isRegistered?: boolean;
  isCaptain?: boolean;
  isWicketKeeper?: boolean;
  isOut?: boolean;
  isRetired?: boolean;
  wicketType?: string;
  battingStyle?: string;
  bowlingStyle?: string;
  role?: string;
}

export interface Team {
  id: TeamID;
  name: string;
  city: string;
  squad: Player[];
  logo?: string;
}

export interface BallEvent {
  ballId: string;
  overNumber: number;
  ballNumber: number;
  bowlerId: string;
  strikerId: string;
  fielderId?: string;
  runsScored: number;
  totalValue?: number;
  extras: number;
  isWicket: boolean;
  type: 'LEGAL' | 'WD' | 'NB' | 'BYE' | 'LB';
  zone?: string;
  wicketType?: string;
  innings?: number;
  teamId?: TeamID;
  teamTotalAtThisBall?: number;
  wicketsAtThisBall?: number;
}

export interface MatchState {
  matchId: string;
  status: 'CONFIG' | 'TOSS' | 'OPENERS' | 'LIVE' | 'INNINGS_BREAK' | 'SUPER_OVER' | 'COMPLETED';
  currentInnings: 1 | 2;
  toss: {
    winnerId: TeamID | null;
    decision: 'BAT' | 'BOWL' | null;
  };
  config: {
    overs: number;
    oversPerBowler: number;
    ballType: 'TENNIS' | 'LEATHER' | 'OTHER';
    matchType: 'LIMITED_OVERS' | 'BOX_TURF' | 'PAIR_CRICKET' | 'TEST' | 'THE_HUNDRED';
    pitchType: 'ROUGH' | 'CEMENT' | 'TURF' | 'ASTROTURF' | 'MATTING';
    city: string;
    ground: string;
    wagonWheel: boolean;
    dateTime?: string;
    target?: number;
    innings1Score?: number;
    innings1Wickets?: number;
    innings1Balls?: number;
    innings1Completed?: boolean; // explicit flag so reload-from-storage can't mis-interpret mid-innings state
    dlsTarget?: number; // revised target after rain delay
    reducedOvers1?: number; // reduced overs for innings 1
    reducedOvers2?: number; // reduced overs for innings 2
    isRainAffected?: boolean;
    dlsParScore?: number; // current par score during chase
    youtubeStreamUrl?: string; // YouTube stream URL
    youtubeEmbedUrl?: string; // YouTube embed URL for spectators
    rtmpUrl?: string; // RTMP URL for streaming
    streamKey?: string; // Stream key for RTMP
  };
  teams: {
    teamA: Team;
    teamB: Team;
    battingTeamId: TeamID;
    bowlingTeamId: TeamID;
  };
  liveScore: {
    runs: number;
    wickets: number;
    balls: number;
  };
  crease: {
    strikerId: PlayerID | null;
    nonStrikerId: PlayerID | null;
    bowlerId: PlayerID | null;
    previousBowlerId: PlayerID | null;
  };
  history: BallEvent[];
  superOver?: any; // SuperOverState from lib/superOver.ts — using any to avoid circular imports
}
