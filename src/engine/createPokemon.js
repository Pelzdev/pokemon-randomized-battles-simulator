import { pokemon } from "../data/pokemon.js";
import { moves } from "../data/moves.js";
import { calculateStats } from "./stats.js";
import { weightedRandom } from "../utils/random.js";
import { abilities } from "../data/abilities.js";
import { items } from "../data/items.js";
import { pokemonRegistry } from "../utils/pokemonRegistry.js";

export function createPokemon(name, level = 50, gen = "generation-i", forceTypes = null, randomizeStats = false, randomAbilities = true, allowWonderGuard = false, randomItems = false, pokemonGens = [1, 2, 3], moveGens = [1, 2, 3]) {
  const base = pokemon[name];

  const types = forceTypes ?? base.types;

  // Assign ability based on randomAbilities parameter (needs to be done before calculateStats)
  let ability = null;
  if (randomAbilities) {
    // Pick random ability from ALL abilities
    let allAbilityNames = Object.keys(abilities);
    // Filter out wonder-guard if not allowed
    if (!allowWonderGuard) {
      allAbilityNames = allAbilityNames.filter(a => a !== 'wonder-guard');
    }
    ability = allAbilityNames[Math.floor(Math.random() * allAbilityNames.length)];
  } else {
    // Pick from Pokemon's normal ability pool (first ability)
    if (base.abilities && base.abilities.length > 0) {
      ability = base.abilities[0];
    }
  }

  const usedBaseStats = randomizeStats ? randomizeBaseStats(base.stats) : { ...base.stats };
  const stats = calculateStats(usedBaseStats, level, ability);

  const p = {
    id: null, // Will be assigned by registry
    name: base.name,
    species: base.name, // Original species name
    level,
    types,
    ability,
    baseStats: usedBaseStats,
    stats,
    maxHp: stats.hp,
    currentHP: stats.hp,
    moves: getRandomMoves(types, gen, 4, stats, moveGens).map(m => ({ ...m, currentPP: m.pp })),
    item: null,
    originalItem: null,
    leechSeed: false,
    leechSeedSource: null,
    status: null,
    statusTurns: 0,
    confusionTurns: 0,
    toxicCounter: 0,
    charging: null,
    currentMove: null,
    statStages: { atk: 0, def: 0, spA: 0, spD: 0, spe: 0, acc: 0, eva: 0 },
    lastDamageDealt: 0
  };
  
  // Assign random item if requested
  if (randomItems) {
    assignRandomItem(p);
    p.originalItem = p.item; // Store original for restoration
  }
  
  // Register Pokemon in the global registry
  pokemonRegistry.register(p);
  
  return p;
}

function randomizeBaseStats(baseStats) {
  const keys = ["hp", "atk", "def", "spA", "spD", "spe"];
  const BST = keys.reduce((s, k) => s + (baseStats[k] || 0), 0);

  // Generate Dirichlet-like proportions by summing several uniforms per stat.
  // Summing 3 uniforms biases values toward the center, reducing extremes.
  const samples = keys.map(() => {
    let s = 0;
    for (let i = 0; i < 3; i++) s += Math.random();
    return s;
  });

  const totalSample = samples.reduce((a, b) => a + b, 0) || 1;
  let newVals = samples.map(s => Math.max(1, Math.round((s / totalSample) * BST)));

  // Adjust rounding differences to exactly match BST.
  // To avoid producing extreme low/high stats, when increasing distribute to smallest stats;
  // when decreasing, remove from largest stats first.
  let diff = BST - newVals.reduce((a, b) => a + b, 0);
  if (diff > 0) {
    const orderAsc = newVals.map((v, i) => ({ i, v })).sort((a, b) => a.v - b.v);
    let idx = 0;
    while (diff > 0) {
      newVals[orderAsc[idx % orderAsc.length].i] += 1;
      diff--;
      idx++;
    }
  } else if (diff < 0) {
    const orderDesc = newVals.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v);
    let idx = 0;
    while (diff < 0) {
      const i = orderDesc[idx % orderDesc.length].i;
      if (newVals[i] > 1) {
        newVals[i] -= 1;
        diff++;
      }
      idx++;
      if (idx > 1000) break;
    }
  }

  const out = {};
  keys.forEach((k, i) => out[k] = newVals[i]);
  return out;
}

function getRandomMoves(types, generation, count, stats = { atk: 50, spA: 50 }, moveGens = [1, 2, 3]) {
  // Consider all moves from the selected generations (including status moves) when building candidates
  const genMap = ['i', 'ii', 'iii', 'iv', 'v'];
  const allowedGens = moveGens.map(g => `generation-${genMap[g - 1]}`).filter(g => g.includes('-'));
  const moveList = Object.values(moves).filter(m => 
    allowedGens.includes(m.generation) && m.name !== 'struggle'
  );

  const weightedMoves = moveList.map(m => {
    // Base weight by type match
    let weight = 2;
    if (types.includes(m.type)) weight = 15; // STAB moves heavily favored (increased from 10)
    else if (m.type === "normal") weight = 4;
    
    // Boost utility moves (status, stat-boost, screens, healing, confusion) to increase their sampling rate
    const effects = m.effects ?? [];
    
    // Only count high-chance status effects (50%+) or status moves without damage as utility
    const hasStatusEffect = effects.some(e => {
      if (e.type === 'STATUS') {
        // If it's a damaging move with low-chance status, don't count as utility
        if (m.power && e.chance && e.chance < 50) return false;
        return true;
      }
      return false;
    });
    
    const hasStatBoost = effects.some(e => e.type === 'STAT' && e.change > 0);
    const hasStatDrop = effects.some(e => e.type === 'STAT' && e.change < 0 && e.target === 'enemy');
    const hasScreen = effects.some(e => e.type === 'SCREEN');
    const hasProtect = effects.some(e => e.type === 'PROTECT');
    const hasHeal = effects.some(e => e.type === 'HEAL');
    const hasConfusion = effects.some(e => e.type === 'CONFUSION');
    
    // WORKAROUND: Many status moves have empty effects arrays in the data
    // Boost non-damaging status moves as a fallback until data is fixed
    const isNonDamaging = !m.power && m.category === 'status';
    
    const isUtility = hasStatusEffect || hasStatBoost || hasStatDrop || hasScreen || hasProtect || hasHeal || hasConfusion || isNonDamaging;
    
    if (isUtility) {
      // Boost off-type utility moves to weight 9 so they compete with STAB (increased from 8)
      if (weight < 9) weight = 9;
    }
    
    return { move: m, weight, isUtility };
  });

  // Stratified sampling: ensure utility moves get fair representation
  // Sample 25 from full pool, 20 specifically from utility moves (increased from 15)
  const TOTAL_SAMPLE = Math.max(count, 45); // Increased from 40 to 45
  const UTILITY_SAMPLE = 20; // Increased from 15 to 20
  const GENERAL_SAMPLE = TOTAL_SAMPLE - UTILITY_SAMPLE;
  
  const candidates = [];
  
  // First, sample general moves from full pool
  const generalPool = weightedMoves.slice();
  while (candidates.length < GENERAL_SAMPLE && generalPool.length) {
    const move = weightedRandom(generalPool.map(w => w.move), generalPool.map(w => w.weight));
    const idx = generalPool.findIndex(w => w.move === move);
    if (idx >= 0) generalPool.splice(idx, 1);
    if (!candidates.find(m => m.name === move.name)) candidates.push(move);
  }
  
  // Then, sample utility moves specifically
  const utilityPool = weightedMoves.filter(w => w.isUtility);
  while (candidates.length < TOTAL_SAMPLE && utilityPool.length) {
    const move = weightedRandom(utilityPool.map(w => w.move), utilityPool.map(w => w.weight));
    const idx = utilityPool.findIndex(w => w.move === move);
    if (idx >= 0) utilityPool.splice(idx, 1);
    if (!candidates.find(m => m.name === move.name)) candidates.push(move);
  }

  // Score function: prefers power, accuracy, STAB, and category matching pokemon stats;
  // rewards status moves that enable combos (e.g., sleep + dream-eater) and stat-boosters.
  function scoreMove(m, stats, types, allCandidates) {
    let score = 0;
    const power = m.power || 0;
    const acc = (m.accuracy == null) ? 100 : m.accuracy;
    // base: expected damage proxy
    score += power * (acc / 100);

    // STAB preference - STAB is huge in competitive, 1.8x multiplier ensures dominance
    if (types.includes(m.type)) score *= 1.8; // Increased from 1.5 to 1.8

    // category preference based on stats
    const atk = stats.atk || 0; const spa = stats.spA || 0;
    if (m.category === 'physical') score *= (atk >= spa ? 1.12 : 0.92);
    if (m.category === 'special') score *= (spa >= atk ? 1.12 : 0.92);

    // Recharge moves - slightly penalize (powerful but risky)
    const hasRecharge = m.effects?.some(e => e.type === 'RECHARGE');
    if (hasRecharge) {
      score *= 0.85; // 15% penalty for recharge risk
    }

    // effects
    for (const e of m.effects ?? []) {
      if (e.type === 'DRAIN') score += 18; // drain is good but not exceptional
      if (e.type === 'MULTI_HIT') score += 8; // multi-hit breaks Sturdy/Sash
      if (e.type === 'FLINCH') score += 5; // flinch is decent utility
      if (e.type === 'CONFUSION') {
        // Confusion is powerful - 50% chance to hit self, lasts 1-4 turns
        const confusionAcc = (m.accuracy == null) ? 100 : m.accuracy;
        score += 80 * (confusionAcc / 100); // Comparable to paralysis
      }
      if (e.type === 'PROTECT') score += 15; // protect is crucial in doubles, decent in singles
      if (e.type === 'STAT') {
        // Stat boosts are INSANE in competitive - sweepers rely on these
        if (e.change > 0) {
          // Offensive boosts (Atk/SpA/Spe) are more valuable than defensive
          if (e.stat === 'atk' || e.stat === 'spA' || e.stat === 'spe') {
            score += 40 * e.change; // Dragon Dance, Swords Dance, etc. are game-winners
          } else {
            score += 28 * e.change; // Defensive boosts still good
          }
        }
      }
      if (e.type === 'STATUS') {
        // Status effects scaled by accuracy to compete with damaging moves
        const statusAcc = (m.accuracy == null) ? 100 : m.accuracy;
        const statusChance = e.chance || 100; // Default to 100% if not specified
        let statusBonus = 0;
        
        // Sleep is THE most powerful status - instant win condition
        if (e.status === 'sleep') statusBonus = 150; // Sleep is ban-worthy in competitive
        else if (e.status === 'paralysis') statusBonus = 100; // Para is great - speed cut + chance to not move
        else if (e.status === 'burn') statusBonus = 90; // Burn neuters physical attackers
        else if (e.status === 'poison') statusBonus = 60; // Poison is decent chip damage
        else if (e.status === 'badly-poison') statusBonus = 70; // Toxic stall is a real strategy
        else statusBonus = 40;
        
        // Scale by both accuracy AND chance
        // For damaging moves with low status chance (like Fire Blast's 10% burn), this gives a small bonus
        score += statusBonus * (statusAcc / 100) * (statusChance / 100);
      }
      if (e.type === 'SCREEN') {
        // Screens are HUGE in doubles - protect the whole team
        score += 70; // Light Screen/Reflect are tournament staples
      }
    }
    
    // Special move considerations
    // Counter/Mirror Coat - situational but powerful
    if (m.name === 'counter' || m.name === 'mirror-coat') {
      score += 25; // Decent situational move
    }
    
    // Endeavor - good on fast Pokemon or with priority
    if (m.name === 'endeavor') {
      const speed = stats.spe || 0;
      if (speed > 90) score += 30; // Great on fast Pokemon
      else score += 10; // Decent otherwise
    }
    
    // Psych Up - copycat strategies
    if (m.name === 'psych-up') {
      score += 15; // Decent utility
    }
    
    // Rage - mediocre move, AI handles it but not great
    if (m.name === 'rage') {
      score -= 10; // Slightly worse than regular damage
    }
    
    // Doubles-specific support moves (MASSIVE in 2v2)
    if (m.name === 'tailwind') {
      score += 80; // Speed control wins games in doubles
    }
    if (m.name === 'trick-room') {
      const speed = stats.spe || 0;
      if (speed < 50) score += 90; // Amazing on slow teams
      else score += 20; // Decent even if you're fast
    }
    
    // Spread status moves are INSANE in doubles - hit both opponents
    if ((m.name === 'discharge' || m.name === 'lava-plume') && m.power) {
      score += 40; // Damage + status spread is tournament-winning
    }
    
    // Variable power moves - high risk/reward
    if (m.name === 'flail' || m.name === 'reversal') {
      const hp = stats.hp || 100;
      if (hp < 100) score += 50; // Amazing on low HP Pokemon (Focus Sash strats)
      else score += 20; // Still decent finisher
    }
    if (m.name === 'eruption' || m.name === 'water-spout') {
      score += 60; // Powerful early-game nuke
    }
    
    // Belly Drum - gamebreaker setup move
    if (m.name === 'belly-drum') {
      const hp = stats.hp || 100;
      const atk = stats.atk || 0;
      if (hp > 150 && atk > 80) score += 100; // Amazing on bulky attackers
      else if (hp > 100) score += 60; // Good on anything with HP
      else score += 20; // Risky on frail mons
    }
    
    // OHKO moves - high risk, high reward
    if (m.name === 'fissure' || m.name === 'horn-drill' || m.name === 'guillotine' || m.name === 'sheer-cold') {
      score += 15; // Low accuracy but can cheese wins
    }
    
    // Stealth Rock - THE most important move in competitive
    if (m.name === 'stealth-rock') {
      score += 90; // Tournament staple, wins games
    }
    
    // Fake Out - excellent priority move
    if (m.name === 'fake-out') {
      score += 35; // Priority + guaranteed flinch on turn 1
    }

    // Synergy: Dream Eater becomes much better if any candidate causes sleep
    if (m.name === 'dream-eater') {
      const hasSleep = allCandidates.some(c => (c.effects ?? []).some(e => e.type === 'STATUS' && e.status === 'sleep'));
      if (hasSleep) score *= 1.6;
    }

    // small preference for higher PP moves (durability)
    if (typeof m.pp === 'number') score += Math.min(5, m.pp / 5);

    // Healer detection: many healing moves are status-target-user with known names
    const HEALERS = new Set(['recover', 'soft-boiled', 'soft-boil', 'wish']);
    if (HEALERS.has(m.name) || (m.target === 'user' && m.category === 'status' && (m.effects ?? []).some(e => e.type === 'HEAL'))) {
      // Estimate heal fraction: default 0.5 for recover/soft-boiled; if effect specifies fraction, use it
      let frac = 0.5;
      const healEffect = (m.effects ?? []).find(e => e.type === 'HEAL');
      if (healEffect) {
        if (typeof healEffect.fraction === 'number') frac = healEffect.fraction;
        else if (typeof healEffect.amount === 'number' && stats.hp) frac = Math.min(1, healEffect.amount / stats.hp);
      } else if (m.name === 'rest') {
        frac = 1;
      }
      // Reward healers proportional to fraction of max HP they restore.
      // Multiply by 120 to be comparable with damage-based scoring (increased from 100)
      score += frac * 120;
      // Bonus if the user's HP stat is low relative to typical (encourages heals on frailer mons)
      if (stats.hp && stats.hp < 120) score += 8; // Increased from 6 to 8
    }

    return score;
  }

  // Score all candidates and pick top `count` unique moves
  const scored = candidates.map(m => ({ m, s: scoreMove(m, stats, types, candidates) }));
  // Use actual base stats where possible — we don't have species' calculated stats here,
  // but createPokemon passes this function before stats are attached; so try to use base stats from data
  // If base stats exist on move selection call site, they should be used. For simplicity, re-score with species base if provided below.

  // sort by score descending
  scored.sort((a, b) => b.s - a.s);
  const final = [];
  for (const entry of scored) {
    if (final.length >= count) break;
    // avoid choosing multiple moves with identical name
    // Do not include self-KO moves in the final selected moves (breaks 1v1 balance)
    const banned = new Set(['explosion', 'self-destruct']);
    if (banned.has(entry.m.name)) continue;
      // Dream Eater should only be included if there is at least one sleep-causing candidate
      if (entry.m.name === 'dream-eater') {
        const hasSleepCandidate = candidates.some(c => (c.effects ?? []).some(e => e.type === 'STATUS' && e.status === 'sleep'));
        if (!hasSleepCandidate) continue;
      }
    if (!final.find(x => x.name === entry.m.name)) final.push(entry.m);
  }

  // If we didn't find enough (rare), fill with random moves from remaining pool
  let fillPool = moveList.filter(m => !final.find(f => f.name === m.name));
  while (final.length < count && fillPool.length) {
    const idx = Math.floor(Math.random() * fillPool.length);
    final.push(fillPool.splice(idx, 1)[0]);
  }

  return final;
}

// Select a random competitive item for a Pokemon
export function assignRandomItem(pokemon) {
  // Item pool with strategic value
  const itemPool = [
    'choice-band', 'choice-specs', 'choice-scarf',
    'life-orb', 'leftovers', 'focus-sash', 'expert-belt',
    'muscle-band', 'wise-glasses', 'assault-vest',
    'sitrus-berry', 'lum-berry', 'salac-berry', 'liechi-berry', 'petaya-berry'
  ];
  
  // Add type-specific items based on Pokemon's types
  const typeItems = {
    'fire': 'charcoal',
    'water': 'mystic-water',
    'grass': 'miracle-seed',
    'electric': 'magnet',
    'ice': 'never-melt-ice',
    'fighting': 'black-belt',
    'poison': 'poison-barb',
    'ground': 'soft-sand',
    'flying': 'sharp-beak',
    'psychic': 'twisted-spoon',
    'bug': 'silver-powder',
    'rock': 'hard-stone',
    'ghost': 'spell-tag',
    'dragon': 'dragon-fang',
    'dark': 'black-glasses',
    'steel': 'metal-coat'
  };
  
  for (const type of pokemon.types) {
    if (typeItems[type]) {
      itemPool.push(typeItems[type]);
    }
  }
  
  // Select random item from pool
  pokemon.item = itemPool[Math.floor(Math.random() * itemPool.length)];
  return pokemon;
}
