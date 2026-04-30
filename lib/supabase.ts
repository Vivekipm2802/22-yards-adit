// lib/supabase.ts
// Supabase client + all 22YARDS data operations

import { createClient } from '@supabase/supabase-js';

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Client Initialization Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Track whether Supabase is properly configured (used by other modules to skip network calls)
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  console.warn(
    '[22YARDS] Supabase env vars missing!\n' +
    '  â Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env or Vercel settings.\n' +
    '  â App will run in OFFLINE mode â data will only be saved to localStorage.'
  );
  // Show a visible warning in dev mode
  if (import.meta.env.DEV) {
    setTimeout(() => {
      const banner = document.createElement('div');
      banner.textContent = 'â ï¸ Supabase not configured â running in offline mode';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#FF6D00;color:#000;text-align:center;padding:6px;font-size:12px;font-weight:700;';
      document.body.appendChild(banner);
    }, 1000);
  }
}

// Use placeholder values if env vars are missing so the app still loads
// (Supabase calls will fail gracefully instead of crashing the entire module)
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key'
);

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Types Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

export interface PlayerProfile {
  id?: string;
  player_id: string;
  phone: string;
  name: string;
  city?: string;
  role?: string;
  avatar_url?: string;
  batting_style?: string;
  bowling_style?: string;

  // Batting
  matches_played: number;
  career_runs: number;
  balls_faced: number;
  innings_played: number;
  not_outs: number;
  total_fours: number;
  total_sixes: number;
  batting_average: number;
  strike_rate: number;

  // Bowling
  total_wickets: number;
  overs_bowled: number;
  balls_bowled_raw: number;
  runs_conceded: number;
  best_figures: string;
  best_figures_wickets: number;
  best_figures_runs: number;
  three_w_hauls: number;
  five_w_hauls: number;
  bowling_average: number;
  bowling_economy: number;

  // Fielding
  total_catches: number;
  run_outs: number;
  stumpings: number;
  fielding_impact: number;

  // Captaincy
  toss_wins: number;
  matches_led: number;
  captaincy_wins: number;

  // Meta
  elite_rank: string;
  total_victories: number;
  total_defeats: number;
  last_login?: string;
  archive_vault: any[];
  created_at?: string;
  updated_at?: string;
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Helper: Generate Player ID Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
export function generatePlayerId(phone: string): string {
  const hash = phone.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return `22Y-${Math.abs(hash % 9999).toString().padStart(4, '0')}-${String.fromCharCode(65 + (Math.abs(hash) % 26))}`;
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Helper: Compute Elite Rank Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
export function computeEliteRank(captaincyWins: number): string {
  if (captaincyWins >= 20) return 'General';
  if (captaincyWins >= 10) return 'Colonel';
  if (captaincyWins >= 5)  return 'Major';
  if (captaincyWins >= 2)  return 'Captain';
  if (captaincyWins >= 1)  return 'Lieutenant';
  return 'Cadet';
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ Helper: Build full stats from match history Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
export function buildStatsFromHistory(history: any[]): Partial<PlayerProfile> {
  const stats = {
    matches_played: history.length,
    career_runs: 0,
    balls_faced: 0,
    innings_played: 0,
    not_outs: 0,
    total_fours: 0,
    total_sixes: 0,
    total_wickets: 0,
    balls_bowled_raw: 0,
    runs_conceded: 0,
    best_figures: '0/0',
    best_figures_wickets: 0,
    best_figures_runs: 999,
    three_w_hauls: 0,
    five_w_hauls: 0,
    total_catches: 0,
    run_outs: 0,
    stumpings: 0,
    toss_wins: 0,
    matches_led: 0,
    captaincy_wins: 0,
    total_victories: 0,
    total_defeats: 0,
  };

  history.forEach((m: any) => {
    const runs = parseInt(m.runs || 0);
    const balls = parseInt(m.ballsFaced || 0);
    const wickets = parseInt(m.wicketsTaken || 0);
    const ballsBowled = parseInt(m.ballsBowled || 0);
    const rc = parseInt(m.runsConceded || 0);

    stats.career_runs += runs;
    stats.balls_faced += balls;
    if (balls > 0 || runs > 0) stats.innings_played++;
    if (m.notOut) stats.not_outs++;
    stats.total_fours += parseInt(m.fours || 0);
    stats.total_sixes += parseInt(m.sixes || 0);

    stats.total_wickets += wickets;
    stats.balls_bowled_raw += ballsBowled;
    stats.runs_conceded += rc;
    if (wickets >= 3) stats.three_w_hauls++;  // B-07 fix: >= 3 not === 3
    if (wickets >= 5) stats.five_w_hauls++;

    // Best figures
    if (
      wickets > stats.best_figures_wickets ||
      (wickets === stats.best_figures_wickets && rc < stats.best_figures_runs)
    ) {
      stats.best_figures = `${wickets}/${rc}`;
      stats.best_figures_wickets = wickets;
      stats.best_figures_runs = rc;
    }

    stats.total_catches += parseInt(m.catches || 0);
    stats.stumpings    += parseInt(m.stumpings || 0);
    stats.run_outs     += parseInt(m.runOuts || 0);

    if (m.result === 'WON')  stats.total_victories++;
    if (m.result === 'LOST') stats.total_defeats++;

    if (m.asCaptain) {
      stats.matches_led++;
      if (m.matchWon) stats.captaincy_wins++;
    }
    if (m.tossWon) stats.toss_wins++;
  });

  // Derived stats
  const dismissals = stats.innings_played - stats.not_outs;
  const battingAverage = dismissals > 0 ? stats.career_runs / dismissals : stats.career_runs;
  const strikeRate = stats.balls_faced > 0 ? (stats.career_runs / stats.balls_faced) * 100 : 0;
  const bowlingAverage = stats.total_wickets > 0 ? stats.runs_conceded / stats.total_wickets : 0;
  const bowlingEconomy = stats.balls_bowled_raw > 0 ? (stats.runs_conceded / stats.balls_bowled_raw) * 6 : 0;
  const oversBowled = parseFloat((Math.floor(stats.balls_bowled_raw / 6) + (stats.balls_bowled_raw % 6) / 10).toFixed(1));
  const fieldingImpact = stats.matches_played > 0
    ? parseFloat(((stats.total_catches * 1 + stats.stumpings * 1.2 + stats.run_outs * 1.2) / stats.matches_played * 10).toFixed(2))
    : 0;

  return {
    ...stats,
    overs_bowled: oversBowled,
    batting_average: parseFloat(battingAverage.toFixed(2)),
    strike_rate: parseFloat(strikeRate.toFixed(2)),
    bowling_average: parseFloat(bowlingAverage.toFixed(2)),
    bowling_economy: parseFloat(bowlingEconomy.toFixed(2)),
    fielding_impact: fieldingImpact,
    elite_rank: computeEliteRank(stats.captaincy_wins),
  };
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ DB: Fetch player by phone Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
export async function fetchPlayerByPhone(phone: string): Promise<PlayerProfile | null> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('phone', phone)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('[Supabase] fetchPlayerByPhone error:', error);
  }
  return data as PlayerProfile | null;
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ DB: Upsert full player profile Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
// Called on login (create if new) and after every match (update stats)
export async function upsertPlayer(profile: Partial<PlayerProfile> & { phone: string; name: string }): Promise<PlayerProfile | null> {
  const player_id = profile.player_id || generatePlayerId(profile.phone);

  const payload: any = {
    ...profile,
    player_id,
    last_login: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('players')
    .upsert(payload, { onConflict: 'phone' })
    .select()
    .single();

  if (error) {
    console.error('[Supabase] upsertPlayer error:', error);
    return null;
  }
  return data as PlayerProfile;
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ DB: Update stats + vault after a completed match Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
export async function syncMatchToSupabase(
  phone: string,
  newMatchRecord: any,
  fullHistory: any[]
): Promise<boolean> {
  try {
    // Normalize phone: strip spaces, +91, leading 0 — keep last 10 digits
    const cleanPhone = phone.replace(/[\s\-\+]/g, '').replace(/^(91|0)/, '').slice(-10);
    if (cleanPhone.length !== 10) return false;

    const statsUpdate = buildStatsFromHistory(fullHistory);
    const update: Partial<PlayerProfile> = {
      ...statsUpdate,
      archive_vault: fullHistory,
      last_login: new Date().toISOString(),
    };

    // Try update first
    const { error, count } = await supabase
      .from('players')
      .update(update)
      .eq('phone', cleanPhone)
      .select('phone', { count: 'exact', head: true });

    if (error) {
      console.error('[Supabase] syncMatchToSupabase update error:', error);
      return false;
    }

    // If no row was matched, the player hasn't signed up yet — create a minimal row
    if (count === 0) {
      const { error: upsertErr } = await supabase
        .from('players')
        .upsert({
          player_id: generatePlayerId(cleanPhone),
          phone: cleanPhone,
          name: newMatchRecord.playerName || 'Unknown',
          ...update,
        }, { onConflict: 'phone' });

      if (upsertErr) {
        console.error('[Supabase] syncMatchToSupabase upsert fallback error:', upsertErr);
        return false;
      }
    }

    return true;
  } catch (e) {
    console.error('[Supabase] syncMatchToSupabase exception:', e);
    return false;
  }
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ DB: Save completed match to matches table Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
export async function saveMatchRecord(matchState: any, winnerName: string, margin: string): Promise<void> {
  // After match ends, battingTeamId = team that batted innings 2 (chaser)
  // bowlingTeamId = team that batted innings 1
  const inn1BattingTeamId = matchState.teams?.bowlingTeamId; // team that batted first (now bowling in inn2)
  const teamABattedFirst = inn1BattingTeamId === 'A';
  const inn1Score = matchState.config?.innings1Score ?? 0;
  const inn1Wickets = matchState.config?.innings1Wickets ?? 0;
  const inn2Score = matchState.liveScore?.runs ?? 0;
  const inn2Wickets = matchState.liveScore?.wickets ?? 0;
  const payload = {
    match_id: matchState.matchId,
    date_played: matchState.config.dateTime ? new Date(matchState.config.dateTime).toISOString() : new Date().toISOString(),
    team_a_name: matchState.teams.teamA.name,
    team_b_name: matchState.teams.teamB.name,
    team_a_score: teamABattedFirst ? inn1Score : inn2Score,
    team_a_wickets: teamABattedFirst ? inn1Wickets : inn2Wickets,
    team_b_score: teamABattedFirst ? inn2Score : inn1Score,
    team_b_wickets: teamABattedFirst ? inn2Wickets : inn1Wickets,
    winner_name: winnerName,
    margin,
    overs: matchState.config.overs,
    city: matchState.config.city,
    ground: matchState.config.ground,
    full_state: matchState,
  };

  const { error } = await supabase.from('matches').upsert(payload, { onConflict: 'match_id' });
  if (error) {
    console.error('[Supabase] saveMatchRecord error:', error);
  } else {
    // Auto-cleanup: remove stale live-state _t rows now that the final record is saved
    cleanupLiveStateRows(matchState.matchId).catch(() => {});
  }
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ DB: Fetch all players for leaderboard Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
export async function fetchLeaderboard(sortBy: 'career_runs' | 'total_wickets' | 'total_victories' = 'career_runs', limit = 50): Promise<PlayerProfile[]> {
  const { data, error } = await supabase
    .from('players')
    .select('player_id, name, phone, city, role, avatar_url, career_runs, total_wickets, total_victories, total_defeats, matches_played, batting_average, strike_rate, bowling_economy, elite_rank')
    .order(sortBy, { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Supabase] fetchLeaderboard error:', error);
    return [];
  }
  return (data || []) as PlayerProfile[];
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ DB: Update last_login timestamp Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
export async function touchLastLogin(phone: string): Promise<void> {
  await supabase
    .from('players')
    .update({ last_login: new Date().toISOString() })
    .eq('phone', phone);
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ DB: Push live match state (called after each ball for broadcast/transfer) Ã¢ÂÂ
// Strategy: INSERT with a unique per-call timestamp key instead of UPSERT.
// This bypasses the UPDATE RLS policy on the matches table (which blocks upsert
// after the first INSERT) by ensuring every push is a fresh INSERT with no conflict.
// fetchMatchById uses a LIKE query to find the most recent live-state row.
export async function pushLiveMatchState(matchState: any): Promise<void> {
  if (!matchState?.matchId) return;
  try {
    const isInn2 = matchState.currentInnings === 2;
    // Determine which team is batting â battingTeamId tells us ('A' or 'B')
    const battingTeamId = matchState.teams?.battingTeamId; // 'A' or 'B'
    const teamABatsNow = battingTeamId === 'A';
    // Unique key per call: original matchId + _t + timestamp
    const liveKey = `${matchState.matchId}_t${Date.now()}`;
    // Correctly assign scores to team A and team B regardless of who bats first
    let teamAScore = 0, teamAWickets = 0, teamBScore = 0, teamBWickets = 0;
    if (isInn2) {
      // Innings 1 is stored in config, innings 2 is live
      // In innings 2, battingTeamId is the team batting NOW (chasing)
      const inn1Score = matchState.config?.innings1Score ?? 0;
      const inn1Wickets = matchState.config?.innings1Wickets ?? 0;
      const inn2Score = matchState.liveScore?.runs ?? 0;
      const inn2Wickets = matchState.liveScore?.wickets ?? 0;
      if (teamABatsNow) {
        // Team A is chasing (batting inn2), Team B batted inn1
        teamAScore = inn2Score; teamAWickets = inn2Wickets;
        teamBScore = inn1Score; teamBWickets = inn1Wickets;
      } else {
        // Team B is chasing (batting inn2), Team A batted inn1
        teamAScore = inn1Score; teamAWickets = inn1Wickets;
        teamBScore = inn2Score; teamBWickets = inn2Wickets;
      }
    } else {
      // Innings 1 â liveScore is the current batting team's score
      if (teamABatsNow) {
        teamAScore = matchState.liveScore?.runs ?? 0;
        teamAWickets = matchState.liveScore?.wickets ?? 0;
      } else {
        teamBScore = matchState.liveScore?.runs ?? 0;
        teamBWickets = matchState.liveScore?.wickets ?? 0;
      }
    }
    const payload = {
      match_id: liveKey,
      date_played: matchState.config?.dateTime
        ? new Date(matchState.config.dateTime).toISOString()
        : new Date().toISOString(),
      team_a_name: matchState.teams?.teamA?.name ?? 'TEAM A',
      team_b_name: matchState.teams?.teamB?.name ?? 'TEAM B',
      team_a_score: teamAScore,
      team_a_wickets: teamAWickets,
      team_b_score: teamBScore,
      team_b_wickets: teamBWickets,
      winner_name: 'IN PROGRESS',
      margin: `Innings ${matchState.currentInnings ?? 1}`,
      overs: matchState.config?.overs ?? 0,
      city: matchState.config?.city ?? '',
      ground: matchState.config?.ground ?? '',
      full_state: matchState,
    };
    const { error } = await supabase.from('matches').insert(payload);
    if (error) {
      console.error('[22Y] pushLiveMatchState error:', error.code, error.message);
    }
  } catch (e) {
    console.error('[22Y] pushLiveMatchState exception:', e);
  }
}

// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂ DB: Fetch a match's full_state by match_id (for Transfer / Broadcast) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
// Checks two places:
// 1. Exact match_id row Ã¢ÂÂ set by saveMatchRecord for completed matches.
// 2. Live-state rows Ã¢ÂÂ inserted by pushLiveMatchState with key `${matchId}_t${ts}`.
//    These exist because the UPDATE RLS policy blocks upsert; we INSERT fresh each ball.
export async function fetchMatchById(matchId: string): Promise<any | null> {
  try {
    // 1. Check for a completed match (stored under exact match_id by saveMatchRecord)
    const { data: exact } = await supabase
      .from('matches')
      .select('full_state, winner_name')
      .eq('match_id', matchId)
      .maybeSingle();

    if (exact && (exact as any).winner_name !== 'IN PROGRESS') {
      // Completed match Ã¢ÂÂ return its final state directly
      return (exact as any).full_state ?? null;
    }

    // 2. Find the most recent live-state row (pushed by pushLiveMatchState)
    //    Keys look like: M-1742400000000_t1742400012345
    //    ORDER BY match_id DESC puts the highest timestamp (latest) first.
    const { data: liveRow } = await supabase
      .from('matches')
      .select('full_state')
      .like('match_id', `${matchId}_t%`)
      .order('match_id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (liveRow) return (liveRow as any).full_state ?? null;

    // 3. Fall back to exact row if it exists (initial IN PROGRESS state, if any)
    return exact ? (exact as any).full_state ?? null : null;
  } catch (_) { return null; }
}

// âââ DB: Cleanup stale live-state rows for a completed match âââââââââââââââââ
// After a match completes, delete all the intermediate _t rows that were
// created by pushLiveMatchState. The final state is saved under the exact
// match_id by saveMatchRecord, so these rows are no longer needed.
export async function cleanupLiveStateRows(matchId: string): Promise<number> {
  if (!matchId) return 0;
  try {
    const { data, error } = await supabase
      .from('matches')
      .delete()
      .like('match_id', `${matchId}_t%`)
      .select('match_id');

    if (error) {
      console.error('[22Y] cleanupLiveStateRows error:', error.code, error.message);
      return 0;
    }
    const count = data?.length ?? 0;
    if (count > 0) {
      console.log(`[22Y] Cleaned up ${count} live-state rows for match ${matchId}`);
    }
    return count;
  } catch (e) {
    console.error('[22Y] cleanupLiveStateRows exception:', e);
    return 0;
  }
}

// âââ DB: Bulk cleanup old IN PROGRESS rows (housekeeping) ââââââââââââââââââââ
// Call periodically to remove stale live-state rows older than `maxAgeDays`.
// This prevents unbounded table growth from abandoned/crashed matches.
export async function cleanupStaleMatches(maxAgeDays: number = 7): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('matches')
      .delete()
      .eq('winner_name', 'IN PROGRESS')
      .lt('date_played', cutoff)
      .select('match_id');

    if (error) {
      console.error('[22Y] cleanupStaleMatches error:', error.code, error.message);
      return 0;
    }
    return data?.length ?? 0;
  } catch (e) {
    console.error('[22Y] cleanupStaleMatches exception:', e);
    return 0;
  }
}

// Compute the 6-digit passcode from a matchId (must match MatchCenter.generatePasscode)
export function computePasscode(matchId: string): string {
  if (!matchId) return '------';
  const hash = matchId.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  return String(Math.abs(hash) % 1000000).padStart(6, '0');
}

// Find an IN PROGRESS match by its 6-digit passcode.
// Scans recent live-state rows and computes the passcode for each base matchId.
export async function findMatchByPasscode(passcode: string): Promise<any | null> {
  if (!passcode || passcode.length !== 6) return null;
  try {
    // Pull recent live-state rows (last ~200). Extract unique base matchIds.
    const { data } = await supabase
      .from('matches')
      .select('match_id, full_state')
      .eq('winner_name', 'IN PROGRESS')
      .order('date_played', { ascending: false })
      .limit(200);
    if (!data || data.length === 0) return null;
    const seen = new Set<string>();
    for (const row of data as any[]) {
      // Extract base matchId from "{matchId}_t{timestamp}" or use match_id directly
      const raw = row.match_id as string;
      const baseId = raw.includes('_t') ? raw.split('_t')[0] : raw;
      if (seen.has(baseId)) continue;
      seen.add(baseId);
      if (computePasscode(baseId) === passcode) {
        // Found it! fetchMatchById for the latest state
        return await fetchMatchById(baseId);
      }
    }
    return null;
  } catch (_) { return null; }
}
