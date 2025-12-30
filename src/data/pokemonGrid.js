import { pokemon } from './pokemon.js';

// Generate a grid mapping for Pokémon IDs 1..649 (Gen I-V).
// If your sprite sheet uses a different number of columns, change COLS.
const COLS = 31;
const FIRST_ID = 1;
const LAST_ID = 649;

export const pokemonGrid = Object.values(pokemon)
    .filter(p => typeof p.id === 'number' && p.id >= FIRST_ID && p.id <= LAST_ID)
    .sort((a, b) => a.id - b.id)
    .map((p, idx) => ({ name: p.name, x: idx % COLS, y: Math.floor(idx / COLS) }));

