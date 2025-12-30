// Items data for battle system
// Each item has properties that affect battle mechanics

export const items = {
  // Choice Items - boost stat but lock into one move
  'choice-band': {
    name: 'choice-band',
    effect: 'CHOICE_ATK',
    multiplier: 1.5,
    description: 'Boosts Attack by 50% but locks user into one move'
  },
  'choice-specs': {
    name: 'choice-specs',
    effect: 'CHOICE_SPA',
    multiplier: 1.5,
    description: 'Boosts Special Attack by 50% but locks user into one move'
  },
  'choice-scarf': {
    name: 'choice-scarf',
    effect: 'CHOICE_SPE',
    multiplier: 1.5,
    description: 'Boosts Speed by 50% but locks user into one move'
  },
  
  // Life Orb - boosts all attacks but causes recoil
  'life-orb': {
    name: 'life-orb',
    effect: 'LIFE_ORB',
    multiplier: 1.3,
    recoil: 0.1,
    description: 'Boosts all moves by 30% but user loses 10% max HP per attack'
  },
  
  // Leftovers - passive healing
  'leftovers': {
    name: 'leftovers',
    effect: 'LEFTOVERS',
    healPercentage: 6.25,
    description: 'Restores 1/16 of max HP at the end of each turn'
  },
  
  // Focus items - survive KO hits
  'focus-sash': {
    name: 'focus-sash',
    effect: 'FOCUS_SASH',
    description: 'If at full HP, survives a KO hit with 1 HP (consumed after use)'
  },
  'focus-band': {
    name: 'focus-band',
    effect: 'FOCUS_BAND',
    chance: 10,
    description: '10% chance to survive a KO hit with 1 HP'
  },
  
  // Berries - status cure and stat boost
  'lum-berry': {
    name: 'lum-berry',
    effect: 'LUM_BERRY',
    description: 'Cures any status condition when afflicted (consumed after use)'
  },
  'sitrus-berry': {
    name: 'sitrus-berry',
    effect: 'SITRUS_BERRY',
    healPercentage: 25,
    description: 'Restores 25% max HP when HP falls below 50% (consumed after use)'
  },
  'salac-berry': {
    name: 'salac-berry',
    effect: 'STAT_BOOST_BERRY',
    stat: 'spe',
    boost: 1,
    threshold: 25,
    description: 'Raises Speed by 1 stage when HP falls below 25% (consumed after use)'
  },
  'liechi-berry': {
    name: 'liechi-berry',
    effect: 'STAT_BOOST_BERRY',
    stat: 'atk',
    boost: 1,
    threshold: 25,
    description: 'Raises Attack by 1 stage when HP falls below 25% (consumed after use)'
  },
  'petaya-berry': {
    name: 'petaya-berry',
    effect: 'STAT_BOOST_BERRY',
    stat: 'spA',
    boost: 1,
    threshold: 25,
    description: 'Raises Special Attack by 1 stage when HP falls below 25% (consumed after use)'
  },
  
  // Type-boosting items (1.2x multiplier)
  'charcoal': {
    name: 'charcoal',
    effect: 'TYPE_BOOST',
    type: 'fire',
    multiplier: 1.2,
    description: 'Boosts Fire-type moves by 20%'
  },
  'mystic-water': {
    name: 'mystic-water',
    effect: 'TYPE_BOOST',
    type: 'water',
    multiplier: 1.2,
    description: 'Boosts Water-type moves by 20%'
  },
  'miracle-seed': {
    name: 'miracle-seed',
    effect: 'TYPE_BOOST',
    type: 'grass',
    multiplier: 1.2,
    description: 'Boosts Grass-type moves by 20%'
  },
  'magnet': {
    name: 'magnet',
    effect: 'TYPE_BOOST',
    type: 'electric',
    multiplier: 1.2,
    description: 'Boosts Electric-type moves by 20%'
  },
  'never-melt-ice': {
    name: 'never-melt-ice',
    effect: 'TYPE_BOOST',
    type: 'ice',
    multiplier: 1.2,
    description: 'Boosts Ice-type moves by 20%'
  },
  'black-belt': {
    name: 'black-belt',
    effect: 'TYPE_BOOST',
    type: 'fighting',
    multiplier: 1.2,
    description: 'Boosts Fighting-type moves by 20%'
  },
  'poison-barb': {
    name: 'poison-barb',
    effect: 'TYPE_BOOST',
    type: 'poison',
    multiplier: 1.2,
    description: 'Boosts Poison-type moves by 20%'
  },
  'soft-sand': {
    name: 'soft-sand',
    effect: 'TYPE_BOOST',
    type: 'ground',
    multiplier: 1.2,
    description: 'Boosts Ground-type moves by 20%'
  },
  'sharp-beak': {
    name: 'sharp-beak',
    effect: 'TYPE_BOOST',
    type: 'flying',
    multiplier: 1.2,
    description: 'Boosts Flying-type moves by 20%'
  },
  'twisted-spoon': {
    name: 'twisted-spoon',
    effect: 'TYPE_BOOST',
    type: 'psychic',
    multiplier: 1.2,
    description: 'Boosts Psychic-type moves by 20%'
  },
  'silver-powder': {
    name: 'silver-powder',
    effect: 'TYPE_BOOST',
    type: 'bug',
    multiplier: 1.2,
    description: 'Boosts Bug-type moves by 20%'
  },
  'hard-stone': {
    name: 'hard-stone',
    effect: 'TYPE_BOOST',
    type: 'rock',
    multiplier: 1.2,
    description: 'Boosts Rock-type moves by 20%'
  },
  'spell-tag': {
    name: 'spell-tag',
    effect: 'TYPE_BOOST',
    type: 'ghost',
    multiplier: 1.2,
    description: 'Boosts Ghost-type moves by 20%'
  },
  'dragon-fang': {
    name: 'dragon-fang',
    effect: 'TYPE_BOOST',
    type: 'dragon',
    multiplier: 1.2,
    description: 'Boosts Dragon-type moves by 20%'
  },
  'black-glasses': {
    name: 'black-glasses',
    effect: 'TYPE_BOOST',
    type: 'dark',
    multiplier: 1.2,
    description: 'Boosts Dark-type moves by 20%'
  },
  'metal-coat': {
    name: 'metal-coat',
    effect: 'TYPE_BOOST',
    type: 'steel',
    multiplier: 1.2,
    description: 'Boosts Steel-type moves by 20%'
  },
  
  // Expert Belt - super effective boost
  'expert-belt': {
    name: 'expert-belt',
    effect: 'EXPERT_BELT',
    multiplier: 1.2,
    description: 'Boosts super effective moves by 20%'
  },
  
  // Muscle Band / Wise Glasses - category boost
  'muscle-band': {
    name: 'muscle-band',
    effect: 'CATEGORY_BOOST',
    category: 'physical',
    multiplier: 1.1,
    description: 'Boosts physical moves by 10%'
  },
  'wise-glasses': {
    name: 'wise-glasses',
    effect: 'CATEGORY_BOOST',
    category: 'special',
    multiplier: 1.1,
    description: 'Boosts special moves by 10%'
  },
  
  // Assault Vest - special defense boost but prevents status moves
  'assault-vest': {
    name: 'assault-vest',
    effect: 'ASSAULT_VEST',
    multiplier: 1.5,
    description: 'Boosts Special Defense by 50% but prevents use of status moves'
  },
  
  // Rocky Helmet - contact damage
  'rocky-helmet': {
    name: 'rocky-helmet',
    effect: 'ROCKY_HELMET',
    damagePercentage: 16.67,
    description: 'Damages attacker for 1/6 max HP when hit by contact move'
  }
};

// Get item by name
export function getItem(itemName) {
  return items[itemName] || null;
}

// Check if item is consumed on use
export function isConsumableItem(itemName) {
  const consumable = ['focus-sash', 'lum-berry', 'sitrus-berry', 'salac-berry', 'liechi-berry', 'petaya-berry'];
  return consumable.includes(itemName);
}
