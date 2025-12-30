/**
 * Centralized type and category icon mappings
 * Used for displaying type and move category icons in the UI
 */

export const TYPE_ICON_MAP = {
  'normal': 'NormalIC_Big.png',
  'fire': 'FireIC_Big.png',
  'water': 'WaterIC_Big.png',
  'grass': 'GrassIC_Big.png',
  'electric': 'ElectricIC_Big.png',
  'ice': 'IceIC_Big.png',
  'fighting': 'FightingIC_Big.png',
  'poison': 'PoisonIC_Big.png',
  'ground': 'GroundIC_Big.png',
  'flying': 'FlyingIC_Big.png',
  'psychic': 'PsychicIC_Big.png',
  'bug': 'BugIC_Big.png',
  'rock': 'RockIC_Big.png',
  'ghost': 'GhostIC_Big.png',
  'dragon': 'DragonIC_Big.png',
  'dark': 'DarkIC_Big.png',
  'steel': 'SteelIC_Big.png',
  'fairy': 'FairyIC_Big.png'
};

export const CATEGORY_ICON_MAP = {
  'physical': 'PhysicalIC_BW.png',
  'special': 'SpecialIC_BW.png',
  'status': 'StatusIC_BW.png'
};

/**
 * Get the icon filename for a type
 * @param {string} type - The Pokemon type
 * @returns {string} Icon filename
 */
export function getTypeIcon(type) {
  return TYPE_ICON_MAP[type] || TYPE_ICON_MAP['normal'];
}

/**
 * Get the icon filename for a move category
 * @param {string} category - The move category (physical, special, status)
 * @returns {string} Icon filename
 */
export function getCategoryIcon(category) {
  return CATEGORY_ICON_MAP[category] || CATEGORY_ICON_MAP['status'];
}
