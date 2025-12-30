import https from 'https';

const fetch = url => new Promise((resolve, reject) => {
  https.get(url, res => {
    let data = "";
    res.on("data", chunk => (data += chunk));
    res.on("end", () => resolve(JSON.parse(data)));
  }).on("error", reject);
});

async function checkWeatherMoves() {
  const moves = ['sunny-day', 'rain-dance', 'sandstorm', 'hail'];
  for (const move of moves) {
    const data = await fetch(`https://pokeapi.co/api/v2/move/${move}/`);
    console.log(`\n${move}:`);
    console.log(`  meta.category: ${data.meta.category.name}`);
    console.log(`  target: ${data.target.name}`);
    const effect = data.effect_entries.find(e => e.language.name === 'en');
    console.log(`  effect: ${effect.short_effect}`);
  }
}

checkWeatherMoves().catch(console.error);
