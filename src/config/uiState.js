/**
 * UIState Manager
 * Provides centralized access to UI form state
 * Eliminates scattered document.getElementById calls throughout the code
 */

export class UIState {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get a DOM element by ID, with caching
   * @param {string} id - Element ID
   * @returns {HTMLElement|null}
   */
  getElement(id) {
    if (!this.cache.has(id)) {
      this.cache.set(id, document.getElementById(id));
    }
    return this.cache.get(id);
  }

  /**
   * Get the checked state of a checkbox
   * @param {string} id - Checkbox element ID
   * @returns {boolean}
   */
  getCheckbox(id) {
    const element = this.getElement(id);
    return element?.checked ?? false;
  }

  /**
   * Get the value of an input element
   * @param {string} id - Input element ID
   * @returns {string|null}
   */
  getInputValue(id) {
    const element = this.getElement(id);
    return element?.value ?? null;
  }

  /**
   * Get selected Pokemon generations (Gen 1-5)
   * @returns {number[]} Array of selected generation numbers
   */
  getPokemonGenerations() {
    return this.getSelectedGenerations('pokemonGen');
  }

  /**
   * Get selected Move generations (Gen 1-5)
   * @returns {number[]} Array of selected generation numbers
   */
  getMoveGenerations() {
    return this.getSelectedGenerations('movesGen');
  }

  /**
   * Get all selected generations for a given prefix
   * @param {string} prefix - Checkbox ID prefix (e.g., 'pokemonGen' for 'pokemonGen1Checkbox')
   * @returns {number[]}
   */
  getSelectedGenerations(prefix) {
    const gens = [];
    for (let i = 1; i <= 5; i++) {
      if (this.getCheckbox(`${prefix}${i}Checkbox`)) {
        gens.push(i);
      }
    }
    return gens;
  }

  /**
   * Get battle mode from dropdown
   * @returns {string} Battle mode ('1v1-single', '1v1-teams', '2v2', or 'full')
   */
  getBattleMode() {
    return this.getInputValue('battleModeSelect') || '1v1-single';
  }

  /**
   * Get all filter options from the UI
   * @returns {object} Filter configuration object
   */
  getFilters() {
    const battleMode = this.getBattleMode();
    return {
      over600BST: this.getCheckbox('over600BSTCheckbox'),
      randomAbilities: this.getCheckbox('randomAbilitiesCheckbox'),
      allowWonderGuard: this.getCheckbox('allowWonderGuardCheckbox'),
      randomItems: this.getCheckbox('randomItemsCheckbox'),
      useExperimentalColors: this.getCheckbox('experimentalColorsCheckbox'),
      normalTournament: this.getCheckbox('normalTournamentCheckbox'),
      is2v2: battleMode === '2v2',
      fullTeams: battleMode === 'full' || battleMode === '1v1-teams' || battleMode === '1v1-full',
      teamSize: this.getTeamSize(battleMode),
      pokemonGens: this.getPokemonGenerations(),
      moveGens: this.getMoveGenerations()
    };
  }

  /**
   * Get team size based on battle mode
   * @param {string} battleMode - The battle mode
   * @returns {number} Team size
   */
  getTeamSize(battleMode) {
    switch (battleMode) {
      case '1v1-single': return 1;
      case '1v1-teams': return 3;
      case '1v1-full': return 6;
      case '2v2': return 2;
      case 'full': return 4;
      default: return 1;
    }
  }

  /**
   * Get tournament size from input
   * @returns {number}
   */
  getTournamentSize() {
    return parseInt(this.getInputValue('tournamentSizeInput') || '16', 10) || 16;
  }

  /**
   * Clear the element cache (useful after DOM changes)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get text content of an element
   * @param {string} id - Element ID
   * @returns {string|null}
   */
  getTextContent(id) {
    const element = this.getElement(id);
    return element?.textContent ?? null;
  }

  /**
   * Set text content of an element
   * @param {string} id - Element ID
   * @param {string} text - Text to set
   */
  setTextContent(id, text) {
    const element = this.getElement(id);
    if (element) {
      element.textContent = text;
    }
  }

  /**
   * Add a listener to an element (with automatic element retrieval)
   * @param {string} id - Element ID
   * @param {string} event - Event type (e.g., 'click', 'change')
   * @param {Function} handler - Event handler
   */
  addEventListener(id, event, handler) {
    const element = this.getElement(id);
    if (element) {
      element.addEventListener(event, handler);
    }
  }
}
