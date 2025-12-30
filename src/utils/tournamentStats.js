/**
 * Tournament Statistics Tracker
 * Tracks detailed stats for team battles including switches, KOs, moves, damage, etc.
 */

export class TournamentStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.pokemonStats = new Map(); // Pokemon name -> stats object
    this.matchStats = [];
    this.currentMatch = null;
  }

  /**
   * Initialize a new match
   */
  startMatch(team1Names, team2Names) {
    this.currentMatch = {
      team1: team1Names,
      team2: team2Names,
      events: [],
      startTime: Date.now()
    };
  }

  /**
   * End current match
   */
  endMatch(winningTeam) {
    if (this.currentMatch) {
      this.currentMatch.endTime = Date.now();
      this.currentMatch.duration = this.currentMatch.endTime - this.currentMatch.startTime;
      this.currentMatch.winner = winningTeam;
      this.matchStats.push(this.currentMatch);
      this.currentMatch = null;
    }
  }

  /**
   * Get or create stats object for a Pokemon
   */
  getPokemonStats(pokemonName) {
    if (!this.pokemonStats.has(pokemonName)) {
      this.pokemonStats.set(pokemonName, {
        name: pokemonName,
        battles: 0,
        wins: 0,
        losses: 0,
        kills: 0,
        deaths: 0,
        switches: 0,
        switchOuts: 0,
        switchIns: 0,
        voluntarySwitches: 0,  // NEW: Strategic switches (not due to fainting)
        forcedSwitches: 0,      // NEW: Switches due to fainting
        switchReasons: {        // NEW: Breakdown of why switches occurred
          lowHP: 0,
          typeDisadvantage: 0,
          death: 0
        },
        damageDealt: 0,
        damageTaken: 0,
        turnsActive: 0,
        movesUsed: new Map(), // move name -> count
        movesDamage: new Map(), // move name -> total damage
        causedKOs: [], // List of {victim: name, move: name, turn: number}
        killedBy: [], // List of {killer: name, move: name, turn: number}
        flinches: 0,
        criticalHits: 0,
        statusesInflicted: new Map(), // status -> count
        statusesReceived: new Map(), // status -> count
        hpRestored: 0,
        recoilDamage: 0
      });
    }
    return this.pokemonStats.get(pokemonName);
  }

  /**
   * Record a battle participation
   */
  recordBattle(pokemonName, won) {
    const stats = this.getPokemonStats(pokemonName);
    stats.battles++;
    if (won) stats.wins++;
    else stats.losses++;
  }

  /**
   * Record a switch
   * @param {string} pokemonName - Pokemon name
   * @param {string} switchType - 'out' or 'in'
   * @param {string} reason - Reason for switch: 'death', 'lowHP', 'typeDisadvantage', or null
   */
  recordSwitch(pokemonName, switchType = 'out', reason = null) {
    const stats = this.getPokemonStats(pokemonName);
    stats.switches++;
    if (switchType === 'out') stats.switchOuts++;
    else stats.switchIns++;
    
    // Track voluntary vs forced switches
    if (reason === 'death') {
      stats.forcedSwitches++;
      stats.switchReasons.death++;
    } else if (reason) {
      stats.voluntarySwitches++;
      if (reason === 'lowHP') stats.switchReasons.lowHP++;
      else if (reason === 'typeDisadvantage') stats.switchReasons.typeDisadvantage++;
    }
    
    if (this.currentMatch) {
      this.currentMatch.events.push({
        type: 'switch',
        pokemon: pokemonName,
        switchType,
        reason
      });
    }
  }

  /**
   * Record a KO
   */
  recordKO(killerName, victimName, moveName, turn) {
    const killerStats = this.getPokemonStats(killerName);
    const victimStats = this.getPokemonStats(victimName);
    
    killerStats.kills++;
    victimStats.deaths++;
    
    killerStats.causedKOs.push({ victim: victimName, move: moveName, turn });
    victimStats.killedBy.push({ killer: killerName, move: moveName, turn });
    
    if (this.currentMatch) {
      this.currentMatch.events.push({
        type: 'ko',
        killer: killerName,
        victim: victimName,
        move: moveName,
        turn
      });
    }
  }

  /**
   * Record move usage
   */
  recordMoveUsed(pokemonName, moveName, damage = 0, wasCrit = false, causedFlinch = false) {
    const stats = this.getPokemonStats(pokemonName);
    
    const moveCount = stats.movesUsed.get(moveName) || 0;
    stats.movesUsed.set(moveName, moveCount + 1);
    
    if (damage > 0) {
      const moveDamage = stats.movesDamage.get(moveName) || 0;
      stats.movesDamage.set(moveName, moveDamage + damage);
      stats.damageDealt += damage;
    }
    
    if (wasCrit) stats.criticalHits++;
    if (causedFlinch) stats.flinches++;
  }

  /**
   * Record damage taken
   */
  recordDamageTaken(pokemonName, damage) {
    const stats = this.getPokemonStats(pokemonName);
    stats.damageTaken += damage;
  }

  /**
   * Record status inflicted
   */
  recordStatusInflicted(attackerName, targetName, status) {
    const attackerStats = this.getPokemonStats(attackerName);
    const targetStats = this.getPokemonStats(targetName);
    
    const count = attackerStats.statusesInflicted.get(status) || 0;
    attackerStats.statusesInflicted.set(status, count + 1);
    
    const received = targetStats.statusesReceived.get(status) || 0;
    targetStats.statusesReceived.set(status, received + 1);
  }

  /**
   * Record HP restored (healing)
   */
  recordHPRestored(pokemonName, amount) {
    const stats = this.getPokemonStats(pokemonName);
    stats.hpRestored += amount;
  }

  /**
   * Record recoil damage
   */
  recordRecoilDamage(pokemonName, amount) {
    const stats = this.getPokemonStats(pokemonName);
    stats.recoilDamage += amount;
  }

  /**
   * Increment turns active for a Pokemon
   */
  recordTurnActive(pokemonName) {
    const stats = this.getPokemonStats(pokemonName);
    stats.turnsActive++;
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const summary = {
      totalMatches: this.matchStats.length,
      totalPokemon: this.pokemonStats.size,
      stats: Array.from(this.pokemonStats.values())
    };

    // Sort by various metrics
    summary.byKills = [...summary.stats].sort((a, b) => b.kills - a.kills).slice(0, 10);
    summary.byDamage = [...summary.stats].sort((a, b) => b.damageDealt - a.damageDealt).slice(0, 10);
    summary.bySwitches = [...summary.stats].sort((a, b) => b.switches - a.switches).slice(0, 10);
    summary.byWinRate = [...summary.stats]
      .filter(s => s.battles > 0)
      .map(s => ({ ...s, winRate: s.wins / s.battles }))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 10);
    summary.bySurvivability = [...summary.stats]
      .filter(s => s.battles > 0)
      .map(s => ({ ...s, survivalRate: (s.battles - s.deaths) / s.battles }))
      .sort((a, b) => b.survivalRate - a.survivalRate)
      .slice(0, 10);

    return summary;
  }

  /**
   * Generate a detailed HTML report
   */
  generateHTMLReport() {
    const summary = this.getSummary();
    let html = '<div class="tournament-stats-report">';
    
    html += '<h2>🏆 Tournament Statistics Report</h2>';
    html += `<p><strong>Total Matches:</strong> ${summary.totalMatches} | <strong>Pokemon Participated:</strong> ${summary.totalPokemon}</p>`;
    
    // Top Killers
    html += '<h3>💀 Top Killers (Most KOs)</h3>';
    html += '<table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">';
    html += '<tr style="background: #f0f0f0;"><th style="padding: 8px; text-align: left;">Rank</th><th style="padding: 8px; text-align: left;">Pokemon</th><th style="padding: 8px; text-align: right;">Kills</th><th style="padding: 8px; text-align: right;">Deaths</th><th style="padding: 8px; text-align: right;">K/D</th></tr>';
    summary.byKills.forEach((s, i) => {
      const kd = s.deaths > 0 ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2);
      html += `<tr><td style="padding: 8px;">${i + 1}</td><td style="padding: 8px;"><strong>${s.name}</strong></td><td style="padding: 8px; text-align: right;">${s.kills}</td><td style="padding: 8px; text-align: right;">${s.deaths}</td><td style="padding: 8px; text-align: right;">${kd}</td></tr>`;
    });
    html += '</table>';
    
    // Top Damage Dealers
    html += '<h3>⚔️ Top Damage Dealers</h3>';
    html += '<table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">';
    html += '<tr style="background: #f0f0f0;"><th style="padding: 8px; text-align: left;">Rank</th><th style="padding: 8px; text-align: left;">Pokemon</th><th style="padding: 8px; text-align: right;">Damage Dealt</th><th style="padding: 8px; text-align: right;">Damage Taken</th><th style="padding: 8px; text-align: right;">Net</th></tr>';
    summary.byDamage.forEach((s, i) => {
      const net = s.damageDealt - s.damageTaken;
      html += `<tr><td style="padding: 8px;">${i + 1}</td><td style="padding: 8px;"><strong>${s.name}</strong></td><td style="padding: 8px; text-align: right;">${s.damageDealt}</td><td style="padding: 8px; text-align: right;">${s.damageTaken}</td><td style="padding: 8px; text-align: right; color: ${net > 0 ? 'green' : 'red'};">${net > 0 ? '+' : ''}${net}</td></tr>`;
    });
    html += '</table>';
    
    // Switching Behavior Statistics
    html += '<h3>🔄 Switching Behavior</h3>';
    const totalSwitches = this.getAll().reduce((sum, s) => sum + s.switches, 0);
    const totalVoluntary = this.getAll().reduce((sum, s) => sum + s.voluntarySwitches, 0);
    const totalForced = this.getAll().reduce((sum, s) => sum + s.forcedSwitches, 0);
    const totalLowHP = this.getAll().reduce((sum, s) => sum + (s.switchReasons?.lowHP || 0), 0);
    const totalTypeDisadv = this.getAll().reduce((sum, s) => sum + (s.switchReasons?.typeDisadvantage || 0), 0);
    
    html += '<div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #2d4a3e;">';
    html += `<p style="font-size: 20px; margin: 5px 0;"><strong>Total Switches:</strong> ${totalSwitches}</p>`;
    html += `<p style="font-size: 20px; margin: 5px 0;"><strong>Voluntary (Strategic):</strong> ${totalVoluntary} (${((totalVoluntary / Math.max(totalSwitches, 1)) * 100).toFixed(1)}%)</p>`;
    html += `<p style="font-size: 20px; margin: 5px 0; padding-left: 20px;">→ Due to Low HP: ${totalLowHP}</p>`;
    html += `<p style="font-size: 20px; margin: 5px 0; padding-left: 20px;">→ Due to Type Disadvantage: ${totalTypeDisadv}</p>`;
    html += `<p style="font-size: 20px; margin: 5px 0;"><strong>Forced (Death):</strong> ${totalForced} (${((totalForced / Math.max(totalSwitches, 1)) * 100).toFixed(1)}%)</p>`;
    html += '</div>';
    
    // Most Active Switchers with voluntary/forced breakdown
    html += '<h3>🔄 Most Active Switchers (Strategic)</h3>';
    html += '<table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">';
    html += '<tr style="background: #f0f0f0;"><th style="padding: 8px; text-align: left;">Rank</th><th style="padding: 8px; text-align: left;">Pokemon</th><th style="padding: 8px; text-align: right;">Voluntary</th><th style="padding: 8px; text-align: right;">Forced</th><th style="padding: 8px; text-align: right;">Total</th><th style="padding: 8px; text-align: right;">V%</th></tr>';
    const topVoluntarySwitchers = this.getAll()
      .filter(s => s.voluntarySwitches > 0)
      .sort((a, b) => b.voluntarySwitches - a.voluntarySwitches)
      .slice(0, 10);
    topVoluntarySwitchers.forEach((s, i) => {
      const voluntaryPercent = s.switches > 0 ? ((s.voluntarySwitches / s.switches) * 100).toFixed(1) : '0.0';
      html += `<tr><td style="padding: 8px;">${i + 1}</td><td style="padding: 8px;"><strong>${s.name}</strong></td><td style="padding: 8px; text-align: right;">${s.voluntarySwitches}</td><td style="padding: 8px; text-align: right;">${s.forcedSwitches}</td><td style="padding: 8px; text-align: right;">${s.switches}</td><td style="padding: 8px; text-align: right;"><strong>${voluntaryPercent}%</strong></td></tr>`;
    });
    html += '</table>';
    
    // Most Switched Pokemon
    html += '<h3>🔄 Most Active Switchers</h3>';
    html += '<table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">';
    html += '<tr style="background: #f0f0f0;"><th style="padding: 8px; text-align: left;">Rank</th><th style="padding: 8px; text-align: left;">Pokemon</th><th style="padding: 8px; text-align: right;">Total Switches</th><th style="padding: 8px; text-align: right;">Switch Outs</th><th style="padding: 8px; text-align: right;">Switch Ins</th></tr>';
    summary.bySwitches.forEach((s, i) => {
      html += `<tr><td style="padding: 8px;">${i + 1}</td><td style="padding: 8px;"><strong>${s.name}</strong></td><td style="padding: 8px; text-align: right;">${s.switches}</td><td style="padding: 8px; text-align: right;">${s.switchOuts}</td><td style="padding: 8px; text-align: right;">${s.switchIns}</td></tr>`;
    });
    html += '</table>';
    
    // Best Win Rates
    html += '<h3>🏅 Best Win Rates (Min 2 battles)</h3>';
    html += '<table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">';
    html += '<tr style="background: #f0f0f0;"><th style="padding: 8px; text-align: left;">Rank</th><th style="padding: 8px; text-align: left;">Pokemon</th><th style="padding: 8px; text-align: right;">Wins</th><th style="padding: 8px; text-align: right;">Losses</th><th style="padding: 8px; text-align: right;">Win Rate</th></tr>';
    summary.byWinRate.filter(s => s.battles >= 2).slice(0, 10).forEach((s, i) => {
      html += `<tr><td style="padding: 8px;">${i + 1}</td><td style="padding: 8px;"><strong>${s.name}</strong></td><td style="padding: 8px; text-align: right;">${s.wins}</td><td style="padding: 8px; text-align: right;">${s.losses}</td><td style="padding: 8px; text-align: right;"><strong>${(s.winRate * 100).toFixed(1)}%</strong></td></tr>`;
    });
    html += '</table>';
    
    // Most Used Moves
    html += '<h3>📊 Most Popular Moves</h3>';
    const moveUsage = new Map();
    const moveDamage = new Map();
    this.pokemonStats.forEach(stats => {
      stats.movesUsed.forEach((count, move) => {
        moveUsage.set(move, (moveUsage.get(move) || 0) + count);
      });
      stats.movesDamage.forEach((damage, move) => {
        moveDamage.set(move, (moveDamage.get(move) || 0) + damage);
      });
    });
    
    const topMoves = Array.from(moveUsage.entries())
      .map(([move, count]) => ({ move, count, damage: moveDamage.get(move) || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    
    html += '<table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">';
    html += '<tr style="background: #f0f0f0;"><th style="padding: 8px; text-align: left;">Rank</th><th style="padding: 8px; text-align: left;">Move</th><th style="padding: 8px; text-align: right;">Times Used</th><th style="padding: 8px; text-align: right;">Total Damage</th><th style="padding: 8px; text-align: right;">Avg Damage</th></tr>';
    topMoves.forEach((m, i) => {
      const avg = m.count > 0 ? (m.damage / m.count).toFixed(1) : 0;
      html += `<tr><td style="padding: 8px;">${i + 1}</td><td style="padding: 8px;"><strong>${m.move}</strong></td><td style="padding: 8px; text-align: right;">${m.count}</td><td style="padding: 8px; text-align: right;">${m.damage}</td><td style="padding: 8px; text-align: right;">${avg}</td></tr>`;
    });
    html += '</table>';
    
    // Notable KOs
    html += '<h3>💥 Most Impressive KOs</h3>';
    const allKOs = [];
    this.pokemonStats.forEach(stats => {
      stats.causedKOs.forEach(ko => {
        allKOs.push({ killer: stats.name, ...ko });
      });
    });
    
    if (allKOs.length > 0) {
      html += '<ul style="margin-bottom: 20px;">';
      allKOs.slice(0, 10).forEach(ko => {
        html += `<li><strong>${ko.killer}</strong> KO'd <strong>${ko.victim}</strong> with <em>${ko.move}</em> (Turn ${ko.turn})</li>`;
      });
      html += '</ul>';
    }
    
    html += '</div>';
    return html;
  }

  /**
   * Log summary to console
   */
  logSummary() {
    const summary = this.getSummary();
    console.log('=== TOURNAMENT STATISTICS ===');
    console.log(`Total Matches: ${summary.totalMatches}`);
    console.log(`Pokemon Participated: ${summary.totalPokemon}`);
    console.log('\nTop 5 Killers:');
    summary.byKills.slice(0, 5).forEach((s, i) => {
      console.log(`${i + 1}. ${s.name}: ${s.kills} kills, ${s.deaths} deaths (K/D: ${(s.kills / Math.max(s.deaths, 1)).toFixed(2)})`);
    });
    console.log('\nTop 5 Damage Dealers:');
    summary.byDamage.slice(0, 5).forEach((s, i) => {
      console.log(`${i + 1}. ${s.name}: ${s.damageDealt} dealt, ${s.damageTaken} taken`);
    });
    console.log('\nTop 5 Switchers:');
    summary.bySwitches.slice(0, 5).forEach((s, i) => {
      console.log(`${i + 1}. ${s.name}: ${s.switches} switches`);
    });
  }
}

// Global tournament stats instance
export const tournamentStats = new TournamentStats();
