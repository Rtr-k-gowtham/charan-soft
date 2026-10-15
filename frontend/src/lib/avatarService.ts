// frontend/src/lib/avatarService.ts
import { createAvatar } from '@dicebear/core';
import { lorelei } from '@dicebear/collection';
import { Buyer } from '../types';

export type AvatarStyle = 'lorelei';

export interface AvatarConfig {
  backgroundColor?: string;
  flip?: boolean;
  radius?: number;
  [key: string]: any;
}

export interface AvatarPreset {
  id: string;
  style: AvatarStyle;
  seed: string;
  label: string;
  backgroundColor?: string;
  config?: AvatarConfig;
}

// In-memory cache to ensure near-zero latency rendering
const avatarCache = new Map<string, string>();

/**
 * Curated list of background colors (hex without '#') suitable for cartoon avatars
 */
export const AVATAR_BG_PALETTE = [
  'b6e3f4', // Soft Sky Blue
  'c0aede', // Lavender
  'd1d4f9', // Periwinkle
  'ffd5dc', // Pastel Rose
  'ffdfbf', // Peach
  'd4ede1', // Mint Green
  'fcefe8', // Warm Vanilla
  'e2e8f0', // Cool Slate
  'fef08a', // Sunlight
  'fed7aa', // Warm Apricot
];

/**
 * Curated Lorelei cartoon avatar presets providing rich visual variety across expressions,
 * hairstyles, accessories, glasses, and gender-neutral character designs.
 * Lorelei is created by Lisa Wischofsky and is licensed under CC0 1.0 Universal (Public Domain).
 */
export const LORELEI_PRESETS: AvatarPreset[] = [
  { id: 'lor-1', style: 'lorelei', seed: 'Avery', label: 'Avery (Creative)', backgroundColor: 'b6e3f4' },
  { id: 'lor-2', style: 'lorelei', seed: 'Bella', label: 'Bella (Artisan)', backgroundColor: 'ffd5dc' },
  { id: 'lor-3', style: 'lorelei', seed: 'Caleb', label: 'Caleb (Urban)', backgroundColor: 'c0aede' },
  { id: 'lor-4', style: 'lorelei', seed: 'Daphne', label: 'Daphne (Elegance)', backgroundColor: 'd4ede1' },
  { id: 'lor-5', style: 'lorelei', seed: 'Ethan', label: 'Ethan (Minimalist)', backgroundColor: 'ffdfbf' },
  { id: 'lor-6', style: 'lorelei', seed: 'Fiona', label: 'Fiona (Studio)', backgroundColor: 'd1d4f9' },
  { id: 'lor-7', style: 'lorelei', seed: 'Gavin', label: 'Gavin (Executive)', backgroundColor: 'fcefe8' },
  { id: 'lor-8', style: 'lorelei', seed: 'Harper', label: 'Harper (Vibrant)', backgroundColor: 'e2e8f0' },
  { id: 'lor-9', style: 'lorelei', seed: 'Iris', label: 'Iris (Classic)', backgroundColor: 'b6e3f4' },
  { id: 'lor-10', style: 'lorelei', seed: 'Jasper', label: 'Jasper (Craft)', backgroundColor: 'ffd5dc' },
  { id: 'lor-11', style: 'lorelei', seed: 'Keira', label: 'Keira (Dynamic)', backgroundColor: 'd4ede1' },
  { id: 'lor-12', style: 'lorelei', seed: 'Liam', label: 'Liam (Focus)', backgroundColor: 'c0aede' },
  { id: 'lor-13', style: 'lorelei', seed: 'Maya', label: 'Maya (Director)', backgroundColor: 'ffdfbf' },
  { id: 'lor-14', style: 'lorelei', seed: 'Noah', label: 'Noah (Lead)', backgroundColor: 'd1d4f9' },
  { id: 'lor-15', style: 'lorelei', seed: 'Olivia', label: 'Olivia (Designer)', backgroundColor: 'ffd5dc' },
  { id: 'lor-16', style: 'lorelei', seed: 'Parker', label: 'Parker (Specialist)', backgroundColor: 'b6e3f4' },
  { id: 'lor-17', style: 'lorelei', seed: 'Quinn', label: 'Quinn (Partner)', backgroundColor: 'fcefe8' },
  { id: 'lor-18', style: 'lorelei', seed: 'Rowan', label: 'Rowan (Merchant)', backgroundColor: 'e2e8f0' },
  { id: 'lor-19', style: 'lorelei', seed: 'Sienna', label: 'Sienna (Manager)', backgroundColor: 'd4ede1' },
  { id: 'lor-20', style: 'lorelei', seed: 'Theo', label: 'Theo (Founder)', backgroundColor: 'c0aede' },
  { id: 'lor-21', style: 'lorelei', seed: 'Uma', label: 'Uma (Supervisor)', backgroundColor: 'fef08a' },
  { id: 'lor-22', style: 'lorelei', seed: 'Victor', label: 'Victor (Producer)', backgroundColor: 'fed7aa' },
  { id: 'lor-23', style: 'lorelei', seed: 'Wren', label: 'Wren (Stylist)', backgroundColor: 'b6e3f4' },
  { id: 'lor-24', style: 'lorelei', seed: 'Zoe', label: 'Zoe (Buyer)', backgroundColor: 'ffd5dc' },
];

/**
 * License metadata for open source transparency
 */
export const AVATAR_LICENSES = {
  lorelei: {
    name: 'Lorelei',
    creator: 'Lisa Wischofsky',
    license: 'CC0 1.0 Universal (Public Domain)',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    commercialUseAllowed: true,
  },
  dicebearCore: {
    name: 'DiceBear Core',
    license: 'MIT',
    url: 'https://github.com/dicebear/dicebear/blob/main/LICENSE',
  },
};

/**
 * Generate an avatar SVG data URI directly in-browser using self-hosted DiceBear Lorelei
 */
export function generateAvatarDataUri(
  style: AvatarStyle = 'lorelei',
  seed: string,
  options?: AvatarConfig
): string {
  const safeSeed = (seed || 'buyer-default').trim();
  const bg = options?.backgroundColor ? [options.backgroundColor.replace('#', '')] : ['b6e3f4'];

  const cacheKey = `lorelei::${safeSeed}::${bg.join(',')}::${options?.flip ? '1' : '0'}`;
  const cached = avatarCache.get(cacheKey);
  if (cached) return cached;

  try {
    const avatar = createAvatar(lorelei, {
      seed: safeSeed,
      backgroundColor: bg,
      flip: options?.flip ?? false,
      radius: options?.radius ?? 0,
    });

    const dataUri = avatar.toDataUri();
    avatarCache.set(cacheKey, dataUri);
    return dataUri;
  } catch (err) {
    console.error('Failed to generate DiceBear Lorelei avatar:', err);
    // Fallback minimal safe SVG
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="#e2e8f0"><circle cx="50" cy="50" r="45" fill="#cbd5e1"/><text x="50" y="55" font-size="28" text-anchor="middle" fill="#475569">👤</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(fallbackSvg)}`;
  }
}

/**
 * Helper to parse avatar_config safely if stored as a JSON string or object
 */
export function parseAvatarConfig(config: string | Record<string, any> | undefined): AvatarConfig {
  if (!config) return {};
  if (typeof config === 'object') return config;
  try {
    return JSON.parse(config);
  } catch {
    return {};
  }
}

/**
 * Resolve the avatar for any buyer object or production order customer reference.
 * Uses deterministic fallback with Buyer Code / ID if seed is not explicitly set,
 * ensuring existing buyers without custom avatars get a stable, permanent cartoon avatar.
 */
export function getBuyerAvatarDataUri(buyer?: {
  id?: number | string;
  code?: string;
  name?: string;
  avatar_style?: string;
  avatar_seed?: string;
  avatar_config?: string | Record<string, any>;
  customer_avatar_style?: string;
  customer_avatar_seed?: string;
  customer_avatar_config?: string | Record<string, any>;
  customer_code?: string;
  customer_name?: string;
} | null): string {
  if (!buyer) {
    return generateAvatarDataUri('lorelei', 'anonymous-buyer', { backgroundColor: 'e2e8f0' });
  }

  // 1. Resolve seed deterministically
  let seed = buyer.avatar_seed || buyer.customer_avatar_seed;
  if (!seed || !seed.trim()) {
    // Deterministic fallback using unique buyer ID / Code
    const identifier = buyer.code || buyer.customer_code || buyer.id || buyer.name || buyer.customer_name || 'buyer';
    seed = `buyer-${identifier}`;
  }

  // 2. Resolve config
  const rawConfig = buyer.avatar_config || buyer.customer_avatar_config;
  const config = parseAvatarConfig(rawConfig);

  return generateAvatarDataUri('lorelei', seed, config);
}
