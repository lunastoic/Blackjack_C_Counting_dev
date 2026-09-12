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

  // Answer meter rail (training): empty end → full end
  meterLow: '#FF3F3F',
  meterMid: '#FF9A1F',
  meterHigh: '#FFD23F',
  meterFull: '#3BE477',

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

  // Modern (arcade) look — intro panels and bevelled buttons
  arcadeFelt: '#1C5238',
  arcadeFeltDeep: '#0E3423',
  arcadeFeltEdge: '#2A6A4A',
  arcadePlaque: '#5A1F2A',
  arcadePlaqueEdge: '#7A2E3B',
  arcadeInk: '#2B1D05', // the dark outline and bottom edge of every bevel
  arcadeCream: '#F3ECD9',
  arcadeMint: '#6FD693',
  arcadeMuted: '#A8B8AC',
  arcadeInfoFill: '#0000006B', // 42% black — the description box
  arcadeInfoEdge: '#FFFFFF14',
  arcadeTileFill: '#00000052',
  // Button faces and the deeper band under each — today's action colours
  arcadeGold: '#F2C445',
  arcadeGoldDeep: '#C9971F',
  arcadeGreen: '#3E9A4E',
  arcadeGreenDeep: '#24672F',
  arcadeRed: '#C9342E',
  arcadeRedDeep: '#8A1F1B',
  arcadeOrange: '#E6862A',
  arcadeOrangeDeep: '#B05E14',
  arcadeBlue: '#3576C9',
  arcadeBlueDeep: '#214F8C',
  arcadeNeutral: '#4A3F3A',
  arcadeNeutralDeep: '#2C2421',
  arcadeInkOnLight: '#1E1607',
} as const;

export type ColorToken = keyof typeof colors;
