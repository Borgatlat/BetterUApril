import { Share } from 'react-native';

/** Custom URL scheme from app.config.js — opens the installed app. */
export const APP_SCHEME = 'betteru';

/**
 * Public HTTPS host for shared links (universal links when AASA is configured on this domain).
 * Custom scheme links work immediately when the app is installed.
 */
export const WEB_SHARE_ORIGIN =
  process.env.EXPO_PUBLIC_SHARE_WEB_ORIGIN || 'https://www.betteruai.com';

const ACTIVITY_TYPES = new Set(['workout', 'mental', 'run', 'pr', 'event']);

/**
 * Builds app + web URLs for a feed activity (workout, run, mental session, etc.).
 * Uses `betteru:///activity/...` (three slashes) so URL parsers keep `/activity` in the path.
 */
export function buildActivityShareUrls(id, { type } = {}) {
  const safeId = encodeURIComponent(String(id || '').trim());
  if (!safeId) return { appLink: null, webLink: null };

  const typeParam =
    type && ACTIVITY_TYPES.has(type) ? `?type=${encodeURIComponent(type)}` : '';

  const appLink = `${APP_SCHEME}:///activity/${safeId}${typeParam}`;
  const webLink = `${WEB_SHARE_ORIGIN}/activity/${safeId}${typeParam}`;

  return { appLink, webLink };
}

/**
 * Parses shared URLs into { id, type } for navigation to /activity/[id].
 * Supports legacy /post/ paths and both app scheme formats.
 */
export function parseActivityShareLink(url) {
  if (!url || typeof url !== 'string') return null;

  const raw = url.trim();
  let type = null;

  try {
    const queryIndex = raw.indexOf('?');
    if (queryIndex !== -1) {
      const params = new URLSearchParams(raw.slice(queryIndex + 1));
      const t = params.get('type');
      if (t && ACTIVITY_TYPES.has(t)) type = t;
    }
  } catch {
    // ignore query parse errors
  }

  const patterns = [
    /betteru:\/\/\/activity\/([^/?&#]+)/i,
    /betteru:\/\/activity\/([^/?&#]+)/i,
    /\/activity\/([^/?&#]+)/i,
    /\/post\/([^/?&#]+)/i,
  ];

  for (const re of patterns) {
    const match = raw.match(re);
    if (match?.[1]) {
      return { id: decodeURIComponent(match[1]), type };
    }
  }

  return null;
}

const TYPE_LABELS = {
  workout: 'workout',
  mental: 'mental session',
  run: 'run',
  walk: 'walk',
  bike: 'bike ride',
  pr: 'personal record',
  event: 'event',
};

/** Human-readable share copy — app deep link only (no duplicate web URL). */
export function buildActivityShareMessage({ id, type, title }) {
  const { appLink } = buildActivityShareUrls(id, { type });
  if (!appLink) return null;

  const trimmedTitle = String(title || '').trim();
  const kind = TYPE_LABELS[type] || 'activity';

  const headline = trimmedTitle
    ? `${trimmedTitle} on BetterU`
    : `Shared a ${kind} on BetterU`;

  return `${headline}\n\nView in the app:\n${appLink}`;
}

/**
 * Opens the native share sheet with a single deep link to ActivityDetailScreen.
 */
export async function shareActivityLink({ id, type, title }) {
  const message = buildActivityShareMessage({ id, type, title });
  if (!message) {
    throw new Error('Missing activity id for share link');
  }

  const shareTitle = String(title || '').trim() || 'BetterU';

  return Share.share({
    message,
    title: shareTitle,
  });
}

/** Route path used by expo-router for activity detail. */
export function getActivityRoute({ id, type }) {
  const base = `/activity/${encodeURIComponent(String(id))}`;
  if (type && ACTIVITY_TYPES.has(type)) {
    return `${base}?type=${encodeURIComponent(type)}`;
  }
  return base;
}
