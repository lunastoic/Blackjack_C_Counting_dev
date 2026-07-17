/**
 * Luna Luxe palette — deep burgundy, near-black, warm gold, cream.
 * All screen code must use these tokens; no raw hex values in components.
 */
export const colors = {
  // Backgrounds
  background: '#120607', // near-black with a red undertone
  backgroundElevated: '#1C0A0D',
  surface: '#2A1013', // deep burgundy surface
  surfaceRaised: '#3D171C',
  feltGreen: '#1F4633', // muted felt green for table areas

  // Brand
  burgundy: '#5C1A22',
  burgundyDeep: '#3D0F14',
  gold: '#D4AF37',
  goldBright: '#F0C75E',
  goldDim: '#8C7325',

  // Text
  textPrimary: '#FAF3E3', // cream
  textSecondary: '#CBB88F',
  textMuted: '#8F8067',
  textOnGold: '#241505',

  // Training aids (Hi-Lo)
  trainingPlus: '#3DBB6E', // +1 green
  trainingMinus: '#E0524D', // −1 red
  trainingNeutral: '#9AA0A6', // 0 gray
  strategyHint: '#F5D547', // strategy yellow glow

  // Status
  success: '#3DBB6E',
  warning: '#E8A33D',
  error: '#E0524D',

  // Chips / bet accents
  chipShadow: '#00000066',

  // Overlays & borders
  overlay: '#000000B3', // 70% black scrim
  overlayLight: '#00000066',
  borderSubtle: '#4A2A22',
  borderGold: '#D4AF3766',

  // Locked / disabled
  disabled: '#5A4F44',
  lockedTint: '#00000080',
} as const;

export type ColorToken = keyof typeof colors;
