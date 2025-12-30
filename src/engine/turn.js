import { rollChance, randomInt } from "../utils/random.js";
import { calculateDamage } from "./damage.js";
import { logBattle } from "../utils/logger.js";
import { tournamentStats } from "../utils/tournamentStats.js";
import { normalizeStat, displayStat, clampStage } from "./statUtils.js";
import { moves as movesData } from "../data/moves.js";
import { getItem } from "../data/items.js";
import { 
  checkAbilityImmunity, 
  applyAbilityOnSwitchIn, 
  checkAbilityStatusImmunity, 
  checkAbilityPreventStatLoss,
  applyAbilityOnContact,
  checkAbilityBlocksCrit,
  checkAbilityBlocksFlinch,
  getAbilityAccuracyModifier,
  checkAbilitySturdy,
  checkAbilityBlocksSecondaryEffects,
  getAbilityEffectChanceMultiplier,
  checkAbilityPreventsRecoil,
  applyAbilityOnStatusInflicted,
  checkAbilityDamagesLeech,
  getAbilitySleepDurationModifier,
  checkAbilityTruant,
  checkAbilityPreventsExplosion,
  checkAbilitySoundproof,
  checkAbilityLightningRod,
  getAbilityHustleAccuracyModifier,
  applyAbilityForecast,
  checkAbilityMagicGuard,
  checkAbilitySheerForce,
  applyAbilityOnKO,
  applyAbilitySimple,
  applyAbilityContrary,
  checkAbilityPressure
} from "./abilities.js";
// Struggle fallback move used when a Pokémon has no PP left for any move.
const STRUGGLE_MOVE = {
  name: 'struggle',
  type: 'typeless',
  category: 'physical',
  power: 50,
  accuracy: 100,
  pp: null,
  priority: 0,
  effects: [ { type: 'RECOIL', amount: 25 } ]
};
import { typeChart } from "../data/typeChart.js";

// Moves that require a charging turn before hitting (Gen1-style)
const TWO_TURN_BY_NAME = new Set(['skull-bash', 'sky-attack', 'solar-beam', 'dig', 'fly', 'dive', 'razor-wind']);

// Trapping moves that trap the opponent for 2-5 turns
const TRAPPING_MOVES = new Set(['wrap', 'bind', 'fire-spin', 'clamp', 'whirlpool', 'sand-tomb', 'magma-storm']);

export function performMove(attacker, defender, move, options = {}) {
  if (!move) throw new Error("Unknown move: " + move);

  // Check recharge - must rest after using recharge moves
  if (attacker.mustRecharge) {
    logBattle(`${attacker.name} must recharge!`);
    attacker.mustRecharge = false;
    return 0;
  }

  // Check Truant - loafs every other turn
  if (checkAbilityTruant(attacker)) {
    logBattle(`${attacker.name} is loafing around!`);
    return 0;
  }
  
  // Assault Vest prevents status moves
  if (attacker.item) {
    const item = getItem(attacker.item);
    if (item && item.effect === 'ASSAULT_VEST' && move.category === 'status') {
      logBattle(`${attacker.name} can't use status moves with Assault Vest!`);
      return 0;
    }
  }
  
  // Choice item locking - force use of locked move
  if (attacker.choiceLockedMove && move.name !== attacker.choiceLockedMove.name) {
    logBattle(`${attacker.name} must use ${attacker.choiceLockedMove.name} due to Choice item!`);
    move = attacker.choiceLockedMove;
  }
  
  // Check Taunt - prevents status moves
  if (attacker.taunted && move.category === "status") {
    logBattle(`${attacker.name} can't use ${move.name} due to Taunt!`);
    return 0;
  }
  
  // Check Disable - prevents using disabled move
  if (attacker.disabledMove === move.name) {
    logBattle(`${attacker.name} can't use ${move.name} - it's disabled!`);
    return 0;
  }
  
  // Check Torment - prevents using same move twice in a row
  if (attacker.tormented && attacker.lastMoveUsed?.name === move.name) {
    logBattle(`${attacker.name} can't use ${move.name} twice in a row due to Torment!`);
    return 0;
  }
  
  // Check Encore - forces use of encored move
  if (attacker.encored && attacker.encoredMove && move.name !== attacker.encoredMove.name) {
    logBattle(`${attacker.name} must use ${attacker.encoredMove.name} due to Encore!`);
    move = attacker.encoredMove;
  }

  // If move has PP tracking and is depleted, use Struggle instead.
  if (typeof move.currentPP === 'number' && move.currentPP <= 0) {
    logBattle(`${attacker.name} tried to use ${move.name} but has no PP left!`);
    move = STRUGGLE_MOVE;
  } else {
    // PP check/decrement (if move has PP tracking)
    if (typeof move.currentPP === 'number') {
      let ppDeduction = 1;
      // Pressure doubles PP usage
      if (checkAbilityPressure(defender)) {
        ppDeduction = 2;
      }
      move.currentPP = Math.max(0, move.currentPP - ppDeduction);
    }
  }
  
  // Track last move used for Encore, Disable, Torment
  attacker.lastMoveUsed = move;

  // Two-turn moves: if currently in the second turn, use the stored move
  if (attacker.currentMove?.waitTurn) {
    logBattle(`${attacker.name} continues ${attacker.currentMove.name}!`);
    // Use the originally chosen move for resolution (in case AI picked another move now)
    move = attacker.currentMove.move;
    attacker.currentMove.waitTurn = false;
    attacker.charging = null; // No longer semi-invulnerable
  } else if (move.effects?.some(e => e.type === "TWO_TURN") || TWO_TURN_BY_NAME.has(move.name)) {
    // Solar Beam skips charging turn in sun
    if (move.name === 'solar-beam' && options.field?.weather === 'sun') {
      logBattle(`${attacker.name} used ${move.name}!`);
      // Continue to normal execution without charging
    } else {
      logBattle(`${attacker.name} started ${move.name}!`);
      attacker.currentMove = { name: move.name, waitTurn: true, move };
      // Only certain moves make the user semi-invulnerable
      const invulnerableMoves = ["fly", "bounce", "dig", "dive"];
      if (invulnerableMoves.includes(move.name)) {
        if (move.name === "fly" || move.name === "bounce") {
          attacker.charging = "flying";
          logBattle(`${attacker.name} flew up high!`);
        } else if (move.name === "dig") {
          attacker.charging = "underground";
          logBattle(`${attacker.name} dug underground!`);
        } else if (move.name === "dive") {
          attacker.charging = "underwater";
          logBattle(`${attacker.name} dove underwater!`);
        }
      } else {
        // Moves like Solar Beam, Razor Wind, Skull Bash, Sky Attack just charge without invulnerability
        attacker.charging = null;
      }
      return 0;
    }
  } else {
    attacker.currentMove = null;
  }

  // Flinch / Skip if flinched
  if (attacker.flinched) {
    logBattle(`${attacker.name} flinched and couldn't move!`);
    attacker.flinched = false;
    return 0;
  }

  // Status checks that can prevent moving (can be bypassed by options.allowWhileAsleep)
  // Allow certain sleep-related moves to bypass the sleep block (Sleep Talk / Snore)
  if (attacker.status === "sleep" && !options.allowWhileAsleep && move.name !== "sleep-talk" && move.name !== "snore") {
    if ((attacker.statusTurns ?? 0) > 0) {
      logBattle(`${attacker.name} is asleep and can't move!`);
      // Early Bird makes sleep pass twice as fast
      const sleepMod = getAbilitySleepDurationModifier(attacker);
      attacker.statusTurns -= sleepMod;
      if (attacker.statusTurns <= 0) {
        attacker.status = null;
        logBattle(`${attacker.name} woke up!`);
      }
      return 0;
    }
  }

  if (attacker.status === "freeze") {
    // 20% chance to thaw each turn
    if (!rollChance(20)) {
      logBattle(`${attacker.name} is frozen solid!`);
      return 0;
    } else {
      attacker.status = null;
      logBattle(`${attacker.name} thawed out!`);
    }
  }

  if (attacker.status === "paralysis") {
    // 25% chance to be fully paralyzed
    if (rollChance(25)) {
      logBattle(`${attacker.name} is paralyzed and can't move!`);
      return 0;
    }
  }

  if ((attacker.confusionTurns ?? 0) > 0) {
    // 50% chance to hurt self
    attacker.confusionTurns--;
    if (rollChance(50)) {
      const selfDmgMove = { category: "physical", power: 40, type: "confusion" };
      const selfDmg = calculateDamage(attacker, attacker, selfDmgMove);
      attacker.currentHP -= selfDmg;
      logBattle(`${attacker.name} is confused and hurt itself for ${selfDmg} damage!`);
      if (attacker.confusionTurns <= 0) logBattle(`${attacker.name} snapped out of confusion!`);
      return 0;
    } else {
      if (attacker.confusionTurns <= 0) logBattle(`${attacker.name} snapped out of confusion!`);
    }
  }

  // Special move behaviours: Rest / Snore / Sleep Talk
  if (move.name === "rest") {
    // Rest fully restores HP and induces sleep for 2 turns
    attacker.currentHP = attacker.maxHp;
    attacker.status = "sleep";
    attacker.statusTurns = 2;
    attacker.toxicCounter = 0;
    attacker.confusionTurns = 0;
    logBattle(`${attacker.name} used Rest and fell asleep to recover HP!`);
    return 0;
  }

  if (move.name === "snore") {
    if (attacker.status !== "sleep") {
      logBattle(`${attacker.name} tried to use Snore but isn't asleep!`);
      return 0;
    }
    // Snore behaves like a 50-power special move; decrement sleep duration
    if ((attacker.statusTurns ?? 0) > 0) {
      attacker.statusTurns--;
      if (attacker.statusTurns <= 0) {
        attacker.status = null;
        logBattle(`${attacker.name} woke up!`);
      }
    }
    // continue to normal resolution
  }

  if (move.name === "sleep-talk") {
    if (attacker.status !== "sleep") {
      logBattle(`${attacker.name} tried to use Sleep Talk but isn't asleep!`);
      return 0;
    }
    // Decrement sleep duration for this turn
    if ((attacker.statusTurns ?? 0) > 0) {
      attacker.statusTurns--;
      if (attacker.statusTurns <= 0) {
        attacker.status = null;
        logBattle(`${attacker.name} woke up!`);
      }
    }

    // Choose a random non-status move from user's moves (excluding Sleep Talk)
    const usable = attacker.moves.filter(m => m.name !== "sleep-talk" && m.category !== "status");
    if (!usable.length) {
      logBattle(`${attacker.name} had no moves to use with Sleep Talk!`);
      return 0;
    }
    const chosen = usable[Math.floor(Math.random() * usable.length)];
    logBattle(`${attacker.name} used Sleep Talk and called ${chosen.name}!`);
    // Execute chosen move but allow it while asleep
    return performMove(attacker, defender, chosen, { allowWhileAsleep: true });
  }
  
  // Destiny Bond - status move that causes opponent to faint if user faints before its next turn
  if (move.name === "destiny-bond") {
    attacker.destinyBond = true;
    logBattle(`${attacker.name} is trying to take its foe down with it!`);
    return 0;
  }
  
  // Future Sight / Doom Desire - delayed damage moves (hit 2 turns later)
  if (move.name === "future-sight" || move.name === "doom-desire") {
    if (!options.field.futureSight) {
      options.field.futureSight = [];
    }
    options.field.futureSight.push({
      turnsLeft: 2,
      move: move,
      attacker: attacker,
      target: defender
    });
    logBattle(`${attacker.name} foresaw an attack!`);
    return 0;
  }
  
  // Wish - heals at the end of next turn (50% max HP)
  if (move.name === "wish") {
    attacker.wishTurns = 1;
    attacker.wishAmount = Math.floor(attacker.maxHp / 2);
    logBattle(`${attacker.name} made a wish!`);
    return 0;
  }
  
  // Yawn - target falls asleep at end of next turn
  if (move.name === "yawn") {
    if (!defender.status && !checkAbilityStatusImmunity(defender, "sleep")) {
      defender.yawnTurns = 1;
      logBattle(`${defender.name} grew drowsy!`);
    } else {
      logBattle(`${attacker.name} tried to use Yawn but it failed!`);
    }
    return 0;
  }
  
  // Transform - copies target's appearance, stats, moves, and stat stages
  if (move.name === "transform") {
    if (!attacker.transformed) {
      attacker.transformed = true;
      attacker.transformedInto = defender.name;
      // Copy stats (keep HP the same)
      const originalHP = attacker.currentHP;
      const originalMaxHP = attacker.maxHp;
      attacker.stats = { ...defender.stats, hp: originalMaxHP };
      attacker.maxHp = originalMaxHP;
      attacker.currentHP = originalHP;
      // Copy types
      attacker.types = [...defender.types];
      // Copy moves (with 5 PP each in Gen 1-4)
      attacker.moves = defender.moves.map(m => ({ ...m, currentPP: 5 }));
      // Copy stat stages
      attacker.statStages = { ...defender.statStages };
      logBattle(`${attacker.name} transformed into ${defender.name}!`);
    } else {
      logBattle(`${attacker.name} tried to Transform but it failed!`);
    }
    return 0;
  }
  
  // Pain Split - average both Pokemon's current HP
  if (move.name === "pain-split") {
    const totalHP = attacker.currentHP + defender.currentHP;
    const averageHP = Math.floor(totalHP / 2);
    attacker.currentHP = Math.min(averageHP, attacker.maxHp);
    defender.currentHP = Math.min(averageHP, defender.maxHp);
    logBattle(`${attacker.name} and ${defender.name} shared their pain! Both now have ${averageHP} HP.`);
    return 0;
  }
  
  // Endeavor - reduces target's HP to match user's HP
  if (move.name === "endeavor") {
    if (defender.currentHP > attacker.currentHP) {
      const damage = defender.currentHP - attacker.currentHP;
      defender.currentHP = attacker.currentHP;
      logBattle(`${attacker.name} used Endeavor! ${defender.name} lost ${damage} HP.`);
    } else {
      logBattle(`${attacker.name} used Endeavor, but it failed!`);
    }
    return 0;
  }
  
  // Psych Up - copies target's stat changes
  if (move.name === "psych-up") {
    attacker.statStages = { ...defender.statStages };
    logBattle(`${attacker.name} copied ${defender.name}'s stat changes!`);
    return 0;
  }
  
  // Counter - returns 2x physical damage received this turn
  if (move.name === "counter") {
    if (attacker.lastDamageTaken && attacker.lastDamageTaken > 0 && attacker.lastMoveCategory === 'physical') {
      const counterDamage = attacker.lastDamageTaken * 2;
      defender.currentHP = Math.max(0, defender.currentHP - counterDamage);
      logBattle(`${attacker.name} countered for ${counterDamage} damage!`);
      return counterDamage;
    } else {
      logBattle(`${attacker.name} used Counter, but it failed!`);
      return 0;
    }
  }
  
  // Mirror Coat - returns 2x special damage received this turn
  if (move.name === "mirror-coat") {
    if (attacker.lastDamageTaken && attacker.lastDamageTaken > 0 && attacker.lastMoveCategory === 'special') {
      const mirrorDamage = attacker.lastDamageTaken * 2;
      defender.currentHP = Math.max(0, defender.currentHP - mirrorDamage);
      logBattle(`${attacker.name} used Mirror Coat for ${mirrorDamage} damage!`);
      return mirrorDamage;
    } else {
      logBattle(`${attacker.name} used Mirror Coat, but it failed!`);
      return 0;
    }
  }
  
  // Substitute - creates a substitute with 1/4 max HP
  if (move.name === "substitute") {
    const cost = Math.floor(attacker.maxHp / 4);
    if (attacker.currentHP <= cost) {
      logBattle(`${attacker.name} doesn't have enough HP to create a substitute!`);
      return 0;
    }
    if (attacker.substitute) {
      logBattle(`${attacker.name} already has a substitute!`);
      return 0;
    }
    attacker.currentHP -= cost;
    attacker.substitute = cost;
    logBattle(`${attacker.name} created a substitute!`);
    return 0;
  }
  
  // Bide - waits 2 turns then deals double the damage taken
  if (move.name === "bide") {
    if (!attacker.bideTurns) {
      attacker.bideTurns = 2;
      attacker.bideDamage = 0;
      logBattle(`${attacker.name} is biding its time!`);
      return 0;
    }
  }
  
  // Perish Song - both Pokemon faint in 3 turns
  if (move.name === "perish-song") {
    if (!checkAbilitySoundproof(defender, move)) {
      attacker.perishCount = 3;
      defender.perishCount = 3;
      logBattle(`${attacker.name} used Perish Song! All Pokemon will faint in 3 turns!`);
    } else {
      logBattle(`${attacker.name} used Perish Song but ${defender.name}'s Soundproof blocked it!`);
    }
    return 0;
  }
  
  // Baton Pass - pass stat changes to next Pokemon (in 1v1 just heals a bit as placeholder)
  if (move.name === "baton-pass") {
    logBattle(`${attacker.name} used Baton Pass!`);
    // In a full game this would switch out and pass stat changes
    // For now, just a small heal to make it somewhat useful
    const heal = Math.floor(attacker.maxHp / 8);
    attacker.currentHP = Math.min(attacker.maxHp, attacker.currentHP + heal);
    logBattle(`${attacker.name} recovered ${heal} HP!`);
    return 0;
  }
  
  // Encore - forces opponent to use the same move for 3 turns
  if (move.name === "encore") {
    if (defender.lastMoveUsed && defender.lastMoveUsed.name !== "struggle") {
      defender.encored = true;
      defender.encoredMove = defender.lastMoveUsed;
      defender.encoreTurns = 3;
      logBattle(`${defender.name} received an encore!`);
    } else {
      logBattle(`${attacker.name} used Encore but it failed!`);
    }
    return 0;
  }
  
  // Disable - disables opponent's last used move for 4 turns
  if (move.name === "disable") {
    if (defender.lastMoveUsed && defender.lastMoveUsed.name !== "struggle") {
      defender.disabledMove = defender.lastMoveUsed.name;
      defender.disableTurns = 4;
      logBattle(`${defender.name}'s ${defender.lastMoveUsed.name} was disabled!`);
    } else {
      logBattle(`${attacker.name} used Disable but it failed!`);
    }
    return 0;
  }
  
  // Taunt - prevents opponent from using status moves for 3 turns
  if (move.name === "taunt") {
    defender.taunted = true;
    defender.tauntTurns = 3;
    logBattle(`${defender.name} fell for the taunt!`);
    return 0;
  }
  
  // Torment - prevents opponent from using the same move twice in a row
  if (move.name === "torment") {
    defender.tormented = true;
    logBattle(`${defender.name} was subjected to torment!`);
    return 0;
  }
  
  // Metronome - uses a random move
  if (move.name === "metronome") {
    const allMoves = Object.values(movesData);
    // Filter out Metronome itself and other meta moves
    const bannedMoves = ['metronome', 'struggle', 'mimic', 'sketch', 'transform'];
    const usableMoves = allMoves.filter(m => !bannedMoves.includes(m.name) && m.power);
    if (usableMoves.length > 0) {
      const randomMove = usableMoves[Math.floor(Math.random() * usableMoves.length)];
      logBattle(`${attacker.name} used Metronome and called ${randomMove.name}!`);
      return performMove(attacker, defender, randomMove, options);
    } else {
      logBattle(`${attacker.name} used Metronome but it failed!`);
      return 0;
    }
  }
  
  // Copycat / Mirror Move - copies opponent's last used move
  if (move.name === "copycat" || move.name === "mirror-move") {
    if (defender.lastMoveUsed && defender.lastMoveUsed.name !== "struggle") {
      logBattle(`${attacker.name} used ${move.name} and copied ${defender.lastMoveUsed.name}!`);
      return performMove(attacker, defender, defender.lastMoveUsed, options);
    } else {
      logBattle(`${attacker.name} used ${move.name} but it failed!`);
      return 0;
    }
  }
  
  // Mimic - permanently replaces Mimic with target's last used move
  if (move.name === "mimic") {
    if (defender.lastMoveUsed && defender.lastMoveUsed.name !== "struggle") {
      const moveIndex = attacker.moves.findIndex(m => m.name === "mimic");
      if (moveIndex !== -1) {
        attacker.moves[moveIndex] = { ...defender.lastMoveUsed, currentPP: 5 };
        logBattle(`${attacker.name} learned ${defender.lastMoveUsed.name}!`);
      } else {
        logBattle(`${attacker.name} used Mimic but it failed!`);
      }
    } else {
      logBattle(`${attacker.name} used Mimic but it failed!`);
    }
    return 0;
  }
  
  // Sketch - permanently replaces Sketch with target's last used move (more PP than Mimic)
  if (move.name === "sketch") {
    if (defender.lastMoveUsed && defender.lastMoveUsed.name !== "struggle" && defender.lastMoveUsed.name !== "sketch") {
      const moveIndex = attacker.moves.findIndex(m => m.name === "sketch");
      if (moveIndex !== -1) {
        attacker.moves[moveIndex] = { ...defender.lastMoveUsed };
        logBattle(`${attacker.name} sketched ${defender.lastMoveUsed.name}!`);
      } else {
        logBattle(`${attacker.name} used Sketch but it failed!`);
      }
    } else {
      logBattle(`${attacker.name} used Sketch but it failed!`);
    }
    return 0;
  }
  
  // Trick Room - reverses speed order for 5 turns
  if (move.name === "trick-room") {
    if (!options.field) options.field = {};
    options.field.trickRoom = 5;
    logBattle(`${attacker.name} twisted the dimensions!`);
    return 0;
  }
  
  // Tailwind - doubles speed for 4 turns
  if (move.name === "tailwind") {
    if (!options.field) options.field = {};
    options.field.tailwind = 4;
    logBattle(`${attacker.name} whipped up a tailwind!`);
    return 0;
  }
  
  // Gravity - prevents flying and increases accuracy for 5 turns
  if (move.name === "gravity") {
    if (!options.field) options.field = {};
    options.field.gravity = 5;
    logBattle(`${attacker.name} intensified gravity!`);
    return 0;
  }
  
  // Wonder Room - swaps defense and special defense for 5 turns
  if (move.name === "wonder-room") {
    if (!options.field) options.field = {};
    options.field.wonderRoom = 5;
    logBattle(`${attacker.name} created a bizarre area!`);
    return 0;
  }
  
  // Counter - returns double the physical damage taken this turn
  if (move.name === "counter") {
    if (defender.lastDamageTaken && defender.lastMoveCategory === "physical") {
      const counterDamage = defender.lastDamageTaken * 2;
      defender.currentHP -= counterDamage;
      logBattle(`${attacker.name} countered for ${counterDamage} damage!`);
      return counterDamage;
    } else {
      logBattle(`${attacker.name} tried to use Counter but it failed!`);
      return 0;
    }
  }
  
  // Mirror Coat - returns double the special damage taken this turn
  if (move.name === "mirror-coat") {
    if (defender.lastDamageTaken && defender.lastMoveCategory === "special") {
      const mirrorDamage = defender.lastDamageTaken * 2;
      defender.currentHP -= mirrorDamage;
      logBattle(`${attacker.name} used Mirror Coat for ${mirrorDamage} damage!`);
      return mirrorDamage;
    } else {
      logBattle(`${attacker.name} tried to use Mirror Coat but it failed!`);
      return 0;
    }
  }

  // Protection
  if (defender.protected) {
    logBattle(`${defender.name} protected itself!`);
    defender.protected = false;
    return 0;
  }

  // Check if defender is semi-invulnerable (charging for two-turn move)
  if (defender.charging && move.category !== "status") {
    // Only certain moves can hit charging Pokemon
    const canHitFlying = defender.charging === "flying" && (move.name === "gust" || move.name === "twister" || move.name === "thunder" || move.name === "sky-uppercut");
    const canHitUnderground = defender.charging === "underground" && (move.name === "earthquake" || move.name === "magnitude");
    const canHitUnderwater = defender.charging === "underwater" && (move.name === "surf" || move.name === "whirlpool");
    
    if (!canHitFlying && !canHitUnderground && !canHitUnderwater) {
      const locationMsg = defender.charging === "flying" ? "up high" : 
                         defender.charging === "underground" ? "underground" : 
                         defender.charging === "underwater" ? "underwater" : "out of reach";
      logBattle(`${attacker.name} used ${move.name}, but ${defender.name} is ${locationMsg}!`);
      return 0;
    }
  }

  // Check ability immunity (must be before accuracy check)
  if (checkAbilityImmunity(attacker, defender, move)) {
    logBattle(`${attacker.name} used ${move.name}, but ${defender.name}'s ${defender.ability} makes it immune!`);
    return 0;
  }
  
  // Weather Ball type change based on weather
  let actualMove = move;
  if (move.name === 'weather-ball' && options.field?.weather) {
    const weatherTypes = {
      'sun': 'fire',
      'rain': 'water',
      'sandstorm': 'rock',
      'hail': 'ice'
    };
    const newType = weatherTypes[options.field.weather];
    if (newType) {
      actualMove = { ...move, type: newType };
    }
  }
  
  // Use actualMove for the rest of the calculations
  move = actualMove;
  
  // Check Lightning Rod (absorbs electric moves and raises Special Attack)
  if (checkAbilityLightningRod(defender, move)) {
    logBattle(`${attacker.name} used ${move.name}, but ${defender.name}'s Lightning Rod absorbed it!`);
    logBattle(`${defender.name}'s Special Attack rose!`);
    return 0;
  }
  
  // Check 
  
  // Check Soundproof immunity to sound-based moves
  if (checkAbilitySoundproof(defender, move)) {
    logBattle(`${attacker.name} used ${move.name}, but ${defender.name}'s Soundproof blocks it!`);
    return 0;
  }
  
  // Fake Out only works on first turn
  const firstTurnOnly = move.effects?.find(e => e.type === "FIRST_TURN_ONLY");
  if (firstTurnOnly && options.turnNumber && options.turnNumber > 1) {
    logBattle(`${attacker.name} used ${move.name}, but it failed! (only works on first turn)`);
    return 0;
  }
  
  // Last Resort only works if all other moves have been used
  const lastResortEffect = move.effects?.find(e => e.type === "LAST_RESORT");
  if (lastResortEffect) {
    if (!attacker.movesUsed) attacker.movesUsed = [];
    const otherMoves = attacker.moves.filter(m => m.name !== 'last-resort');
    const allOtherMovesUsed = otherMoves.every(m => attacker.movesUsed.includes(m.name));
    if (!allOtherMovesUsed) {
      logBattle(`${attacker.name} used ${move.name}, but it failed! (must use all other moves first)`);
      return 0;
    }
  }
  
  // Belly Drum - max attack boost for 50% HP cost
  const bellyDrumEffect = move.effects?.find(e => e.type === "BELLY_DRUM");
  if (bellyDrumEffect) {
    const cost = Math.floor(attacker.maxHp / 2);
    if (attacker.currentHP <= cost || attacker.statStages.atk >= 6) {
      logBattle(`${attacker.name} used ${move.name}, but it failed!`);
      return 0;
    }
    attacker.currentHP -= cost;
    attacker.statStages.atk = 6; // Max attack
    logBattle(`${attacker.name} cut its own HP and maximized its Attack!`);
    return 0;
  }
  
  // OHKO moves - instant KO if they hit
  const ohkoEffect = move.effects?.find(e => e.type === "OHKO");
  if (ohkoEffect) {
    // OHKO moves fail if target is higher level (can't check level, so skip in this sim)
    // Sturdy and Focus Sash block OHKO moves (handled in damage calculation)
    logBattle(`${attacker.name} used ${move.name}! It's a one-hit KO!`);
    return defender.currentHP; // Return full HP as damage
  }
  
  // Stealth Rock - sets entry hazard
  const hazardEffect = move.effects?.find(e => e.type === "HAZARD");
  if (hazardEffect) {
    if (!options.field) options.field = {};
    if (!options.field.hazards) options.field.hazards = {};
    if (options.field.hazards[hazardEffect.hazardType]) {
      logBattle(`${attacker.name} used ${move.name}, but it failed! (already set)`);
      return 0;
    }
    options.field.hazards[hazardEffect.hazardType] = true;
    logBattle(`${attacker.name} set ${hazardEffect.hazardType} on the opposing side!`);
    return 0;
  }

  // Accuracy check
  if (move.accuracy !== null) {
    // Dream Eater only works if target is asleep
    if (move.name === 'dream-eater' && defender.status !== 'sleep') {
      logBattle(`${attacker.name} tried to use Dream Eater but the target isn't asleep!`);
      return 0;
    }
    
    const atkAccStage = clampStage(attacker.statStages?.acc ?? 0);
    const defEvaStage = clampStage(defender.statStages?.eva ?? 0);

    function accStageMultiplier(stage) {
      if (stage >= 0) return (3 + stage) / 3;
      return 3 / (3 - stage);
    }

    const accMult = accStageMultiplier(atkAccStage);
    const evaMult = accStageMultiplier(defEvaStage);

    let finalAcc = move.accuracy * (accMult / evaMult);
    
    // Weather-based accuracy changes
    if (options.field?.weather) {
      // Thunder and Hurricane have 100% accuracy in rain
      if ((move.name === 'thunder' || move.name === 'hurricane') && options.field.weather === 'rain') {
        finalAcc = 100;
      }
      // Thunder and Hurricane have 50% accuracy in sun
      if ((move.name === 'thunder' || move.name === 'hurricane') && options.field.weather === 'sun') {
        finalAcc *= 0.5;
      }
      // Solar Beam has 50% power in rain (handled in damage calculation, but affects accuracy perception)
      // Blizzard has 100% accuracy in hail (if hail is implemented)
    }
    
    // Apply ability accuracy modifiers
    const abilityAccMod = getAbilityAccuracyModifier(attacker, defender, options.field);
    finalAcc *= abilityAccMod;
    
    // Gravity increases accuracy by 5/3 (approximately 1.67x)
    if (options.field?.gravity > 0) {
      finalAcc = Math.floor(finalAcc * 5 / 3);
    }
    
    // Apply Hustle accuracy penalty
    const hustleMod = getAbilityHustleAccuracyModifier(attacker, move);
    finalAcc *= hustleMod;
    
    finalAcc = Math.max(1, Math.min(100, finalAcc));

    if (!rollChance(finalAcc)) {
      logBattle(`${attacker.name}'s ${move.name} missed!`);
      return 0;
    }
  }

  // Multi-hit
  let hits = 1;
  const multi = move.effects?.find(e => e.type === "MULTI_HIT");
  if (multi) hits = randomInt(multi.min, multi.max);

  let totalDamage = 0;

  for (let i = 0; i < hits; i++) {
    // Check for crit immunity - only for damaging moves
    let isCrit = false;
    if (move.power && !checkAbilityBlocksCrit(defender)) {
      isCrit = rollChance(getCritChance(attacker, move));
    }
    
    let dmg = calculateDamage(attacker, defender, move, isCrit, options);
    if (isCrit) dmg = Math.floor(dmg * 1.5);
    
    // Check Sturdy (prevents OHKO from full HP)
    if (checkAbilitySturdy(defender, dmg)) {
      dmg = defender.currentHP - 1;
      logBattle(`${defender.name}'s Sturdy allows it to endure!`);
    }
    
    // Check Focus Sash/Focus Band (prevents OHKO)
    if (dmg >= defender.currentHP && defender.currentHP === defender.maxHp && defender.item) {
      const item = getItem(defender.item);
      if (item && item.effect === 'FOCUS_SASH') {
        dmg = defender.currentHP - 1;
        defender.item = null; // Consumed
        logBattle(`${defender.name} hung on using its Focus Sash!`);
      } else if (item && item.effect === 'FOCUS_BAND' && rollChance(item.chance)) {
        dmg = defender.currentHP - 1;
        logBattle(`${defender.name} hung on using its Focus Band!`);
      }
    }
    
    // Handle Substitute - absorbs damage
    if (defender.substitute && defender.substitute > 0) {
      const subDmg = Math.min(dmg, defender.substitute);
      defender.substitute -= subDmg;
      if (defender.substitute <= 0) {
        defender.substitute = 0;
        logBattle(`${defender.name}'s substitute faded!`);
      } else {
        logBattle(`${attacker.name} used ${move.name}, dealt ${subDmg} damage to substitute!`);
      }
      totalDamage += subDmg;
      // Break out - substitute blocks all effects
      if (defender.currentHP <= 0) break;
      continue;
    }

    defender.currentHP -= dmg;
    totalDamage += dmg;
    attacker.lastDamageDealt = dmg;
    
    // Track that defender was hit this turn (for Revenge/Vengeance)
    if (dmg > 0) {
      defender.hitThisTurn = true;
      
      // Rage effect - increase Attack when hit
      if (defender.rageActive && defender.statStages?.atk < 6) {
        defender.statStages.atk = Math.min(6, (defender.statStages?.atk || 0) + 1);
        logBattle(`${defender.name}'s Rage is building! Attack rose!`);
      }
    }
    
    // Track damage taken for Counter/Mirror Coat and Bide
    defender.lastDamageTaken = dmg;
    defender.lastMoveCategory = move.category; // Category of the move that HIT them
    if (defender.bideTurns) {
      defender.bideDamage = (defender.bideDamage || 0) + dmg;
    }

    logBattle(`${attacker.name} used ${move.name}!${isCrit ? " It's a critical hit!" : ""}`);
    logBattle(`It dealt ${dmg} damage to ${defender.name}!`);
    
    // Track move usage and damage
    tournamentStats.recordMoveUsed(attacker.name, move.name, dmg, isCrit, false);
    tournamentStats.recordDamageTaken(defender.name, dmg);
    
    // Stench - 10% flinch chance on damaging moves (if not already a flinching move)
    if (attacker.ability === 'stench' && move.power && !move.effects?.some(e => e.type === 'FLINCH')) {
      if (rollChance(10) && !checkAbilityBlocksFlinch(defender)) {
        defender.flinched = true;
        tournamentStats.recordMoveUsed(attacker.name, 'stench-flinch', 0, false, true);
        logBattle(`${attacker.name}'s Stench made ${defender.name} flinch!`);
      }
    }
    
    // Contact ability effects (only if move makes contact)
    if (move.contact || move.flags?.includes('contact')) {
      const contactResult = applyAbilityOnContact(attacker, defender);
      if (contactResult) {
        logBattle(`${defender.name}'s ${defender.ability} activated!`);
      }
      
      // Rocky Helmet - damages attacker on contact
      if (defender.item && attacker.currentHP > 0) {
        const item = getItem(defender.item);
        if (item && item.effect === 'ROCKY_HELMET') {
          const helmetDamage = Math.floor(attacker.maxHp * item.damagePercentage / 100);
          attacker.currentHP = Math.max(0, attacker.currentHP - helmetDamage);
          logBattle(`${attacker.name} was hurt by Rocky Helmet!`);
        }
      }
    }
    
    // Check for Sitrus Berry activation (HP < 50%)
    if (defender.item && defender.currentHP > 0 && defender.currentHP < defender.maxHp / 2) {
      const item = getItem(defender.item);
      if (item && item.effect === 'SITRUS_BERRY') {
        const healAmount = Math.floor(defender.maxHp * item.healPercentage / 100);
        defender.currentHP = Math.min(defender.maxHp, defender.currentHP + healAmount);
        defender.item = null; // Consumed
        logBattle(`${defender.name} restored HP using its Sitrus Berry!`);
      }
    }
    
    // Check for stat boost berries (HP < 25%)
    if (defender.item && defender.currentHP > 0 && defender.currentHP < defender.maxHp / 4) {
      const item = getItem(defender.item);
      if (item && item.effect === 'STAT_BOOST_BERRY') {
        if (!defender.statStages) defender.statStages = {};
        const stat = item.stat;
        if (!defender.statStages[stat]) defender.statStages[stat] = 0;
        defender.statStages[stat] = Math.min(6, defender.statStages[stat] + item.boost);
        defender.item = null; // Consumed
        logBattle(`${defender.name}'s ${displayStat(stat)} rose from its berry!`);
      }
    }

      // Leech Seed handling: if move is leech-seed and it hit, apply volatile
      if (move.name === 'leech-seed' && dmg > 0) {
        if (!defender.leechSeed) {
          defender.leechSeed = true;
          defender.leechSeedSource = attacker;
          logBattle(`${defender.name} was seeded by ${attacker.name}!`);
        }
      }
    // Effects per hit
    for (const effect of move.effects ?? []) {
      applyEffect(effect, attacker, defender, options);
    }
    
    // Apply trapping effect if this is a trapping move and defender survived
    if (TRAPPING_MOVES.has(move.name) && defender.currentHP > 0 && !defender.trapped) {
      defender.trapped = true;
      defender.trappingTurns = randomInt(2, 5); // 2-5 turns (Gen 3+ uses 4-5)
      defender.trappingMove = move.name;
      defender.trappingSource = attacker;
      logBattle(`${defender.name} is trapped by ${move.name}!`);
    }

    if (defender.currentHP <= 0) break;
  }
  
  // Apply Moxie on KO
  if (defender.currentHP <= 0) {
    // Track KO
    const turnNum = options.turnNumber || 0;
    tournamentStats.recordKO(attacker.name, defender.name, move.name, turnNum);
    
    if (applyAbilityOnKO(attacker, defender)) {
      logBattle(`${attacker.name}'s Moxie raised its Attack!`);
    }
  }
  
  // Update Rollout turn counter
  if (move.name === 'rollout' || move.name === 'ice-ball') {
    attacker.rolloutTurn = (attacker.rolloutTurn || 0) + 1;
    if (attacker.rolloutTurn > 5 || totalDamage === 0) {
      // Reset after 5 turns or on miss
      attacker.rolloutTurn = 0;
    }
  } else {
    // Reset rollout if different move used
    attacker.rolloutTurn = 0;
  }
  
  // Update Fury Cutter streak
  if (move.name === 'fury-cutter' && totalDamage > 0) {
    attacker.furyCutterStreak = (attacker.furyCutterStreak || 0) + 1;
  } else if (move.name !== 'fury-cutter') {
    // Reset streak if different move used
    attacker.furyCutterStreak = 0;
  } else {
    // Reset on miss
    attacker.furyCutterStreak = 1;
  }
  
  // Process Bide - countdown and unleash
  if (attacker.bideTurns) {
    attacker.bideTurns--;
    if (attacker.bideTurns === 0) {
      const bideDamage = (attacker.bideDamage || 0) * 2;
      if (bideDamage > 0) {
        defender.currentHP = Math.max(0, defender.currentHP - bideDamage);
        logBattle(`${attacker.name} unleashed Bide for ${bideDamage} damage!`);
      } else {
        logBattle(`${attacker.name}'s Bide failed!`);
      }
      attacker.bideDamage = 0;
      attacker.bideTurns = undefined;
    } else {
      logBattle(`${attacker.name} is storing energy! (${attacker.bideTurns} turns left)`);
    }
  }
  
  // Self-sacrifice moves: Explosion, Self-Destruct cause user to faint
  if ((move.name === 'explosion' || move.name === 'self-destruct') && attacker.currentHP > 0) {
    // Check if Damp ability prevents explosion
    if (checkAbilityPreventsExplosion(defender)) {
      logBattle(`${defender.name}'s Damp prevented ${move.name}!`);
    } else {
      attacker.currentHP = 0;
      logBattle(`${attacker.name} fainted from ${move.name}!`);
    }
  }
  
  // Destiny Bond: if defender has Destiny Bond active and was KO'd, attacker faints
  if (defender.currentHP <= 0 && defender.destinyBond) {
    attacker.currentHP = 0;
    logBattle(`${attacker.name} was taken down with Destiny Bond!`);
  }
  
  // Clear attacker's Destiny Bond after any move (it only lasts until next move)
  if (attacker.destinyBond) {
    attacker.destinyBond = false;
  }
  
  // Life Orb recoil - 10% max HP damage after successful hit
  if (totalDamage > 0 && attacker.item && attacker.currentHP > 0) {
    const item = getItem(attacker.item);
    if (item && item.effect === 'LIFE_ORB') {
      const recoilDamage = Math.floor(attacker.maxHp * item.recoil);
      attacker.currentHP = Math.max(0, attacker.currentHP - recoilDamage);
      logBattle(`${attacker.name} lost ${recoilDamage} HP from Life Orb!`);
    }
  }
  
  // Choice item locking - lock into first move used
  if (attacker.item && totalDamage > 0 && move.category !== 'status') {
    const item = getItem(attacker.item);
    if (item && (item.effect === 'CHOICE_ATK' || item.effect === 'CHOICE_SPA' || item.effect === 'CHOICE_SPE')) {
      if (!attacker.choiceLockedMove) {
        attacker.choiceLockedMove = move;
        logBattle(`${attacker.name} is locked into ${move.name}!`);
      }
    }
  }
  
  // Track move usage for Last Resort
  if (!attacker.movesUsed) attacker.movesUsed = [];
  if (!attacker.movesUsed.includes(move.name)) {
    attacker.movesUsed.push(move.name);
  }
  
  // Recharge effect - must recharge next turn after using these moves
  const rechargeEffect = move.effects?.find(e => e.type === "RECHARGE");
  if (rechargeEffect && totalDamage > 0) {
    attacker.mustRecharge = true;
  }
  
  // Rage effect - power increases when hit
  if (move.name === "rage") {
    attacker.rageActive = true;
  }

  return totalDamage;
}

function getCritChance(attacker, move) {
  // Standard crit ratios (modern / Gen3+): stage 0=1/16, 1=1/8, 2=1/4, 3=1/3
  const CRIT_PROBS = [1/16, 1/8, 1/4, 1/3];
  let stage = move.critStage ?? 0;
  
  // Focus Energy increases crit stage by 2
  if (attacker.focusEnergy) {
    stage += 2;
  }
  
  stage = Math.max(0, Math.min(stage, CRIT_PROBS.length - 1));
  let prob = CRIT_PROBS[stage];

  // If move is from generation-i, give a small speed-based bump (approx Gen 1 behavior)
  if (move.generation === "generation-i") {
    prob = Math.min(0.99, prob + attacker.stats.spe / 512);
  }

  return prob * 100;
}

const HANDLED_EFFECT_TYPES = new Set([
  "STATUS", "STAT", "DRAIN", "RECOIL", "FLINCH",
  "PROTECT", "WEATHER", "SCREEN", "FOCUS_ENERGY",
  "MULTI_HIT", "OHKO", "TWO_TURN", "CONFUSION", "RECHARGE",
  "COUNTER", "RAGE", "HEAL", "BIDE", "VARIABLE_POWER",
  "BELLY_DRUM", "HAZARD", "PAIN_SPLIT", "CLEAR_HAZARDS",
  "PSYCH_UP", "FIRST_TURN_ONLY", "ENDEAVOR", "TAILWIND",
  "SWITCH", "LAST_RESORT", "SUCKER_PUNCH"
]);

export function getHandledEffectTypes() {
  return Array.from(HANDLED_EFFECT_TYPES);
}

export function applyEffect(effect, user, target, options = {}) {
  // Runtime guard to flag any effect types that lack handling logic
  // Warn only once per unknown type to avoid noisy logs in large tournaments
  if (!HANDLED_EFFECT_TYPES.has(effect.type)) {
    if (!applyEffect._warnedTypes) applyEffect._warnedTypes = new Set();
    if (!applyEffect._warnedTypes.has(effect.type)) {
      applyEffect._warnedTypes.add(effect.type);
      console.warn(`Unhandled effect type encountered: ${effect.type}`);
    }
  }

  // Sheer Force removes all secondary effects from user's moves
  if (checkAbilitySheerForce(user)) {
    return; // No secondary effects applied
  }
  
  // Shield Dust blocks all secondary effects on target
  if (checkAbilityBlocksSecondaryEffects(target)) {
    // Only block effects that target the opponent (not self-buffs)
    if (effect.type === "STATUS" || effect.type === "FLINCH" || (effect.type === "STAT" && effect.target !== "self")) {
      return;
    }
  }
  
  // Apply Serene Grace effect chance multiplier
  let effectChance = effect.chance;
  if (effectChance) {
    effectChance *= getAbilityEffectChanceMultiplier(user);
  }
  
  switch (effect.type) {
    case "STATUS":
      if (rollChance(effectChance || 100)) {
        // Check ability immunity to status
        if (checkAbilityStatusImmunity(target, effect.status)) {
          logBattle(`${target.name}'s ${target.ability} prevents ${effect.status}!`);
          break;
        }
        
        // Confusion is separate from main status
        if (effect.status === "confusion") {
          if (!target.confusionTurns) target.confusionTurns = 0;
          target.confusionTurns += effect.turns ?? Math.floor(Math.random() * 4) + 1;
          tournamentStats.recordStatusInflicted(user.name, target.name, 'confusion');
          logBattle(`${target.name} became confused!`);
        } else if (!target.status) {
          target.status = effect.status;
          tournamentStats.recordStatusInflicted(user.name, target.name, effect.status);
          // set durations / counters for multi-turn statuses
          if (effect.status === "sleep") {
            target.statusTurns = effect.turns ?? (randomInt(1, 3));
          } else if (effect.status === "toxic") {
            target.toxicCounter = 1;
          }
          logBattle(`${target.name} is now ${effect.status}!`);
          
          // Check Lum Berry - cures status immediately
          if (target.item) {
            const item = getItem(target.item);
            if (item && item.effect === 'LUM_BERRY') {
              target.status = null;
              target.statusTurns = 0;
              target.toxicCounter = 0;
              target.item = null; // Consumed
              logBattle(`${target.name} cured its status with Lum Berry!`);
            }
          }
          
          // Apply Synchronize
          const syncResult = applyAbilityOnStatusInflicted(user, target, effect.status);
          if (syncResult) {
            logBattle(`${target.name}'s Synchronize reflected the status back!`);
          }
        }
      }
      break;

    case "STAT":
      if (rollChance(effectChance || 100)) {
        // Determine the actual target based on effect.target
        const actualTarget = (effect.target === "self") ? user : target;
        const key = normalizeStat(effect.stat);
        
        // Apply Simple and Contrary abilities
        let statChange = effect.change;
        statChange = applyAbilitySimple(actualTarget, statChange);
        statChange = applyAbilityContrary(actualTarget, statChange);
        
        // Check if ability prevents stat loss
        if (statChange < 0 && actualTarget !== user && checkAbilityPreventStatLoss(actualTarget, key)) {
          logBattle(`${actualTarget.name}'s ${actualTarget.ability} prevents stat loss!`);
          break;
        }
        
        if (!actualTarget.statStages[key] && actualTarget.statStages[key] !== 0) actualTarget.statStages[key] = 0;
        actualTarget.statStages[key] += statChange;
        actualTarget.statStages[key] = clampStage(actualTarget.statStages[key]);
        logBattle(`${actualTarget.name}'s ${displayStat(key)} changed by ${statChange}!`);
      }
      break;

    case "DRAIN":
      // Check Liquid Ooze
      if (checkAbilityDamagesLeech(target)) {
        const drainFactor = (typeof effect.amount === 'number' && effect.amount > 1) ? (effect.amount / 100) : (effect.amount || 0);
        const damageAmount = Math.floor(user.lastDamageDealt * drainFactor);
        user.currentHP -= damageAmount;
        logBattle(`${target.name}'s Liquid Ooze damaged ${user.name} for ${damageAmount} HP!`);
      } else {
        // effect.amount may be stored as a percentage (e.g. 50 for 50%) or fraction (0.5)
        const drainFactor = (typeof effect.amount === 'number' && effect.amount > 1) ? (effect.amount / 100) : (effect.amount || 0);
        const healAmount = Math.floor(user.lastDamageDealt * drainFactor);
        user.currentHP = Math.min(user.maxHp ?? user.stats.hp, user.currentHP + healAmount);
        tournamentStats.recordHPRestored(user.name, healAmount);
        logBattle(`${user.name} healed ${healAmount} HP!`);
      }
      break;

    case "RECOIL":
      // Rock Head prevents recoil
      if (checkAbilityPreventsRecoil(user)) {
        logBattle(`${user.name}'s Rock Head prevents recoil!`);
      } else {
        // recoil amount may be percent/integer or fraction
        const recoilFactor = (typeof effect.amount === 'number' && effect.amount > 1) ? (effect.amount / 100) : (effect.amount || 0);
        const recoilAmount = Math.floor(user.lastDamageDealt * recoilFactor);
        user.currentHP -= recoilAmount;
        tournamentStats.recordRecoilDamage(user.name, recoilAmount);
        logBattle(`${user.name} took ${recoilAmount} recoil damage!`);
      }
      break;

    case "FLINCH":
      if (rollChance(effectChance || 100)) {
        if (!checkAbilityBlocksFlinch(target)) {
          target.flinched = true;
          tournamentStats.recordMoveUsed(user.name, 'flinch-effect', 0, false, true);
          logBattle(`${target.name} flinched!`);
        } else {
          logBattle(`${target.name}'s ${target.ability} prevents flinching!`);
        }
      }
      break;

    case "PROTECT":
      user.protected = true;
      logBattle(`${user.name} protected itself!`);
      break;

    case "WEATHER":
      // Set weather on the field (passed via options.field)
      if (options.field) {
        options.field.weather = effect.weather;
        options.field.weatherTurns = effect.turns || 5;
        logBattle(`${user.name} set the weather to ${effect.weather}!`);
        
        // Update Forecast Pokemon when weather changes
        applyAbilityForecast(user, options.field);
        applyAbilityForecast(target, options.field);
      }
      break;

    case "SCREEN":
      // Set screen effect on the field (protects whole team in 2v2)
      if (!options.field) options.field = {};
      options.field[effect.screen] = effect.turns || 5;
      const screenName = effect.screen === "light-screen" ? "Light Screen" : "Reflect";
      logBattle(`${user.name} set up ${screenName}!`);
      break;

    case "FOCUS_ENERGY":
      user.focusEnergy = true;
      logBattle(`${user.name} is getting pumped!`);
      break;

    case "MULTI_HIT":
      // Multi-hit effects are handled in performMove's hit loop
      // This case exists to mark the effect type as handled
      break;

    case "OHKO":
      // OHKO effects are handled directly in performMove before damage calculation
      // This case exists to mark the effect type as handled
      break;

    case "TWO_TURN":
      // Two-turn move charging is handled in performMove's charging logic
      // This case exists to mark the effect type as handled
      break;

    case "CONFUSION":
      // Confusion is a special status handled in the STATUS case above
      // This effect type is for moves that cause confusion as their primary effect
      if (rollChance(effectChance || 100)) {
        if (!target.confusionTurns) target.confusionTurns = 0;
        target.confusionTurns += effect.turns ?? Math.floor(Math.random() * 4) + 1;
        tournamentStats.recordStatusInflicted(user.name, target.name, 'confusion');
        logBattle(`${target.name} became confused!`);
      }
      break;

    case "RECHARGE":
      // Set flag to force recharge next turn
      user.mustRecharge = true;
      break;

    case "COUNTER":
      // Counter is handled as a special move in performMove
      // This case exists to mark the effect type as handled
      break;

    case "RAGE":
      // Rage sets a flag that increases attack when hit
      user.rageActive = true;
      logBattle(`${user.name} is in a rage!`);
      break;

    case "HEAL":
      // Heal user by specified amount (percentage of max HP)
      const healPercent = effect.amount || 50;
      const healAmount = Math.floor(user.maxHp * healPercent / 100);
      user.currentHP = Math.min(user.maxHp, user.currentHP + healAmount);
      tournamentStats.recordHPRestored(user.name, healAmount);
      logBattle(`${user.name} restored ${healAmount} HP!`);
      break;

    case "BIDE":
      // Bide is handled as a special move in performMove
      // This case exists to mark the effect type as handled
      break;

    case "VARIABLE_POWER":
      // Variable power moves calculate damage differently in performMove/calculateDamage
      // This case exists to mark the effect type as handled
      break;

    case "BELLY_DRUM":
      // Belly Drum is handled directly in performMove
      // This case exists to mark the effect type as handled
      break;

    case "HAZARD":
      // Hazards are handled directly in performMove
      // This case exists to mark the effect type as handled
      break;

    case "PAIN_SPLIT":
      // Pain Split is handled as a special move in performMove
      // This case exists to mark the effect type as handled
      break;

    case "CLEAR_HAZARDS":
      // Remove hazards from the field
      if (options.field?.hazards) {
        options.field.hazards = {};
        logBattle(`${user.name} cleared the hazards!`);
      }
      break;

    case "PSYCH_UP":
      // Psych Up is handled as a special move in performMove
      // This case exists to mark the effect type as handled
      break;

    case "FIRST_TURN_ONLY":
      // First turn only moves (like Fake Out) are validated in performMove
      // This case exists to mark the effect type as handled
      break;

    case "ENDEAVOR":
      // Endeavor is handled as a special move in performMove
      // This case exists to mark the effect type as handled
      break;

    case "TAILWIND":
      // Tailwind is handled as a special move in performMove
      // This case exists to mark the effect type as handled
      break;

    case "SWITCH":
      // Switch moves (like U-turn, Volt Switch) force a switch after dealing damage
      // In a battle simulator context, we just note this effect
      logBattle(`${user.name} will switch out!`);
      break;

    case "LAST_RESORT":
      // Last Resort is validated in performMove to ensure all other moves have been used
      // This case exists to mark the effect type as handled
      break;

    case "SUCKER_PUNCH":
      // Sucker Punch priority move validation is handled in performMove
      // This case exists to mark the effect type as handled
      break;
  }
}

export function processStatus(pokemon) {
  if (!pokemon.status) return;
  if (checkAbilityMagicGuard(pokemon)) return; // Magic Guard prevents status damage
  
  // Handle sleep status duration
  if (pokemon.status === "sleep") {
    if (pokemon.statusTurns === undefined) pokemon.statusTurns = 1;
    pokemon.statusTurns--;
    if (pokemon.statusTurns <= 0) {
      pokemon.status = null;
      pokemon.statusTurns = 0;
      logBattle(`${pokemon.name} woke up!`);
    }
    return;
  }
  
  let damage = 0;
  switch (pokemon.status) {
    case "burn":
      damage = Math.floor(pokemon.stats.hp / 16);
      pokemon.currentHP -= damage;
      logBattle(`${pokemon.name} is hurt by burn for ${damage} damage!`);
      break;
    case "poison":
      damage = Math.floor(pokemon.stats.hp / 8);
      pokemon.currentHP -= damage;
      logBattle(`${pokemon.name} is hurt by poison for ${damage} damage!`);
      break;
    case "toxic":
      if (!pokemon.toxicCounter) pokemon.toxicCounter = 1;
      damage = Math.floor((pokemon.stats.hp / 16) * pokemon.toxicCounter);
      pokemon.currentHP -= damage;
      logBattle(`${pokemon.name} is hurt by toxic for ${damage} damage!`);
      pokemon.toxicCounter++;
      break;
  }
}

export function processEndOfTurn(p1, p2, field = {}) {
  // field: { weather: null|'sandstorm'|'hail'|'sun'|'rain' }
  // Process leech seed and items like Leftovers, and weather damage.
  const parties = [p1, p2];
  for (const p of parties) {
    if (p.currentHP <= 0) continue;
    // Leftovers heal (1/16)
    if (p.item) {
      const item = getItem(p.item);
      if (item && item.effect === 'LEFTOVERS') {
        const heal = Math.floor(p.maxHp * item.healPercentage / 100);
        p.currentHP = Math.min(p.maxHp, p.currentHP + heal);
        logBattle(`${p.name} restored ${heal} HP with Leftovers.`);
      }
    }

    // Leech Seed (Gen1 behaves as 1/8 of max HP)
    if (p.leechSeed && p.leechSeedSource && p.leechSeedSource.currentHP > 0) {
      if (!checkAbilityMagicGuard(p)) {
        const amount = Math.max(1, Math.floor(p.maxHp / 8));
        p.currentHP = Math.max(0, p.currentHP - amount);
        p.leechSeedSource.currentHP = Math.min(p.leechSeedSource.maxHp, p.leechSeedSource.currentHP + amount);
        logBattle(`${p.name} is drained by Leech Seed for ${amount} HP! ${p.leechSeedSource.name} regained ${amount} HP.`);
      }
    }
    
    // Trapping move damage (Wrap, Bind, Fire Spin, etc.) - 1/16 max HP per turn
    if (p.trapped && p.trappingSource && p.trappingSource.currentHP > 0) {
      if (!checkAbilityMagicGuard(p)) {
        const amount = Math.max(1, Math.floor(p.maxHp / 16));
        p.currentHP = Math.max(0, p.currentHP - amount);
        logBattle(`${p.name} is hurt by ${p.trappingMove} for ${amount} damage!`);
      }
      
      p.trappingTurns--;
      if (p.trappingTurns <= 0) {
        p.trapped = false;
        p.trappingMove = null;
        p.trappingSource = null;
        logBattle(`${p.name} is freed from ${p.trappingMove}!`);
      }
    } else if (p.trapped) {
      // If trapping source fainted, free the trapped Pokemon
      p.trapped = false;
      p.trappingTurns = 0;
      p.trappingMove = null;
      p.trappingSource = null;
    }
    
    // Wish healing
    if (p.wishTurns !== undefined && p.wishTurns > 0) {
      p.wishTurns--;
      if (p.wishTurns === 0 && p.currentHP > 0) {
        const heal = Math.min(p.wishAmount, p.maxHp - p.currentHP);
        p.currentHP += heal;
        logBattle(`${p.name}'s wish came true! Restored ${heal} HP.`);
        p.wishAmount = 0;
      }
    }
    
    // Yawn - fall asleep after countdown
    if (p.yawnTurns !== undefined && p.yawnTurns > 0) {
      p.yawnTurns--;
      if (p.yawnTurns === 0 && !p.status && !checkAbilityStatusImmunity(p, "sleep")) {
        p.status = "sleep";
        p.statusTurns = randomInt(1, 3);
        logBattle(`${p.name} fell asleep from Yawn!`);
      } else if (p.yawnTurns === 0) {
        // Failed to fall asleep (already has status or immune)
        p.yawnTurns = undefined;
      }
    }
    
    // Perish Song - countdown to fainting
    if (p.perishCount !== undefined && p.perishCount > 0) {
      p.perishCount--;
      if (p.perishCount === 0) {
        p.currentHP = 0;
        logBattle(`${p.name} fainted from Perish Song!`);
      } else {
        logBattle(`${p.name}'s perish count: ${p.perishCount}!`);
      }
    }
    
    // Encore countdown
    if (p.encoreTurns !== undefined && p.encoreTurns > 0) {
      p.encoreTurns--;
      if (p.encoreTurns === 0) {
        p.encored = false;
        p.encoredMove = null;
        logBattle(`${p.name}'s encore ended!`);
      }
    }
    
    // Disable countdown
    if (p.disableTurns !== undefined && p.disableTurns > 0) {
      p.disableTurns--;
      if (p.disableTurns === 0) {
        logBattle(`${p.name}'s ${p.disabledMove} is no longer disabled!`);
        p.disabledMove = null;
      }
    }
    
    // Taunt countdown
    if (p.tauntTurns !== undefined && p.tauntTurns > 0) {
      p.tauntTurns--;
      if (p.tauntTurns === 0) {
        p.taunted = false;
        logBattle(`${p.name}'s taunt wore off!`);
      }
    }

    // Weather damage (simple): sandstorm/hail deal 1/16 to non-immune (rock/ground/steel for sandstorm; ice for hail)
    if (field.weather === 'sandstorm' && !checkAbilityMagicGuard(p)) {
      const immune = p.types.includes('rock') || p.types.includes('ground') || p.types.includes('steel');
      if (!immune) {
        const dmg = Math.max(1, Math.floor(p.maxHp / 16));
        p.currentHP = Math.max(0, p.currentHP - dmg);
        logBattle(`${p.name} is buffeted by sandstorm for ${dmg} damage.`);
      }
    } else if (field.weather === 'hail' && !checkAbilityMagicGuard(p)) {
      const immune = p.types.includes('ice');
      if (!immune) {
        const dmg = Math.max(1, Math.floor(p.maxHp / 16));
        p.currentHP = Math.max(0, p.currentHP - dmg);
        logBattle(`${p.name} is pelted by hail for ${dmg} damage.`);
      }
    }
  }
  
  // Process Future Sight / Doom Desire attacks
  if (field.futureSight && field.futureSight.length > 0) {
    const remaining = [];
    for (const futureAttack of field.futureSight) {
      futureAttack.turnsLeft--;
      if (futureAttack.turnsLeft <= 0) {
        // Execute the delayed attack
        if (futureAttack.target.currentHP > 0) {
          const dmg = calculateDamage(futureAttack.attacker, futureAttack.target, futureAttack.move);
          futureAttack.target.currentHP = Math.max(0, futureAttack.target.currentHP - dmg);
          logBattle(`${futureAttack.target.name} took ${dmg} damage from ${futureAttack.move.name}!`);
        }
      } else {
        remaining.push(futureAttack);
      }
    }
    field.futureSight = remaining;
  }
}
