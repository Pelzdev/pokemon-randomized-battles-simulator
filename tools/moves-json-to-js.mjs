import fs from 'fs';

// Convert moves.json to moves.js ES6 module
const jsonData = JSON.parse(fs.readFileSync('moves.json', 'utf8'));

const jsContent = `export const moves = ${JSON.stringify(jsonData, null, 2)};\n`;

fs.writeFileSync('src/data/moves.js', jsContent);
console.log('moves.js updated successfully!');
