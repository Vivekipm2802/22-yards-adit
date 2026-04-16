/**
 * Input sanitization utilities for 22YARDS
 * Prevents XSS in contexts where React's built-in escaping isn't sufficient
 * (e.g., share text, PDF generation, URL params, Supabase data).
 */

/**
 * Strip HTML tags and dangerous characters from user input.
 * Safe for rendering in share text, PDFs, and storing in Supabase.
 */
export function sanitizeText(input: string, maxLength = 100): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')          // Strip HTML tags
    .replace(/[<>"'&]/g, '')          // Remove special chars that could be used for injection
    .replace(/javascript:/gi, '')     // Remove javascript: protocol
    .replace(/on\w+=/gi, '')          // Remove event handlers like onclick=
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitize a team name (allows letters, numbers, spaces, hyphens, underscores)
 */
export function sanitizeTeamName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .replace(/[^a-zA-Z0-9\s\-_.]/g, '')
    .trim()
    .slice(0, 50);
}

/**
 * Sanitize a player name (allows Unicode letters, spaces, dots, hyphens)
 */
export function sanitizePlayerName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  // Allow Unicode word chars (\p{L}), spaces, dots, hyphens
  return name
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'&;(){}[\]]/g, '')
    .trim()
    .slice(0, 60);
}

/**
 * Sanitize a phone number (only digits, max 15)
 */
export function sanitizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/[^\d+]/g, '').slice(0, 15);
}

/**
 * Sanitize a city name
 */
export function sanitizeCity(city: string): string {
  if (!city || typeof city !== 'string') return '';
  return city
    .replace(/[<>"'&;(){}[\]]/g, '')
    .trim()
    .slice(0, 80);
}

/**
 * Validate that a string is a plausible URL (used for YouTube stream URLs)
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
