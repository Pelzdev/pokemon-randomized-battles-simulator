import { performMove, processStatus, processEndOfTurn } from "./turn.js";
import { clampStage } from "./statUtils.js";
import { logBattle, clearLogs } from "../utils/logger.js";
import { typeChart } from "../data/typeChart.js";
import { tournamentStats } from "../utils/tournamentStats.js";
import { applyAbilityOnSwitchIn, getAbilitySpeedModifier, applyAbilityEndOfTurn, checkAbilityImmunity, applyAbilityForecast } from "./abilities.js";
import { getItem } from "../data/items.js";

export function battle(p1, p2) {
  clearLogs();
  let turn = 1;
  const field = { weather: null, weatherTurns: 0 };
  
  // Apply switch-in abilities at battle start
  applyAbilityOnSwitchIn(p1, p2, field);
  applyAbilityOnSwitchIn(p2, p1, field);
  
  // Apply Forecast if weather is already set
  applyAbilityForecast(p1, field);
  applyAbilityForecast(p2, field);

  while (p1.currentHP > 0 && p2.currentHP > 0) {
    logBattle(`--- Turn ${turn} ---`);
    
    // Reset damage tracking for Counter/Mirror Coat at start of turn
    p1.lastDamageTaken = 0;
    p1.lastMoveCategory = null;
    p2.lastDamageTaken = 0;
    p2.lastMoveCategory = null;
    
    // Reset hitThisTurn tracking for Revenge/Vengeance
    p1.hitThisTurn = false;
    p2.hitThisTurn = false;

    // Status damage first
    processStatus(p1);
    processStatus(p2);
    if (p1.currentHP <= 0 || p2.currentHP <= 0) break;

    const p1Move = getPriorityMove(p1, p2, field);
    const p2Move = getPriorityMove(p2, p1, field);

    const p1Priority = p1Move.priority ?? 0;
    const p2Priority = p2Move.priority ?? 0;

    function stageMultiplier(stage) {
      if (stage >= 0) return (2 + stage) / 2;
      return 2 / (2 - stage);
    }

    function effectiveSpeed(pokemon) {
      const stage = clampStage(pokemon.statStages?.spe ?? 0);
      let sp = Math.floor(pokemon.stats.spe * stageMultiplier(stage));
      if (pokemon.status === "paralysis") sp = Math.floor(sp / 2);
      
      // Apply ability speed modifiers
      const abilityMod = getAbilitySpeedModifier(pokemon, field);
      sp = Math.floor(sp * abilityMod);
      
      // Apply Choice Scarf speed boost
      if (pokemon.item) {
        const item = getItem(pokemon.item);
        if (item && item.effect === 'CHOICE_SPE') {
          sp = Math.floor(sp * item.multiplier);
        }
      }
      
      return sp;
    }

    const p1Spe = effectiveSpeed(p1);
    const p2Spe = effectiveSpeed(p2);

    // Determine move order: priority first, then speed (random tiebreaker)
    // Trick Room reverses speed order
    let p1Faster;
    if (p1Priority > p2Priority) {
      p1Faster = true;
    } else if (p2Priority > p1Priority) {
      p1Faster = false;
    } else {
      // Same priority - check speed
      if (field.trickRoom > 0) {
        // Trick Room reverses speed order (slower goes first)
        p1Faster = p1Spe < p2Spe || (p1Spe === p2Spe && Math.random() < 0.5);
      } else {
        // Normal speed order (faster goes first)
        p1Faster = p1Spe > p2Spe || (p1Spe === p2Spe && Math.random() < 0.5);
      }
    }
    
    if (p1Faster) {
      performMove(p1, p2, p1Move, { field, turnNumber: turn });
      if (p2.currentHP > 0) performMove(p2, p1, p2Move, { field, turnNumber: turn });
    } else {
      performMove(p2, p1, p2Move, { field, turnNumber: turn });
      if (p1.currentHP > 0) performMove(p1, p2, p1Move, { field, turnNumber: turn });
    }

    // End-of-turn effects (leech seed, leftovers, weather, abilities)
    if (p1.currentHP > 0 && p2.currentHP > 0) {
      processEndOfTurn(p1, p2, field);
      
      // Apply end-of-turn ability effects
      applyAbilityEndOfTurn(p1, field);
      applyAbilityEndOfTurn(p2, field);
    }

    // Decrement weather turns
    if (field.weather && field.weatherTurns > 0) {
        // Update Forecast Pokemon when weather ends
        applyAbilityForecast(p1, field);
        applyAbilityForecast(p2, field);
      field.weatherTurns--;
      if (field.weatherTurns <= 0) {
        logBattle(`The ${field.weather} subsided.`);
        field.weather = null;
      }
    }

    // Decrement screen turns
    if (p1["light-screen"] > 0) {
      p1["light-screen"]--;
      if (p1["light-screen"] <= 0) logBattle(`${p1.name}'s Light Screen wore off!`);
    }
    if (p1["reflect"] > 0) {
      p1["reflect"]--;
      if (p1["reflect"] <= 0) logBattle(`${p1.name}'s Reflect wore off!`);
    }
    if (p2["light-screen"] > 0) {
      p2["light-screen"]--;
      if (p2["light-screen"] <= 0) logBattle(`${p2.name}'s Light Screen wore off!`);
    }
    if (p2["reflect"] > 0) {
      p2["reflect"]--;
      if (p2["reflect"] <= 0) logBattle(`${p2.name}'s Reflect wore off!`);
    }
    
    // Decrement field effect turns
    if (field.trickRoom > 0) {
      field.trickRoom--;
      if (field.trickRoom <= 0) logBattle(`The twisted dimensions returned to normal!`);
    }
    if (field.gravity > 0) {
      field.gravity--;
      if (field.gravity <= 0) logBattle(`Gravity returned to normal!`);
    }
    if (field.wonderRoom > 0) {
      field.wonderRoom--;
      if (field.wonderRoom <= 0) logBattle(`Wonder Room wore off!`);
    }

    turn++;
    // Safety: prevent pathological infinite battles — declare draw after large number of turns
    if (turn > 10000) {
      logBattle('Match aborted: turn limit exceeded (draw).');
      // choose winner by remaining HP (or random if equal)
      if (p1.currentHP === p2.currentHP) return Math.random() < 0.5 ? p1 : p2;
      return p1.currentHP > p2.currentHP ? p1 : p2;
    }
  }
  const winnerObj = p1.currentHP > 0 ? p1 : p2;
  logBattle(`🏆 ${winnerObj.name} wins!`);
  return winnerObj;
}

// Random move from Pokémon moveset (weighted moves already handled in createPokemon)
function estimateDamage(attacker, defender, move) {
  if (!attacker || !defender || !move || !move.power) return 0;
  
  // Check ability immunity first
  if (checkAbilityImmunity(attacker, defender, move)) {
    return 0; // AI should avoid this move
  }
  
  const isSpecial = move.category === 'special';
  const atkBase = isSpecial ? attacker.stats.spA : attacker.stats.atk;
  const defBase = isSpecial ? defender.stats.spD : defender.stats.def;
  const atkStage = clampStage(attacker.statStages?.[isSpecial ? 'spA' : 'atk'] ?? 0);
  let defStage = clampStage(defender.statStages?.[isSpecial ? 'spD' : 'def'] ?? 0);
  // ignore positive def stage on crit approximation not used here
  function stageMultiplier(stage) { if (stage >= 0) return (2 + stage) / 2; return 2 / (2 - stage); }
  let atk = Math.max(1, Math.floor(atkBase * stageMultiplier(atkStage)));
  const def = Math.max(1, Math.floor(defBase * stageMultiplier(defStage)));
  if (attacker.status === 'burn' && !isSpecial) atk = Math.floor(atk / 2);
  let dmg = Math.floor(((((2 * attacker.level) / 5 + 2) * move.power * atk) / def) / 50 + 2);
  // STAB
  if (attacker.types.includes(move.type)) dmg = Math.floor(dmg * 1.5);
  // type effectiveness
  const typeMult = defender.types.reduce((mult, t) => mult * (typeChart[move.type]?.[t] ?? 1), 1);
  dmg = Math.floor(dmg * typeMult);
  
  // Apply ability damage modifiers
  if (defender.ability) {
    // Thick Fat - halves fire and ice damage
    if (defender.ability === 'thick-fat' && (move.type === 'fire' || move.type === 'ice')) {
      dmg = Math.floor(dmg / 2);
    }
    
    // Wonder Guard - only super effective moves deal damage
    if (defender.ability === 'wonder-guard' && typeMult <= 1) {
      return 0; // AI should avoid non-super-effective moves
    }
  }
  
  // use average random multiplier (mean of 0.85..1.0)
  dmg = Math.floor(dmg * 0.925);
  return Math.max(1, dmg);
}

function scoreMoveForSituation(user, target, move, field = {}, is2v2 = false) {
  // Safety check: if target is undefined, return neutral score
  if (!target || !user || !move) return 0;
  
  let score = 0;
  // Prefer moves with PP
  if (typeof move.currentPP === 'number') {
    if (move.currentPP <= 0) return -9999; // don't pick depleted moves
    score += Math.min(8, move.currentPP / 2);
  }
  
  // Recharge moves - penalize heavily if we're low HP or target survives
  const rechargeEffect = move.effects?.find(e => e.type === 'RECHARGE');
  if (rechargeEffect && move.power) {
    const userHPPercent = user.currentHP / user.maxHp;
    const estDamage = estimateDamage(user, target, move);
    
    // Don't use recharge moves if we're low HP and target survives
    if (userHPPercent < 0.4 && estDamage < target.currentHP) {
      score -= 80; // Very risky - we'll be vulnerable
    } else if (userHPPercent < 0.6 && estDamage < target.currentHP) {
      score -= 40; // Still risky
    }
    
    // Bonus if it secures the KO (worth the recharge)
    if (estDamage >= target.currentHP) {
      score += 60; // Great trade - they're down and we just recharge
    }
  }
  
  // Status moves: evaluate by effects
  if (move.category === 'status') {
    const moveAcc = (move.accuracy == null) ? 100 : move.accuracy;
    
    for (const e of move.effects ?? []) {
      if (e.type === 'STAT' && e.change > 0) {
        // Offensive stat boosts are HUGE - they enable sweeps
        if (e.stat === 'atk' || e.stat === 'spA') score += 70 * e.change;
        else if (e.stat === 'spe') score += 65 * e.change; // Speed control is crucial
        else score += 45 * e.change; // Defensive boosts still good
      }
      if (e.type === 'STATUS') {
        // Only inflict status if target doesn't have one already
        if (!target.status) {
          let statusValue = 0;
          // Scale by accuracy like pros consider - 100% status > 75% status
          if (e.status === 'sleep') statusValue = 180; // Sleep is game-winning
          else if (e.status === 'paralysis') statusValue = 120; // Speed control + disable chance
          else if (e.status === 'burn') statusValue = 110; // Neuters physical attackers
          else if (e.status === 'badly-poison') statusValue = 85; // Toxic stall wins games
          else if (e.status === 'poison') statusValue = 60; // Regular poison chip
          else statusValue = 40;
          
          // Scale by accuracy and effect chance
          const effectChance = e.chance || 100;
          score += statusValue * (moveAcc / 100) * (effectChance / 100);
        }
      }
      if (e.type === 'SCREEN') {
        // Screens are INSANE in doubles - protect whole team for 5 turns
        if (is2v2) {
          const teamNeedsScreens = !field.lightScreen && !field.reflect;
          if (teamNeedsScreens) {
            score += 110; // Massively valuable in doubles - reduces damage to both allies
          } else {
            score += 20; // Already have screens up
          }
        } else {
          score += 40; // Still good in singles
        }
      }
      if (e.type === 'HEAL') {
        // Scale healing value by how hurt we are
        const hpPercent = user.currentHP / user.maxHp;
        if (hpPercent < 0.3) score += 90; // Desperate heal
        else if (hpPercent < 0.5) score += 60; // Good heal timing
        else if (hpPercent < 0.7) score += 30; // Decent heal
        else score += 10; // Don't heal at full HP
      }
      if (e.type === 'PROTECT') score += 20; // Scouting + stalling
    }
    
    // Additional context bonuses for status moves
    const userHealthy = user.currentHP / user.maxHp > 0.7;
    const targetHealthy = target.currentHP / target.maxHp > 0.7;
    
    // Check if opponent can KO us next turn - don't setup if so
    const opponentBestDamage = Math.max(...target.moves.map(m => estimateDamage(target, user, m)));
    const opponentCanKO = opponentBestDamage >= user.currentHP;
    
    // Don't setup at low HP - prioritize survival
    if (!userHealthy || opponentCanKO) {
      if (move.effects?.some(e => e.type === 'STAT' && e.change > 0 && (e.stat === 'atk' || e.stat === 'spA'))) {
        score -= 80; // Offensive setup when in danger is very bad
      }
      if (move.effects?.some(e => e.type === 'STATUS' && !target.status)) {
        score -= 40; // Status moves also risky if we might die
      }
    }
    
    // If we're healthy and they're healthy, status/setup is amazing (like pros do)
    if (userHealthy && targetHealthy && !opponentCanKO) {
      // Early game - setup moves shine
      if (move.effects?.some(e => e.type === 'STAT' && e.change > 0)) {
        score += 50; // Huge bonus for setting up early
      }
      // Status moves when no immediate KO available - cripple them
      if (move.effects?.some(e => e.type === 'STATUS' && !target.status)) {
        score += 60; // Big bonus - inflict status early like pros
      }
    }
    
    // Tailwind/Trick Room are game-changers in doubles
    if (is2v2) {
      if (move.name === 'tailwind' && !field.tailwind) {
        score += 100; // Speed control is CRUCIAL in doubles
      }
      if (move.name === 'trick-room' && !field.trickRoom) {
        const userSpeed = user.stats.spe || 0;
        if (userSpeed < 50) score += 120; // Amazing for slow teams
        else score += 40; // Still decent for reversals
      }
    }
    
    return score;
  }

  // Damaging moves: estimate expected damage * accuracy
  const acc = (move.accuracy == null) ? 100 : move.accuracy;
  let est = estimateDamage(user, target, move);
  
  // Weather synergy bonuses
  if (field.weather === 'sun') {
    if (move.type === 'fire') est = Math.floor(est * 1.5);
    if (move.type === 'water') est = Math.floor(est * 0.5);
  } else if (field.weather === 'rain') {
    if (move.type === 'water') est = Math.floor(est * 1.5);
    if (move.type === 'fire') est = Math.floor(est * 0.5);
  }
  
  score += est * (acc / 100);
  
  // Bonus if this move can KO - heavily prioritize securing KOs
  if (est >= target.currentHP) {
    score += 100; // Increased from 50 - KOs are game-changing
  }
  
  // Bonus if opponent is low HP even if not quite a KO
  const targetHPPercent = target.currentHP / target.maxHp;
  if (targetHPPercent < 0.3) {
    score += 30; // Finish weakened opponents
  }
  
  // Counter/Mirror Coat logic - only use if we took damage last turn
  if (move.name === 'counter' || move.name === 'mirror-coat') {
    const expectedType = move.name === 'counter' ? 'physical' : 'special';
    if (user.lastDamageTaken && user.lastDamageTaken > 0 && user.lastMoveCategory === expectedType) {
      score += 100; // Huge bonus - we can counter
    } else {
      score -= 80; // Don't use counter moves randomly
    }
  }
  
  // Endeavor - only good when we're low and opponent is high
  if (move.name === 'endeavor') {
    const userHPPercent = user.currentHP / user.maxHp;
    const targetHPPercent = target.currentHP / target.maxHp;
    if (userHPPercent < 0.3 && targetHPPercent > 0.5) {
      score += 80; // Great move in this situation
    } else {
      score -= 60; // Don't use endeavor at high HP
    }
  }
  
  // Flail/Reversal - better at low HP
  if (move.name === 'flail' || move.name === 'reversal') {
    const userHPPercent = user.currentHP / user.maxHp;
    if (userHPPercent < 0.2) score += 90; // Amazing at very low HP (200 power)
    else if (userHPPercent < 0.35) score += 60; // Good at low HP (80-100 power)
    else score -= 40; // Bad at high HP (20-40 power)
  }
  
  // Eruption/Water Spout - better at high HP
  if (move.name === 'eruption' || move.name === 'water-spout') {
    const userHPPercent = user.currentHP / user.maxHp;
    if (userHPPercent > 0.8) score += 80; // Amazing at full HP (120+ power)
    else if (userHPPercent > 0.5) score += 40; // Decent at high HP (75+ power)
    else score -= 40; // Weak at low HP
  }
  
  // Belly Drum - only use when healthy and no setup yet
  if (move.name === 'belly-drum') {
    const userHPPercent = user.currentHP / user.maxHp;
    if (userHPPercent > 0.6 && user.statStages.atk < 4) {
      score += 110; // Amazing setup move
    } else {
      score -= 90; // Don't use when low HP or already boosted
    }
  }
  
  // OHKO moves - risky but can steal wins
  if (move.name === 'fissure' || move.name === 'horn-drill' || move.name === 'guillotine' || move.name === 'sheer-cold') {
    const targetHPPercent = target.currentHP / target.maxHp;
    if (targetHPPercent > 0.8) score += 40; // Worth a shot on healthy targets
    else score += 10; // Low priority, but still an option
  }
  
  // Stealth Rock - use early if not set yet
  if (move.name === 'stealth-rock') {
    if (!field.hazards?.['stealth-rock']) {
      score += 100; // High priority to set up
    } else {
      score -= 100; // Already set, don't use again
    }
  }
  
  // reward DRAIN moves
  for (const e of move.effects ?? []) {
    if (e.type === 'DRAIN') score += 20;
    if (e.type === 'FLINCH') score += 8;
    if (e.type === 'MULTI_HIT') score += 8;
    
    // Secondary status effects on damaging moves (Body Slam, Thunderbolt, etc.)
    if (e.type === 'STATUS' && move.power && !target.status) {
      const effectChance = e.chance || 100;
      let statusBonus = 0;
      
      if (e.status === 'sleep') statusBonus = 45; // 30% sleep chance = massive
      else if (e.status === 'paralysis') statusBonus = 35; // Speed control
      else if (e.status === 'burn') statusBonus = 30; // Attack nerf
      else if (e.status === 'freeze') statusBonus = 30; // Similar to sleep
      else if (e.status === 'poison' || e.status === 'badly-poison') statusBonus = 20;
      else statusBonus = 10;
      
      // Scale by chance - 30% chance = 30% of bonus
      score += statusBonus * (effectChance / 100);
    }
  }

  // small bias for STAB and higher PP already reflected
  return score;
}

function getPriorityMove(pokemon, opponent, field = {}, is2v2 = false) {
  // Filter out moves with no PP where possible
  const candidates = pokemon.moves.slice();
  // Score all candidates and pick best
  const scored = candidates.map(m => ({ m, s: scoreMoveForSituation(pokemon, opponent, m, field, is2v2) }));
  scored.sort((a, b) => b.s - a.s);
  // If top candidate is heavily negative (all depleted), fall back to random
  if (scored.length === 0) return pokemon.moves[0];
  if (scored[0].s <= -900) return pokemon.moves[Math.floor(Math.random() * pokemon.moves.length)];
  // pick among top tied candidates
  const topScore = scored[0].s;
  const topCandidates = scored.filter(x => Math.abs(x.s - topScore) < 1e-6).map(x => x.m);
  return topCandidates[Math.floor(Math.random() * topCandidates.length)];
}

// 1v1 Battle with full teams (3v3 or 6v6) and switching mechanics
export function battle1v1Teams(team1, team2) {
  const field = {};
  let turn = 1;
  
  // Initialize team structures - only one active Pokemon per team
  const team1State = {
    pokemon: [...team1],
    active: null,
    bench: []
  };
  
  const team2State = {
    pokemon: [...team2],
    active: null,
    bench: []
  };
  
  // Tag team membership for sleep clause and logging
  team1.forEach(p => p.teamId = 'team1');
  team2.forEach(p => p.teamId = 'team2');
  
  // Sleep Clause: only allow one asleep per team (in 1v1 tournaments)
  const sleepClause = { max: 1, counts: { team1: 0, team2: 0 } };
  
  // Select starting Pokemon (first one in team)
  team1State.active = team1[0];
  team1State.bench = team1.slice(1);
  team2State.active = team2[0];
  team2State.bench = team2.slice(1);
  
  logBattle(`${team1State.active.name} vs ${team2State.active.name}!`);
  
  // Apply switch-in abilities for starters
  applyAbilityOnSwitchIn(team1State.active, team2State.active, field);
  applyAbilityOnSwitchIn(team2State.active, team1State.active, field);
  applyAbilityForecast(team1State.active, field);
  applyAbilityForecast(team2State.active, field);
  
  // Switching AI - decides if and when to switch
  function shouldSwitch(teamState, opponent) {
    const active = teamState.active;
    if (!active || active.currentHP <= 0) return null;
    
    const availableBench = teamState.bench.filter(p => p && p.currentHP > 0);
    if (availableBench.length === 0) return null;
    
    // Don't switch too often - only in specific situations
    const hpPercent = active.currentHP / active.maxHp;
    
    // Helper: evaluate matchup score for a candidate vs opponent
    function matchupScore(poke, foe) {
      let score = 0;
      if (foe) {
        for (const oppType of foe.types) {
          for (const myType of poke.types) {
            const eff = typeChart[oppType]?.[myType] || 1;
            if (eff < 1) score += 20; // Resist
            else if (eff > 1) score -= 20; // Weak
          }
        }
        for (const myType of poke.types) {
          for (const oppType of foe.types) {
            const eff = typeChart[myType]?.[oppType] || 1;
            if (eff > 1) score += 18; // Super effective
            else if (eff < 1) score -= 8; // Not very effective
          }
        }
      }
      score += (poke.currentHP / poke.maxHp) * 8; // prefer healthier
      return score;
    }
    
    const currentScore = matchupScore(active, opponent);
    
    // Consider switching if low HP and a much healthier bench option exists
    if (hpPercent < 0.35 && Math.random() < 0.5) {
      const healthyBench = availableBench.filter(p => p.currentHP / p.maxHp > 0.65);
      if (healthyBench.length > 0) {
        // pick the healthiest strong matchup
        const best = healthyBench.reduce((bestP, p) => {
          const s = matchupScore(p, opponent);
          if (!bestP || s > bestP.score) return { poke: p, score: s };
          return bestP;
        }, null);
        if (best && best.score > currentScore + 10) {
          return {
            pokemon: best.poke,
            reason: 'lowHP'
          };
        }
      }
    }
    
    // Consider switching if at type disadvantage
    if (opponent && Math.random() < 0.25) {
      let hasDisadvantage = false;
      for (const oppType of opponent.types) {
        for (const myType of active.types) {
          const effectiveness = typeChart[oppType]?.[myType] || 1;
          if (effectiveness > 1) { hasDisadvantage = true; break; }
        }
        if (hasDisadvantage) break;
      }
      
      if (hasDisadvantage) {
        let bestSwitch = null;
        let bestScore = -1000;
        
        for (const bench of availableBench) {
          const score = matchupScore(bench, opponent);
          if (score > bestScore) {
            bestScore = score;
            bestSwitch = bench;
          }
        }
        
        // Switch if the bench option is meaningfully better than current
        if (bestSwitch && bestScore > currentScore + 5 && bestScore > 10) {
          return {
            pokemon: bestSwitch,
            reason: 'typeDisadvantage'
          };
        }
      }
    }
    
    return null;
  }
  
  // Perform a switch
  function performSwitch(teamState, newPokemon, opponent, reason = null) {
    const oldPokemon = teamState.active;
    logBattle(`${oldPokemon.name} switches out!`);
    
    // Track switch with reason
    tournamentStats.recordSwitch(oldPokemon.name, 'out', reason);
    tournamentStats.recordSwitch(newPokemon.name, 'in', reason);
    
    // Swap active with bench Pokemon
    const benchIndex = teamState.bench.indexOf(newPokemon);
    teamState.bench[benchIndex] = oldPokemon;
    teamState.active = newPokemon;
    
    logBattle(`Go! ${newPokemon.name}!`);
    
    // Apply switch-in abilities
    applyAbilityOnSwitchIn(newPokemon, opponent, field);
    applyAbilityForecast(newPokemon, field);
  }
  
  // Handle fainted Pokemon - must switch
  function handleFainted(teamState, opponentActive) {
    if (teamState.active && teamState.active.currentHP <= 0) {
      const availableBench = teamState.bench.filter(p => p && p.currentHP > 0);
      if (availableBench.length > 0) {
        logBattle(`${teamState.active.name} fainted!`);
        
        // Track switch (forced due to faint)
        const faintedPokemon = teamState.active;
        tournamentStats.recordSwitch(faintedPokemon.name, 'out', 'death');
        
        // Smart switch-in: pick Pokemon with best type matchup
        let bestReplacement = availableBench[0];
        let bestScore = -1000;
        
        for (const bench of availableBench) {
          let score = 0;
          if (opponentActive) {
            // Score based on defensive typing
            for (const oppType of opponentActive.types) {
              for (const benchType of bench.types) {
                const effectiveness = typeChart[oppType]?.[benchType] || 1;
                if (effectiveness < 1) score += 20;
                else if (effectiveness > 1) score -= 20;
              }
            }
            // Score based on offensive typing
            for (const benchType of bench.types) {
              for (const oppType of opponentActive.types) {
                const effectiveness = typeChart[benchType]?.[oppType] || 1;
                if (effectiveness > 1) score += 15;
                else if (effectiveness < 1) score -= 10;
              }
            }
          }
          // Factor in HP
          score += (bench.currentHP / bench.maxHp) * 10;
          
          if (score > bestScore) {
            bestScore = score;
            bestReplacement = bench;
          }
        }
        
        const benchIndex = teamState.bench.indexOf(bestReplacement);
        teamState.bench[benchIndex] = teamState.active;
        teamState.active = bestReplacement;
        
        // Track switch-in (forced due to death)
        tournamentStats.recordSwitch(bestReplacement.name, 'in', 'death');
        
        logBattle(`Go! ${bestReplacement.name}!`);
        
        // Apply switch-in abilities
        if (opponentActive && opponentActive.currentHP > 0) {
          applyAbilityOnSwitchIn(bestReplacement, opponentActive, field);
        }
        applyAbilityForecast(bestReplacement, field);
      } else {
        teamState.active = null;
      }
    }
  }
  
  // Check if team is defeated (all Pokemon fainted)
  function isTeamDefeated(teamState) {
    return teamState.pokemon.every(p => p.currentHP <= 0);
  }
  
  // Main battle loop
  while (!isTeamDefeated(team1State) && !isTeamDefeated(team2State) && turn < 200) {
    logBattle(`--- Turn ${turn} ---`);
    
    const p1 = team1State.active;
    const p2 = team2State.active;
    
    if (!p1 || !p2) break;
    
    // Track turns active
    tournamentStats.recordTurnActive(p1.name);
    tournamentStats.recordTurnActive(p2.name);
    
    // Reset damage tracking
    p1.lastDamageTaken = 0;
    p1.lastMoveCategory = null;
    p1.hitThisTurn = false;
    p2.lastDamageTaken = 0;
    p2.lastMoveCategory = null;
    p2.hitThisTurn = false;
    
    // Status damage
    processStatus(p1, { sleepClause });
    processStatus(p2, { sleepClause });
    
    // Check if anyone fainted from status
    if (p1.currentHP <= 0 || p2.currentHP <= 0) {
      handleFainted(team1State, team2State.active);
      handleFainted(team2State, team1State.active);
      if (isTeamDefeated(team1State) || isTeamDefeated(team2State)) break;
      turn++;
      continue;
    }
    
    // Switching phase (20% chance each turn before moves)
    if (Math.random() < 0.2) {
      const switchResult = shouldSwitch(team1State, team2State.active);
      if (switchResult) {
        performSwitch(team1State, switchResult.pokemon, team2State.active, switchResult.reason);
      }
    }
    
    if (Math.random() < 0.2) {
      const switchResult = shouldSwitch(team2State, team1State.active);
      if (switchResult) {
        performSwitch(team2State, switchResult.pokemon, team1State.active, switchResult.reason);
      }
    }
    
    // Select moves
    const p1Move = getPriorityMove(team1State.active, team2State.active, field);
    const p2Move = getPriorityMove(team2State.active, team1State.active, field);
    
    // Determine move order
    const p1Priority = p1Move.priority ?? 0;
    const p2Priority = p2Move.priority ?? 0;
    
    function effectiveSpeed(pokemon) {
      const stage = clampStage(pokemon.statStages?.spe ?? 0);
      let sp = Math.floor(pokemon.stats.spe * ((stage >= 0) ? (2 + stage) / 2 : 2 / (2 - stage)));
      if (pokemon.status === "paralysis") sp = Math.floor(sp / 2);
      const abilityMod = getAbilitySpeedModifier(pokemon, field);
      sp = Math.floor(sp * abilityMod);
      if (pokemon.item) {
        const item = getItem(pokemon.item);
        if (item && item.effect === 'CHOICE_SPE') sp = Math.floor(sp * item.multiplier);
      }
      return sp;
    }
    
    const p1Spe = effectiveSpeed(team1State.active);
    const p2Spe = effectiveSpeed(team2State.active);
    
    let p1Faster;
    if (p1Priority > p2Priority) {
      p1Faster = true;
    } else if (p2Priority > p1Priority) {
      p1Faster = false;
    } else {
      if (field.trickRoom > 0) {
        p1Faster = p1Spe < p2Spe || (p1Spe === p2Spe && Math.random() < 0.5);
      } else {
        p1Faster = p1Spe > p2Spe || (p1Spe === p2Spe && Math.random() < 0.5);
      }
    }
    
    // Execute moves
    if (p1Faster) {
      if (team1State.active.currentHP > 0) {
        performMove(team1State.active, team2State.active, p1Move, { field, turnNumber: turn, sleepClause });
      }
      if (team2State.active.currentHP > 0) {
        performMove(team2State.active, team1State.active, p2Move, { field, turnNumber: turn, sleepClause });
      }
    } else {
      if (team2State.active.currentHP > 0) {
        performMove(team2State.active, team1State.active, p2Move, { field, turnNumber: turn, sleepClause });
      }
      if (team1State.active.currentHP > 0) {
        performMove(team1State.active, team2State.active, p1Move, { field, turnNumber: turn, sleepClause });
      }
    }
    
    // Handle fainted Pokemon
    handleFainted(team1State, team2State.active);
    handleFainted(team2State, team1State.active);
    
    if (isTeamDefeated(team1State) || isTeamDefeated(team2State)) break;
    
    // End-of-turn effects
    if (team1State.active && team1State.active.currentHP > 0 && 
        team2State.active && team2State.active.currentHP > 0) {
      processEndOfTurn(team1State.active, team2State.active, field);
      applyAbilityEndOfTurn(team1State.active, field);
      applyAbilityEndOfTurn(team2State.active, field);
    }
    
    // Decrement field effects
    if (field.weather && field.weatherTurns > 0) {
      if (team1State.active) applyAbilityForecast(team1State.active, field);
      if (team2State.active) applyAbilityForecast(team2State.active, field);
      field.weatherTurns--;
      if (field.weatherTurns <= 0) {
        logBattle(`The ${field.weather} subsided.`);
        field.weather = null;
      }
    }
    
    if (field.trickRoom > 0) {
      field.trickRoom--;
      if (field.trickRoom <= 0) logBattle(`The twisted dimensions returned to normal!`);
    }
    
    if (field.tailwind > 0) {
      field.tailwind--;
      if (field.tailwind <= 0) logBattle(`The tailwind died down!`);
    }
    
    if (field.gravity > 0) {
      field.gravity--;
      if (field.gravity <= 0) logBattle(`Gravity returned to normal!`);
    }
    
    if (field.wonderRoom > 0) {
      field.wonderRoom--;
      if (field.wonderRoom <= 0) logBattle(`Wonder Room wore off!`);
    }
    
    turn++;
  }
  
  // Determine winner
  if (isTeamDefeated(team2State)) {
    const survivors = team1State.pokemon.filter(p => p.currentHP > 0);
    logBattle(`Team 1 wins! (Survivors: ${survivors.map(p => p.name).join(', ')})`);
    return team1;
  } else if (isTeamDefeated(team1State)) {
    const survivors = team2State.pokemon.filter(p => p.currentHP > 0);
    logBattle(`Team 2 wins! (Survivors: ${survivors.map(p => p.name).join(', ')})`);
    return team2;
  } else {
    logBattle('Battle timeout! Team 1 wins by default.');
    return team1;
  }
}

export function battle2v2(team1, team2) {
  clearLogs();
  let turn = 1;
  const field = { weather: null, weatherTurns: 0 };
  
  // Get active Pokemon (first alive in each team)
  let p1a = team1.find(p => p.currentHP > 0);
  let p1b = team1.find(p => p.currentHP > 0 && p !== p1a);
  let p2a = team2.find(p => p.currentHP > 0);
  let p2b = team2.find(p => p.currentHP > 0 && p !== p2a);
  
  // Apply switch-in abilities for all active Pokemon
  if (p1a) {
    applyAbilityOnSwitchIn(p1a, p2a, field);
    applyAbilityForecast(p1a, field);
  }
  if (p1b) {
    applyAbilityOnSwitchIn(p1b, p2a, field);
    applyAbilityForecast(p1b, field);
  }
  if (p2a) {
    applyAbilityOnSwitchIn(p2a, p1a, field);
    applyAbilityForecast(p2a, field);
  }
  if (p2b) {
    applyAbilityOnSwitchIn(p2b, p1a, field);
    applyAbilityForecast(p2b, field);
  }

  // Helper to check if a move is a spread move (hits multiple targets)
  function isSpreadMove(move) {
    const spreadMoves = [
      'earthquake', 'surf', 'magnitude', 'discharge', 'lava-plume', 'heat-wave',
      'blizzard', 'sludge-wave', 'rock-slide', 'bulldoze', 'razor-leaf',
      'icy-wind', 'parabolic-charge', 'boomburst', 'hyper-voice', 'struggle-bug',
      'acid', 'air-cutter', 'dazzling-gleam', 'muddy-water', 'origin-pulse',
      'precipice-blades', 'searing-shot', 'acid-spray', 'twister', 'powder-snow'
    ];
    return spreadMoves.includes(move.name);
  }
  
  // Smart target selection for 2v2 - considers KO potential and threat level
  function selectTarget2v2Smart(attacker, opponents, move) {
    if (opponents.length === 0) return null;
    if (opponents.length === 1) return opponents[0];
    
    const targets = opponents.filter(p => p);
    if (targets.length === 0) return null;
    if (targets.length === 1) return targets[0];
    
    // Score each target
    const scored = targets.map(target => {
      let score = 0;
      
      // Estimate damage to this target
      const damage = estimateDamage(attacker, target, move);
      
      // Huge bonus for securing KO
      if (damage >= target.currentHP) {
        score += 100; // KO is top priority
      } else {
        // Otherwise prefer bringing down the higher HP threat
        score += damage * 0.5;
      }
      
      // Prefer targeting Pokemon with lower HP% (finish off wounded)
      const hpPercent = target.currentHP / target.maxHp;
      score += (1 - hpPercent) * 30;
      
      return { target, score };
    });
    
    // Pick highest scoring target
    scored.sort((a, b) => b.score - a.score);
    return scored[0].target;
  }

  while (team1.some(p => p.currentHP > 0) && team2.some(p => p.currentHP > 0)) {
    logBattle(`--- Turn ${turn} ---`);
    
    // Get active Pokemon
    p1a = team1.find(p => p.currentHP > 0);
    p1b = team1.find(p => p.currentHP > 0 && p !== p1a);
    p2a = team2.find(p => p.currentHP > 0);
    p2b = team2.find(p => p.currentHP > 0 && p !== p2a);
    
    const activePokemon = [p1a, p1b, p2a, p2b].filter(p => p);
    
    // Reset damage tracking for all active Pokemon
    for (const p of activePokemon) {
      p.lastDamageTaken = 0;
      p.lastMoveCategory = null;
      p.hitThisTurn = false;
    }

    // Status damage
    for (const p of activePokemon) {
      if (p.currentHP > 0) processStatus(p);
    }
    if (!team1.some(p => p.currentHP > 0) || !team2.some(p => p.currentHP > 0)) break;

    // Determine move order for all active Pokemon
    const moveOrder = [];
    if (p1a && p1a.currentHP > 0) {
      const opponents = [p2a, p2b].filter(p => p && p.currentHP > 0);
      const move = getPriorityMove(p1a, opponents[0], field, true);
      // Spread moves hit both opponents AND partner (but not self)
      const targets = isSpreadMove(move) 
        ? [p1b, p2a, p2b].filter(p => p && p.currentHP > 0) 
        : [selectTarget2v2Smart(p1a, opponents, move)];
      moveOrder.push({ pokemon: p1a, move, targets, team: 1 });
    }
    if (p1b && p1b.currentHP > 0) {
      const opponents = [p2a, p2b].filter(p => p && p.currentHP > 0);
      const move = getPriorityMove(p1b, opponents[0], field, true);
      // Spread moves hit both opponents AND partner (but not self)
      const targets = isSpreadMove(move) 
        ? [p1a, p2a, p2b].filter(p => p && p.currentHP > 0) 
        : [selectTarget2v2Smart(p1b, opponents, move)];
      moveOrder.push({ pokemon: p1b, move, targets, team: 1 });
    }
    if (p2a && p2a.currentHP > 0) {
      const opponents = [p1a, p1b].filter(p => p && p.currentHP > 0);
      const move = getPriorityMove(p2a, opponents[0], field, true);
      // Spread moves hit both opponents AND partner (but not self)
      const targets = isSpreadMove(move) 
        ? [p2b, p1a, p1b].filter(p => p && p.currentHP > 0) 
        : [selectTarget2v2Smart(p2a, opponents, move)];
      moveOrder.push({ pokemon: p2a, move, targets, team: 2 });
    }
    if (p2b && p2b.currentHP > 0) {
      const opponents = [p1a, p1b].filter(p => p && p.currentHP > 0);
      const move = getPriorityMove(p2b, opponents[0], field, true);
      // Spread moves hit both opponents AND partner (but not self)
      const targets = isSpreadMove(move) 
        ? [p2a, p1a, p1b].filter(p => p && p.currentHP > 0) 
        : [selectTarget2v2Smart(p2b, opponents, move)];
      moveOrder.push({ pokemon: p2b, move, targets, team: 2 });
    }

    // Sort by priority and speed
    moveOrder.sort((a, b) => {
      const aPriority = a.move.priority ?? 0;
      const bPriority = b.move.priority ?? 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      
      // Same priority - check speed
      function effectiveSpeed(pokemon) {
        const stage = clampStage(pokemon.statStages?.spe ?? 0);
        let sp = Math.floor(pokemon.stats.spe * ((stage >= 0) ? (2 + stage) / 2 : 2 / (2 - stage)));
        if (pokemon.status === "paralysis") sp = Math.floor(sp / 2);
        const abilityMod = getAbilitySpeedModifier(pokemon, field);
        sp = Math.floor(sp * abilityMod);
        if (pokemon.item) {
          const item = getItem(pokemon.item);
          if (item && item.effect === 'CHOICE_SPE') sp = Math.floor(sp * item.multiplier);
        }
        return sp;
      }
      
      const aSpe = effectiveSpeed(a.pokemon);
      const bSpe = effectiveSpeed(b.pokemon);
      
      if (field.trickRoom > 0) {
        return aSpe - bSpe || (Math.random() < 0.5 ? -1 : 1);
      } else {
        return bSpe - aSpe || (Math.random() < 0.5 ? -1 : 1);
      }
    });

    // Execute moves in order
    for (const action of moveOrder) {
      if (action.pokemon.currentHP > 0) {
        const isSpread = action.targets.length > 1;
        for (const target of action.targets) {
          if (target && target.currentHP > 0) {
            // Apply 0.75x damage reduction for spread moves
            const spreadMultiplier = isSpread ? 0.75 : 1.0;
            performMove(action.pokemon, target, action.move, { field, spreadMultiplier, turnNumber: turn });
          }
        }
      }
    }

    // End-of-turn effects
    for (const p of activePokemon) {
      if (p.currentHP > 0) {
        applyAbilityEndOfTurn(p, field);
      }
    }
    
    // Process end of turn for pairs
    if (p1a && p1a.currentHP > 0 && p2a && p2a.currentHP > 0) {
      processEndOfTurn(p1a, p2a, field);
    }
    if (p1b && p1b.currentHP > 0 && p2b && p2b.currentHP > 0) {
      processEndOfTurn(p1b, p2b, field);
    }

    // Decrement weather turns
    if (field.weather && field.weatherTurns > 0) {
      for (const p of activePokemon) {
        if (p.currentHP > 0) applyAbilityForecast(p, field);
      }
      field.weatherTurns--;
      if (field.weatherTurns <= 0) {
        logBattle(`The ${field.weather} subsided.`);
        field.weather = null;
      }
    }

    // Decrement screen turns
    if (field.reflect > 0) field.reflect--;
    if (field.lightScreen > 0) field.lightScreen--;
    if (field.trickRoom > 0) field.trickRoom--;

    turn++;
    if (turn > 100) {
      logBattle('Battle timed out after 100 turns.');
      break;
    }
  }

  // Return winning team
  if (team1.some(p => p.currentHP > 0)) {
    logBattle(`Team 1 wins! (${team1.filter(p => p.currentHP > 0).map(p => p.name).join(', ')})`);
    return team1;
  } else {
    logBattle(`Team 2 wins! (${team2.filter(p => p.currentHP > 0).map(p => p.name).join(', ')})`);
    return team2;
  }
}

// Full 4v4 Doubles Battle with switching mechanics
// Each team has 4 Pokemon, only 2 are active at a time
export function battle2v2Full(team1, team2) {
  const field = {};
  let turn = 1;
  
  // Initialize team structures
  const team1State = {
    pokemon: [...team1],
    active: [null, null], // Two active slots
    bench: []
  };
  
  const team2State = {
    pokemon: [...team2],
    active: [null, null],
    bench: []
  };
  
  // Randomly select starting 2 Pokemon for each team
  function selectStarters(teamState) {
    const shuffled = [...teamState.pokemon];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    teamState.active = [shuffled[0], shuffled[1]];
    teamState.bench = [shuffled[2], shuffled[3]];
    
    logBattle(`${teamState.active[0].name} and ${teamState.active[1].name} are sent out!`);
  }
  
  selectStarters(team1State);
  selectStarters(team2State);
  
  // Apply switch-in abilities for starters
  for (const p of team1State.active) {
    if (p) {
      applyAbilityOnSwitchIn(p, team2State.active[0], field);
      applyAbilityForecast(p, field);
    }
  }
  for (const p of team2State.active) {
    if (p) {
      applyAbilityOnSwitchIn(p, team1State.active[0], field);
      applyAbilityForecast(p, field);
    }
  }
  
  // Helper to check if a move is a spread move
  function isSpreadMove(move) {
    const spreadMoves = [
      'earthquake', 'surf', 'magnitude', 'discharge', 'lava-plume', 'heat-wave',
      'blizzard', 'sludge-wave', 'rock-slide', 'bulldoze', 'razor-leaf',
      'icy-wind', 'parabolic-charge', 'boomburst', 'hyper-voice', 'struggle-bug',
      'acid', 'air-cutter', 'dazzling-gleam', 'muddy-water', 'origin-pulse',
      'precipice-blades', 'searing-shot', 'acid-spray', 'twister', 'powder-snow'
    ];
    return spreadMoves.includes(move.name);
  }
  
  // Smart target selection
  function selectTarget2v2Smart(attacker, opponents, move) {
    if (opponents.length === 0) return null;
    if (opponents.length === 1) return opponents[0];
    
    const targets = opponents.filter(p => p);
    if (targets.length === 0) return null;
    if (targets.length === 1) return targets[0];
    
    const scored = targets.map(target => {
      let score = 0;
      const damage = estimateDamage(attacker, target, move);
      if (damage >= target.currentHP) {
        score += 100;
      } else {
        score += damage * 0.5;
      }
      const hpPercent = target.currentHP / target.maxHp;
      score += (1 - hpPercent) * 30;
      return { target, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    return scored[0].target;
  }
  
  // Switching AI - decides if and when to switch
  function shouldSwitch(teamState, activeIndex, opponents) {
    const active = teamState.active[activeIndex];
    if (!active || active.currentHP <= 0) return null;
    
    const availableBench = teamState.bench.filter(p => p && p.currentHP > 0);
    if (availableBench.length === 0) return null;
    
    // Don't switch too often - only in specific situations
    const hpPercent = active.currentHP / active.maxHp;
    
    // Consider switching if very low HP and have healthy bench
    if (hpPercent < 0.25) {
      const healthyBench = availableBench.filter(p => p.currentHP / p.maxHp > 0.7);
      if (healthyBench.length > 0) {
        // Only switch if opponent has type advantage
        let hasDisadvantage = false;
        for (const opp of opponents) {
          if (opp && opp.currentHP > 0) {
            // Check if any of opponent's types have advantage over us
            for (const oppType of opp.types) {
              for (const myType of active.types) {
                const effectiveness = typeChart[oppType]?.[myType] || 1;
                if (effectiveness > 1) {
                  hasDisadvantage = true;
                  break;
                }
              }
              if (hasDisadvantage) break;
            }
          }
        }
        
        if (hasDisadvantage && Math.random() < 0.4) {
          // Pick best bench Pokemon based on type matchup
          let bestSwitch = healthyBench[0];
          let bestScore = -1000;
          
          for (const bench of healthyBench) {
            let score = 0;
            for (const opp of opponents) {
              if (opp && opp.currentHP > 0) {
                // Score based on defensive typing
                for (const oppType of opp.types) {
                  for (const benchType of bench.types) {
                    const effectiveness = typeChart[oppType]?.[benchType] || 1;
                    if (effectiveness < 1) score += 20; // Resist
                    else if (effectiveness > 1) score -= 20; // Weak
                  }
                }
              }
            }
            if (score > bestScore) {
              bestScore = score;
              bestSwitch = bench;
            }
          }
          
          return bestSwitch;
        }
      }
    }
    
    return null;
  }
  
  // Perform a switch
  function performSwitch(teamState, activeIndex, newPokemon) {
    const oldPokemon = teamState.active[activeIndex];
    logBattle(`${oldPokemon.name} switches out!`);
    
    // Remove from active, add to bench
    const benchIndex = teamState.bench.indexOf(newPokemon);
    teamState.bench[benchIndex] = oldPokemon;
    teamState.active[activeIndex] = newPokemon;
    
    logBattle(`Go! ${newPokemon.name}!`);
    
    // Apply switch-in abilities
    const opponents = teamState === team1State ? team2State.active : team1State.active;
    const validOpponent = opponents.find(opp => opp && opp.currentHP > 0);
    if (validOpponent) {
      applyAbilityOnSwitchIn(newPokemon, validOpponent, field);
    }
    applyAbilityForecast(newPokemon, field);
  }
  
  // Handle fainted Pokemon - must switch
  function handleFainted(teamState) {
    for (let i = 0; i < teamState.active.length; i++) {
      const active = teamState.active[i];
      if (active && active.currentHP <= 0) {
        const availableBench = teamState.bench.filter(p => p && p.currentHP > 0);
        if (availableBench.length > 0) {
          // Pick first available (or random)
          const replacement = availableBench[0];
          logBattle(`${active.name} fainted!`);
          
          const benchIndex = teamState.bench.indexOf(replacement);
          teamState.bench[benchIndex] = active;
          teamState.active[i] = replacement;
          
          logBattle(`Go! ${replacement.name}!`);
          
          // Apply switch-in abilities
          const opponents = teamState === team1State ? team2State.active : team1State.active;
          const firstOpponent = opponents.find(opp => opp && opp.currentHP > 0);
          if (firstOpponent) {
            applyAbilityOnSwitchIn(replacement, firstOpponent, field);
          }
          applyAbilityForecast(replacement, field);
        } else {
          teamState.active[i] = null;
        }
      }
    }
  }
  
  // Check if team is defeated (all Pokemon fainted)
  function isTeamDefeated(teamState) {
    return teamState.pokemon.every(p => p.currentHP <= 0);
  }
  
  // Main battle loop
  while (!isTeamDefeated(team1State) && !isTeamDefeated(team2State)) {
    logBattle(`--- Turn ${turn} ---`);
    
    const allActive = [...team1State.active, ...team2State.active].filter(p => p && p.currentHP > 0);
    
    // Reset damage tracking
    for (const p of allActive) {
      p.lastDamageTaken = 0;
      p.lastMoveCategory = null;
      p.hitThisTurn = false;
    }
    
    // Status damage
    for (const p of allActive) {
      if (p.currentHP > 0) processStatus(p);
    }
    if (isTeamDefeated(team1State) || isTeamDefeated(team2State)) break;
    
    // Handle fainted Pokemon
    handleFainted(team1State);
    handleFainted(team2State);
    if (isTeamDefeated(team1State) || isTeamDefeated(team2State)) break;
    
    // Switching phase - check if any Pokemon want to switch
    const switches = [];
    
    for (let i = 0; i < 2; i++) {
      const p1 = team1State.active[i];
      if (p1 && p1.currentHP > 0) {
        const switchTo = shouldSwitch(team1State, i, team2State.active.filter(p => p));
        if (switchTo) {
          switches.push({ teamState: team1State, activeIndex: i, newPokemon: switchTo });
        }
      }
      
      const p2 = team2State.active[i];
      if (p2 && p2.currentHP > 0) {
        const switchTo = shouldSwitch(team2State, i, team1State.active.filter(p => p));
        if (switchTo) {
          switches.push({ teamState: team2State, activeIndex: i, newPokemon: switchTo });
        }
      }
    }
    
    // Execute switches
    for (const sw of switches) {
      performSwitch(sw.teamState, sw.activeIndex, sw.newPokemon);
    }
    
    // Build move order
    const moveOrder = [];
    
    for (let i = 0; i < 2; i++) {
      const p1 = team1State.active[i];
      if (p1 && p1.currentHP > 0) {
        const opponents = team2State.active.filter(p => p && p.currentHP > 0);
        const firstOpponent = opponents[0] || team2State.active.find(p => p && p.currentHP > 0);
        const move = getPriorityMove(p1, firstOpponent, field, true);
        const targets = isSpreadMove(move)
          ? [...team1State.active.filter((p, idx) => p && idx !== i && p.currentHP > 0), ...opponents]
          : [selectTarget2v2Smart(p1, opponents, move)];
        moveOrder.push({ pokemon: p1, move, targets });
      }
      
      const p2 = team2State.active[i];
      if (p2 && p2.currentHP > 0) {
        const opponents = team1State.active.filter(p => p && p.currentHP > 0);
        const firstOpponent = opponents[0] || team1State.active.find(p => p && p.currentHP > 0);
        const move = getPriorityMove(p2, firstOpponent, field, true);
        const targets = isSpreadMove(move)
          ? [...team2State.active.filter((p, idx) => p && idx !== i && p.currentHP > 0), ...opponents]
          : [selectTarget2v2Smart(p2, opponents, move)];
        moveOrder.push({ pokemon: p2, move, targets });
      }
    }
    
    // Sort by priority and speed
    moveOrder.sort((a, b) => {
      const aPriority = a.move.priority ?? 0;
      const bPriority = b.move.priority ?? 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      
      function effectiveSpeed(pokemon) {
        const stage = clampStage(pokemon.statStages?.spe ?? 0);
        let sp = Math.floor(pokemon.stats.spe * ((stage >= 0) ? (2 + stage) / 2 : 2 / (2 - stage)));
        if (pokemon.status === "paralysis") sp = Math.floor(sp / 2);
        const abilityMod = getAbilitySpeedModifier(pokemon, field);
        sp = Math.floor(sp * abilityMod);
        if (pokemon.item) {
          const item = getItem(pokemon.item);
          if (item && item.effect === 'CHOICE_SPE') sp = Math.floor(sp * item.multiplier);
        }
        return sp;
      }
      
      const aSpe = effectiveSpeed(a.pokemon);
      const bSpe = effectiveSpeed(b.pokemon);
      
      if (field.trickRoom > 0) {
        return aSpe - bSpe || (Math.random() < 0.5 ? -1 : 1);
      } else {
        return bSpe - aSpe || (Math.random() < 0.5 ? -1 : 1);
      }
    });
    
    // Execute moves
    for (const action of moveOrder) {
      if (action.pokemon.currentHP > 0) {
        const isSpread = action.targets.length > 1;
        for (const target of action.targets) {
          if (target && target.currentHP > 0) {
            const spreadMultiplier = isSpread ? 0.75 : 1.0;
            performMove(action.pokemon, target, action.move, { field, spreadMultiplier, turnNumber: turn });
          }
        }
      }
    }
    
    // Handle fainted Pokemon after moves
    handleFainted(team1State);
    handleFainted(team2State);
    
    // End-of-turn effects
    for (const p of allActive) {
      if (p.currentHP > 0) {
        applyAbilityEndOfTurn(p, field);
      }
    }
    
    // Process end of turn for active Pokemon
    const currentActive = [...team1State.active, ...team2State.active].filter(p => p && p.currentHP > 0);
    for (let i = 0; i < currentActive.length - 1; i++) {
      if (currentActive[i] && currentActive[i + 1]) {
        processEndOfTurn(currentActive[i], currentActive[i + 1], field);
      }
    }
    
    // Decrement field effects
    if (field.weather && field.weatherTurns > 0) {
      for (const p of currentActive) {
        if (p.currentHP > 0) applyAbilityForecast(p, field);
      }
      field.weatherTurns--;
      if (field.weatherTurns <= 0) {
        logBattle(`The ${field.weather} subsided.`);
        field.weather = null;
      }
    }
    
    if (field.trickRoom > 0) {
      field.trickRoom--;
      if (field.trickRoom <= 0) {
        logBattle(`The twisted dimensions returned to normal!`);
      }
    }
    
    if (field.tailwind > 0) {
      field.tailwind--;
      if (field.tailwind <= 0) {
        logBattle(`The tailwind died down!`);
      }
    }
    
    if (field.gravity > 0) {
      field.gravity--;
      if (field.gravity <= 0) {
        logBattle(`Gravity returned to normal!`);
      }
    }
    
    if (field.wonderRoom > 0) {
      field.wonderRoom--;
      if (field.wonderRoom <= 0) {
        logBattle(`Wonder Room wore off!`);
      }
    }
    
    if (field['light-screen'] > 0) field['light-screen']--;
    if (field['reflect'] > 0) field['reflect']--;
    
    turn++;
    if (turn > 100) {
      logBattle('Battle timeout! Draw.');
      return team1;
    }
  }
  
  if (isTeamDefeated(team2State)) {
    logBattle(`Team 1 wins! (${team1State.pokemon.filter(p => p.currentHP > 0).map(p => p.name).join(', ')})`);
    return team1;
  } else {
    logBattle(`Team 2 wins! (${team2State.pokemon.filter(p => p.currentHP > 0).map(p => p.name).join(', ')})`);
    return team2;
  }
}

// Helper function to select target in 2v2 battle
function selectTarget2v2(attacker, opponents) {
  // Filter out fainted opponents
  const aliveOpponents = opponents.filter(p => p && p.currentHP > 0);
  if (aliveOpponents.length === 0) return null;
  if (aliveOpponents.length === 1) return aliveOpponents[0];
  
  // Simple AI: target the one with lower HP percentage
  aliveOpponents.sort((a, b) => {
    const aHpPercent = a.currentHP / a.stats.hp;
    const bHpPercent = b.currentHP / b.stats.hp;
    return aHpPercent - bHpPercent;
  });
  
  return aliveOpponents[0];
}
