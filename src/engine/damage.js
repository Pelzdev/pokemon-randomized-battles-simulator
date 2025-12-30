import { typeChart } from "../data/typeChart.js";
import { clampStage } from "./statUtils.js";
import { randomInt } from "../utils/random.js";
import { applyAbilityOnDamageCalculation, checkAbilityUnaware } from "./abilities.js";
import { getItem } from "../data/items.js";

// Implements the canonical integer-based damage calculation used in modern gens.
// Uses the discrete random multiplier 217..255 / 255 and floors at the standard steps.
export function calculateDamage(attacker, defender, move, isCrit = false, options = {}) {
  if (!move || !move.power) return 0;
  const isSpecial = move.category === "special";

  // Store field reference in attacker for Weather Ball check
  if (options.field) {
    attacker.field = options.field;
  }

  // Calculate variable power for certain moves
  let movePower = move.power;
  
  // Reversal/Flail - power based on user's remaining HP
  if (move.name === 'reversal' || move.name === 'flail') {
    const hpPercent = (attacker.currentHP / attacker.maxHp) * 100;
    if (hpPercent < 4.17) movePower = 200;
    else if (hpPercent < 10.42) movePower = 150;
    else if (hpPercent < 20.83) movePower = 100;
    else if (hpPercent < 35.42) movePower = 80;
    else if (hpPercent < 68.75) movePower = 40;
    else movePower = 20;
  }
  
  // Eruption/Water Spout - power based on user's remaining HP (max 150)
  if (move.name === 'eruption' || move.name === 'water-spout') {
    movePower = Math.max(1, Math.floor(150 * attacker.currentHP / attacker.maxHp));
  }
  
  // Magnitude - random power between 10-150
  if (move.name === 'magnitude') {
    const roll = Math.random() * 100;
    if (roll < 5) movePower = 10;        // 5% - Magnitude 4
    else if (roll < 15) movePower = 30;  // 10% - Magnitude 5
    else if (roll < 35) movePower = 50;  // 20% - Magnitude 6
    else if (roll < 65) movePower = 70;  // 30% - Magnitude 7
    else if (roll < 85) movePower = 90;  // 20% - Magnitude 8
    else if (roll < 95) movePower = 110; // 10% - Magnitude 9
    else movePower = 150;                // 5% - Magnitude 10
  }
  
  // Rollout - power doubles each turn (30→60→120→240→480)
  if (move.name === 'rollout' || move.name === 'ice-ball') {
    const rolloutTurn = attacker.rolloutTurn || 1;
    movePower = 30 * Math.pow(2, rolloutTurn - 1);
  }
  
  // Fury Cutter - power doubles on consecutive hits (40→80→160 max)
  if (move.name === 'fury-cutter') {
    const furyCutterStreak = attacker.furyCutterStreak || 1;
    movePower = Math.min(160, 40 * Math.pow(2, furyCutterStreak - 1));
  }
  
  // Weather Ball - doubles power and changes type based on weather
  if (move.name === 'weather-ball') {
    const field = attacker.field || {};
    if (field.weather) {
      movePower = 100; // doubles from 50
    }
  }
  
  // Hex - doubles power if target has status condition
  if (move.name === 'hex' || move.name === 'venoshock') {
    if (defender.status) {
      movePower = 130; // doubles from 65
    }
  }
  
  // Vengeance/Revenge - doubles power if user was hit this turn
  if (move.name === 'vengeance' || move.name === 'revenge') {
    if (attacker.hitThisTurn) {
      movePower = 120; // doubles from 60
    }
  }
  
  // Acrobatics - doubles power if no item (always true since no items yet)
  if (move.name === 'acrobatics') {
    movePower = 110; // doubles from 55
  }

  const atkBase = isSpecial ? attacker.stats.spA : attacker.stats.atk;
  let defBase = isSpecial ? defender.stats.spD : defender.stats.def;
  
  // Wonder Room swaps defense and special defense
  if (options.field?.wonderRoom > 0) {
    defBase = isSpecial ? defender.stats.def : defender.stats.spD;
  }

  let atkStage = clampStage(attacker.statStages?.[isSpecial ? "spA" : "atk"] ?? 0);
  let defStage = clampStage(defender.statStages?.[isSpecial ? "spD" : "def"] ?? 0);
  
  // Unaware - ignore opponent's stat stages
  if (checkAbilityUnaware(attacker)) {
    defStage = 0; // Ignore defender's defensive stat stages
  }
  if (checkAbilityUnaware(defender)) {
    atkStage = 0; // Ignore attacker's offensive stat stages
  }

  // Critical hits ignore positive defensive stat stages
  if (isCrit && defStage > 0) defStage = 0;

  function stageMultiplier(stage) {
    if (stage >= 0) return (2 + stage) / 2;
    return 2 / (2 - stage);
  }

  let atk = Math.max(1, Math.floor(atkBase * stageMultiplier(atkStage)));
  let def = Math.max(1, Math.floor(defBase * stageMultiplier(defStage)));
  
  // Assault Vest boosts Special Defense by 50%
  if (defender.item && isSpecial) {
    const item = getItem(defender.item);
    if (item && item.effect === 'ASSAULT_VEST') {
      def = Math.floor(def * item.multiplier);
    }
  }
  
  // Explosion and Self-Destruct halve the target's defense in damage calculation
  if (move.name === 'explosion' || move.name === 'self-destruct') {
    def = Math.floor(def / 2);
  }

  // Burn halves physical attack (unless abilities/items modify it; not implemented)
  if (attacker.status === "burn" && !isSpecial) {
    atk = Math.floor(atk / 2);
  }

  // Step 1: initial base
  const levelFactor = Math.floor((2 * attacker.level) / 5) + 2; // floor

  // Step 2: intermediate multiplication and flooring
  // X = floor(levelFactor * power * atk / def)
  let X = Math.floor((levelFactor * movePower * atk) / Math.max(1, def));

  // Step 3: damage before modifiers
  // Y = floor(X / 50) + 2
  let Y = Math.floor(X / 50) + 2;

  // Modifier components
  let modifier = 1;
  // STAB
  if (attacker.types.includes(move.type)) modifier *= 1.5;
  // Type effectiveness
  const typeMult = defender.types.reduce((mult, t) => mult * (typeChart[move.type]?.[t] ?? 1), 1);
  modifier *= typeMult;
  // Critical
  if (isCrit) modifier *= 1.5;
  // Burn handled above by halving attack
  
  // Spread move reduction (0.75x in double battles)
  if (options.spreadMultiplier) {
    modifier *= options.spreadMultiplier;
  }

  // Screen effects (Light Screen / Reflect)
  // In 1v1 battles, screens reduce damage by 50% (in doubles it's 33%)
  if (!isCrit) { // Screens are ignored on critical hits
    const field = options.field || {};
    if (isSpecial && field["light-screen"] > 0) {
      modifier *= 0.5;
    } else if (!isSpecial && field["reflect"] > 0) {
      modifier *= 0.5;
    }
  }

  // Random: integer between 217 and 255 inclusive, divided by 255
  const rand217_255 = randomInt(217, 255);

  // Final damage: floor(Y * modifier * rand / 255)
  let dmg = Math.floor((Y * modifier * rand217_255) / 255);
  dmg = Math.max(1, dmg);
  
  // Apply ability modifiers
  dmg = applyAbilityOnDamageCalculation(attacker, defender, move, dmg);
  
  // Apply item modifiers
  dmg = applyItemOnDamage(attacker, defender, move, dmg, typeMult, isSpecial);

  return dmg;
}

// Apply item effects to damage calculation
function applyItemOnDamage(attacker, defender, move, damage, typeMult, isSpecial) {
  if (!attacker.item) return damage;
  
  const item = getItem(attacker.item);
  if (!item) return damage;
  
  let modifier = 1;
  
  // Choice items - boost attack/special attack/speed
  if (item.effect === 'CHOICE_ATK' && !isSpecial) {
    modifier *= item.multiplier;
  } else if (item.effect === 'CHOICE_SPA' && isSpecial) {
    modifier *= item.multiplier;
  }
  
  // Life Orb - boost all attacks
  if (item.effect === 'LIFE_ORB') {
    modifier *= item.multiplier;
  }
  
  // Type-boosting items
  if (item.effect === 'TYPE_BOOST' && move.type === item.type) {
    modifier *= item.multiplier;
  }
  
  // Expert Belt - boost super effective moves
  if (item.effect === 'EXPERT_BELT' && typeMult > 1) {
    modifier *= item.multiplier;
  }
  
  // Category boost items (Muscle Band / Wise Glasses)
  if (item.effect === 'CATEGORY_BOOST' && move.category === item.category) {
    modifier *= item.multiplier;
  }
  
  return Math.floor(damage * modifier);
}
