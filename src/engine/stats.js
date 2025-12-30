import { getAbilityStatMultiplier } from "./abilities.js";

export function calculateStats(baseStats, level, ability = null) {
  const stats = {
    hp: Math.floor(((2 * baseStats.hp * level) / 100) + level + 10),
    atk: Math.floor(((2 * baseStats.atk * level) / 100) + 5),
    def: Math.floor(((2 * baseStats.def * level) / 100) + 5),
    spA: Math.floor(((2 * baseStats.spA * level) / 100) + 5),
    spD: Math.floor(((2 * baseStats.spD * level) / 100) + 5),
    spe: Math.floor(((2 * baseStats.spe * level) / 100) + 5),
  };
  
  // Apply ability stat multipliers (Huge Power / Pure Power)
  if (ability) {
    stats.atk = Math.floor(stats.atk * getAbilityStatMultiplier({ ability }, 'atk'));
    stats.def = Math.floor(stats.def * getAbilityStatMultiplier({ ability }, 'def'));
    stats.spA = Math.floor(stats.spA * getAbilityStatMultiplier({ ability }, 'spA'));
    stats.spD = Math.floor(stats.spD * getAbilityStatMultiplier({ ability }, 'spD'));
    stats.spe = Math.floor(stats.spe * getAbilityStatMultiplier({ ability }, 'spe'));
  }
  
  return stats;
}
