/**
 * POKEMON BATTLE SIMULATOR - Main Application
 * 
 * This application creates randomized Pokemon with custom type combinations
 * and runs simulated battles with a Pokemon Emerald-style UI.
 * 
 * Key Features:
 * - Sprite recoloring based on types (Inclement Emerald algorithm)
 * - Tournament bracket system
 * - Pokemon Emerald-style UI with stats bars and type icons
 * - Generation filtering for Pokemon and moves
 * - BST-based filtering
 * - Randomization options for abilities and items
 * 
 * File Structure:
 * - Utility functions (color conversion, lerp, clamp)
 * - Sprite sheet and canvas setup
 * - Color space conversion (RGB <-> HSV/HSL)
 * - Sprite recoloring engine (enhanced algorithm)
 * - UI display functions
 * - Tournament system
 * - Event handlers and initialization
 */

import { createPokemon } from "./engine/createPokemon.js";
import { battle, battle1v1Teams, battle2v2, battle2v2Full } from "./engine/battle.js";
import { getHandledEffectTypes } from "./engine/turn.js";
import { pokemon } from "./data/pokemon.js";
import { typeChart } from "./data/typeChart.js";
import { logBattle, clearLogs, battleLogs, setLoggingEnabled } from "./utils/logger.js";
import { tournamentStats } from "./utils/tournamentStats.js";
import { pokemonRegistry } from "./utils/pokemonRegistry.js";
import { typeRampsEnhanced, snapToGBA } from "./data/typeRamps.js";
import { pokemonGrid } from './data/pokemonGrid.js';
import { moves } from "./data/moves.js";
import { SPRITE, RECOLORING, CANVAS, POKEMON, UI, TOURNAMENT, SPRITE_GRID } from "./config/constants.js";
import { TYPE_ICON_MAP, CATEGORY_ICON_MAP, getTypeIcon, getCategoryIcon } from "./config/typeMapping.js";
import { UIState } from "./config/uiState.js";

// Global variable to store current Pokemon
let currentPokemon = null;

// Make Pokemon registry accessible from browser console
if (typeof window !== 'undefined') {
  window.pokemonRegistry = pokemonRegistry;
  console.log('Pokemon Registry available via window.pokemonRegistry');
  console.log('Methods: getById(id), getAll(), getByName(name), getByType(type), exportToJSON(), etc.');
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function clamp(n, a, b) {
	return Math.max(a, Math.min(b, n));
}

function lerp(a, b, f) {
	return Math.round(a + (b - a) * f);
}

// =============================================================================
// SPRITE SHEET AND CANVAS SETUP
// =============================================================================

const SPRITE_SHEET = SPRITE.SHEET;
const TILE = SPRITE.TILE_SIZE;
const img = new Image();
img.crossOrigin = 'anonymous';
img.src = SPRITE_SHEET;
let imgFailed = false;
img.onerror = (e) => {
	imgFailed = true;
	console.warn('Sprite sheet failed to load:', SPRITE_SHEET, e);
};

// One-time sanity check: ensure all move effect types found in the data
// have a corresponding handler in turn.js. Logs to console in dev.
function checkMoveEffectCoverage() {
	try {
		const handled = new Set(getHandledEffectTypes());
		const missing = new Set();
		Object.values(moves).forEach(m => {
			(m.effects ?? []).forEach(e => {
				if (!e?.type) return;
				if (!handled.has(e.type)) missing.add(e.type);
			});
		});
		if (missing.size > 0) {
			console.warn(`Unhandled move effect types in data: ${Array.from(missing).join(', ')}`);
		} else {
			console.info('All move effect types in moves.js have handlers.');
		}
	} catch (err) {
		console.warn('Failed effect coverage check:', err);
	}
}

checkMoveEffectCoverage();

// Create reusable canvases to avoid missing-element issues
const _offscreenCanvas = document.createElement('canvas');
_offscreenCanvas.width = TILE;
_offscreenCanvas.height = TILE;
let _offscreenCtx = null;

const _mainCanvas = document.createElement('canvas');
_mainCanvas.id = 'canvas';
_mainCanvas.width = CANVAS.WIDTH;
_mainCanvas.height = CANVAS.HEIGHT;
_mainCanvas.style.imageRendering = CANVAS.IMAGE_RENDERING;
_mainCanvas.style.border = CANVAS.BORDER;
// Ensure the main canvas is attached to the DOM as early as possible.
function ensureMainCanvasAttached() {
	try {
		if (!document.getElementById('canvas')) {
			// If DOM is already available, append immediately; otherwise wait for DOMContentLoaded below.
			if (document.body) {
				const area = document.getElementById('spriteArea') || document.body;
				area.appendChild(_mainCanvas);
			}
		}
	} catch (err) {
		// Canvas attachment failed, will retry
	}
}
// Try to attach right away if possible
ensureMainCanvasAttached();
// If DOM isn't ready yet, ensure we attach when it becomes ready
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', ensureMainCanvasAttached);

function get2dContext(target) {
	try {
		// target may be an element, id, or omitted
		let canvas = null;
		if (typeof target === 'string') canvas = document.getElementById(target);
		else if (target && typeof target.getContext === 'function') canvas = target;
		else canvas = document.getElementById('canvas') || _mainCanvas;
		if (!canvas) return null;
		if (typeof canvas.getContext !== 'function') return null;
		return canvas.getContext('2d', { willReadFrequently: true });
	} catch (err) {
		console.error('get2dContext error', err);
		return null;
	}
}
// =============================================================================
// COLOR SPACE CONVERSION FUNCTIONS
// =============================================================================

// Convert RGB to HSL color space
function getHsl(r, g, b) {
	r /= 255; g /= 255; b /= 255;
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	let h, s, l = (max + min) / 2;
	if (max === min) h = s = 0;
	else {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		h /= 6;
	}
	return { h, s, l };
}

function getHsv(r, g, b) {
	r /= 255; g /= 255; b /= 255;
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	const d = max - min;
	let h, s = max === 0 ? 0 : d / max;
	const v = max;
	if (max === min) h = 0;
	else {
		if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		h /= 6;
	}
	return { h, s, v };
}

function hsvToRgb(h, s, v) {
	let r, g, b;
	const i = Math.floor(h * 6);
	const f = h * 6 - i;
	const p = v * (1 - s);
	const q = v * (1 - f * s);
	const t = v * (1 - (1 - f) * s);
	switch (i % 6) {
		case 0: r = v; g = t; b = p; break;
		case 1: r = q; g = v; b = p; break;
		case 2: r = p; g = v; b = t; break;
		case 3: r = p; g = q; b = v; break;
		case 4: r = t; g = p; b = v; break;
		case 5: r = v; g = p; b = q; break;
	}
	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// =============================================================================
// SPRITE RECOLORING ENGINE
// =============================================================================

/**
 * Recolor a Pokemon sprite based on its types using the enhanced Inclement Emerald algorithm
 * @param {string[]} types - Array of type names (e.g., ['fire', 'flying'])
 * @param {number} x - X coordinate of sprite in sprite sheet
 * @param {number} y - Y coordinate of sprite in sprite sheet
 */
function processSpriteForTypes(types, x, y) {
	// Ensure main canvas is attached and available
	ensureMainCanvasAttached();
	const ctx = get2dContext('canvas');
	if (!ctx) {
		console.error('Canvas 2D context unavailable, aborting recolor');
		return;
	}
	
	// Initialize offscreen context for pixel manipulation
	if (!_offscreenCtx) {
		try {
			_offscreenCtx = _offscreenCanvas.getContext('2d', { willReadFrequently: true });
		} catch (e) {
			console.error('Offscreen 2D context unavailable');
			return;
		}
		if (!_offscreenCtx) {
			console.error('Failed to create offscreen context');
			return;
		}
	}
	const tctx = _offscreenCtx;
	tctx.clearRect(0, 0, TILE, TILE);
	tctx.drawImage(img, x * TILE, y * TILE, TILE, TILE, 0, 0, TILE, TILE);
	const imageData = tctx.getImageData(0, 0, TILE, TILE);
	const originalPixels = new Uint8ClampedArray(imageData.data);
	const pixels = imageData.data;

	// Check if experimental colors is enabled
	const useExperimental = document.getElementById('experimentalColorsCheckbox')?.checked ?? false;
	const colorRamps = typeRampsEnhanced;

	// Get color ramps with fallbacks
	const ramp1 = (types[0] && colorRamps[types[0].toLowerCase()]) || colorRamps.normal;
	const ramp2 = (types[1] && colorRamps[types[1].toLowerCase()]) || ramp1;
	
	// Validate ramps exist and have content
	if (!ramp1 || !ramp1.length || !ramp2 || !ramp2.length) {
		console.error('Invalid color ramps for types:', types);
		return;
	}

	if (useExperimental) {
		// EXPERIMENTAL ALGORITHM - S-curve contrast, gradient dual-type blending, cubic saturation weighting
		const palette = [];
		let minV = 1.0, maxV = 0.0;
		for (let i = 0; i < originalPixels.length; i += 4) {
			if (originalPixels[i+3] < 128) continue;
			const r = originalPixels[i], g = originalPixels[i+1], b = originalPixels[i+2];
			if (!palette.find(c => c.rgb[0]===r && c.rgb[1]===g && c.rgb[2]===b)) {
				const hsv = getHsv(r, g, b);
				palette.push({ rgb: [r,g,b], ...hsv });
				// Wider range for better contrast
				if (hsv.v > 0.03 && hsv.v < 0.98) {
					if (hsv.v < minV) minV = hsv.v;
					if (hsv.v > maxV) maxV = hsv.v;
				}
			}
		}

		// Find dominant hue with cubic weighting for stronger color influence
		let sinSum = 0, cosSum = 0, weightSum = 0;
		palette.forEach(p => {
			if (p.s > 0.06 && p.v > 0.08 && p.v < 0.94) {
				const angle = p.h * Math.PI * 2;
				const weight = Math.pow(p.s, 2.5) * p.v; // Cubic saturation
				sinSum += Math.sin(angle) * weight;
				cosSum += Math.cos(angle) * weight;
				weightSum += weight;
			}
		});
		let meanHue = weightSum > 0 ? Math.atan2(sinSum, cosSum) / (Math.PI * 2) : 0;
		if (meanHue < 0) meanHue += 1;

		if (maxV <= minV) { minV = 0.0; maxV = 1.0; }
		
		const colorMap = new Map();
		
		palette.forEach(p => {
			// Only preserve pure black and nearly white
			if (p.v < 0.03 || (p.v > 0.97 && p.s < 0.03)) {
				colorMap.set(p.rgb.join(','), [p.rgb[0], p.rgb[1], p.rgb[2]]);
				return;
			}

			const hueDist = Math.min(Math.abs(p.h - meanHue), 1 - Math.abs(p.h - meanHue));
			let targetRamp = ramp1;
		let rampShift = 0; // For single-type variance

		if (types[1] && types[0] !== types[1]) {
			// Improved dual-type with smooth gradient blending
			const brightThreshold = minV + (maxV - minV) * 0.45;
			let blendFactor = 0;
			
			if (p.v >= brightThreshold) {
				blendFactor = (p.v - brightThreshold) / (maxV - brightThreshold);
				if (hueDist > 0.18 || p.s > 0.4) {
					blendFactor = Math.min(1, blendFactor + 0.3);
				}
			}
			
			if (blendFactor > 0.4) {
				targetRamp = ramp2;
			}
		} else {
			// Single-type: add variance based on saturation and hue deviation
			const satFactor = p.s * 0.5;
			const hueFactor = hueDist * 0.3;
			rampShift = (satFactor + hueFactor - 0.25) * 1.5;
		}

		// S-curve (smoothstep) for dramatic contrast
		let normalizedV = (maxV === minV) ? 0.5 : (p.v - minV) / (maxV - minV);
		if (!isFinite(normalizedV) || isNaN(normalizedV)) normalizedV = 0.5;
		normalizedV = normalizedV * normalizedV * (3 - 2 * normalizedV);
		normalizedV = Math.max(0, Math.min(1, normalizedV));
		
		// Apply ramp shift for single-type variance
		normalizedV = normalizedV + rampShift;
		normalizedV = Math.max(0, Math.min(1, normalizedV));
		
		// Find position in ramp
		let rIdx = normalizedV * (targetRamp.length - 1);
		let low = Math.floor(rIdx), high = Math.ceil(rIdx), f = rIdx - low;
		
		// Validate indices are valid numbers
		if (!isFinite(low) || isNaN(low)) low = 0;
		if (!isFinite(high) || isNaN(high)) high = 0;
		
		// Bounds check and validate array elements exist
		low = Math.max(0, Math.min(targetRamp.length - 1, low));
		high = Math.max(0, Math.min(targetRamp.length - 1, high));
		
		// Safety check: ensure the ramp elements exist
		if (!targetRamp[low] || !targetRamp[high]) {
			console.error('Invalid ramp structure at indices', low, high, 'for ramp:', targetRamp);
			colorMap.set(p.rgb.join(','), [p.rgb[0], p.rgb[1], p.rgb[2]]);
			return;
		}
		
		// Work in HSV space throughout - convert ramp colors to HSV and interpolate
		const lowHsv = getHsv(targetRamp[low][0], targetRamp[low][1], targetRamp[low][2]);
		const highHsv = getHsv(targetRamp[high][0], targetRamp[high][1], targetRamp[high][2]);
		
		// Interpolate in HSV space with hue wraparound
		let targetH = lowHsv.h;
		if (f > 0 && Math.abs(highHsv.h - lowHsv.h) > 0.5) {
			// Handle hue wraparound (e.g., red at 0.0 and 1.0)
			if (lowHsv.h < highHsv.h) targetH = lowHsv.h + (1 + lowHsv.h - highHsv.h) * f;
			else targetH = lowHsv.h + (highHsv.h - lowHsv.h) * f;
			if (targetH > 1) targetH -= 1;
		} else {
			targetH = lowHsv.h + (highHsv.h - lowHsv.h) * f;
		}
		const targetS = lowHsv.s + (highHsv.s - lowHsv.s) * f;
		const targetV = lowHsv.v + (highHsv.v - lowHsv.v) * f;
		
		const [nr, ng, nb] = hsvToRgb(targetH, targetS, targetV);
		
		colorMap.set(p.rgb.join(','), [
			snapToGBA(nr),
			snapToGBA(ng),
			snapToGBA(nb)
		]);
});

	// Apply mapping with per-pixel fallback for unmapped colors
	for (let i = 0; i < pixels.length; i += 4) {
		if (pixels[i+3] < 128) continue; // Skip transparent
		
		const key = `${pixels[i]},${pixels[i+1]},${pixels[i+2]}`;
		if (colorMap.has(key)) {
			const res = colorMap.get(key);
			pixels[i] = res[0]; pixels[i+1] = res[1]; pixels[i+2] = res[2];
		} else {
			// Per-pixel fallback for unmapped colors
			const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
			const hsv = getHsv(r, g, b);
			
			if (hsv.v < 0.03 || (hsv.v > 0.97 && hsv.s < 0.03)) continue;
			
			const hueDist = Math.min(Math.abs(hsv.h - meanHue), 1 - Math.abs(hsv.h - meanHue));
			let targetRamp = ramp1;
			let rampShift = 0;
		
		if (types[1] && types[0] !== types[1]) {
			const brightThreshold = minV + (maxV - minV) * 0.45;
			let blendFactor = 0;
			if (hsv.v >= brightThreshold) {
				blendFactor = (hsv.v - brightThreshold) / (maxV - brightThreshold);
				if (hueDist > 0.18 || hsv.s > 0.4) blendFactor = Math.min(1, blendFactor + 0.3);
			}
			if (blendFactor > 0.4) targetRamp = ramp2;
		} else {
			// Single-type variance
			const satFactor = hsv.s * 0.5;
			const hueFactor = hueDist * 0.3;
			rampShift = (satFactor + hueFactor - 0.25) * 1.5;
		}
		
		let normalizedV = (maxV === minV) ? 0.5 : (hsv.v - minV) / (maxV - minV);
		if (!isFinite(normalizedV) || isNaN(normalizedV)) normalizedV = 0.5;
		normalizedV = normalizedV * normalizedV * (3 - 2 * normalizedV);
		normalizedV = Math.max(0, Math.min(1, normalizedV));
		
		// Apply ramp shift for single-type variance
		normalizedV = normalizedV + rampShift;
		normalizedV = Math.max(0, Math.min(1, normalizedV));
					
					if (!isFinite(low) || isNaN(low)) low = 0;
					if (!isFinite(high) || isNaN(high)) high = 0;
					low = Math.max(0, Math.min(targetRamp.length - 1, low));
					high = Math.max(0, Math.min(targetRamp.length - 1, high));
					
					if (!targetRamp[low] || !targetRamp[high]) continue;
					
					const lowHsv = getHsv(targetRamp[low][0], targetRamp[low][1], targetRamp[low][2]);
					const highHsv = getHsv(targetRamp[high][0], targetRamp[high][1], targetRamp[high][2]);
					
					let targetH = lowHsv.h;
					if (f > 0 && Math.abs(highHsv.h - lowHsv.h) > 0.5) {
						if (lowHsv.h < highHsv.h) targetH = lowHsv.h + (1 + lowHsv.h - highHsv.h) * f;
						else targetH = lowHsv.h + (highHsv.h - lowHsv.h) * f;
						if (targetH > 1) targetH -= 1;
				} else {
					targetH = lowHsv.h + (highHsv.h - lowHsv.h) * f;
				}
				const targetS = lowHsv.s + (highHsv.s - lowHsv.s) * f;
				const targetV = lowHsv.v + (highHsv.v - lowHsv.v) * f;
				
				const [nr, ng, nb] = hsvToRgb(targetH, targetS, targetV);
				pixels[i] = snapToGBA(nr);
				pixels[i+1] = snapToGBA(ng);
				pixels[i+2] = snapToGBA(nb);
			}
		}
	} else {
		// INCLEMENT EMERALD STYLE ALGORITHM using HSV with power curve contrast
		const palette = [];
		let minV = 1.0, maxV = 0.0;
		for (let i = 0; i < originalPixels.length; i += 4) {
			if (originalPixels[i+3] < 128) continue;
			const r = originalPixels[i], g = originalPixels[i+1], b = originalPixels[i+2];
			if (!palette.find(c => c.rgb[0]===r && c.rgb[1]===g && c.rgb[2]===b)) {
				const hsv = getHsv(r, g, b);
				palette.push({ rgb: [r,g,b], ...hsv });
				// Track value (brightness) range, excluding near-black and near-white
				if (hsv.v > 0.05 && hsv.v < 0.97) {
					if (hsv.v < minV) minV = hsv.v;
					if (hsv.v > maxV) maxV = hsv.v;
				}
			}
		}

		// Find dominant hue weighted by saturation and value
		let sinSum = 0, cosSum = 0, weightSum = 0;
		palette.forEach(p => {
			if (p.s > 0.08 && p.v > 0.10 && p.v < 0.92) {
				const angle = p.h * Math.PI * 2;
				const weight = p.s * p.s * p.v; // Square saturation for stronger weighting
				sinSum += Math.sin(angle) * weight;
				cosSum += Math.cos(angle) * weight;
				weightSum += weight;
			}
		});
		let meanHue = weightSum > 0 ? Math.atan2(sinSum, cosSum) / (Math.PI * 2) : 0;
		if (meanHue < 0) meanHue += 1;

		if (maxV <= minV) { minV = 0.0; maxV = 1.0; }
		
		const colorMap = new Map();
		
		palette.forEach(p => {
			// Only preserve pure black and very desaturated near-white
			if (p.v < 0.05 || (p.v > 0.97 && p.s < 0.05)) {
				colorMap.set(p.rgb.join(','), [p.rgb[0], p.rgb[1], p.rgb[2]]);
				return;
			}

			// Calculate hue distance for dual-type Pokemon
			const hueDist = Math.min(Math.abs(p.h - meanHue), 1 - Math.abs(p.h - meanHue));
			let targetRamp = ramp1;

			// Secondary type colors - more nuanced distribution
			if (types[1] && types[0] !== types[1]) {
				// Use secondary for:
				// 1. Significantly different hues (> 0.22)
				// 2. Mid-to-high brightness values (above 50% of range)
				// 3. Higher saturation colors in upper brightness range
				const brightThreshold = minV + (maxV - minV) * 0.50;
				const shouldUseSecondary = 
					hueDist > 0.22 || 
					(p.v >= brightThreshold && p.s > 0.3) ||
					(p.v >= brightThreshold && hueDist > 0.12);
				
				if (shouldUseSecondary) {
					targetRamp = ramp2;
				}
			}

			// Map value (brightness) to ramp position with contrast enhancement
			let normalizedV = (maxV === minV) ? 0.5 : (p.v - minV) / (maxV - minV);
			
			// Validate normalizedV is a valid number
			if (!isFinite(normalizedV) || isNaN(normalizedV)) {
				normalizedV = 0.5; // Use middle value as fallback
			}
			
			// Enhance contrast by expanding the middle range
			normalizedV = Math.pow(normalizedV, 0.9); // Slight curve for better distribution
			normalizedV = Math.max(0, Math.min(1, normalizedV));
			
			// Find position in ramp
			let rIdx = normalizedV * (targetRamp.length - 1);
			let low = Math.floor(rIdx), high = Math.ceil(rIdx), f = rIdx - low;
			
			// Validate indices are valid numbers
			if (!isFinite(low) || isNaN(low)) low = 0;
			if (!isFinite(high) || isNaN(high)) high = 0;
			
			// Bounds check and validate array elements exist
			low = Math.max(0, Math.min(targetRamp.length - 1, low));
			high = Math.max(0, Math.min(targetRamp.length - 1, high));
			
			// Safety check: ensure the ramp elements exist
			if (!targetRamp[low] || !targetRamp[high]) {
				console.error('Invalid ramp structure at indices', low, high, 'for ramp:', targetRamp);
				colorMap.set(p.rgb.join(','), [p.rgb[0], p.rgb[1], p.rgb[2]]);
				return;
			}
			
			// Work in HSV space throughout - convert ramp colors to HSV and interpolate
			const lowHsv = getHsv(targetRamp[low][0], targetRamp[low][1], targetRamp[low][2]);
			const highHsv = getHsv(targetRamp[high][0], targetRamp[high][1], targetRamp[high][2]);
			
			// Interpolate in HSV space with hue wraparound
			let targetH = lowHsv.h;
			if (f > 0 && Math.abs(highHsv.h - lowHsv.h) > 0.5) {
				// Handle hue wraparound (e.g., red at 0.0 and 1.0)
				if (lowHsv.h < highHsv.h) targetH = lowHsv.h + (1 + lowHsv.h - highHsv.h) * f;
				else targetH = lowHsv.h + (highHsv.h - lowHsv.h) * f;
				if (targetH > 1) targetH -= 1;
			} else {
				targetH = lowHsv.h + (highHsv.h - lowHsv.h) * f;
			}
			const targetS = lowHsv.s + (highHsv.s - lowHsv.s) * f;
			const targetV = lowHsv.v + (highHsv.v - lowHsv.v) * f;
			
			// Use target color directly - no saturation blending
			const [nr, ng, nb] = hsvToRgb(targetH, targetS, targetV);
			
			colorMap.set(p.rgb.join(','), [
				snapToGBA(nr),
				snapToGBA(ng),
				snapToGBA(nb)
			]);
		});

		// Apply mapping with per-pixel fallback for unmapped colors
		for (let i = 0; i < pixels.length; i += 4) {
			if (pixels[i+3] < 128) continue; // Skip transparent
			
			const key = `${pixels[i]},${pixels[i+1]},${pixels[i+2]}`;
			if (colorMap.has(key)) {
				const res = colorMap.get(key);
				pixels[i] = res[0]; pixels[i+1] = res[1]; pixels[i+2] = res[2];
			} else {
				// Per-pixel fallback for colors not in palette
				const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
				const hsv = getHsv(r, g, b);
				
				// Only preserve pure black and very desaturated near-white
				if (hsv.v < 0.05 || (hsv.v > 0.97 && hsv.s < 0.05)) {
					continue; // Keep original
				}
				
				// Determine target ramp
				const hueDist = Math.min(Math.abs(hsv.h - meanHue), 1 - Math.abs(hsv.h - meanHue));
				let targetRamp = ramp1;
				if (types[1] && types[0] !== types[1]) {
					const brightThreshold = minV + (maxV - minV) * 0.50;
					const shouldUseSecondary = 
						hueDist > 0.22 || 
						(hsv.v >= brightThreshold && hsv.s > 0.3) ||
						(hsv.v >= brightThreshold && hueDist > 0.12);
					if (shouldUseSecondary) targetRamp = ramp2;
				}
				
				// Map to ramp with contrast enhancement
				let normalizedV = (maxV === minV) ? 0.5 : (hsv.v - minV) / (maxV - minV);
				
				// Validate normalizedV is a valid number
				if (!isFinite(normalizedV) || isNaN(normalizedV)) {
					normalizedV = 0.5; // Use middle value as fallback
				}
				
				normalizedV = Math.pow(normalizedV, 0.9); // Slight curve for better distribution
				normalizedV = Math.max(0, Math.min(1, normalizedV));
				let rIdx = normalizedV * (targetRamp.length - 1);
				let low = Math.floor(rIdx), high = Math.ceil(rIdx), f = rIdx - low;
				
				// Validate indices are valid numbers
				if (!isFinite(low) || isNaN(low)) low = 0;
				if (!isFinite(high) || isNaN(high)) high = 0;
				
				// Bounds check and validate array elements exist
				low = Math.max(0, Math.min(targetRamp.length - 1, low));
				high = Math.max(0, Math.min(targetRamp.length - 1, high));
				
				// Safety check: ensure the ramp elements exist
				if (!targetRamp[low] || !targetRamp[high]) {
					continue; // Skip this pixel
				}
				
				const lowHsv = getHsv(targetRamp[low][0], targetRamp[low][1], targetRamp[low][2]);
				const highHsv = getHsv(targetRamp[high][0], targetRamp[high][1], targetRamp[high][2]);
				
				let targetH = lowHsv.h;
				if (f > 0 && Math.abs(highHsv.h - lowHsv.h) > 0.5) {
					if (lowHsv.h < highHsv.h) targetH = lowHsv.h + (1 + lowHsv.h - highHsv.h) * f;
					else targetH = lowHsv.h + (highHsv.h - lowHsv.h) * f;
					if (targetH > 1) targetH -= 1;
				} else {
					targetH = lowHsv.h + (highHsv.h - lowHsv.h) * f;
				}
				const targetS = lowHsv.s + (highHsv.s - lowHsv.s) * f;
				const targetV = lowHsv.v + (highHsv.v - lowHsv.v) * f;
				
				const [nr, ng, nb] = hsvToRgb(targetH, targetS, targetV);
				pixels[i] = snapToGBA(nr);
				pixels[i+1] = snapToGBA(ng);
				pixels[i+2] = snapToGBA(nb);
			}
		}
	}

	
	ctx.putImageData(imageData, 0, 0);
}

function drawPlaceholder(types) {
	const ctx = get2dContext('canvas');
	if (!ctx) return;
	// pick a neutral midpoint from the primary ramp for placeholder
	const ramp = typeRampsEnhanced[types[0]] ?? typeRampsEnhanced.normal;
	const mid = ramp[Math.floor(ramp.length / 2)];
	const css = `rgb(${mid[0]},${mid[1]},${mid[2]})`;
	ctx.clearRect(0, 0, TILE, TILE);
	ctx.fillStyle = css;
	ctx.fillRect(0, 0, TILE, TILE);
	// draw a simple highlight + silhouette block
	ctx.fillStyle = 'rgba(0,0,0,0.18)';
	ctx.fillRect(6, 8, TILE - 12, TILE - 16);
	ctx.fillStyle = 'rgba(255,255,255,0.08)';
	ctx.fillRect(6, 6, TILE - 12, 8);
}

// =============================================================================
// UI DISPLAY FUNCTIONS
// =============================================================================

// All pokemon names for randomization
const allPokemon = Object.keys(pokemon);

/**
 * Display Pokemon information in an Emerald-style info box
 * Shows sprite, types, ability, item, base stats with bars, and moves
 */
function describePokemon(p) {
	clearLogs();
	
	// Create Pokemon Emerald-style display with HTML
	const logsDiv = document.getElementById('logs');
	
	// Get canvas reference BEFORE clearing the div (it might be inside)
	let canvas = document.getElementById('canvas');
	
	// Now clear the div
	logsDiv.innerHTML = '';
	
	// Create info box container
	const infoBox = document.createElement('div');
	infoBox.className = 'pokemon-info-box';
	
	// Create two-column layout
	const leftColumn = document.createElement('div');
	leftColumn.className = 'left-column';
	
	const rightColumn = document.createElement('div');
	rightColumn.className = 'right-column';
	
	// LEFT COLUMN: Name, Sprite, Types, Ability/Item
	// Pokemon name and level
	const nameHeader = document.createElement('div');
	nameHeader.className = 'pokemon-name-header';
	nameHeader.textContent = p.name;
	leftColumn.appendChild(nameHeader);
	
	// Pokemon level
	const levelHeader = document.createElement('div');
	levelHeader.className = 'pokemon-level-header';
	levelHeader.textContent = `Lv.${p.level}`;
	leftColumn.appendChild(levelHeader);
	
	// Add sprite underneath name
	const spriteContainer = document.createElement('div');
	spriteContainer.style.textAlign = 'center';
	if (canvas) {
		canvas.className = 'pokemon-sprite'; // Apply sprite styling
		spriteContainer.appendChild(canvas);
	}
	leftColumn.appendChild(spriteContainer);
	
	// Type icons
	const typeContainer = document.createElement('div');
	typeContainer.className = 'type-container';
	p.types.forEach(type => {
		const typeImg = document.createElement('img');
		typeImg.src = `type%20icons/${getTypeIcon(type)}`;
		typeImg.className = 'type-icon';
		typeImg.alt = type;
		typeContainer.appendChild(typeImg);
	});
	leftColumn.appendChild(typeContainer);
	
	// Ability and Item
	const details = document.createElement('div');
	details.className = 'pokemon-details';
	if (p.ability) {
		details.innerHTML += `<div class="detail-line"><span class="label">ABILITY:</span> ${p.ability}</div>`;
	}
	// Display originalItem if item was consumed, otherwise display current item
	const displayItem = p.item || p.originalItem;
	if (displayItem) {
		details.innerHTML += `<div class="detail-line"><span class="label">ITEM:</span> ${displayItem}</div>`;
	}
	leftColumn.appendChild(details);
	
	// RIGHT COLUMN: Stats and Moves stacked vertically
	const statsMovesContainer = document.createElement('div');
	statsMovesContainer.className = 'stats-moves-container';
	
	// Stats section - show base stats with visual bars
	const statsSection = document.createElement('div');
	statsSection.className = 'stats-section';
	statsSection.innerHTML = '<div class="section-header">STATS</div>';
	if (p.baseStats) {
		const bs = p.baseStats;
		const maxStat = 255; // Pokemon base stats max out around 255
		statsSection.innerHTML += `<div class="stat-row"><span class="stat-label">HP</span><div class="stat-bar"><div class="stat-bar-fill" style="width: ${(bs.hp / maxStat * 100)}%"></div></div><span class="stat-value">${bs.hp}</span></div><div class="stat-row"><span class="stat-label">ATK</span><div class="stat-bar"><div class="stat-bar-fill" style="width: ${(bs.atk / maxStat * 100)}%"></div></div><span class="stat-value">${bs.atk}</span></div><div class="stat-row"><span class="stat-label">DEF</span><div class="stat-bar"><div class="stat-bar-fill" style="width: ${(bs.def / maxStat * 100)}%"></div></div><span class="stat-value">${bs.def}</span></div><div class="stat-row"><span class="stat-label">SPA</span><div class="stat-bar"><div class="stat-bar-fill" style="width: ${(bs.spA / maxStat * 100)}%"></div></div><span class="stat-value">${bs.spA}</span></div><div class="stat-row"><span class="stat-label">SPD</span><div class="stat-bar"><div class="stat-bar-fill" style="width: ${(bs.spD / maxStat * 100)}%"></div></div><span class="stat-value">${bs.spD}</span></div><div class="stat-row"><span class="stat-label">SPE</span><div class="stat-bar"><div class="stat-bar-fill" style="width: ${(bs.spe / maxStat * 100)}%"></div></div><span class="stat-value">${bs.spe}</span></div>`;
		const BST = bs.hp + bs.atk + bs.def + bs.spA + bs.spD + bs.spe;
		statsSection.innerHTML += `<div class="stat-row bst"><span class="stat-label">BST</span><span class="stat-value">${BST}</span></div>`;
	}
	statsMovesContainer.appendChild(statsSection);
	
	// Moves section
	const movesSection = document.createElement('div');
	movesSection.className = 'moves-section';
	movesSection.innerHTML = '<div class="section-header">MOVES</div>';
	p.moves.forEach(m => {
		const moveDiv = document.createElement('div');
		moveDiv.className = 'move-row';
		
		// Move type icon
		const moveTypeImg = document.createElement('img');
		moveTypeImg.src = `type%20icons/${getTypeIcon(m.type)}`;
		moveTypeImg.className = 'move-type-icon';
		
		// Move category icon (physical/special/status)
		const moveCategoryImg = document.createElement('img');
		moveCategoryImg.src = `type%20icons/${getCategoryIcon(m.category)}`;
		moveCategoryImg.className = 'move-category-icon';
		
		const moveInfo = document.createElement('div');
		moveInfo.className = 'move-info';
		moveInfo.innerHTML = `<div class="move-name">${m.name}</div><div class="move-stats">PWR: ${m.power ?? '—'} ACC: ${m.accuracy ?? '—'} PP: ${m.pp ?? '—'}</div>`;
		
		moveDiv.appendChild(moveTypeImg);
		moveDiv.appendChild(moveCategoryImg);
		moveDiv.appendChild(moveInfo);
		movesSection.appendChild(moveDiv);
	});
	statsMovesContainer.appendChild(movesSection);
	
	// Add stats and moves to right column
	rightColumn.appendChild(statsMovesContainer);
	
	// Add both columns to info box
	infoBox.appendChild(leftColumn);
	infoBox.appendChild(rightColumn);
	
	logsDiv.appendChild(infoBox);
}

// Function to save Pokemon to database
function savePokemonToDatabase() {
	if (!currentPokemon) {
		alert('No Pokemon to save! Please randomize a Pokemon first.');
		return;
	}

	// Create a simplified Pokemon object for storage
	const pokemonData = {
		name: currentPokemon.name,
		level: currentPokemon.level,
		types: currentPokemon.types,
		ability: currentPokemon.ability,
		baseStats: currentPokemon.baseStats,
		stats: currentPokemon.stats,
		moves: currentPokemon.moves.map(m => ({
			name: m.name,
			type: m.type,
			category: m.category,
			power: m.power,
			accuracy: m.accuracy,
			pp: m.pp
		})),
		timestamp: new Date().toISOString()
	};

	// Get existing database from localStorage
	let database = [];
	try {
		const stored = localStorage.getItem('pokemonDatabase');
		if (stored) {
			database = JSON.parse(stored);
		}
	} catch (e) {
		console.error('Error loading database:', e);
	}

	// Add new Pokemon to database
	database.push(pokemonData);

	// Save back to localStorage
	try {
		localStorage.setItem('pokemonDatabase', JSON.stringify(database, null, 2));
		alert(`Pokemon saved! Total Pokemon in database: ${database.length}`);
	} catch (e) {
		console.error('Error saving database:', e);
		alert('Error saving Pokemon to database. See console for details.');
	}

	// Also trigger download of the database file
	downloadDatabase(database);
}

// Function to download the database as a JSON file
function downloadDatabase(database) {
	const dataStr = JSON.stringify(database, null, 2);
	const dataBlob = new Blob([dataStr], { type: 'application/json' });
	const url = URL.createObjectURL(dataBlob);
	
	const link = document.createElement('a');
	link.href = url;
	link.download = 'pokemon_database.json';
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

// Function to display all Pokemon in the registry
function displayPokemonRegistry() {
	const logsDiv = document.getElementById('logs');
	logsDiv.innerHTML = '';
	
	const stats = pokemonRegistry.getStats();
	const allPokemon = pokemonRegistry.getAll();
	
	let html = '<div class="pokemon-registry-view">';
	html += '<h2>🗂️ Pokémon Registry</h2>';
	html += `<p><strong>Total Pokémon:</strong> ${stats.total}</p>`;
	html += `<p><strong>Average Level:</strong> ${stats.averageLevel.toFixed(1)}</p>`;
	
	// Type distribution
	html += '<h3>Type Distribution</h3>';
	html += '<table style="border-collapse: collapse; margin-bottom: 20px;"><tr>';
	Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
		html += `<td style="padding: 8px; border: 1px solid #2d4a3e;"><strong>${type}:</strong> ${count}</td>`;
	});
	html += '</tr></table>';
	
	// All Pokemon table
	html += '<h3>All Pokémon</h3>';
	html += '<div style="max-height: 600px; overflow-y: auto;">';
	html += '<table style="width: 100%; border-collapse: collapse;">';
	html += '<tr style="background: #2d4a3e; color: white; position: sticky; top: 0;"><th style="padding: 10px;">ID</th><th style="padding: 10px;">Name</th><th style="padding: 10px;">Species</th><th style="padding: 10px;">Level</th><th style="padding: 10px;">Types</th><th style="padding: 10px;">Ability</th><th style="padding: 10px;">HP</th></tr>';
	
	allPokemon.forEach((p, i) => {
		const bgColor = i % 2 === 0 ? '#f5f9f5' : 'white';
		html += `<tr style="background: ${bgColor};">`;
		html += `<td style="padding: 8px; border-bottom: 1px solid #c0d0c8;"><code>${p.id}</code></td>`;
		html += `<td style="padding: 8px; border-bottom: 1px solid #c0d0c8;"><strong>${p.name}</strong></td>`;
		html += `<td style="padding: 8px; border-bottom: 1px solid #c0d0c8;">${p.species}</td>`;
		html += `<td style="padding: 8px; border-bottom: 1px solid #c0d0c8;">${p.level}</td>`;
		html += `<td style="padding: 8px; border-bottom: 1px solid #c0d0c8;">${p.types.join(', ')}</td>`;
		html += `<td style="padding: 8px; border-bottom: 1px solid #c0d0c8;">${p.ability || 'None'}</td>`;
		html += `<td style="padding: 8px; border-bottom: 1px solid #c0d0c8;">${p.currentHP}/${p.maxHp}</td>`;
		html += '</tr>';
	});
	
	html += '</table></div></div>';
	
	logsDiv.innerHTML = html;
	console.log(`Displaying ${allPokemon.length} Pokémon from registry`);
}

// Function to export the registry as JSON
function exportPokemonRegistry() {
	const json = pokemonRegistry.exportToJSON();
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	
	const link = document.createElement('a');
	link.href = url;
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
	link.download = `pokemon_registry_${timestamp}.json`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
	
	console.log(`Exported ${pokemonRegistry.count()} Pokémon to JSON`);
	alert(`Exported ${pokemonRegistry.count()} Pokémon to JSON file`);
}

document.addEventListener("DOMContentLoaded", () => {
	const uiState = new UIState();
	const btn = document.getElementById("randomizeBtn");
	if (!btn) return;

	const runTournamentBtn = document.getElementById('runTournamentBtn');
	if (runTournamentBtn) {
		runTournamentBtn.addEventListener('click', () => {
			const filters = uiState.getFilters();
			const size = uiState.getTournamentSize();
			runTournament(size, filters.over600BST, filters.randomAbilities, filters.allowWonderGuard, filters.randomItems, filters.is2v2, filters.fullTeams, filters.normalTournament, filters.pokemonGens, filters.moveGens);
		});
	}

	// Save Pokemon button
	const savePokemonBtn = document.getElementById('savePokemonBtn');
	if (savePokemonBtn) {
		savePokemonBtn.addEventListener('click', () => {
			savePokemonToDatabase();
		});
	}

	// View Registry button
	const viewRegistryBtn = document.getElementById('viewRegistryBtn');
	if (viewRegistryBtn) {
		viewRegistryBtn.addEventListener('click', () => {
			displayPokemonRegistry();
		});
	}

	// Export Registry button
	const exportRegistryBtn = document.getElementById('exportRegistryBtn');
	if (exportRegistryBtn) {
		exportRegistryBtn.addEventListener('click', () => {
			exportPokemonRegistry();
		});
	}

	// Clear Registry button
	const clearRegistryBtn = document.getElementById('clearRegistryBtn');
	if (clearRegistryBtn) {
		clearRegistryBtn.addEventListener('click', () => {
			if (confirm(`Clear all ${pokemonRegistry.count()} Pokémon from the registry?`)) {
				pokemonRegistry.clear();
				console.log('Registry cleared');
				alert('Registry cleared!');
			}
		});
	}

	// Ensure the main canvas exists and is sized before any handlers run
	let existingCanvas = document.getElementById('canvas');
	if (!existingCanvas) {
		const area = document.getElementById('spriteArea') || document.body;
		// attach our pre-created main canvas to DOM so getElementById finds it later
		area.appendChild(_mainCanvas);
		existingCanvas = _mainCanvas;
	}
	btn.addEventListener("click", () => {
		// Randomize one or two types first
		const availableTypes = Object.keys(typeChart);
		const typeCount = Math.random() < 0.4 ? 2 : 1;
		const chosen = [];
		while (chosen.length < typeCount) {
			const t = availableTypes[Math.floor(Math.random() * availableTypes.length)];
			if (!chosen.includes(t)) chosen.push(t);
		}

		const name = allPokemon[Math.floor(Math.random() * allPokemon.length)];
		const filters = uiState.getFilters();
		// create with randomized base stat distribution (preserve BST)
		const p = createPokemon(name, POKEMON.DEFAULT_LEVEL, "generation-i-ii-iii", chosen, true, filters.randomAbilities, filters.allowWonderGuard, filters.randomItems, filters.pokemonGens, filters.moveGens);
		currentPokemon = p; // Store for saving
		logBattle(`Forced types: ${chosen.join(", ")}`);
		describePokemon(p);

		// find sprite grid coordinates for this species (case-insensitive)
		const keyName = p.name.toLowerCase();
		let cell = pokemonGrid.find(x => x.name && x.name.toLowerCase() === keyName);
		if (!cell) {
			// fall back to a random grid cell
			cell = pokemonGrid[Math.floor(Math.random() * pokemonGrid.length)];
		}
		// ensure image loaded, then recolor and draw
		if (img.complete) {
			processSpriteForTypes(p.types, cell.x, cell.y);
		} else {
			img.onload = () => processSpriteForTypes(p.types, cell.x, cell.y);
		}
	});
});

// Render a labeled grid of all sprites so user can verify mapping
function renderSpriteGrid(scale = 2, cols = 25, offset = 0) {
	if (!img.complete && !imgFailed) {
		img.onload = () => renderSpriteGrid(scale, cols, offset);
		img.onerror = () => renderSpriteGrid(scale, cols, offset);
		return;
	}

	// build mapping for first 151 pokemon using current cols/offset
	const first151 = Object.values(pokemon)
		.filter(p => typeof p.id === 'number' && p.id >= 1 && p.id <= SPRITE.FIRST_GENERATION_COUNT)
		.sort((a, b) => a.id - b.id);
	const entries = first151.map((p, idx) => {
		const globalIdx = idx + offset;
		return { name: p.name, x: ((globalIdx % cols) + cols) % cols, y: Math.floor(globalIdx / cols) };
	});

	const tile = TILE * scale;
	const rows = Math.ceil(entries.length / cols);

	// create overlay container
	let overlay = document.getElementById('spriteGridOverlay');
	if (!overlay) {
		overlay = document.createElement('div');
		overlay.id = 'spriteGridOverlay';
		overlay.style.position = 'fixed';
		overlay.style.left = '8px';
		overlay.style.top = '8px';
		overlay.style.right = '8px';
		overlay.style.bottom = '8px';
		overlay.style.background = 'rgba(0,0,0,0.85)';
		overlay.style.color = '#fff';
		overlay.style.zIndex = 9999;
		overlay.style.padding = '12px';
		overlay.style.overflow = 'auto';
		document.body.appendChild(overlay);
	} else {
		overlay.innerHTML = '';
	}

	// controls: cols and offset
	const controlRow = document.createElement('div');
	controlRow.style.display = 'flex';
	controlRow.style.gap = '8px';
	controlRow.style.alignItems = 'center';
	controlRow.style.marginBottom = '8px';

	const colsInput = document.createElement('input');
	colsInput.type = 'number'; colsInput.value = cols; colsInput.min = 4; colsInput.max = 64; colsInput.style.width = '70px';
	const offsetInput = document.createElement('input');
	offsetInput.type = 'number'; offsetInput.value = offset; offsetInput.style.width = '70px';
	const applyBtn = document.createElement('button'); applyBtn.textContent = 'Apply';
	const closeBtn = document.createElement('button'); closeBtn.textContent = 'Close';
	controlRow.appendChild(document.createTextNode('Cols: ')); controlRow.appendChild(colsInput);
	controlRow.appendChild(document.createTextNode('Offset: ')); controlRow.appendChild(offsetInput);
	controlRow.appendChild(applyBtn); controlRow.appendChild(closeBtn);
	overlay.appendChild(controlRow);

	closeBtn.addEventListener('click', () => overlay.remove());
	applyBtn.addEventListener('click', () => {
		const c = parseInt(colsInput.value, 10) || cols;
		const o = parseInt(offsetInput.value, 10) || 0;
		renderSpriteGrid(scale, c, o);
	});

	const canvas = document.createElement('canvas');
	canvas.width = cols * tile;
	canvas.height = Math.max(rows, 1) * tile;
	canvas.style.imageRendering = 'pixelated';
	canvas.style.border = '1px solid #666';
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	ctx.fillStyle = '#222';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// draw each sprite and label
	entries.forEach((cell, i) => {
		const col = i % cols;
		const row = Math.floor(i / cols);
		const sx = (cell.x || 0) * TILE;
		const sy = (cell.y || 0) * TILE;
		const dx = col * tile;
		const dy = row * tile;
		try {
			if (!imgFailed && img.naturalWidth && img.naturalHeight) ctx.drawImage(img, sx, sy, TILE, TILE, dx, dy, tile, tile);
			else {
				// placeholder box when image not available
				ctx.fillStyle = '#333';
				ctx.fillRect(dx, dy, tile, tile);
			}
		} catch (e) {
			ctx.fillStyle = '#444'; ctx.fillRect(dx, dy, tile, tile);
		}
		// label
		ctx.fillStyle = 'rgba(0,0,0,0.6)';
		ctx.fillRect(dx, dy + tile - 14, tile, 14);
		ctx.fillStyle = '#fff';
		ctx.font = `${10 * scale}px sans-serif`;
		ctx.fillText(cell.name || `#${i+1}`, dx + 4, dy + tile - 4);
	});

	// click reporting: show which species is expected at clicked tile
	canvas.addEventListener('click', (ev) => {
		const rect = canvas.getBoundingClientRect();
		const cx = Math.floor((ev.clientX - rect.left) / tile);
		const cy = Math.floor((ev.clientY - rect.top) / tile);
		const clickedIndex = cy * cols + cx;
		const expected = entries[clickedIndex];
		alert(`Clicked tile x:${cx} y:${cy} index:${clickedIndex} expected:${expected ? expected.name : '—'}`);
	});

	overlay.appendChild(canvas);

	// mapping list for quick inspection
	const list = document.createElement('div');
	list.style.marginTop = '8px'; list.style.fontFamily = 'monospace'; list.style.whiteSpace = 'pre';
	let text = '';
	entries.forEach((c, idx) => { text += `${String(idx+1).padStart(3)}. ${c.name.padEnd(18)} x:${String(c.x).padStart(2)} y:${c.y}\n`; });
	list.textContent = text;
	overlay.appendChild(list);
}

// =============================================================================
// TOURNAMENT SYSTEM
// =============================================================================

function isPowerOfTwo(n) {
	return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}

function randomTypes() {
	const availableTypes = Object.keys(typeChart);
	const typeCount = Math.random() < 0.4 ? 2 : 1;
	const chosen = [];
	while (chosen.length < typeCount) {
		const t = availableTypes[Math.floor(Math.random() * availableTypes.length)];
		if (!chosen.includes(t)) chosen.push(t);
	}
	return chosen;
}

// Track move mix given to Pokemon at tournament creation
const tournamentMoveStats = {
	damaging: 0,
	status: 0,
	statBoost: 0,
	totalMoves: 0,
	totalPokemon: 0
};

function resetTournamentMoveStats() {
	tournamentMoveStats.damaging = 0;
	tournamentMoveStats.status = 0;
	tournamentMoveStats.statBoost = 0;
	tournamentMoveStats.totalMoves = 0;
	tournamentMoveStats.totalPokemon = 0;
}

function updateTournamentMoveStats(p) {
	if (!p || !Array.isArray(p.moves)) return;
	tournamentMoveStats.totalPokemon += 1;
	for (const m of p.moves) {
		const effects = m.effects ?? [];
		const isDamaging = (m.power ?? 0) > 0 || m.category === 'physical' || m.category === 'special';
		const isStatusInflictor = effects.some(e => e.type === 'STATUS');
		const isStatBoost = effects.some(e => e.type === 'STAT' && e.change > 0);
		if (isDamaging) tournamentMoveStats.damaging += 1;
		if (isStatusInflictor) tournamentMoveStats.status += 1;
		if (isStatBoost) tournamentMoveStats.statBoost += 1;
		tournamentMoveStats.totalMoves += 1;
	}
}

/**
 * Run a Pokemon tournament bracket with randomized participants
 * @param {number} size - Tournament size (must be power of 2)
 * @param {boolean} includeOver600BST - Whether to include Pokemon with >600 base stat total
 * @param {boolean} randomAbilities - Whether to randomize abilities
 * @param {boolean} allowWonderGuard - Whether to allow Wonder Guard ability
 * @param {boolean} randomItems - Whether to randomize items
 * @param {number[]} pokemonGens - Which generations to include for Pokemon
 * @param {number[]} moveGens - Which generations to include for moves
 */// Clear transient/volatile battle state so a Pokémon begins a match fresh
function resetBattleState(p) {
	if (!p) return;
	p.currentHP = p.maxHp;
	p.status = null;
	p.statusTurns = 0;
	p.confusionTurns = 0;
	p.toxicCounter = 0;
	p.leechSeed = false;
	p.leechSeedSource = null;
	p.protected = false;
	p.flinched = false;
	p.mustRecharge = false;
	p.currentMove = null;
	p.charging = null;
	p.lastDamageDealt = 0;
	p.statStages = { atk: 0, def: 0, spA: 0, spD: 0, spe: 0, acc: 0, eva: 0 };
	// Restore consumed items
	if (p.originalItem) {
		p.item = p.originalItem;
	}
}

async function runTournament(size = 16, includeOver600BST = false, randomAbilities = true, allowWonderGuard = false, randomItems = false, is2v2 = false, fullTeams = false, normalTournament = false, pokemonGens = [1, 2, 3, 4, 5], moveGens = [1, 2, 3, 4, 5]) {
	clearLogs();
	resetTournamentMoveStats();
	// Reset tournament statistics for team battles
	if (is2v2 || fullTeams) {
		tournamentStats.setEnabled(false); // disable tracking/noise by default
		tournamentStats.reset();
	}
	
	// Start timing Pokemon creation
	const startCreation = performance.now();
	
	// Log registry stats before tournament
	console.log(`📊 Pokemon Registry before tournament: ${pokemonRegistry.count()} Pokémon`);
	
	if (!isPowerOfTwo(size)) {
		logBattle('Tournament size must be a power of two (e.g. 8,16,32).');
		return;
	}
	const participants = [];
	// Filter by generation - Gen 1: 1-151, Gen 2: 152-251, Gen 3: 252-386, Gen 4: 387-493, Gen 5: 494-649
	const genFilteredPool = allPokemon.filter(name => {
		const id = pokemon[name].id;
		if (pokemonGens.includes(1) && id >= 1 && id <= 151) return true;
		if (pokemonGens.includes(2) && id >= 152 && id <= 251) return true;
		if (pokemonGens.includes(3) && id >= 252 && id <= 386) return true;
		if (pokemonGens.includes(4) && id >= 387 && id <= 493) return true;
		if (pokemonGens.includes(5) && id >= 494 && id <= 649) return true;
		return false;
	});
	// Filter tournament pool based on BST (Base Stat Total)
	const tournamentPool = includeOver600BST ? genFilteredPool : genFilteredPool.filter(name => {
		const p = pokemon[name];
		const bst = p.stats.hp + p.stats.atk + p.stats.def + p.stats.spA + p.stats.spD + p.stats.spe;
		return bst <= 600;
	});
	
	if (is2v2 || fullTeams) {
		// Create teams of Pokemon for team-based battles
		// Determine team size based on battle mode
		let teamSize;
		if (is2v2) {
			teamSize = fullTeams ? 4 : 2; // 4 for 2v2 full, 2 for 2v2
		} else {
			// 1v1 teams: check filters for team size (3 or 6)
			const battleMode = document.getElementById('battleModeSelect')?.value || '1v1-teams';
			console.log(`🔍 Team Creation Debug: battleMode="${battleMode}", is2v2=${is2v2}, fullTeams=${fullTeams}`);
			if (battleMode === '1v1-full') {
				teamSize = 6;
			} else if (battleMode === 'full') {
				teamSize = 4;
			} else {
				teamSize = 3;
			}
		}
		console.log(`👥 Creating teams with ${teamSize} Pokemon each`);
		for (let i = 0; i < size; i++) {
			const team = [];
			for (let j = 0; j < teamSize; j++) {
				const species = tournamentPool[Math.floor(Math.random() * tournamentPool.length)];
				const types = normalTournament ? null : randomTypes(); // null = use normal types
				const p = createPokemon(species, 50, 'generation-i-ii-iii', types, normalTournament ? false : true, randomAbilities, allowWonderGuard, randomItems, pokemonGens, moveGens);
				updateTournamentMoveStats(p);
				team.push(p);
			}
			participants.push(team);
		}
	} else {
		// Single Pokemon per participant
		for (let i = 0; i < size; i++) {
			const species = tournamentPool[Math.floor(Math.random() * tournamentPool.length)];
			const types = normalTournament ? null : randomTypes(); // null = use normal types
			const p = createPokemon(species, 50, 'generation-i-ii-iii', types, normalTournament ? false : true, randomAbilities, allowWonderGuard, randomItems, pokemonGens, moveGens);
			updateTournamentMoveStats(p);
			participants.push(p);
		}
	}

	// Log move distribution stats
	if (size <= 64) {
		console.log('Tournament move mix:', { ...tournamentMoveStats });
	}
	
	const endCreation = performance.now();
	console.log(`⏱️ Pokemon creation took ${(endCreation - startCreation).toFixed(2)}ms for ${tournamentMoveStats.totalPokemon} Pokemon`);
	const damagingPct = ((tournamentMoveStats.damaging / tournamentMoveStats.totalMoves) * 100).toFixed(1);
	const statusPct = ((tournamentMoveStats.status / tournamentMoveStats.totalMoves) * 100).toFixed(1);
	const boostPct = ((tournamentMoveStats.statBoost / tournamentMoveStats.totalMoves) * 100).toFixed(1);
	logBattle(`=== Tournament Move Distribution (${tournamentMoveStats.totalPokemon} Pokemon, ${tournamentMoveStats.totalMoves} moves) ===`);
	logBattle(`Damaging: ${tournamentMoveStats.damaging} (${damagingPct}%)`);
	logBattle(`With status effects: ${tournamentMoveStats.status} (${statusPct}%)`);
	logBattle(`With stat boosts: ${tournamentMoveStats.statBoost} (${boostPct}%)`);
	logBattle(`Note: Categories overlap - moves can be both damaging and have status/boost effects`);
	logBattle('');

	shuffle(participants);
	let round = 1;
	let current = participants;
	if (size <= 64) {
		console.log(`Initial Tournament Bracket (${current.length} participants):`, current);
	}
	
	while (current.length > 1) {
		// Enable logging for final battle
		if (current.length === 2) {
			setLoggingEnabled(true);
		} else {
			setLoggingEnabled(false);
		}
		
		const next = [];
		for (let i = 0; i < current.length; i += 2) {
			if (is2v2 || fullTeams) {
				const team1 = current[i];
				const team2 = current[i+1];
				// Reset state for all Pokemon in both teams
				for (const p of team1) {
					resetBattleState(p);
					for (const m of p.moves) m.currentPP = m.pp;
				}
				for (const p of team2) {
					resetBattleState(p);
					for (const m of p.moves) m.currentPP = m.pp;
				}
				logBattle(`Match: ${team1.map(p => p.name).join(' & ')} vs ${team2.map(p => p.name).join(' & ')}`);
				
				// Start tracking this match
				tournamentStats.startMatch(
					team1.map(p => p.name),
					team2.map(p => p.name)
				);
				
				let winningTeam;
				if (is2v2) {
					// 2v2 battles
					winningTeam = fullTeams ? battle2v2Full(team1, team2) : battle2v2(team1, team2);
				} else {
					// 1v1 team battles (3v3 or 6v6 with switching)
					winningTeam = battle1v1Teams(team1, team2);
				}
				
				// End tracking and record outcomes
				tournamentStats.endMatch(winningTeam.map(p => p.name));
				for (const p of team1) {
					tournamentStats.recordBattle(p.name, winningTeam === team1);
				}
				for (const p of team2) {
					tournamentStats.recordBattle(p.name, winningTeam === team2);
				}
				
				next.push(winningTeam);
			} else {
				const p1 = current[i];
				const p2 = current[i+1];
				// Reset volatile state and restore PP for participants before each match so matches start fresh
				resetBattleState(p1);
				resetBattleState(p2);
				for (const m of p1.moves) m.currentPP = m.pp;
				for (const m of p2.moves) m.currentPP = m.pp;
				logBattle(`Match: ${p1.name} vs ${p2.name}`);
				const winner = battle(p1, p2); // returns winning pokemon object
				next.push(winner);
			}
		}
		current = next;
		if (size <= 64) {
			console.log(`Round ${round} Winners:`, current);
		}
		round++;
	}

	// Re-enable logging
	setLoggingEnabled(true);

	const champion = current[0];
	
	if (is2v2 || fullTeams) {
		logBattle(`=== Tournament Champions: ${Array.isArray(champion) ? champion.map(p => p.name).join(' & ') : champion.name} ===`);
		currentPokemon = Array.isArray(champion) ? champion[0] : champion;
		
		// Save battle logs before clearing
		const savedLogs = [...battleLogs];
		
		// Clear the logs div completely
		const logsDiv = document.getElementById('logs');
		logsDiv.innerHTML = '';
		
		// Create title
		const title = document.createElement('h3');
		title.style.marginTop = '0';
		title.textContent = 'Tournament Champions';
		logsDiv.appendChild(title);
		
		// Log stats summary to console
		tournamentStats.logSummary();
		
		// Create container for champions (2x2 grid if fullTeams, 1x2 if not)
		const championsContainer = document.createElement('div');
		if (fullTeams) {
			// Use CSS Grid for 2x2 layout
			championsContainer.style.display = 'grid';
			championsContainer.style.gridTemplateColumns = 'repeat(2, 600px)';
			championsContainer.style.gap = '20px';
			championsContainer.style.justifyContent = 'center';
			championsContainer.style.margin = '0 auto';
		} else {
			// Use flex for 1x2 layout
			championsContainer.style.display = 'flex';
			championsContainer.style.gap = '20px';
			championsContainer.style.alignItems = 'flex-start';
			championsContainer.style.flexWrap = 'wrap';
			championsContainer.style.justifyContent = 'center';
		}
		logsDiv.appendChild(championsContainer);
		
		// Store reference to the real logs div
		const realLogsDiv = logsDiv;
		
		// Determine the number of champions to display (same logic as team creation)
		let numChampions;
		if (is2v2) {
			numChampions = fullTeams ? 4 : 2;
		} else {
			const battleMode = document.getElementById('battleModeSelect')?.value || '1v1-teams';
			if (battleMode === '1v1-full') {
				numChampions = 6;
			} else if (battleMode === 'full') {
				numChampions = 4;
			} else {
				numChampions = 3;
			}
		}
		
		console.log(`🏆 Displaying ${numChampions} champions. Champion is array: ${Array.isArray(champion)}, length: ${Array.isArray(champion) ? champion.length : 'N/A'}`);
		
		// Display each champion Pokemon
		for (let i = 0; i < numChampions && i < (Array.isArray(champion) ? champion.length : 1); i++) {
			console.log(`🏆 Processing champion ${i + 1}/${numChampions}`);
			
			// Create canvas for this champion
			const canvas = document.createElement('canvas');
			canvas.id = 'canvas';
			canvas.width = 96;
			canvas.height = 96;
			document.body.appendChild(canvas);
			
			// Create a temporary logs div so describePokemon doesn't clear our container
			const tempLogs = document.createElement('div');
			tempLogs.id = 'logs';
			
			// Replace the current logs div with temp logs
			const currentLogs = document.getElementById('logs');
			if (currentLogs) {
				currentLogs.replaceWith(tempLogs);
			} else {
				document.body.appendChild(tempLogs);
			}
			
			// Display this champion
			describePokemon(champion[i]);
			
			// Find sprite cell and draw
			const keyName = champion[i].name.toLowerCase();
			let cell = pokemonGrid.find(x => x.name && x.name.toLowerCase() === keyName);
			if (!cell) cell = pokemonGrid[Math.floor(Math.random() * pokemonGrid.length)];
			
			if (img.complete) {
				processSpriteForTypes(champion[i].types, cell.x, cell.y);
			} else {
				img.onload = () => processSpriteForTypes(champion[i].types, cell.x, cell.y);
			}
			
			// Get the complete info box and move it to container
			const champInfoBox = tempLogs.querySelector('.pokemon-info-box');
			if (champInfoBox) {
				champInfoBox.style.flexShrink = '0';
				champInfoBox.style.width = '550px';
				champInfoBox.style.maxWidth = 'none';
				championsContainer.appendChild(champInfoBox);
				// Remove the id from canvas so next champion can use it
				const embeddedCanvas = champInfoBox.querySelector('canvas');
				if (embeddedCanvas) embeddedCanvas.removeAttribute('id');
			}
			
			// Restore the real logs div after last champion
			if (i === numChampions - 1) {
				const currentLogs = document.getElementById('logs');
				if (currentLogs) {
					currentLogs.replaceWith(realLogsDiv);
				} else {
					document.body.appendChild(realLogsDiv);
				}
			}
		}
		
		// Display battle logs
		if (savedLogs.length > 0) {
			const logsTitle = document.createElement('h3');
			logsTitle.style.marginTop = '30px';
			logsTitle.textContent = 'Final Battle Log';
			logsDiv.appendChild(logsTitle);
			
			const logsContainer = document.createElement('div');
			logsContainer.style.backgroundColor = '#f5f5f5';
			logsContainer.style.padding = '15px';
			logsContainer.style.borderRadius = '5px';
			logsContainer.style.maxHeight = '400px';
			logsContainer.style.overflowY = 'auto';
			logsContainer.style.fontFamily = 'monospace';
			logsContainer.style.fontSize = '12px';
			logsContainer.style.whiteSpace = 'pre-wrap';
			
			savedLogs.forEach(log => {
				const logLine = document.createElement('div');
				logLine.textContent = log;
				logLine.style.marginBottom = '2px';
				logsContainer.appendChild(logLine);
			});
			
			logsDiv.appendChild(logsContainer);
		}
		
		// Display tournament statistics report (disabled by default)
		if (tournamentStats.enabled) {
			const statsTitle = document.createElement('h3');
			statsTitle.style.marginTop = '30px';
			statsTitle.textContent = 'Tournament Statistics';
			logsDiv.appendChild(statsTitle);

			const statsReport = document.createElement('div');
			statsReport.innerHTML = tournamentStats.generateHTMLReport();
			logsDiv.appendChild(statsReport);
		}
		
		// Display registry statistics
		const registryTitle = document.createElement('h3');
		registryTitle.style.marginTop = '30px';
		registryTitle.textContent = `Pokémon Registry (${pokemonRegistry.count()} Total)`;
		logsDiv.appendChild(registryTitle);
		
		const registryStats = pokemonRegistry.getStats();
		const registryInfo = document.createElement('div');
		registryInfo.style.background = 'linear-gradient(135deg, #e8f0e8 0%, #d0e0d8 100%)';
		registryInfo.style.padding = '20px';
		registryInfo.style.borderRadius = '10px';
		registryInfo.style.border = '3px solid #2d4a3e';
		registryInfo.innerHTML = `
			<p style="font-size: 20px; color: #2d4a3e;"><strong>Total Pokémon Created:</strong> ${registryStats.total}</p>
			<p style="font-size: 20px; color: #2d4a3e;"><strong>Average Level:</strong> ${registryStats.averageLevel.toFixed(1)}</p>
			<p style="font-size: 20px; color: #2d4a3e;"><strong>Most Common Types:</strong> ${Object.entries(registryStats.byType).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([t, c]) => `${t} (${c})`).join(', ')}</p>
			<button id="viewFullRegistryBtn" style="margin-top: 15px; padding: 10px 20px; font-size: 18px; cursor: pointer;">View Full Registry</button>
		`;
		logsDiv.appendChild(registryInfo);
		
		// Add event listener to the view registry button
		const viewFullRegBtn = document.getElementById('viewFullRegistryBtn');
		if (viewFullRegBtn) {
			viewFullRegBtn.addEventListener('click', displayPokemonRegistry);
		}
		
		console.log(`📊 Pokemon Registry after tournament: ${pokemonRegistry.count()} Pokémon`);
	} else {
		currentPokemon = champion; // Store for saving
		logBattle(`=== Tournament Champion: ${champion.name} ===`);
		
		// Save battle logs before clearing
		const savedLogs = [...battleLogs];
		
		// show champion like randomize
		describePokemon(champion);
		// draw champion sprite - find sprite grid coordinates for this species (case-insensitive)
		const keyName = champion.name.toLowerCase();
		let cell = pokemonGrid.find(x => x.name && x.name.toLowerCase() === keyName);
		if (!cell) {
			// fall back to a random grid cell
			cell = pokemonGrid[Math.floor(Math.random() * pokemonGrid.length)];
		}
		// ensure image loaded, then recolor and draw
		if (img.complete) {
			processSpriteForTypes(champion.types, cell.x, cell.y);
		} else {
			img.onload = () => processSpriteForTypes(champion.types, cell.x, cell.y);
		}
		
		// Display battle logs
		if (savedLogs.length > 0) {
			const logsDiv = document.getElementById('logs');
			const logsTitle = document.createElement('h3');
			logsTitle.style.marginTop = '30px';
			logsTitle.textContent = 'Final Battle Log';
			logsDiv.appendChild(logsTitle);
			
			const logsContainer = document.createElement('div');
			logsContainer.style.backgroundColor = '#f5f5f5';
			logsContainer.style.padding = '15px';
			logsContainer.style.borderRadius = '5px';
			logsContainer.style.maxHeight = '400px';
			logsContainer.style.overflowY = 'auto';
			logsContainer.style.fontFamily = 'monospace';
			logsContainer.style.fontSize = '12px';
			logsContainer.style.whiteSpace = 'pre-wrap';
			
			savedLogs.forEach(log => {
				const logLine = document.createElement('div');
				logLine.textContent = log;
				logLine.style.marginBottom = '2px';
				logsContainer.appendChild(logLine);
			});
			
			logsDiv.appendChild(logsContainer);
		}
	}
}

