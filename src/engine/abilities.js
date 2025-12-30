// Ability implementations for battle system
// This file contains the logic for various Pokemon abilities

// Called when Pokemon enters battle
export function applyAbilityOnSwitchIn(pokemon, opponent, field) {
  if (!pokemon || !pokemon.ability || !opponent) return;
  
  // Intimidate - lowers opponent's Attack
  if (pokemon.ability === 'intimidate') {
    if (!checkAbilityPreventStatLoss(opponent, 'atk')) {
      if (!opponent.statStages) opponent.statStages = {};
      if (!opponent.statStages.atk) opponent.statStages.atk = 0;
      opponent.statStages.atk = Math.max(-6, opponent.statStages.atk - 1);
    }
  }
  
  // Trace - copies opponent's ability (with restrictions)
  if (pokemon.ability === 'trace' && opponent.ability) {
    const uncopyableAbilities = [
      'trace', 'wonder-guard', 'forecast', 'multitype', 'illusion', 
      'imposter', 'flower-gift', 'zen-mode'
    ];
    if (!uncopyableAbilities.includes(opponent.ability)) {
      pokemon.ability = opponent.ability;
      // Log the trace (but logging might be disabled)
    }
  }
  
  // Weather-setting abilities
  if (field) {
    if (pokemon.ability === 'drizzle') {
      field.weather = 'rain';
      field.weatherTurns = 999; // Permanent weather in Gen 3
    } else if (pokemon.ability === 'drought') {
      field.weather = 'sun';
      field.weatherTurns = 999;
    } else if (pokemon.ability === 'sand-stream') {
      field.weather = 'sandstorm';
      field.weatherTurns = 999;
    }
  }
}

// Check if ability prevents stat reduction
export function checkAbilityPreventStatLoss(pokemon, stat) {
  if (!pokemon.ability) return false;
  
  // Clear Body / White Smoke - prevents all stat reductions
  if (pokemon.ability === 'clear-body' || pokemon.ability === 'white-smoke') {
    return true;
  }
  
  // Hyper Cutter - prevents Attack reduction
  if (pokemon.ability === 'hyper-cutter' && stat === 'atk') {
    return true;
  }
  
  // Keen Eye - prevents Accuracy reduction
  if (pokemon.ability === 'keen-eye' && stat === 'acc') {
    return true;
  }
  
  return false;
}

export function applyAbilityOnDamageCalculation(attacker, defender, move, baseDamage) {
  let damage = baseDamage;
  
  // Attacker abilities that boost damage
  if (attacker.ability) {
    // Overgrow/Blaze/Torrent/Swarm - boost type moves at low HP (1/3 or less)
    const typeBoostAbilities = {
      'overgrow': 'grass',
      'blaze': 'fire',
      'torrent': 'water',
      'swarm': 'bug'
    };
    
    if (typeBoostAbilities[attacker.ability] && move.type === typeBoostAbilities[attacker.ability]) {
      if (attacker.currentHP <= Math.floor(attacker.maxHp / 3)) {
        damage = Math.floor(damage * 1.5);
      }
    }
    
    // Huge Power / Pure Power - doubles physical attack (handled in stat calculation)
    // Hustle - 1.5x physical damage (accuracy penalty handled elsewhere)
    if (attacker.ability === 'hustle' && move.category === 'physical') {
      damage = Math.floor(damage * 1.5);
    }
    
    // Guts - 1.5x physical attack when statused
    if (attacker.ability === 'guts' && attacker.status && move.category === 'physical') {
      damage = Math.floor(damage * 1.5);
    }
    
    // Technician - 1.5x damage for moves with 60 power or less
    if (attacker.ability === 'technician' && move.power && move.power <= 60) {
      damage = Math.floor(damage * 1.5);
    }
    
    // Adaptability - doubles STAB bonus (2x instead of 1.5x)
    if (attacker.ability === 'adaptability' && attacker.types.includes(move.type)) {
      damage = Math.floor(damage * 1.333); // Adds 1/3 more to existing 1.5x STAB = 2x total
    }
    
    // Sheer Force - 1.3x damage if move has secondary effects (and removes them)
    if (attacker.ability === 'sheer-force' && move.effects && move.effects.length > 0) {
      damage = Math.floor(damage * 1.3);
    }
  }
  
  // Defender abilities that reduce damage
  if (defender.ability) {
    // Thick Fat - halves fire and ice damage
    if (defender.ability === 'thick-fat' && (move.type === 'fire' || move.type === 'ice')) {
      damage = Math.floor(damage / 2);
    }
    
    // Marvel Scale - 1.5x defense when statused
    if (defender.ability === 'marvel-scale' && defender.status && move.category === 'physical') {
      damage = Math.floor(damage / 1.5);
    }
  }
  
  return damage;
}

export function checkAbilityImmunity(attacker, defender, move) {
  if (!defender || !defender.ability) return false;
  
  // Levitate - immune to ground moves
  if (defender.ability === 'levitate' && move.type === 'ground') {
    return true;
  }
  
  // Water Absorb - immune to water moves, heals instead
  if (defender.ability === 'water-absorb' && move.type === 'water') {
    defender.currentHP = Math.min(defender.maxHp, defender.currentHP + Math.floor(defender.maxHp / 4));
    return true;
  }
  
  // Volt Absorb - immune to electric moves, heals instead
  if (defender.ability === 'volt-absorb' && move.type === 'electric') {
    defender.currentHP = Math.min(defender.maxHp, defender.currentHP + Math.floor(defender.maxHp / 4));
    return true;
  }
  
  // Flash Fire - immune to fire moves, boosts fire moves
  if (defender.ability === 'flash-fire' && move.type === 'fire') {
    defender.flashFireActivated = true;
    return true;
  }
  
  // Wonder Guard - only super-effective moves hit
  if (defender.ability === 'wonder-guard') {
    // Calculate type effectiveness
    const typeChart = {
      normal: { rock: 0.5, ghost: 0, steel: 0.5 },
      fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
      water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
      electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
      grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
      ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
      fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2 },
      poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
      ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
      flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
      psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
      bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5 },
      rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
      ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5, steel: 0.5 },
      dragon: { dragon: 2, steel: 0.5 },
      dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, steel: 0.5 },
      steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5 }
    };
    
    let effectiveness = 1;
    for (const defType of defender.types) {
      effectiveness *= (typeChart[move.type]?.[defType] ?? 1);
    }
    
    if (effectiveness <= 1) {
      return true; // Immune if not super effective
    }
  }
  
  return false;
}

export function checkAbilityStatusImmunity(pokemon, status) {
  if (!pokemon.ability) return false;
  
  // Immunity - immune to poison
  if (pokemon.ability === 'immunity' && (status === 'poison' || status === 'toxic')) {
    return true;
  }
  
  // Insomnia / Vital Spirit - immune to sleep
  if ((pokemon.ability === 'insomnia' || pokemon.ability === 'vital-spirit') && status === 'sleep') {
    return true;
  }
  
  // Limber - immune to paralysis
  if (pokemon.ability === 'limber' && status === 'paralysis') {
    return true;
  }
  
  // Magma Armor - immune to freeze
  if (pokemon.ability === 'magma-armor' && status === 'freeze') {
    return true;
  }
  
  // Water Veil - immune to burn
  if (pokemon.ability === 'water-veil' && status === 'burn') {
    return true;
  }
  
  return false;
}

// Called after Pokemon takes damage from a contact move
export function applyAbilityOnContact(attacker, defender) {
  if (!defender.ability) return;
  
  // Static - 30% chance to paralyze on contact
  if (defender.ability === 'static' && !attacker.status) {
    if (Math.random() < 0.3) {
      attacker.status = 'paralysis';
      return 'static';
    }
  }
  
  // Flame Body - 30% chance to burn on contact
  if (defender.ability === 'flame-body' && !attacker.status) {
    if (Math.random() < 0.3) {
      attacker.status = 'burn';
      return 'flame-body';
    }
  }
  
  // Poison Point - 30% chance to poison on contact
  if (defender.ability === 'poison-point' && !attacker.status) {
    if (Math.random() < 0.3) {
      attacker.status = 'poison';
      return 'poison-point';
    }
  }
  
  // Rough Skin - deals 1/16 max HP damage on contact
  if (defender.ability === 'rough-skin') {
    const damage = Math.floor(attacker.maxHp / 16);
    attacker.currentHP = Math.max(0, attacker.currentHP - damage);
    return 'rough-skin';
  }
  
  // Effect Spore - 10% each for poison, paralysis, or sleep
  if (defender.ability === 'effect-spore' && !attacker.status) {
    const roll = Math.random();
    if (roll < 0.1) {
      attacker.status = 'poison';
      return 'effect-spore';
    } else if (roll < 0.2) {
      attacker.status = 'paralysis';
      return 'effect-spore';
    } else if (roll < 0.3) {
      attacker.status = 'sleep';
      attacker.statusTurns = 2;
      return 'effect-spore';
    }
  }
  
  // Cute Charm - 30% chance to infatuate on contact (infatuation not implemented yet, skip for now)
  // TODO: Implement infatuation mechanic
  
  return null;
}

// Check if critical hits are blocked
export function checkAbilityBlocksCrit(defender) {
  if (!defender.ability) return false;
  
  // Battle Armor / Shell Armor - blocks critical hits
  return defender.ability === 'battle-armor' || defender.ability === 'shell-armor';
}

// Check if flinching is blocked
export function checkAbilityBlocksFlinch(pokemon) {
  if (!pokemon.ability) return false;
  
  // Inner Focus - blocks flinching
  return pokemon.ability === 'inner-focus';
}

// Modify speed based on abilities and weather
export function getAbilitySpeedModifier(pokemon, field) {
  if (!pokemon.ability) return 1;
  
  // Weather-based speed boosts
  if (field && field.weather) {
    // Chlorophyll - 2x speed in sun
    if (pokemon.ability === 'chlorophyll' && field.weather === 'sun') {
      return 2;
    }
    
    // Swift Swim - 2x speed in rain
    if (pokemon.ability === 'swift-swim' && field.weather === 'rain') {
      return 2;
    }
  }
  
  return 1;
}

// Modify accuracy based on abilities
export function getAbilityAccuracyModifier(attacker, defender, field) {
  let modifier = 1;
  
  // Compound Eyes - 1.3x accuracy
  if (attacker.ability === 'compound-eyes') {
    modifier *= 1.3;
  }
  
  // Sand Veil - 0.8x opponent accuracy in sandstorm
  if (defender.ability === 'sand-veil' && field?.weather === 'sandstorm') {
    modifier *= 0.8;
  }
  
  return modifier;
}

// Check if ability prevents OHKO at full HP
export function checkAbilitySturdy(pokemon, incomingDamage) {
  // Sturdy - survives OHKO from full HP with 1 HP (Gen 5+ mechanics)
  return pokemon.ability === 'sturdy' && pokemon.currentHP === pokemon.maxHp && incomingDamage >= pokemon.currentHP;
}

// Apply end-of-turn ability effects
export function applyAbilityEndOfTurn(pokemon, field) {
  if (!pokemon.ability) return;
  
  // Speed Boost - raises speed at end of turn
  if (pokemon.ability === 'speed-boost') {
    if (!pokemon.statStages) pokemon.statStages = {};
    if (!pokemon.statStages.spe) pokemon.statStages.spe = 0;
    pokemon.statStages.spe = Math.min(6, pokemon.statStages.spe + 1);
  }
  
  // Rain Dish - heals 1/16 HP in rain
  if (pokemon.ability === 'rain-dish' && field?.weather === 'rain') {
    const heal = Math.floor(pokemon.maxHp / 16);
    pokemon.currentHP = Math.min(pokemon.maxHp, pokemon.currentHP + heal);
  }
  
  // Dry Skin - heal 1/8 max HP in rain
  if (pokemon.ability === 'dry-skin' && field?.weather === 'rain') {
    const heal = Math.floor(pokemon.maxHp / 8);
    pokemon.currentHP = Math.min(pokemon.maxHp, pokemon.currentHP + heal);
  }
  
  // Ice Body - heal 1/16 max HP in hail
  if (pokemon.ability === 'ice-body' && field?.weather === 'hail') {
    const heal = Math.floor(pokemon.maxHp / 16);
    pokemon.currentHP = Math.min(pokemon.maxHp, pokemon.currentHP + heal);
  }
  
  // Solar Power - lose 1/8 max HP in sun
  if (pokemon.ability === 'solar-power' && field?.weather === 'sun') {
    const damage = Math.floor(pokemon.maxHp / 8);
    pokemon.currentHP = Math.max(0, pokemon.currentHP - damage);
  }
  
  // Shed Skin - 30% chance to cure status
  if (pokemon.ability === 'shed-skin' && pokemon.status) {
    if (Math.random() < 0.3) {
      pokemon.status = null;
      pokemon.statusTurns = 0;
      pokemon.toxicCounter = 0;
    }
  }
  
  // Speed Boost - raise Speed by 1 stage at end of turn
  if (pokemon.ability === 'speed-boost') {
    if (!pokemon.statStages) pokemon.statStages = {};
    const currentStage = pokemon.statStages.spe || 0;
    if (currentStage < 6) {
      pokemon.statStages.spe = Math.min(6, currentStage + 1);
    }
  }
  
  // Moody - raise one random stat by 2 stages and lower another by 1 stage
  if (pokemon.ability === 'moody') {
    if (!pokemon.statStages) pokemon.statStages = {};
    const stats = ['atk', 'def', 'spA', 'spD', 'spe', 'acc', 'eva'];
    // Choose random stat to raise (that's not maxed)
    const raisableStats = stats.filter(s => (pokemon.statStages[s] || 0) < 6);
    if (raisableStats.length > 0) {
      const raisestat = raisableStats[Math.floor(Math.random() * raisableStats.length)];
      pokemon.statStages[raisestat] = Math.min(6, (pokemon.statStages[raisestat] || 0) + 2);
      
      // Choose random stat to lower (that's not minimized and not the raised stat)
      const lowerableStats = stats.filter(s => s !== raisestat && (pokemon.statStages[s] || 0) > -6);
      if (lowerableStats.length > 0) {
        const lowerStat = lowerableStats[Math.floor(Math.random() * lowerableStats.length)];
        pokemon.statStages[lowerStat] = Math.max(-6, (pokemon.statStages[lowerStat] || 0) - 1);
      }
    }
  }
}

export function checkAbilityMagicGuard(pokemon) {
  // Magic Guard - immune to indirect damage (weather, status, entry hazards, etc)
  return pokemon.ability === 'magic-guard';
}

export function checkAbilitySheerForce(pokemon) {
  // Sheer Force removes secondary effects from attacker's moves (for power boost)
  return pokemon.ability === 'sheer-force';
}

export function applyAbilityOnKO(attacker, defender) {
  // Moxie - raise Attack by 1 stage when KOing an opponent
  if (attacker.ability === 'moxie' && defender.currentHP <= 0) {
    if (!attacker.statStages) attacker.statStages = {};
    const currentStage = attacker.statStages.atk || 0;
    if (currentStage < 6) {
      attacker.statStages.atk = Math.min(6, currentStage + 1);
      return true; // Signal that ability activated
    }
  }
  return false;
}

// Check if ability blocks secondary effects from moves
export function checkAbilityBlocksSecondaryEffects(pokemon) {
  // Shield Dust blocks all secondary effects on self
  // Sheer Force blocks secondary effects on attacker's own moves
  return pokemon.ability === 'shield-dust';
}

export function checkAbilityRemovesSecondaryEffects(pokemon) {
  // Sheer Force removes secondary effects from attacker's moves (for power boost)
  return pokemon.ability === 'sheer-force';
}

// Check if ability increases secondary effect chance
export function getAbilityEffectChanceMultiplier(pokemon) {
  // Serene Grace - doubles effect chance
  if (pokemon.ability === 'serene-grace') {
    return 2;
  }
  return 1;
}

// Check if ability prevents recoil damage
export function checkAbilityPreventsRecoil(pokemon) {
  // Rock Head - prevents recoil damage
  return pokemon.ability === 'rock-head';
}

// Check if ability prevents confusion
export function checkAbilityPreventsConfusion(pokemon) {
  // Own Tempo - prevents confusion
  return pokemon.ability === 'own-tempo';
}

// Apply ability when pokemon switches out
export function applyAbilityOnSwitchOut(pokemon) {
  // Natural Cure - cures status on switch out
  if (pokemon.ability === 'natural-cure' && pokemon.status) {
    pokemon.status = null;
    pokemon.statusTurns = 0;
    pokemon.toxicCounter = 0;
  }
}

// Modify sleep duration based on ability
export function getAbilitySleepDurationModifier(pokemon) {
  // Early Bird - sleep passes twice as fast
  if (pokemon.ability === 'early-bird') {
    return 2;
  }
  return 1;
}

// Apply ability when status is inflicted
export function applyAbilityOnStatusInflicted(inflicter, target, status) {
  // Synchronize - reflects burn, paralysis, poison back to inflicter
  if (target.ability === 'synchronize' && !inflicter.status) {
    if (status === 'burn' || status === 'paralysis' || status === 'poison' || status === 'toxic') {
      // Check if inflicter is immune
      if (!checkAbilityStatusImmunity(inflicter, status)) {
        inflicter.status = status;
        if (status === 'toxic') {
          inflicter.toxicCounter = 1;
        }
        return 'synchronize';
      }
    }
  }
  return null;
}

// Check if ability damages leeching moves
export function checkAbilityDamagesLeech(defender) {
  // Liquid Ooze - damages leeching opponents
  return defender.ability === 'liquid-ooze';
}

// Check if ability negates weather effects
export function checkAbilityNegatesWeather(pokemon) {
  // Cloud Nine / Air Lock - negates weather effects
  return pokemon.ability === 'cloud-nine' || pokemon.ability === 'air-lock';
}

// Check if ability prevents explosion moves
export function checkAbilityPreventsExplosion(pokemon) {
  // Damp - prevents Explosion/Self-Destruct
  return pokemon.ability === 'damp';
}

// Check if ability blocks sound-based moves
export function checkAbilitySoundproof(defender, move) {
  if (defender.ability !== 'soundproof') return false;
  
  // List of sound-based moves
  const soundMoves = [
    'growl', 'roar', 'sing', 'supersonic', 'screech', 'snore', 'uproar',
    'metal-sound', 'grass-whistle', 'hyper-voice', 'perish-song', 'heal-bell'
  ];
  
  return soundMoves.includes(move.name);
}

// Modify stats based on abilities (called during stat calculation)
export function getAbilityStatMultiplier(pokemon, stat) {
  if (!pokemon.ability) return 1;
  
  // Huge Power / Pure Power - doubles Attack
  if ((pokemon.ability === 'huge-power' || pokemon.ability === 'pure-power') && stat === 'atk') {
    return 2;
  }
  
  return 1;
}

// Check if pokemon loafs this turn due to Truant
export function checkAbilityTruant(pokemon) {
  if (pokemon.ability !== 'truant') return false;
  
  // Initialize truant counter if not set
  if (pokemon.truantCounter === undefined) {
    pokemon.truantCounter = 0;
  }
  
  pokemon.truantCounter++;
  
  // Loaf on even turns
  return pokemon.truantCounter % 2 === 0;
}

// Modify evasion based on abilities
export function getAbilityEvasionModifier(pokemon, field) {
  if (!pokemon.ability) return 1;
  
  // Sand Veil - 1.25x evasion in sandstorm (implemented as 0.8x opponent accuracy)
  // Already handled in getAbilityAccuracyModifier
  
  return 1;
}

// Check if ability prevents opponent from fleeing/switching
export function checkAbilityTrapsOpponent(pokemon, opponent) {
  if (!pokemon.ability) return false;
  
  // Shadow Tag - prevents opponent from switching (unless opponent also has Shadow Tag)
  if (pokemon.ability === 'shadow-tag') {
    return opponent.ability !== 'shadow-tag';
  }
  
  // Arena Trap - prevents grounded opponents from switching
  if (pokemon.ability === 'arena-trap') {
    const isGrounded = !opponent.types.includes('flying') && 
                      opponent.ability !== 'levitate';
    return isGrounded;
  }
  
  // Magnet Pull - prevents steel-type opponents from switching
  if (pokemon.ability === 'magnet-pull') {
    return opponent.types.includes('steel');
  }
  
  return false;
}

// Lightning Rod - absorbs electric moves and raises Special Attack (Gen 4+ mechanics)
export function checkAbilityLightningRod(defender, move) {
  if (defender.ability !== 'lightning-rod') return false;
  if (move.type !== 'electric') return false;
  
  // Raise Special Attack by 1 stage
  if (!defender.statStages) defender.statStages = {};
  if (!defender.statStages.spA) defender.statStages.spA = 0;
  defender.statStages.spA = Math.min(6, defender.statStages.spA + 1);
  
  return true; // Move is absorbed
}

// Plus/Minus - increases Special Attack in doubles (not applicable in 1v1 battles)
export function getAbilityPlusMinusMultiplier(pokemon, ally) {
  // In singles, Plus/Minus have no effect
  // In doubles, would check if ally has Plus or Minus
  return 1;
}

// Forecast - changes Castform's type based on weather
export function applyAbilityForecast(pokemon, field) {
  if (pokemon.ability !== 'forecast') return;
  if (!pokemon.name.toLowerCase().includes('castform')) return;
  
  // Change type based on weather
  if (field?.weather) {
    if (field.weather === 'rain') {
      pokemon.types = ['water'];
    } else if (field.weather === 'sun') {
      pokemon.types = ['fire'];
    } else if (field.weather === 'hail') {
      pokemon.types = ['ice'];
    }
  } else {
    // Revert to normal type
    pokemon.types = ['normal'];
  }
}

// Hustle accuracy penalty
export function getAbilityHustleAccuracyModifier(attacker, move) {
  if (attacker.ability !== 'hustle') return 1;
  if (move.category === 'physical') {
    return 0.8; // 20% accuracy reduction
  }
  return 1;
}

// Simple - stat changes are doubled
export function applyAbilitySimple(pokemon, statChange) {
  if (pokemon.ability === 'simple') {
    return statChange * 2;
  }
  return statChange;
}

// Contrary - stat changes are reversed
export function applyAbilityContrary(pokemon, statChange) {
  if (pokemon.ability === 'contrary') {
    return -statChange;
  }
  return statChange;
}

// Check if ability ignores stat stages (Unaware)
export function checkAbilityUnaware(pokemon) {
  return pokemon.ability === 'unaware';
}

// Check if ability increases PP usage (Pressure)
export function checkAbilityPressure(pokemon) {
  return pokemon.ability === 'pressure';
}
