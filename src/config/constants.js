/**
 * Application-wide constants
 * Centralized magic numbers and configuration values
 */

// Sprite rendering
export const SPRITE = {
  SHEET: 'sprites2.png',
  TILE_SIZE: 96,
  FIRST_GENERATION_COUNT: 151
};

// Color space thresholds
export const RECOLORING = {
  DARK_THRESHOLD: 0.03,    // Threshold for preserving pure black
  LIGHT_THRESHOLD: 0.97,   // Threshold for preserving near-white
  DARK_THRESHOLD_EXPERIMENTAL: 0.03,
  LIGHT_THRESHOLD_EXPERIMENTAL: 0.98,
  DARK_THRESHOLD_STANDARD: 0.05,
  LIGHT_THRESHOLD_STANDARD: 0.97,
  BRIGHTNESS_THRESHOLD: 0.50,
  HUE_DISTANCE_THRESHOLD: 0.22,
  HUE_DISTANCE_THRESHOLD_ALT: 0.18,
  HUE_DISTANCE_THRESHOLD_ALT2: 0.12,
  SATURATION_THRESHOLD: 0.06,
  SATURATION_THRESHOLD_ALT: 0.08,
  VALUE_THRESHOLD: 0.08,
  VALUE_THRESHOLD_ALT: 0.10,
  VALUE_THRESHOLD_EXPERIMENTAL: 0.08,
  VALUE_THRESHOLD_STANDARD: 0.10,
  VALUE_UPPER_THRESHOLD: 0.94,
  VALUE_UPPER_THRESHOLD_STANDARD: 0.92,
  CONTRAST_POWER: 0.9,
  SATURATION_WEIGHT_EXPERIMENTAL: 2.5,
  SATURATION_WEIGHT_STANDARD: 2,
  SATURATION_FACTOR: 0.5,
  HUE_FACTOR: 0.3,
  BLEND_FACTOR_OFFSET: 0.3,
  BLEND_FACTOR_THRESHOLD: 0.4,
  RAMP_SHIFT_MULTIPLIER: 1.5
};

// Battle mechanics
export const BATTLE = {
  LOW_HP_THRESHOLD: 1/3,
  DEFAULT_MAX_TURNS: 1000,
  STAT_STAGES: {
    MIN: -6,
    MAX: 6
  },
  PRESSURE_PP_COST_MULTIPLIER: 2,
  RECHARGE_MOVE_COST: 1,
  MOVE_ACCURACY_BASE: 100
};

// Generation ranges
export const GENERATION_RANGES = {
  1: { start: 1, end: 151, name: 'Generation I' },
  2: { start: 152, end: 251, name: 'Generation II' },
  3: { start: 252, end: 386, name: 'Generation III' },
  4: { start: 387, end: 493, name: 'Generation IV' },
  5: { start: 494, end: 649, name: 'Generation V' }
};

// Tournament
export const TOURNAMENT = {
  DEFAULT_SIZE: 16,
  MAX_SIZE: 64,
  VALID_SIZES: [2, 4, 8, 16, 32, 64]
};

// Pokemon level
export const POKEMON = {
  DEFAULT_LEVEL: 50,
  MIN_LEVEL: 1,
  MAX_LEVEL: 100,
  DEFAULT_STAT_RANDOMIZATION: false
};

// UI defaults
export const UI = {
  DEFAULT_OVER_600_BST: false,
  DEFAULT_RANDOM_ABILITIES: true,
  DEFAULT_ALLOW_WONDER_GUARD: false,
  DEFAULT_RANDOM_ITEMS: false,
  DEFAULT_EXPERIMENTAL_COLORS: false,
  DEFAULT_GENERATIONS: [1, 2, 3]
};

// Canvas sizing
export const CANVAS = {
  WIDTH: 96,
  HEIGHT: 96,
  BORDER: '1px solid #222',
  IMAGE_RENDERING: 'pixelated'
};

// Sprite grid rendering
export const SPRITE_GRID = {
  DEFAULT_SCALE: 2,
  DEFAULT_COLS: 25,
  DEFAULT_OFFSET: 0,
  MIN_COLS: 4,
  MAX_COLS: 64
};
