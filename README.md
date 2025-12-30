# Pokemon Battle Simulator

A web-based Pokemon battle simulator with randomized type combinations and an authentic Pokemon Emerald-style interface.

## Getting Started

### Running the Application

1. **Using a local server** (recommended):
   ```bash
   # If you have Python 3 installed:
   python3 -m http.server 8000
   
   # Or with Python 2:
   python -m SimpleHTTPServer 8000
   
   # Or with Node.js (if installed):
   npx http-server
   ```
   Then open `http://localhost:8000` in your web browser.

2. **Direct file opening**:
   - Open `index.html` directly in your web browser (double-click the file)
   - Note: Some features may be restricted due to browser security when opening files directly

## Features

- **Sprite Recoloring**: Automatic sprite recoloring based on type combinations using the Inclement Emerald algorithm
- **Tournament Mode**: Run bracket-style tournaments with up to 64 participants
- **Generation Filtering**: Filter Pokemon and moves by generation (Gen 1-5)
- **Customization Options**:
  - BST (Base Stat Total) filtering (≤600 or all)
  - Random abilities
  - Random items
  - Wonder Guard toggle
  - Enhanced color recoloring

## How to Use

### Basic Usage

1. Open `index.html` in a web browser
2. Click "Randomize Pokemon" to generate a random Pokemon with random types
3. The Pokemon sprite will be automatically recolored to match its new types
4. View stats, moves, ability, and other details in the info panel

### Tournament Mode

1. Set the tournament size (must be a power of 2: 2, 4, 8, 16, 32, or 64)
2. Configure your filters:
   - Select Pokemon generations to include
   - Select move generations to include
   - Toggle "600+ BST" to include legendary/pseudo-legendary Pokemon
   - Toggle other options as desired
3. Click "Run Tournament" to start
4. The champion will be displayed at the end

### Filters and Options

- **600+ BST Checkbox**: When unchecked, excludes Pokemon with base stat totals above 600
- **Random Abilities**: Randomizes the Pokemon's ability
- **Wonder Guard**: Allows the Wonder Guard ability (normally restricted)
- **Random Items**: Gives Pokemon random held items
- **Enhanced Colors**: Uses the enhanced Inclement Emerald recoloring algorithm
- **Generation Checkboxes**: Include/exclude specific generations

## Files Structure

```
├── index.html              # Main HTML file
├── styles.css             # Pokemon Emerald-style CSS
├── moves.json             # Move data
├── sprites2.png          # Pokemon sprite sheet
├── src/
│   ├── index.js          # Main application logic
│   ├── config/
│   │   ├── constants.js  # Application-wide constants
│   │   ├── typeMapping.js # Type and category icon mappings
│   │   └── uiState.js    # UI state manager
│   ├── data/
│   │   ├── moves.js      # Move data module
│   │   ├── pokemon.js    # Pokemon data module
│   │   ├── pokemonGrid.js # Sprite sheet coordinate mappings
│   │   ├── typeChart.js  # Type effectiveness chart
│   │   └── typeRamps.js  # Color palettes for type recoloring
│   ├── engine/
│   │   ├── battle.js     # Battle simulation logic
│   │   ├── createPokemon.js # Pokemon generation
│   │   ├── damage.js     # Damage calculation
│   │   ├── stats.js      # Stat calculation
│   │   ├── statUtils.js  # Stat utilities
│   │   └── turn.js       # Turn processing
│   └── utils/
│       ├── logger.js     # Battle logging
│       └── random.js     # RNG utilities
├── type icons/           # Type and category icons
└── font/                # Pokemon Emerald font
```

## Technical Details

### Sprite Recoloring Algorithm

The enhanced recoloring algorithm uses HSV color space and implements:

1. **Palette Analysis**: Extracts unique colors from the sprite
2. **Dominant Hue Detection**: Calculates the weighted average hue of colored pixels
3. **Dual-Type Distribution**: Assigns primary and secondary type colors based on hue distance and brightness
4. **Saturation Preservation**: Maintains color intensity for vibrant results
5. **Brightness Mapping**: Maps original brightness to target color ramps

### Battle System

The battle system implements Gen 1-5 mechanics including:
- Type effectiveness (including Fairy type)
- Stat calculations with natures and IVs
- Move effects (status, stat changes, weather, etc.)
- Turn-based combat with speed priority
- PP management

## Credits

- Inspired by [Inclement Emerald Customizer](https://github.com/JWGerbenGB/Inclement-Emerald-Customizer)
- Uses Pokemon Emerald font and visual style
- Type icons from Pokemon games
