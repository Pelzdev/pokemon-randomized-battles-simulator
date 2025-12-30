# Pokemon Battle Simulator - Testing & Analysis Guide

## Overview

This guide explains how to use the included testing tools to analyze the Pokemon battle AI behavior, move selection, and tournament outcomes.

## Quick Start

### 1. Run a Quick Balance Test
```bash
cd "Pokedata GPT"
node tools/quick-battle-test.mjs --battles 100
```
Expected: Both teams should have roughly 50% win rate

### 2. Run a Tournament Analysis
```bash
node tools/tournament-simulator.mjs --tournaments 3 --size 8
```
Expected: Diverse champion types, balanced move usage, stats slightly higher for winners

### 3. Analyze Specific Behaviors (Verbose Mode)
```bash
node tools/tournament-simulator.mjs --tournaments 1 --size 4 --verbose
```
Shows detailed move selections and battle progression

---

## Testing Tools

### Tool 1: Quick Battle Test
**File:** `tools/quick-battle-test.mjs`

Runs 100+ random 1v1 or 2v2 battles to verify the AI isn't biased.

**Usage:**
```bash
node tools/quick-battle-test.mjs [--format 1v1|2v2] [--battles 100]
```

**What It Tests:**
- ✅ AI move selection isn't biased
- ✅ Random Pokemon can win
- ✅ Battle outcomes are varied
- ✅ No stat combinations are overpowered

**Expected Results:**
- Win rates should be near 50/50
- Battles should complete in reasonable time
- Mix of Pokemon types should win

---

### Tool 2: Tournament Simulator
**File:** `tools/tournament-simulator.mjs`

Runs realistic tournaments (single elimination) and gathers detailed statistics about AI behavior.

**Usage:**
```bash
node tools/tournament-simulator.mjs [--format 1v1|2v2] [--tournaments 5] [--size 8]
```

**What It Analyzes:**
1. **Champion Profile**
   - Types of Pokemon that win most
   - Abilities that correlate with victory
   - Common stat distributions

2. **Move Selection**
   - Which moves are used most
   - Move effect type distribution
   - Status vs damage move preferences

3. **Battle Statistics**
   - Winner vs loser stat comparison
   - HP, Attack, Defense patterns
   - Speed and Special Attack/Defense roles

4. **AI Behavior Patterns**
   - Preference for STAB moves
   - Utility move selection in safe situations
   - Healing move usage when appropriate

---

## What to Look For

### Good AI Behavior Signs ✅

1. **Diverse Champions**
   - Different types win tournaments
   - Both fast and slow Pokemon succeed
   - Physical and special attackers both effective

2. **Smart Move Selection**
   - Status moves used to control opponents
   - Healing moves used when damaged
   - Offensive moves prioritized when ahead
   - Strategic STAB selection

3. **Balanced Matchups**
   - Type advantages matter but aren't deterministic
   - Rock-Paper-Scissors style type dynamics
   - Ability effects influence outcomes

4. **Stat Utilization**
   - Winners have slightly higher stats (but not drastically)
   - Speed Pokemon often go first (as designed)
   - High Attack/Sp.A Pokemon deal more damage

### Warning Signs ⚠️

1. **Same Type Always Wins**
   - Indicates type chart is broken
   - Check damage calculation
   - Verify ability effects

2. **Moves Never Used**
   - Moves with high frequency might be broken
   - Status moves completely ignored = AI doesn't value them
   - Healing moves never chosen = HP calculation issue

3. **Stat Irrelevance**
   - Winners don't have higher stats
   - Speed doesn't affect turn order
   - Attack stat doesn't affect damage output

4. **Frozen Outcomes**
   - Same team always wins
   - Tournament results are too predictable
   - RNG might not be working

---

## Running Specific Tests

### Test 1: AI Strategy Validation
```bash
# Run multiple tournaments to see strategy variance
node tools/tournament-simulator.mjs --tournaments 5 --size 8 --verbose

# What to check:
# - Do different Pokemon get selected? (should randomize)
# - Do moves vary by situation? (should respond to HP/opponent)
# - Are status moves occasionally used? (should have smart values)
```

### Test 2: Battle Balance Check
```bash
# Quick balance verification
node tools/quick-battle-test.mjs --battles 200

# What to check:
# - Is win rate ~50% for both sides?
# - Did it complete without errors?
# - Are battles finishing in reasonable time?
```

### Test 3: Move Effect Verification
```bash
# See which move effects are being triggered
node tools/tournament-simulator.mjs --tournaments 3 --size 8

# Check output for:
# - "Move Effects Used" section shows variety
# - STATUS effects should appear
# - DRAIN/RECOIL effects should appear
# - STAT modifications should happen
```

### Test 4: 2v2 Format Testing
```bash
# Test doubles format
node tools/tournament-simulator.mjs --format 2v2 --tournaments 2 --size 4

# What to check:
# - Teams fight correctly (2v2, not 1v1)
# - No crashes when switching Pokemon
# - Team synergy matters
```

### Test 5: Large Scale Tournament
```bash
# Long-running test for comprehensive analysis
node tools/tournament-simulator.mjs --tournaments 10 --size 32

# What to check:
# - Statistics converge (repeated runs should be similar)
# - No memory leaks (should complete without issues)
# - All Pokemon types get chances
```

---

## Performance Expectations

### Timing
- **quick-battle-test** (100 battles): ~10-15 seconds
- **quick-battle-test** (500 battles): ~60-90 seconds
- **tournament-simulator** (1 tournament, 8 size): ~15-20 seconds
- **tournament-simulator** (5 tournaments, 8 size): ~70-100 seconds

If much slower, check:
- System load
- Memory availability
- Logging isn't enabled unnecessarily

### Output Stability
- Run the same test twice with same parameters
- Results should be similar but not identical (randomness)
- Move counts should converge with more data

---

## Analyzing Output

### Example Good Tournament Output
```
📊 SUMMARY
  Total Battles: 14
  Format: 1v1
  Tournament Size: 8

🏆 CHAMPION ANALYSIS
  Total Champions: 2
  Most Common Types:
    ground/flying   : 1x (50%)
    normal          : 1x (50%)

🎯 MOVE ANALYSIS
  Top Moves: discharge, drill-run, earthquake, thunderbolt...

💫 MOVE EFFECTS USED
    STAT            : 28 instances  ← Good! Stat changes happen
    STATUS          : 22 instances  ← Good! Status moves used
    RECHARGE        : 1 instances   ← Less common (correct)
    DRAIN           : 1 instances   ← Less common (correct)

📈 WINNER STATISTICS
  Average Winner Stats:
    HP:  135.1  ← Winners slightly healthier
    ATK: 83.8   ← Winners slightly stronger
    DEF: 106.2  ← Defense helps
    Spe: 66.7   ← Speed varies
```

### Red Flags
```
❌ All battles won by Electric types
❌ Move effects: (none shown)
❌ Winner stats = Loser stats (battle outcome random)
❌ Crashes with errors
```

---

## Debugging Tips

### If battles crash:
```bash
# Run with verbose mode to see where it fails
node tools/tournament-simulator.mjs --tournaments 1 --size 2 --verbose
```

### If results seem wrong:
1. Check move.effects arrays aren't empty for status moves
2. Verify ability implementations work correctly
3. Test damage calculation with specific Pokemon

### If performance is slow:
1. Reduce tournament size: `--size 4` instead of `--size 16`
2. Reduce count: `--tournaments 1` instead of `--tournaments 10`
3. Use quick-battle-test instead (simpler overhead)

---

## Creating Baseline Reports

For tracking improvements over time:

```bash
# Create baseline
node tools/tournament-simulator.mjs --tournaments 5 --size 16 > baseline-$(date +%Y%m%d).txt

# Later, compare after code changes
node tools/tournament-simulator.mjs --tournaments 5 --size 16 > current-$(date +%Y%m%d).txt

# Review both files for differences in:
# - Champion types/abilities
# - Move selection patterns
# - Stat comparisons
# - Win rate consistency
```

---

## Success Metrics

The battle AI is working well when:

✅ **Win rates are balanced** (near 50/50)
✅ **Champions are diverse** (variety of types/abilities)
✅ **Move effects trigger** (status, healing, stat changes visible)
✅ **Strategy adapts** (different moves in different situations)
✅ **No crashes occur** (stable across many battles)
✅ **Stat distributions matter** (winners have slight advantage)
✅ **AI values utility** (status moves are used)
✅ **Tournaments complete** (reasonable time, no hangs)

---

## Next Steps

After running tests:

1. **If everything passes:** System is working correctly
2. **If some moves unused:** Check move effects implementation
3. **If battle outcomes skewed:** Check damage calculation
4. **If crashes occur:** Check error in verbose mode output
5. **If too slow:** Optimize hot loops (move selection, damage calc)

---

For detailed tool documentation, see: [tools/README.md](tools/README.md)
