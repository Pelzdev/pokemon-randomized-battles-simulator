export function normalizeStat(stat) {
  if (!stat) return stat;
  const s = stat.toLowerCase();
  switch (s) {
    case 'attack':
    case 'atk':
      return 'atk';
    case 'defense':
    case 'def':
      return 'def';
    case 'special-attack':
    case 'special_attack':
    case 'spatk':
    case 'spa':
    case 'spa':
    case 'sp.a':
      return 'spA';
    case 'special-defense':
    case 'special_defense':
    case 'spdef':
    case 'spd':
      return 'spD';
    case 'speed':
    case 'spe':
      return 'spe';
    case 'accuracy':
    case 'acc':
      return 'acc';
    case 'evasion':
    case 'eva':
      return 'eva';
    default:
      return stat;
  }
}

export function displayStat(key) {
  switch (key) {
    case 'atk': return 'Attack';
    case 'def': return 'Defense';
    case 'spA': return 'Special Attack';
    case 'spD': return 'Special Defense';
    case 'spe': return 'Speed';
    case 'acc': return 'Accuracy';
    case 'eva': return 'Evasion';
    default: return key;
  }
}

export function clampStage(n) {
  if (typeof n !== 'number') return 0;
  return Math.max(-6, Math.min(6, n));
}
