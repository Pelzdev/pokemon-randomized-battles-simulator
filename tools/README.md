# Tournament Simulator & Battle Testing Tools

Tools for analyzing Pokemon Battle AI behavior, move selection patterns, and tournament outcomes.

## Tools Available

### 1. **tournament-simulator.mjs** - Comprehensive Tournament Analysis

Runs single-elimination tournaments and analyzes AI behavior across multiple battles.

```bash
node tools/tournament-simulator.mjs [options]
```

#### Options:
- `--format FORMAT` - Battle format: `1v1` (default), `2v2`, `2v2-full`
- `--tournaments N` - Number of tournaments to run (default: 5)
- `--size N` - Tournament size: 2, 4, 8 (default), 16, 32, 64
- `--verbose` - Show detailed battle logs
- `--stats-only` - Skip battles, only show Pokemon setup stats
- `--help` - Show help message

#### Examples:

**Basic 1v1 tournament:**
```bash
node tools/tournament-simulator.mjs --tournaments 3 --size 8
```

**2v2 tournament with verbose logging:**
```bash
node tools/tournament-simulator.mjs --format 2v2 --size 8 --verbose
```

**Large tournament for AI analysis:**
```bash
node tools/tournament-simulator.mjs --tournaments 10 --size 16
```

#### Output Analysis:

The tool generates a comprehensive report including:

- **Tournament Summary**
  - Total battles and tournaments run
  - Format and size configuration

- **Champion Analysis**
  - Most common champion types/abilities
  - Success patterns

- **Move Analysis**
  - Top 15 most-used moves
  - Move effect type distribution
  - Strategic move selection insights

- **Statistical Comparison**
  - Average stats of winners vs losers
  - Stat advantages that correlate with wins

### 2. **quick-battle-test.mjs** - Fast Battle Balance Verification

Runs many random battles quickly to verify balanced AI behavior.

```bash
node tools/quick-battle-test.mjs [options]
```

#### Options:
- `--format FORMAT` - `1v1` (default) or `2v2`
- `--battles N` - Number of battles to run (default: 100)
- `--verbose` - Show detailed logs
- `--help` - Show help message

#### Examples:

**Quick balance check (100 battles):**
```bash
node tools/quick-battle-test.mjs --battles 100
```

**Stress test with 500 battles:**
```bash
node tools/quick-battle-test.mjs --battles 500
```

**2v2 format balance test:**
```bash
node tools/quick-battle-test.mjs --format 2v2 --battles 200
```

#### Output:

Simple win/loss statistics showing:
- Team 1 wins (%)
- Team 2 wins (%)
- Balance assessment

---

## What Gets Analyzed

### AI Move Selection
- Which moves are chosen in different situations
- Preference for status vs damage moves
- STAB weighting effectiveness

### Battle Patterns
- Type advantages/disadvantages
- Speed-based decision making
- HP-based move selection

### Ability Impact
- How abilities affect battle outcomes
- Weather-related victories
- Stat modification advantages

### Effectiveness Metrics
- Win rates by type combination
- Stat correlations with victory
- Move effect usage patterns

---

## Interpreting Results

### Champion Analysis
A healthy AI should show:
- Diverse champion types (not always one type winning)
- No single ability dominating all victories
- Both physical and special attackers winning

### Move Analysis
Good AI behavior includes:
- Mix of damage and utility moves
- Status moves used strategically
- Higher PP moves preferred when appropriate

### Stat Analysis
Winners typically show:
- Slightly higher average stats (but not drastically)
- Balanced distributions (not all physical or all special)
- Mix of fast and slow Pokemon

---

## Advanced Usage

### Performance Monitoring

Run tournaments regularly to track AI improvements:
```bash
# Create a baseline
node tools/tournament-simulator.mjs --tournaments 5 --size 16 > baseline.txt

# After code changes, compare
node tools/tournament-simulator.mjs --tournaments 5 --size 16 > current.txt
```

### Debugging Specific Battles

Use `--verbose` to see move-by-move logs:
```bash
node tools/tournament-simulator.mjs --tournaments 1 --size 2 --verbose
```

### Testing New Features

Quickly verify changes don't break battle balance:
```bash
node tools/quick-battle-test.mjs --battles 200
```

---

## Requirements

- Node.js v18+ (for ES modules)
- All Pokemon battle system files must be intact
- No special dependencies beyond built-in modules

## Notes

- Battles use randomized Pokemon from Generations 1-5
- All abilities and moves are available to the AI
- Items are randomly assigned to Pokemon
- Each run produces different results (random matchups)
