/**
 * Duckworth-Lewis-Stern (DLS) Method Implementation
 * Used to revise targets in rain-interrupted limited-overs cricket matches
 */

/**
 * Standard Edition G50 DLS Resource Percentage Table
 * Maps (overs remaining, wickets lost) to percentage of total resources
 * Values represent the proportion of resources remaining from that point onward
 */
const DLS_RESOURCE_TABLE: Record<number, Record<number, number>> = {
  50: { 0: 100.0, 1: 93.4, 2: 85.1, 3: 74.9, 4: 62.7, 5: 49.0, 6: 33.6, 7: 22.0, 8: 12.2, 9: 4.7 },
  49: { 0: 99.5, 1: 92.9, 2: 84.7, 3: 74.5, 4: 62.4, 5: 48.7, 6: 33.3, 7: 21.8, 8: 12.0, 9: 4.6 },
  48: { 0: 99.0, 1: 92.4, 2: 84.2, 3: 74.1, 4: 62.1, 5: 48.3, 6: 33.0, 7: 21.5, 8: 11.8, 9: 4.5 },
  47: { 0: 98.5, 1: 91.9, 2: 83.7, 3: 73.7, 4: 61.8, 5: 48.0, 6: 32.7, 7: 21.3, 8: 11.6, 9: 4.4 },
  46: { 0: 98.0, 1: 91.4, 2: 83.2, 3: 73.2, 4: 61.4, 5: 47.6, 6: 32.4, 7: 21.0, 8: 11.4, 9: 4.3 },
  45: { 0: 97.5, 1: 90.9, 2: 82.7, 3: 72.8, 4: 61.1, 5: 47.3, 6: 32.1, 7: 20.8, 8: 11.2, 9: 4.2 },
  44: { 0: 97.0, 1: 90.4, 2: 82.2, 3: 72.4, 4: 60.7, 5: 46.9, 6: 31.8, 7: 20.5, 8: 11.0, 9: 4.1 },
  43: { 0: 96.5, 1: 89.9, 2: 81.7, 3: 71.9, 4: 60.4, 5: 46.6, 6: 31.5, 7: 20.3, 8: 10.8, 9: 4.0 },
  42: { 0: 96.0, 1: 89.4, 2: 81.2, 3: 71.5, 4: 60.0, 5: 46.2, 6: 31.2, 7: 20.0, 8: 10.6, 9: 3.9 },
  41: { 0: 95.5, 1: 88.9, 2: 80.7, 3: 71.1, 4: 59.7, 5: 45.9, 6: 30.9, 7: 19.8, 8: 10.4, 9: 3.8 },
  40: { 0: 89.3, 1: 82.6, 2: 74.6, 3: 64.9, 4: 53.9, 5: 41.2, 6: 27.4, 7: 17.3, 8: 8.8, 9: 2.9 },
  39: { 0: 88.8, 1: 82.1, 2: 74.1, 3: 64.5, 4: 53.5, 5: 40.8, 6: 27.1, 7: 17.1, 8: 8.6, 9: 2.8 },
  38: { 0: 88.2, 1: 81.6, 2: 73.6, 3: 64.0, 4: 53.1, 5: 40.5, 6: 26.8, 7: 16.8, 8: 8.4, 9: 2.7 },
  37: { 0: 87.7, 1: 81.0, 2: 73.1, 3: 63.6, 4: 52.7, 5: 40.1, 6: 26.5, 7: 16.6, 8: 8.2, 9: 2.6 },
  36: { 0: 87.1, 1: 80.5, 2: 72.6, 3: 63.1, 4: 52.3, 5: 39.8, 6: 26.2, 7: 16.4, 8: 8.0, 9: 2.5 },
  35: { 0: 86.6, 1: 79.9, 2: 72.1, 3: 62.6, 4: 51.9, 5: 39.4, 6: 25.9, 7: 16.2, 8: 7.8, 9: 2.4 },
  34: { 0: 86.0, 1: 79.4, 2: 71.6, 3: 62.2, 4: 51.5, 5: 39.0, 6: 25.6, 7: 15.9, 8: 7.6, 9: 2.3 },
  33: { 0: 85.5, 1: 78.8, 2: 71.0, 3: 61.7, 4: 51.1, 5: 38.7, 6: 25.3, 7: 15.7, 8: 7.4, 9: 2.2 },
  32: { 0: 84.9, 1: 78.3, 2: 70.5, 3: 61.2, 4: 50.7, 5: 38.3, 6: 25.0, 7: 15.5, 8: 7.2, 9: 2.1 },
  31: { 0: 84.4, 1: 77.7, 2: 70.0, 3: 60.8, 4: 50.2, 5: 38.0, 6: 24.7, 7: 15.2, 8: 7.0, 9: 2.0 },
  30: { 0: 75.1, 1: 68.4, 2: 60.9, 3: 51.9, 4: 41.8, 5: 30.4, 6: 19.9, 7: 12.2, 8: 5.8, 9: 1.5 },
  29: { 0: 74.5, 1: 67.8, 2: 60.4, 3: 51.4, 4: 41.4, 5: 30.0, 6: 19.6, 7: 12.0, 8: 5.6, 9: 1.4 },
  28: { 0: 73.9, 1: 67.3, 2: 59.8, 3: 50.9, 4: 40.9, 5: 29.6, 6: 19.3, 7: 11.7, 8: 5.4, 9: 1.3 },
  27: { 0: 73.3, 1: 66.7, 2: 59.3, 3: 50.4, 4: 40.5, 5: 29.3, 6: 19.0, 7: 11.5, 8: 5.2, 9: 1.2 },
  26: { 0: 72.7, 1: 66.1, 2: 58.7, 3: 49.9, 4: 40.0, 5: 28.9, 6: 18.7, 7: 11.3, 8: 5.0, 9: 1.1 },
  25: { 0: 72.1, 1: 65.5, 2: 58.2, 3: 49.3, 4: 39.6, 5: 28.5, 6: 18.4, 7: 11.0, 8: 4.8, 9: 1.0 },
  24: { 0: 71.5, 1: 64.9, 2: 57.6, 3: 48.8, 4: 39.1, 5: 28.1, 6: 18.1, 7: 10.8, 8: 4.6, 9: 0.9 },
  23: { 0: 70.9, 1: 64.3, 2: 57.0, 3: 48.3, 4: 38.7, 5: 27.8, 6: 17.8, 7: 10.5, 8: 4.4, 9: 0.8 },
  22: { 0: 70.3, 1: 63.7, 2: 56.5, 3: 47.8, 4: 38.2, 5: 27.4, 6: 17.5, 7: 10.3, 8: 4.2, 9: 0.7 },
  21: { 0: 69.6, 1: 63.1, 2: 55.9, 3: 47.2, 4: 37.8, 5: 27.0, 6: 17.2, 7: 10.0, 8: 4.0, 9: 0.6 },
  20: { 0: 56.6, 1: 50.9, 2: 44.9, 3: 38.2, 4: 31.0, 5: 23.2, 6: 15.5, 7: 9.2, 8: 4.3, 9: 1.0 },
  19: { 0: 55.9, 1: 50.3, 2: 44.3, 3: 37.7, 4: 30.5, 5: 22.8, 6: 15.2, 7: 9.0, 8: 4.1, 9: 0.9 },
  18: { 0: 55.3, 1: 49.7, 2: 43.8, 3: 37.2, 4: 30.1, 5: 22.4, 6: 14.9, 7: 8.8, 8: 3.9, 9: 0.8 },
  17: { 0: 54.6, 1: 49.1, 2: 43.2, 3: 36.7, 4: 29.6, 5: 22.0, 6: 14.6, 7: 8.5, 8: 3.7, 9: 0.7 },
  16: { 0: 54.0, 1: 48.5, 2: 42.7, 3: 36.2, 4: 29.2, 5: 21.6, 6: 14.3, 7: 8.3, 8: 3.5, 9: 0.6 },
  15: { 0: 53.3, 1: 47.9, 2: 42.1, 3: 35.7, 4: 28.7, 5: 21.2, 6: 14.0, 7: 8.1, 8: 3.3, 9: 0.5 },
  14: { 0: 52.7, 1: 47.3, 2: 41.6, 3: 35.1, 4: 28.3, 5: 20.8, 6: 13.7, 7: 7.8, 8: 3.1, 9: 0.4 },
  13: { 0: 52.0, 1: 46.7, 2: 41.0, 3: 34.6, 4: 27.8, 5: 20.4, 6: 13.4, 7: 7.6, 8: 2.9, 9: 0.3 },
  12: { 0: 51.4, 1: 46.1, 2: 40.4, 3: 34.1, 4: 27.4, 5: 20.0, 6: 13.1, 7: 7.4, 8: 2.7, 9: 0.2 },
  11: { 0: 50.7, 1: 45.5, 2: 39.9, 3: 33.6, 4: 26.9, 5: 19.6, 6: 12.8, 7: 7.1, 8: 2.5, 9: 0.1 },
  10: { 0: 32.1, 1: 28.0, 2: 24.2, 3: 20.1, 4: 16.0, 5: 11.6, 6: 7.5, 7: 4.2, 8: 1.8, 9: 0.0 },
  9: { 0: 31.4, 1: 27.4, 2: 23.6, 3: 19.6, 4: 15.5, 5: 11.2, 6: 7.2, 7: 4.0, 8: 1.7, 9: 0.0 },
  8: { 0: 30.8, 1: 26.8, 2: 23.0, 3: 19.1, 4: 15.1, 5: 10.9, 6: 6.9, 7: 3.9, 8: 1.6, 9: 0.0 },
  7: { 0: 30.1, 1: 26.2, 2: 22.5, 3: 18.6, 4: 14.7, 5: 10.6, 6: 6.7, 7: 3.7, 8: 1.5, 9: 0.0 },
  6: { 0: 29.5, 1: 25.7, 2: 21.9, 3: 18.1, 4: 14.3, 5: 10.2, 6: 6.4, 7: 3.6, 8: 1.4, 9: 0.0 },
  5: { 0: 17.9, 1: 15.4, 2: 13.1, 3: 10.8, 4: 8.3, 5: 5.8, 6: 3.6, 7: 1.9, 8: 0.7, 9: 0.0 },
  4: { 0: 17.2, 1: 14.8, 2: 12.6, 3: 10.4, 4: 7.9, 5: 5.5, 6: 3.4, 7: 1.8, 8: 0.6, 9: 0.0 },
  3: { 0: 16.6, 1: 14.3, 2: 12.1, 3: 9.9, 4: 7.5, 5: 5.2, 6: 3.2, 7: 1.7, 8: 0.5, 9: 0.0 },
  2: { 0: 8.3, 1: 7.1, 2: 6.0, 3: 4.9, 4: 3.7, 5: 2.5, 6: 1.6, 7: 0.8, 8: 0.2, 9: 0.0 },
  1: { 0: 4.0, 1: 3.4, 2: 2.8, 3: 2.3, 4: 1.7, 5: 1.2, 6: 0.7, 7: 0.4, 8: 0.1, 9: 0.0 },
};

/**
 * Average score in a 50-over innings (used for calculating advantage/disadvantage)
 * This is a standard DLS parameter
 */
const G50 = 245;

/**
 * Get resource percentage for given overs remaining and wickets lost
 * Uses linear interpolation for fractional overs
 *
 * @param oversRemaining - Total overs remaining (can be fractional, e.g., 7.3)
 * @param wicketsLost - Number of wickets lost (0-9)
 * @returns Resource percentage (0-100)
 */
export function getResourcePercentage(oversRemaining: number, wicketsLost: number): number {
  // Clamp wickets to valid range
  const w = Math.max(0, Math.min(9, wicketsLost));

  // Handle edge case of no overs remaining
  if (oversRemaining <= 0) {
    return 0;
  }

  // Round overs to nearest integer for exact table lookup
  const fullOvers = Math.floor(oversRemaining);
  const fractionalPart = oversRemaining - fullOvers;

  // Get the table values
  if (fullOvers < 1) {
    // Less than 1 over remaining - use 1 over value
    return (DLS_RESOURCE_TABLE[1] || {})[w] || 0;
  }

  if (fullOvers > 50) {
    // More than 50 overs remaining - use 50 over value
    return (DLS_RESOURCE_TABLE[50] || {})[w] || 0;
  }

  // Get exact values for the full over
  const exactValue = (DLS_RESOURCE_TABLE[fullOvers] || {})[w] || 0;

  // If no fractional part or last over, return exact value
  if (fractionalPart === 0 || fullOvers === 50) {
    return exactValue;
  }

  // Linear interpolation for fractional overs
  const nextOverValue = (DLS_RESOURCE_TABLE[fullOvers + 1] || {})[w] || 0;
  const interpolated = exactValue + (nextOverValue - exactValue) * fractionalPart;

  return interpolated;
}

/**
 * Calculate revised DLS target when overs are reduced
 *
 * @param params - Object containing match parameters
 * @returns Object with revisedTarget, parScore, and method description
 */
export function calculateDLSTarget(params: {
  team1Score: number;
  team1OversAvailable: number;
  team1OversUsed: number;
  team1WicketsAtInterruption: number;
  team2OversAvailable: number;
  team2WicketsLost: number;
  team2BallsBowled: number;
  matchOvers: number;
}): { revisedTarget: number; parScore: number; method: string } {
  const {
    team1Score,
    team1OversAvailable,
    team1OversUsed,
    team1WicketsAtInterruption,
    team2OversAvailable,
    team2WicketsLost,
    team2BallsBowled,
    matchOvers,
  } = params;

  // Calculate resources used by Team 1
  // R1 = Resources at start - Resources remaining at interruption
  const resourcesAtStart = getResourcePercentage(team1OversAvailable, 0);
  const resourcesAtEnd = getResourcePercentage(team1OversAvailable - team1OversUsed, team1WicketsAtInterruption);
  const R1 = resourcesAtStart - resourcesAtEnd;

  // Calculate resources available for Team 2
  // R2 = Resources available at start of Team 2's reduced innings
  const R2 = getResourcePercentage(team2OversAvailable, 0) - getResourcePercentage(team2OversAvailable - (team2BallsBowled / 6), team2WicketsLost);

  // If resources available for Team 2 are equal to or less than Team 1's resources used
  let revisedTarget: number;
  let method = "DLS Method";

  if (R2 < R1) {
    // Scenario 1: Team 2 has fewer resources
    // Target = Team1Score × (R2/R1) + 1
    revisedTarget = Math.ceil(team1Score * (R2 / R1)) + 1;
    method = "DLS (Fewer Resources)";
  } else {
    // Scenario 2: Team 2 has more resources
    // Target = Team1Score + G50 × (R2 - R1)/100 + 1
    // Calculate G50 adjusted for actual match overs
    const adjustedG50 = G50 * (matchOvers / 50);
    revisedTarget = Math.ceil(team1Score + (adjustedG50 * (R2 - R1)) / 100) + 1;
    method = "DLS (More Resources)";
  }

  // Calculate par score (Team 1's score at this point in Team 2's innings)
  const parScore = Math.ceil(team1Score * (R2 / R1));

  return {
    revisedTarget,
    parScore,
    method,
  };
}

/**
 * Get DLS par score at any point during Team 2's innings
 * Par score represents the score Team 2 should have at any given point to be level with Team 1
 *
 * @param params - Object containing match state parameters
 * @returns Par score (the score Team 2 should have to be tied with Team 1)
 */
export function getDLSParScore(params: {
  team1Score: number;
  matchOvers: number;
  team2OversRemaining: number;
  team2WicketsLost: number;
  team2OversTotal: number;
}): number {
  const { team1Score, matchOvers, team2OversRemaining, team2WicketsLost, team2OversTotal } = params;

  // Calculate resources used by Team 1 (assumes they used all available overs or all 10 wickets)
  // For simplicity, assume Team 1 completed their innings
  const R1 = getResourcePercentage(team2OversTotal, 0) - getResourcePercentage(0, 10);

  // Calculate resources used by Team 2 so far
  const oversUsed = team2OversTotal - team2OversRemaining;
  const resourcesAtStart = getResourcePercentage(team2OversTotal, 0);
  const resourcesRemaining = getResourcePercentage(team2OversRemaining, team2WicketsLost);
  const resourcesUsedByTeam2 = resourcesAtStart - resourcesRemaining;

  // Par score = Team1Score × (R2_used / R1)
  const parScore = Math.ceil(team1Score * (resourcesUsedByTeam2 / R1));

  return parScore;
}

/**
 * Calculate Match Status for DLS scenarios
 * Returns whether Team 2 is ahead, level, or behind par
 */
export function getMatchStatus(
  team2Score: number,
  parScore: number
): { status: "ahead" | "level" | "behind"; margin: number } {
  if (team2Score > parScore) {
    return {
      status: "ahead",
      margin: team2Score - parScore,
    };
  } else if (team2Score === parScore) {
    return {
      status: "level",
      margin: 0,
    };
  } else {
    return {
      status: "behind",
      margin: parScore - team2Score,
    };
  }
}

/**
 * Get resource percentage table for a specific match format
 * Scales the standard 50-over table for different match lengths
 *
 * @param matchOvers - Total overs in the match (e.g., 20 for T20, 50 for ODI)
 * @returns Scaled resource table for the match format
 */
export function getScaledResourceTable(matchOvers: number): Record<number, Record<number, number>> {
  const scaleFactor = matchOvers / 50;
  const scaledTable: Record<number, Record<number, number>> = {};

  // Scale the overs dimension
  for (const oversStr in DLS_RESOURCE_TABLE) {
    const overs = parseInt(oversStr);
    const scaledOvers = Math.round(overs * scaleFactor);

    if (scaledOvers <= matchOvers) {
      scaledTable[scaledOvers] = { ...DLS_RESOURCE_TABLE[overs] };
    }
  }

  return scaledTable;
}

/**
 * Validate DLS calculation parameters
 * Returns an array of error messages (empty if valid)
 */
export function validateDLSParams(params: {
  team1Score: number;
  team1OversAvailable: number;
  team1OversUsed: number;
  team1WicketsAtInterruption: number;
  team2OversAvailable: number;
  team2WicketsLost: number;
  team2BallsBowled: number;
  matchOvers: number;
}): string[] {
  const errors: string[] = [];

  if (params.team1Score < 0) errors.push("Team 1 score cannot be negative");
  if (params.team1OversAvailable <= 0) errors.push("Team 1 overs available must be positive");
  if (params.team1OversUsed < 0 || params.team1OversUsed > params.team1OversAvailable) {
    errors.push("Team 1 overs used must be between 0 and overs available");
  }
  if (params.team1WicketsAtInterruption < 0 || params.team1WicketsAtInterruption > 10) {
    errors.push("Team 1 wickets at interruption must be between 0 and 10");
  }
  if (params.team2OversAvailable <= 0) errors.push("Team 2 overs available must be positive");
  if (params.team2WicketsLost < 0 || params.team2WicketsLost > 10) {
    errors.push("Team 2 wickets lost must be between 0 and 10");
  }
  if (params.team2BallsBowled < 0) errors.push("Team 2 balls bowled cannot be negative");
  if (params.matchOvers <= 0) errors.push("Match overs must be positive");

  return errors;
}
