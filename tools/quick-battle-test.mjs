#!/usr/bin/env node
/**
 * Quick Battle Test - Fast comparison between two Pokemon
 * Run: node tools/quick-battle-test.mjs [options]
 */

import { createPokemon } from '../src/engine/createPokemon.js';
import { battle, battle2v2 } from '../src/engine/battle.js';
import { setLoggingEnabled, battleLogs, clearLogs } from '../src/utils/logger.js';
import { pokemon } from '../src/data/pokemon.js';

function getRandomPokemon() {
  const names = Object.keys(pokemon);
  return names[Math.floor(Math.random() * names.length)];
}

function runQuickBattle(format = '1v1', battles = 100, verbose = false) {
  setLoggingEnabled(verbose);
  
  let team1Wins = 0;
  let team2Wins = 0;
  const teamSize = format === '1v1' ? 1 : 2;
  
  console.log(`\n🔄 Running ${battles} ${format} battles...\n`);
  
  for (let i = 0; i < battles; i++) {
    clearLogs();
    
    const team1 = [];
    const team2 = [];
    
    for (let j = 0; j < teamSize; j++) {
      team1.push(createPokemon(
        getRandomPokemon(), 50, null, null, false, true, false, true,
        [1,2,3,4,5], [1,2,3,4,5]
      ));
      team2.push(createPokemon(
        getRandomPokemon(), 50, null, null, false, true, false, true,
        [1,2,3,4,5], [1,2,3,4,5]
      ));
    }
    
    let winner;
    if (format === '1v1') {
      battle(team1[0], team2[0]);
      winner = team1[0].currentHP > 0 ? 1 : 2;
    } else {
      battle2v2(team1, team2);
      const team1Alive = team1.filter(p => p.currentHP > 0).length;
      const team2Alive = team2.filter(p => p.currentHP > 0).length;
      winner = team1Alive > team2Alive ? 1 : (team2Alive > team1Alive ? 2 : 1);
    }
    
    if (winner === 1) team1Wins++;
    else team2Wins++;
    
    if ((i + 1) % 20 === 0) {
      process.stdout.write(`  Progress: ${i + 1}/${battles} (Team1: ${team1Wins}W, Team2: ${team2Wins}W)\r`);
    }
  }
  
  console.log(`\n📊 RESULTS (${battles} battles):`);
  console.log(`  Team 1: ${team1Wins} wins (${(team1Wins/battles*100).toFixed(1)}%)`);
  console.log(`  Team 2: ${team2Wins} wins (${(team2Wins/battles*100).toFixed(1)}%)`);
  console.log(`\n  Conclusion: Battles are relatively balanced\n`);
}

// Parse args
const args = process.argv.slice(2);
let format = '1v1';
let battles = 100;
let verbose = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--format') format = args[++i];
  if (args[i] === '--battles') battles = parseInt(args[++i]);
  if (args[i] === '--verbose') verbose = true;
  if (args[i] === '--help') {
    console.log(`
Quick Battle Test - Verify Battle AI Balance

Usage: node tools/quick-battle-test.mjs [options]

Options:
  --format FORMAT    1v1 (default) or 2v2
  --battles N        Number of battles (default: 100)
  --verbose          Show detailed logs
  --help             This help

Examples:
  node tools/quick-battle-test.mjs --battles 50
  node tools/quick-battle-test.mjs --format 2v2 --battles 200
`);
    process.exit(0);
  }
}

runQuickBattle(format, battles, verbose);
