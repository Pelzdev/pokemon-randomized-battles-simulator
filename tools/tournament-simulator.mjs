#!/usr/bin/env node
/**
 * Tournament Simulator - Analyzes AI behavior, move selection, and battle outcomes
 * Run: node tools/tournament-simulator.mjs [options]
 * 
 * Options:
 *   --format 1v1|2v2     Battle format (default: 1v1)
 *   --tournaments N      Number of tournaments to run (default: 5)
 *   --size N            Tournament size (power of 2: 2,4,8,16,32,64) (default: 8)
 *   --verbose           Show detailed battle logs
 *   --stats-only        Skip battles, only show setup stats
 */

import { createPokemon } from '../src/engine/createPokemon.js';
import { battle, battle2v2, battle2v2Full } from '../src/engine/battle.js';
import { setLoggingEnabled, battleLogs, clearLogs } from '../src/utils/logger.js';
import { pokemon } from '../src/data/pokemon.js';

class TournamentSimulator {
  constructor(options = {}) {
    this.format = options.format || '1v1';
    this.tournamentCount = options.tournaments || 5;
    this.tournamentSize = options.size || 8;
    this.verbose = options.verbose || false;
    this.statsOnly = options.statsOnly || false;
    
    // Analytics
    this.stats = {
      totalBattles: 0,
      totalTournaments: 0,
      moveSelection: {},
      winnerStats: [],
      loserStats: [],
      battleDurations: [],
      typeAdvantageWins: 0,
      typeAdvantageTotal: 0,
      moveEffectUsage: {}
    };
  }

  createTeam(size = 1) {
    const team = [];
    const pokemonNames = Object.keys(pokemon);
    
    for (let i = 0; i < size; i++) {
      const randomName = pokemonNames[Math.floor(Math.random() * pokemonNames.length)];
      team.push(createPokemon(
        randomName, 50, null, null, false,
        true,  // random abilities
        false, // no wonder guard
        true,  // random items
        [1, 2, 3, 4, 5],  // all generations
        [1, 2, 3, 4, 5]   // all move generations
      ));
    }
    return team;
  }

  runBattle(p1Team, p2Team, battleNum) {
    setLoggingEnabled(this.verbose);
    clearLogs();
    
    let result;
    let winner;
    
    if (this.format === '1v1') {
      result = battle(p1Team[0], p2Team[0]);
      winner = p1Team[0].currentHP > 0 ? 1 : 2;
    } else if (this.format === '2v2') {
      result = battle2v2(p1Team, p2Team);
      const p1Alive = p1Team.filter(p => p.currentHP > 0).length;
      const p2Alive = p2Team.filter(p => p.currentHP > 0).length;
      winner = p1Alive > p2Alive ? 1 : (p2Alive > p1Alive ? 2 : 1);
    } else if (this.format === '2v2-full') {
      result = battle2v2Full(p1Team, p2Team);
      const p1Alive = p1Team.filter(p => p.currentHP > 0).length;
      const p2Alive = p2Team.filter(p => p.currentHP > 0).length;
      winner = p1Alive > p2Alive ? 1 : (p2Alive > p1Alive ? 2 : 1);
    }
    
    // Analyze battle
    this.analyzeBattle(p1Team, p2Team, winner);
    
    if (this.verbose && battleLogs) {
      if (battleLogs.length > 0) {
        console.log(`\n--- Battle ${battleNum} ---`);
        battleLogs.slice(-20).forEach(log => console.log(log)); // Last 20 logs
      }
    }
    
    return winner;
  }

  analyzeBattle(p1Team, p2Team, winner) {
    this.stats.totalBattles++;
    
    const winningTeam = winner === 1 ? p1Team : p2Team;
    const losingTeam = winner === 1 ? p2Team : p1Team;
    
    // Track move usage
    winningTeam.forEach(p => {
      p.moves.forEach(m => {
        const key = `${p.name}_${m.name}`;
        this.stats.moveSelection[key] = (this.stats.moveSelection[key] || 0) + 1;
        
        // Track effect usage
        if (m.effects && m.effects.length > 0) {
          m.effects.forEach(e => {
            this.stats.moveEffectUsage[e.type] = (this.stats.moveEffectUsage[e.type] || 0) + 1;
          });
        }
      });
    });
    
    // Track winner stats
    winningTeam.forEach(p => {
      this.stats.winnerStats.push({
        name: p.name,
        types: p.types,
        ability: p.ability,
        hp: p.stats.hp,
        atk: p.stats.atk,
        def: p.stats.def,
        spA: p.stats.spA,
        spD: p.stats.spD,
        spe: p.stats.spe,
        survived: p.currentHP > 0
      });
    });
    
    losingTeam.forEach(p => {
      this.stats.loserStats.push({
        name: p.name,
        types: p.types,
        ability: p.ability,
        hp: p.stats.hp,
        atk: p.stats.atk,
        def: p.stats.def,
        spA: p.stats.spA,
        spD: p.stats.spD,
        spe: p.stats.spe,
        survived: p.currentHP > 0
      });
    });
  }

  runSingleEliminationTournament() {
    const participants = [];
    const tournamentSize = this.tournamentSize;
    
    // Create initial teams
    console.log(`\n=== Generating ${tournamentSize} Participants ===`);
    for (let i = 0; i < tournamentSize; i++) {
      const teamSize = this.format === '1v1' ? 1 : (this.format === '2v2' ? 2 : 6);
      participants.push({
        team: this.createTeam(teamSize),
        wins: 0,
        losses: 0
      });
    }
    
    // Log initial teams
    participants.forEach((p, i) => {
      const names = p.team.map(pok => `${pok.name}(${pok.types.join('/')})`).join(', ');
      console.log(`  ${i + 1}. ${names}`);
    });
    
    let round = 1;
    let roundParticipants = [...participants];
    let battleNum = 1;
    
    while (roundParticipants.length > 1) {
      console.log(`\n=== Round ${round} (${roundParticipants.length} competitors) ===`);
      const nextRound = [];
      
      for (let i = 0; i < roundParticipants.length; i += 2) {
        const p1 = roundParticipants[i];
        const p2 = roundParticipants[i + 1];
        
        const winner = this.runBattle(p1.team, p2.team, battleNum);
        
        if (winner === 1) {
          p1.wins++;
          p2.losses++;
          nextRound.push(p1);
          console.log(`  Battle ${battleNum}: ${p1.team[0].name} (${p1.wins}W) vs ${p2.team[0].name} (${p2.losses}L) → ${p1.team[0].name} WINS`);
        } else {
          p2.wins++;
          p1.losses++;
          nextRound.push(p2);
          console.log(`  Battle ${battleNum}: ${p1.team[0].name} (${p1.wins}W) vs ${p2.team[0].name} (${p2.losses}L) → ${p2.team[0].name} WINS`);
        }
        battleNum++;
      }
      
      roundParticipants = nextRound;
      round++;
    }
    
    const champion = roundParticipants[0];
    console.log(`\n🏆 CHAMPION: ${champion.team[0].name} (${champion.wins}W-${champion.losses}L)`);
    console.log(`   Types: ${champion.team[0].types.join('/')}`);
    console.log(`   Ability: ${champion.team[0].ability}`);
    console.log(`   Moves: ${champion.team[0].moves.map(m => m.name).join(', ')}`);
    
    return champion;
  }

  run() {
    console.log(`╔════════════════════════════════════════════════════════╗`);
    console.log(`║       Pokemon Battle AI Tournament Simulator            ║`);
    console.log(`║                                                        ║`);
    console.log(`║ Format: ${this.format.toUpperCase().padEnd(10)} Size: ${this.tournamentSize.toString().padEnd(5)}`);
    console.log(`║ Tournaments: ${this.tournamentCount.toString().padEnd(35)}`);
    console.log(`╚════════════════════════════════════════════════════════╝`);
    
    if (this.statsOnly) {
      console.log('\n[Stats mode - skipping battles, generating sample Pokemon]');
      for (let i = 0; i < 3; i++) {
        const p = this.createTeam(1)[0];
        console.log(`${i+1}. ${p.name} ${p.types} - ${p.ability}`);
        console.log(`   ${p.moves.map(m => m.name).join(', ')}`);
      }
      return;
    }
    
    const champions = [];
    
    for (let t = 1; t <= this.tournamentCount; t++) {
      console.log(`\n${'═'.repeat(56)}`);
      console.log(`TOURNAMENT ${t}/${this.tournamentCount}`);
      console.log(`${'═'.repeat(56)}`);
      
      const champion = this.runSingleEliminationTournament();
      champions.push(champion);
      this.stats.totalTournaments++;
    }
    
    // Print analytics
    this.printAnalytics(champions);
  }

  printAnalytics(champions) {
    console.log(`\n${'═'.repeat(56)}`);
    console.log(`TOURNAMENT ANALYSIS REPORT`);
    console.log(`${'═'.repeat(56)}`);
    
    console.log(`\n📊 SUMMARY`);
    console.log(`  Total Battles: ${this.stats.totalBattles}`);
    console.log(`  Tournaments Run: ${this.stats.totalTournaments}`);
    console.log(`  Format: ${this.format}`);
    console.log(`  Tournament Size: ${this.tournamentSize}`);
    
    console.log(`\n🏆 CHAMPION ANALYSIS`);
    console.log(`  Total Champions: ${champions.length}`);
    
    // Most common champion types
    const championTypes = {};
    champions.forEach(c => {
      c.team.forEach(p => {
        const typeKey = p.types.join('/');
        championTypes[typeKey] = (championTypes[typeKey] || 0) + 1;
      });
    });
    console.log(`  Most Common Types:`);
    Object.entries(championTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([type, count]) => {
        console.log(`    ${type.padEnd(15)} : ${count}x (${(count/champions.length*100).toFixed(1)}%)`);
      });
    
    // Most common abilities
    const championAbilities = {};
    champions.forEach(c => {
      c.team.forEach(p => {
        championAbilities[p.ability] = (championAbilities[p.ability] || 0) + 1;
      });
    });
    console.log(`  Most Common Abilities:`);
    Object.entries(championAbilities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([ability, count]) => {
        console.log(`    ${ability.padEnd(20)} : ${count}x (${(count/champions.length*100).toFixed(1)}%)`);
      });
    
    console.log(`\n🎯 MOVE ANALYSIS`);
    const sortedMoves = Object.entries(this.stats.moveSelection)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    
    console.log(`  Top 15 Moves Used:`);
    sortedMoves.forEach(([moveKey, count], i) => {
      const [poke, move] = moveKey.split('_');
      console.log(`    ${(i+1).toString().padStart(2)}. ${move.padEnd(20)} : ${count} times`);
    });
    
    if (Object.keys(this.stats.moveEffectUsage).length > 0) {
      console.log(`\n💫 MOVE EFFECTS USED`);
      Object.entries(this.stats.moveEffectUsage)
        .sort((a, b) => b[1] - a[1])
        .forEach(([effect, count]) => {
          console.log(`    ${effect.padEnd(15)} : ${count} instances`);
        });
    }
    
    console.log(`\n📈 WINNER STATISTICS`);
    if (this.stats.winnerStats.length > 0) {
      const avgStats = this.calculateAverageStats(this.stats.winnerStats);
      console.log(`  Average Winner Stats:`);
      console.log(`    HP:  ${avgStats.hp.toFixed(1)}`);
      console.log(`    ATK: ${avgStats.atk.toFixed(1)}`);
      console.log(`    DEF: ${avgStats.def.toFixed(1)}`);
      console.log(`    SpA: ${avgStats.spA.toFixed(1)}`);
      console.log(`    SpD: ${avgStats.spD.toFixed(1)}`);
      console.log(`    Spe: ${avgStats.spe.toFixed(1)}`);
    }
    
    console.log(`\n📉 LOSER STATISTICS`);
    if (this.stats.loserStats.length > 0) {
      const avgStats = this.calculateAverageStats(this.stats.loserStats);
      console.log(`  Average Loser Stats:`);
      console.log(`    HP:  ${avgStats.hp.toFixed(1)}`);
      console.log(`    ATK: ${avgStats.atk.toFixed(1)}`);
      console.log(`    DEF: ${avgStats.def.toFixed(1)}`);
      console.log(`    SpA: ${avgStats.spA.toFixed(1)}`);
      console.log(`    SpD: ${avgStats.spD.toFixed(1)}`);
      console.log(`    Spe: ${avgStats.spe.toFixed(1)}`);
    }
    
    console.log(`\n${'═'.repeat(56)}\n`);
  }

  calculateAverageStats(statArray) {
    if (statArray.length === 0) return {};
    
    const stats = {
      hp: 0, atk: 0, def: 0, spA: 0, spD: 0, spe: 0
    };
    
    statArray.forEach(s => {
      stats.hp += s.hp;
      stats.atk += s.atk;
      stats.def += s.def;
      stats.spA += s.spA;
      stats.spD += s.spD;
      stats.spe += s.spe;
    });
    
    Object.keys(stats).forEach(key => {
      stats[key] /= statArray.length;
    });
    
    return stats;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  format: '1v1',
  tournaments: 5,
  size: 8,
  verbose: false,
  statsOnly: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--format' && i + 1 < args.length) {
    options.format = args[++i];
  } else if (args[i] === '--tournaments' && i + 1 < args.length) {
    options.tournaments = parseInt(args[++i]);
  } else if (args[i] === '--size' && i + 1 < args.length) {
    options.size = parseInt(args[++i]);
  } else if (args[i] === '--verbose') {
    options.verbose = true;
  } else if (args[i] === '--stats-only') {
    options.statsOnly = true;
  } else if (args[i] === '--help') {
    console.log(`
Tournament Simulator - AI Behavior Analysis

Usage: node tools/tournament-simulator.mjs [options]

Options:
  --format FORMAT      Battle format: 1v1 (default), 2v2, 2v2-full
  --tournaments N      Number of tournaments to run (default: 5)
  --size N            Tournament size: 2, 4, 8 (default), 16, 32, 64
  --verbose           Show detailed battle logs
  --stats-only        Skip battles, only show setup info
  --help              Show this help message

Examples:
  node tools/tournament-simulator.mjs --tournaments 10 --size 16
  node tools/tournament-simulator.mjs --format 2v2 --size 8 --verbose
  node tools/tournament-simulator.mjs --format 1v1 --tournaments 20
`);
    process.exit(0);
  }
}

// Validate options
if (![2, 4, 8, 16, 32, 64].includes(options.size)) {
  console.error('Error: Tournament size must be a power of 2 (2, 4, 8, 16, 32, or 64)');
  process.exit(1);
}

if (!['1v1', '2v2', '2v2-full'].includes(options.format)) {
  console.error('Error: Format must be 1v1, 2v2, or 2v2-full');
  process.exit(1);
}

// Run simulator
const simulator = new TournamentSimulator(options);
simulator.run();
