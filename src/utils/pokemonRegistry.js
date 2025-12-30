/**
 * Pokemon Registry
 * Central storage for all created Pokemon instances
 * Allows accessing any Pokemon by its unique ID
 */

export class PokemonRegistry {
  constructor() {
    this.pokemon = new Map(); // ID -> Pokemon object
    this.nextId = 1;
  }

  /**
   * Generate a new unique ID
   * @returns {string} Unique Pokemon ID
   */
  generateId() {
    return `PKM-${this.nextId++}`;
  }

  /**
   * Register a Pokemon in the registry
   * @param {object} pokemon - Pokemon object to register
   * @returns {string} The assigned ID
   */
  register(pokemon) {
    if (!pokemon.id) {
      pokemon.id = this.generateId();
    }
    this.pokemon.set(pokemon.id, pokemon);
    return pokemon.id;
  }

  /**
   * Get a Pokemon by ID
   * @param {string} id - Pokemon ID
   * @returns {object|null} Pokemon object or null if not found
   */
  getById(id) {
    return this.pokemon.get(id) || null;
  }

  /**
   * Get all registered Pokemon
   * @returns {Array} Array of all Pokemon objects
   */
  getAll() {
    return Array.from(this.pokemon.values());
  }

  /**
   * Get all Pokemon IDs
   * @returns {Array} Array of all Pokemon IDs
   */
  getAllIds() {
    return Array.from(this.pokemon.keys());
  }

  /**
   * Check if a Pokemon exists by ID
   * @param {string} id - Pokemon ID
   * @returns {boolean}
   */
  exists(id) {
    return this.pokemon.has(id);
  }

  /**
   * Remove a Pokemon from the registry
   * @param {string} id - Pokemon ID
   * @returns {boolean} True if removed, false if not found
   */
  remove(id) {
    return this.pokemon.delete(id);
  }

  /**
   * Clear all Pokemon from the registry
   */
  clear() {
    this.pokemon.clear();
  }

  /**
   * Get Pokemon count
   * @returns {number}
   */
  count() {
    return this.pokemon.size;
  }

  /**
   * Find Pokemon by criteria
   * @param {Function} predicate - Filter function
   * @returns {Array} Array of matching Pokemon
   */
  find(predicate) {
    return this.getAll().filter(predicate);
  }

  /**
   * Get Pokemon by name (case-insensitive, returns all matches)
   * @param {string} name - Pokemon name
   * @returns {Array} Array of Pokemon with matching name
   */
  getByName(name) {
    const lowerName = name.toLowerCase();
    return this.getAll().filter(p => p.name.toLowerCase() === lowerName);
  }

  /**
   * Get Pokemon by species
   * @param {string} species - Pokemon species
   * @returns {Array} Array of Pokemon of that species
   */
  getBySpecies(species) {
    return this.getAll().filter(p => p.species === species);
  }

  /**
   * Get Pokemon by type
   * @param {string} type - Type name
   * @returns {Array} Array of Pokemon with that type
   */
  getByType(type) {
    return this.getAll().filter(p => p.types.includes(type));
  }

  /**
   * Get statistics about registered Pokemon
   * @returns {object} Statistics object
   */
  getStats() {
    const all = this.getAll();
    return {
      total: all.length,
      byType: this.getTypeDistribution(),
      bySpecies: this.getSpeciesDistribution(),
      averageLevel: all.reduce((sum, p) => sum + (p.level || 50), 0) / Math.max(all.length, 1)
    };
  }

  /**
   * Get type distribution
   * @returns {object} Type -> count mapping
   */
  getTypeDistribution() {
    const distribution = {};
    this.getAll().forEach(p => {
      p.types.forEach(type => {
        distribution[type] = (distribution[type] || 0) + 1;
      });
    });
    return distribution;
  }

  /**
   * Get species distribution
   * @returns {object} Species -> count mapping
   */
  getSpeciesDistribution() {
    const distribution = {};
    this.getAll().forEach(p => {
      const species = p.species || p.name;
      distribution[species] = (distribution[species] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Export registry to JSON
   * @returns {string} JSON string of all Pokemon
   */
  exportToJSON() {
    return JSON.stringify(this.getAll(), null, 2);
  }

  /**
   * Import Pokemon from JSON
   * @param {string} json - JSON string
   * @returns {number} Number of Pokemon imported
   */
  importFromJSON(json) {
    try {
      const data = JSON.parse(json);
      const imported = Array.isArray(data) ? data : [data];
      imported.forEach(p => this.register(p));
      return imported.length;
    } catch (error) {
      console.error('Failed to import Pokemon:', error);
      return 0;
    }
  }
}

// Global registry instance
export const pokemonRegistry = new PokemonRegistry();

// Make it accessible from browser console for debugging
if (typeof window !== 'undefined') {
  window.pokemonRegistry = pokemonRegistry;
}
