# Pokémon Registry System

## Overview
The Pokémon Registry is a central storage system that automatically tracks all created Pokémon instances with unique IDs, allowing you to access and manage them throughout the application.

## Features

### 🆔 Automatic ID Assignment
- Every Pokémon created gets a unique ID (format: `PKM-1`, `PKM-2`, etc.)
- IDs are assigned automatically during creation
- Pokémon are registered immediately when created (randomize or tournament)

### 🗄️ Global Registry Storage
All created Pokémon are stored in a central registry accessible via:
- **JavaScript Console**: `window.pokemonRegistry` or `pokemonRegistry`
- **UI Buttons**: View All Pokémon, Export Registry, Clear Registry

## API Reference

### Access from Console
```javascript
// Get all Pokémon
pokemonRegistry.getAll()

// Get Pokémon by ID
pokemonRegistry.getById('PKM-42')

// Find Pokémon by name
pokemonRegistry.getByName('pikachu')

// Find Pokémon by type
pokemonRegistry.getByType('fire')

// Find Pokémon by species
pokemonRegistry.getBySpecies('charizard')

// Get registry statistics
pokemonRegistry.getStats()

// Get count
pokemonRegistry.count()

// Export to JSON
pokemonRegistry.exportToJSON()

// Clear all Pokémon
pokemonRegistry.clear()

// Custom search
pokemonRegistry.find(p => p.level > 50 && p.types.includes('dragon'))
```

### Pokémon Object Structure
```javascript
{
  id: "PKM-123",           // Unique identifier
  name: "charizard-fire-flying",  // Display name with types
  species: "charizard",     // Original species
  level: 50,
  types: ["fire", "flying"],
  ability: "blaze",
  stats: { hp: 297, atk: 204, def: 192, spA: 239, spD: 206, spe: 236 },
  maxHp: 297,
  currentHP: 297,
  moves: [...],             // Array of move objects
  item: "leftovers",
  status: null,
  // ... and more battle-related properties
}
```

## UI Features

### Buttons Added
1. **View All Pokémon (Registry)** - Opens a detailed table view of all created Pokémon
2. **Export Registry to JSON** - Downloads all Pokémon data as a JSON file
3. **Clear Registry** - Removes all Pokémon from the registry (with confirmation)

### Registry View Display
After tournaments, the page shows:
- Total Pokémon count
- Average level
- Most common types
- Button to view full registry details

### Full Registry Table
When viewing the full registry, you'll see:
- Pokémon ID
- Name (with type variants)
- Original species
- Level
- Type(s)
- Ability
- Current HP / Max HP

## Usage Examples

### Example 1: Find all Fire-type Pokémon
```javascript
const firePokemon = pokemonRegistry.getByType('fire');
console.log(`Found ${firePokemon.length} Fire-type Pokémon:`, firePokemon.map(p => p.name));
```

### Example 2: Get specific Pokémon by ID
```javascript
const myPokemon = pokemonRegistry.getById('PKM-5');
if (myPokemon) {
  console.log(`${myPokemon.name} - Level ${myPokemon.level}`);
  console.log(`Types: ${myPokemon.types.join(', ')}`);
  console.log(`HP: ${myPokemon.currentHP}/${myPokemon.maxHp}`);
}
```

### Example 3: Export all Dragon-type Pokémon
```javascript
const dragons = pokemonRegistry.getByType('dragon');
const dragonsJSON = JSON.stringify(dragons, null, 2);
console.log(dragonsJSON);
// Or download as file
const blob = new Blob([dragonsJSON], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'dragons.json';
a.click();
```

### Example 4: Find Pokémon with specific criteria
```javascript
// Find all Pokémon with HP over 300
const tanky = pokemonRegistry.find(p => p.maxHp > 300);

// Find all dual-type Pokémon
const dualTypes = pokemonRegistry.find(p => p.types.length === 2);

// Find low HP Pokémon that need healing
const injured = pokemonRegistry.find(p => p.currentHP < p.maxHp * 0.5);
```

### Example 5: Get statistics
```javascript
const stats = pokemonRegistry.getStats();
console.log('Registry Statistics:', stats);
// Output:
// {
//   total: 256,
//   byType: { fire: 45, water: 38, grass: 35, ... },
//   bySpecies: { pikachu: 8, charizard: 5, ... },
//   averageLevel: 50
// }
```

## Workflow

### During Randomization
1. Click "Randomize Pokémon" button
2. Pokémon is created and automatically registered
3. ID is assigned (e.g., `PKM-1`)
4. Pokémon is displayed on screen
5. Access it anytime via `pokemonRegistry.getById('PKM-1')`

### During Tournaments
1. Click "Run Tournament"
2. All Pokémon for all teams are created and registered
3. Each gets a unique ID
4. After tournament, registry shows total count
5. View full registry with "View All Pokémon (Registry)" button

### Exporting Data
1. Click "Export Registry to JSON" at any time
2. JSON file is downloaded with timestamp
3. Contains all Pokémon data including:
   - IDs, stats, types, abilities
   - Moves with PP
   - Current battle state
   - Items held

## Console Helpers

The registry is accessible from the browser console for debugging and analysis:

```javascript
// Quick stats
console.log(`Total Pokémon: ${pokemonRegistry.count()}`);

// Type breakdown
console.table(pokemonRegistry.getTypeDistribution());

// Species breakdown
console.table(pokemonRegistry.getSpeciesDistribution());

// List all IDs
console.log(pokemonRegistry.getAllIds());

// Get the first 10 Pokémon
console.log(pokemonRegistry.getAll().slice(0, 10));
```

## Persistence Note
⚠️ The registry is **in-memory only** and will be cleared when you:
- Refresh the page
- Close the browser tab
- Click "Clear Registry" button

To save Pokémon data permanently:
1. Use "Export Registry to JSON" button regularly
2. Import the JSON back into your application if needed (feature can be added)

## Future Enhancements
Potential additions:
- Import Pokémon from JSON
- Filter/search UI in the registry view
- Click on Pokémon ID to view full details
- Battle history per Pokémon
- Sorting options in the table view
