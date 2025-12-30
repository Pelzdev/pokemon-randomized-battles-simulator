import { pokemon } from "../data/pokemon.js";
import { moves } from "../data/moves.js";
import { calculateStats } from "./stats.js";
import { weightedRandom } from "../utils/random.js";
import { abilities } from "../data/abilities.js";
import { items } from "../data/items.js";
import { pokemonRegistry } from "../utils/pokemonRegistry.js";

// PERFORMANCE OPTIMIZATION: Cache pre-filtered moves by generation
// This avoids filtering ~900 moves for every single Pokemon created
const movesCacheByGen = {};

function getMovesForGenerations(moveGens) {
  const cacheKey = moveGens.join(',');
  if (movesCacheByGen[cacheKey]) {
    return movesCacheByGen[cacheKey];
  }
  
  const genMap = ['i', 'ii', 'iii', 'iv', 'v'];
  const allowedGens = moveGens.map(g => `generation-${genMap[g - 1]}`).filter(g => g.includes('-'));
  const filtered = Object.values(moves).filter(m => 
    allowedGens.includes(m.generation) && m.name !== 'struggle'
  );
  
  movesCacheByGen[cacheKey] = filtered;
  return filtered;
}

// PERFORMANCE OPTIMIZATION: Cache move special scoring bonuses
// Avoids repeated name lookups and calculations for special moves
const moveSpecialScoreCache = {};

function getSpecialMoveScoreBonus(moveName, stats) {
  if (moveSpecialScoreCache[moveName]) {
    const cachedBonus = moveSpecialScoreCache[moveName];
    return cachedBonus.fixed !== undefined ? cachedBonus.fixed : cachedBonus.calc?.(stats) || 0;
  }
  
  let bonus = 0;
  
  if (moveName === 'counter' || moveName === 'mirror-coat') bonus = 25;
  else if (moveName === 'endeavor') {
    const calc = s => (s.spe || 0) > 90 ? 30 : 10;
    moveSpecialScoreCache[moveName] = { calc };
    return calc(stats);
  }
  else if (moveName === 'psych-up') bonus = 15;
  else if (moveName === 'rage') bonus = -10;
  else if (moveName === 'tailwind') bonus = 80;
  else if (moveName === 'trick-room') {
    const calc = s => (s.spe || 0) < 50 ? 90 : 20;
    moveSpecialScoreCache[moveName] = { calc };
    return calc(stats);
  }
  else if (moveName === 'discharge' || moveName === 'lava-plume') bonus = 40;
  else if (moveName === 'flail' || moveName === 'reversal') {
    const calc = s => (s.hp || 100) < 100 ? 50 : 20;
    moveSpecialScoreCache[moveName] = { calc };
    return calc(stats);
  }
  else if (moveName === 'eruption' || moveName === 'water-spout') bonus = 60;
  else if (moveName === 'belly-drum') {
    const hp = stats.hp || 100;
    const atk = stats.atk || 0;
    bonus = (hp > 150 && atk > 80) ? 100 : (hp > 100 ? 60 : 20);
  }
  else if (moveName === 'fissure' || moveName === 'horn-drill' || moveName === 'guillotine' || moveName === 'sheer-cold') bonus = 15;
  else if (moveName === 'stealth-rock') bonus = 90;
  else if (moveName === 'fake-out') bonus = 35;
  
  if (bonus !== 0) {
    moveSpecialScoreCache[moveName] = { fixed: bonus };
  }
  return bonus;
}

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
  // Use cached filtered moves instead of filtering all moves every time
  const moveList = getMovesForGenerations(moveGens);

  const weightedMoves = moveList.map(m => {
    // Base weight by type match
    let weight = 2;
    if (types.includes(m.type)) weight = 15;
    else if (m.type === "normal") weight = 4;
    
    const effects = m.effects ?? [];
    
    const hasStatusEffect = effects.some(e => {
      if (e.type === 'STATUS') {
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
    const isNonDamaging = !m.power && m.category === 'status';
    
    const isUtility = hasStatusEffect || hasStatBoost || hasStatDrop || hasScreen || hasProtect || hasHeal || hasConfusion || isNonDamaging;
    
    if (isUtility && weight < 9) weight = 9;
    
    return { move: m, weight, isUtility };
  });

  // Stratified sampling
  const TOTAL_SAMPLE = Math.max(count, 25);  // Reduced from 45 to 25 for speed
  const UTILITY_SAMPLE = 10;  // Reduced from 20 to 10
  const GENERAL_SAMPLE = TOTAL_SAMPLE - UTILITY_SAMPLE;
  
  const candidates = [];
  
  // Sample general moves
  const generalPool = weightedMoves.slice();
  while (candidates.length < GENERAL_SAMPLE && generalPool.length) {
    const move = weightedRandom(generalPool.map(w => w.move), generalPool.map(w => w.weight));
    const idx = generalPool.findIndex(w => w.move === move);
    if (idx >= 0) generalPool.splice(idx, 1);
    if (!candidates.find(m => m.name === move.name)) candidates.push(move);
  }
  
  // Sample utility moves
  const utilityPool = weightedMoves.filter(w => w.isUtility);
  while (candidates.length < TOTAL_SAMPLE && utilityPool.length) {
    const move = weightedRandom(utilityPool.map(w => w.move), utilityPool.map(w => w.weight));
    const idx = utilityPool.findIndex(w => w.move === move);
    if (idx >= 0) utilityPool.splice(idx, 1);
    if (!candidates.find(m => m.name === move.name)) candidates.push(move);
  }

  // Score function
  function scoreMove(m, stats, types, allCandidates) {
    let score = 0;
    const power = m.power || 0;
    const acc = (m.accuracy == null) ? 100 : m.accuracy;
    score += power * (acc / 100);

    if (types.includes(m.type)) score *= 1.8;

    const atk = stats.atk || 0; const spa = stats.spA || 0;
    if (m.category === 'physical') score *= (atk >= spa ? 1.12 : 0.92);
    if (m.category === 'special') score *= (spa >= atk ? 1.12 : 0.92);

    const hasRecharge = m.effects?.some(e => e.type === 'RECHARGE');
    if (hasRecharge) score *= 0.85;

    // Effects
    for (const e of m.effects ?? []) {
      if (e.type === 'DRAIN') score += 18;
      if (e.type === 'MULTI_HIT') score += 8;
      if (e.type === 'FLINCH') score += 5;
      if (e.type === 'CONFUSION') {
        const confusionAcc = (m.accuracy == null) ? 100 : m.accuracy;
        score += 80 * (confusionAcc / 100);
      }
      if (e.type === 'PROTECT') score += 15;
      if (e.type === 'STAT') {
        if (e.change > 0) {
          if (e.stat === 'atk' || e.stat === 'spA' || e.stat === 'spe') {
            score += 40 * e.change;
          } else {
            score += 28 * e.change;
          }
        }
      }
      if (e.type === 'STATUS') {
        const statusAcc = (m.accuracy == null) ? 100 : m.accuracy;
        const statusChance = e.chance || 100;
        let statusBonus = 0;
        if (e.status === 'sleep') statusBonus = 150;
        else if (e.status === 'paralysis') statusBonus = 100;
        else if (e.status === 'burn') statusBonus = 90;
        else if (e.status === 'poison') statusBonus = 60;
        else if (e.status === 'badly-poison') statusBonus = 70;
        else statusBonus = 40;
        score += statusBonus * (statusAcc / 100) * (statusChance / 100);
      }
      if (e.type === 'SCREEN') score += 70;
    }
    
    // Use cached special move bonuses
    score += getSpecialMoveScoreBonus(m.name, stats);

    // Synergy: Dream Eater
    if (m.name === 'dream-eater') {
      const hasSleep = allCandidates.some(c => (c.effects ?? []).some(e => e.type === 'STATUS' && e.status === 'sleep'));
      if (hasSleep) score *= 1.6;
    }

    // PP preference
    if (typeof m.pp === 'number') score += Math.min(5, m.pp / 5);

    // Healers
    const HEALERS = new Set(['recover', 'soft-boiled', 'soft-boil', 'wish']);
    if (HEALERS.has(m.name) || (m.target === 'user' && m.category === 'status' && (m.effects ?? []).some(e => e.type === 'HEAL'))) {
      let frac = 0.5;
      const healEffect = (m.effects ?? []).find(e => e.type === 'HEAL');
      if (healEffect) {
        if (typeof healEffect.fraction === 'number') frac = healEffect.fraction;
        else if (typeof healEffect.amount === 'number' && stats.hp) frac = Math.min(1, healEffect.amount / stats.hp);
      } else if (m.name === 'rest') {
        frac = 1;
      }
      score += frac * 120;
      if (stats.hp && stats.hp < 120) score += 8;
    }

    return score;
  }

  // Score all candidates and pick top moves
  const scored = candidates.map(m => ({ m, s: scoreMove(m, stats, types, candidates) }));
  scored.sort((a, b) => b.s - a.s);
  
  const final = [];
  for (const entry of scored) {
    if (final.length >= count) break;
    const banned = new Set(['explosion', 'self-destruct']);
    if (banned.has(entry.m.name)) continue;
    if (entry.m.name === 'dream-eater') {
      const hasSleepCandidate = candidates.some(c => (c.effects ?? []).some(e => e.type === 'STATUS' && e.status === 'sleep'));
      if (!hasSleepCandidate) continue;
    }
    if (!final.find(x => x.name === entry.m.name)) final.push(entry.m);
  }

  // Fill remaining with random moves if needed
  let fillPool = moveList.filter(m => !final.find(f => f.name === m.name));
  while (final.length < count && fillPool.length) {
    const idx = Math.floor(Math.random() * fillPool.length);
    final.push(fillPool.splice(idx, 1)[0]);
  }

  return final;
}

// Select a random competitive item for a Pokemon
export function assignRandomItem(pokemon) {
  const itemPool = [
    'choice-band', 'choice-specs', 'choice-scarf',
    'life-orb', 'leftovers', 'focus-sash', 'expert-belt',
    'muscle-band', 'wise-glasses', 'assault-vest',
    'sitrus-berry', 'lum-berry', 'salac-berry', 'liechi-berry', 'petaya-berry'
  ];
  
  const typeItems = {
    'fire': 'charcoal', 'water': 'mystic-water', 'grass': 'miracle-seed',
    'electric': 'magnet', 'ice': 'never-melt-ice', 'fighting': 'black-belt',
    'poison': 'poison-barb', 'ground': 'soft-sand', 'flying': 'sharp-beak',
    'psychic': 'twisted-spoon', 'bug': 'silver-powder', 'rock': 'hard-stone',
    'ghost': 'spell-tag', 'dragon': 'dragon-fang', 'dark': 'black-glasses',
    'steel': 'metal-coat'
  };
  
  for (const type of pokemon.types) {
    if (typeItems[type]) itemPool.push(typeItems[type]);
  }
  
  pokemon.item = itemPool[Math.floor(Math.random() * itemPool.length)];
  return pokemon;
}
