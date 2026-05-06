export interface AvatarDef { emoji: string; from: string; to: string; ring: string }

export const RACE_AVATARS: Record<string, AvatarDef> = {
  'Dragonborn': { emoji: '🐉', from: '#7f1d1d', to: '#3b0000', ring: '#ef4444' },
  'Dwarf':      { emoji: '⚒️', from: '#78350f', to: '#292524', ring: '#d97706' },
  'Elf':        { emoji: '🌿', from: '#14532d', to: '#052e16', ring: '#4ade80' },
  'Gnome':      { emoji: '🔮', from: '#4c1d95', to: '#1e1b4b', ring: '#a78bfa' },
  'Half-Elf':   { emoji: '🌙', from: '#164e63', to: '#0c2340', ring: '#67e8f9' },
  'Half-Orc':   { emoji: '🗡️', from: '#365314', to: '#1a2e05', ring: '#86efac' },
  'Halfling':   { emoji: '🌻', from: '#854d0e', to: '#431407', ring: '#fbbf24' },
  'Human':      { emoji: '🛡️', from: '#44403c', to: '#1c1917', ring: '#a8a29e' },
  'Tiefling':   { emoji: '😈', from: '#6b21a8', to: '#3b0764', ring: '#e879f9' },
  'Aarakocra':  { emoji: '🦅', from: '#0c4a6e', to: '#082f49', ring: '#38bdf8' },
  'Genasi':     { emoji: '💫', from: '#115e59', to: '#042f2e', ring: '#2dd4bf' },
  'Goliath':    { emoji: '🏔️', from: '#1e293b', to: '#0f172a', ring: '#94a3b8' },
};

export const MONSTER_AVATARS: Record<string, AvatarDef> = {
  'Aberration':  { emoji: '👁️', from: '#312e81', to: '#1e1b4b', ring: '#818cf8' },
  'Beast':       { emoji: '🐺', from: '#78350f', to: '#292524', ring: '#d97706' },
  'Celestial':   { emoji: '⭐', from: '#713f12', to: '#451a03', ring: '#fde68a' },
  'Construct':   { emoji: '⚙️', from: '#27272a', to: '#09090b', ring: '#71717a' },
  'Dragon':      { emoji: '🐉', from: '#7f1d1d', to: '#3b0000', ring: '#ef4444' },
  'Elemental':   { emoji: '🔥', from: '#7c2d12', to: '#431407', ring: '#fb923c' },
  'Fey':         { emoji: '🌸', from: '#831843', to: '#4a044e', ring: '#f472b6' },
  'Fiend':       { emoji: '😈', from: '#450a0a', to: '#1c0505', ring: '#dc2626' },
  'Giant':       { emoji: '🏔️', from: '#1e293b', to: '#0f172a', ring: '#94a3b8' },
  'Humanoid':    { emoji: '🧍', from: '#44403c', to: '#1c1917', ring: '#a8a29e' },
  'Monstrosity': { emoji: '🦑', from: '#581c87', to: '#1e1040', ring: '#c084fc' },
  'Ooze':        { emoji: '💚', from: '#14532d', to: '#052e16', ring: '#4ade80' },
  'Plant':       { emoji: '🌵', from: '#166534', to: '#052e16', ring: '#86efac' },
  'Undead':      { emoji: '💀', from: '#1c1917', to: '#0c0a09', ring: '#78716c' },
};

const FALLBACK: AvatarDef = { emoji: '❓', from: '#1c1917', to: '#0c0a09', ring: '#a8a29e' };

export function getRaceAvatar(race: string): AvatarDef {
  return RACE_AVATARS[race] ?? FALLBACK;
}

export function getMonsterAvatar(type: string): AvatarDef {
  return MONSTER_AVATARS[type] ?? FALLBACK;
}

export function avatarStyle(def: AvatarDef): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, ${def.from}, ${def.to})`,
    border: `2px solid ${def.ring}`,
    boxShadow: `0 0 8px ${def.ring}33`,
  };
}
