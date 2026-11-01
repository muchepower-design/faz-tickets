// frontend/src/utils/teams.js

/**
 * Decide how to render a team name given its info and the opposing team's info.
 *
 * Rules:
 *   - National team            → show its country name (falls back to team name)
 *   - Club vs club, same country → show club name only
 *   - Club vs club, different countries → show "Club (Country)"
 *   - Club vs national, or unknown      → show club name only
 *
 * `fallback` is used when the info object is missing (e.g. legacy API response).
 */
export function displayTeam(info, otherInfo, fallback = 'TBD') {
  if (!info) return fallback;

  // National team — show the country name
  if (info.type === 'national') {
    return info.country_name || info.name || fallback;
  }

  // Club (or unknown type) — only add country if the opponent is a different-country club
  const bothClubs = otherInfo?.type === 'club';
  const differentCountry =
    bothClubs &&
    info.country_id &&
    otherInfo.country_id &&
    info.country_id !== otherInfo.country_id;

  if (differentCountry) {
    return `${info.name} (${info.country_name || '?'})`;
  }

  return info.name || fallback;
}

/**
 * Convenience: returns { home, away } display strings from a match object.
 * Works with both the rich (`*_team_info`) and legacy (`home_team` string) shapes.
 */
export function matchTeamLabels(match) {
  if (!match) return { home: 'TBD', away: 'TBD' };
  return {
    home: displayTeam(match.home_team_info, match.away_team_info, match.home_team),
    away: displayTeam(match.away_team_info, match.home_team_info, match.away_team),
  };
}