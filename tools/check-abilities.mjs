import https from 'https';

const fetch = url => new Promise((resolve, reject) => {
  https.get(url, res => {
    let data = "";
    res.on("data", chunk => (data += chunk));
    res.on("end", () => resolve(JSON.parse(data)));
  }).on("error", reject);
});

async function checkAbilities() {
  // Check a few popular abilities to understand the data structure
  const testAbilities = ['overgrow', 'blaze', 'torrent', 'levitate', 'intimidate', 'sturdy'];
  
  for (const abilityName of testAbilities) {
    const data = await fetch(`https://pokeapi.co/api/v2/ability/${abilityName}/`);
    console.log(`\n${data.name} (Gen ${data.generation.name}):`);
    const effect = data.effect_entries.find(e => e.language.name === 'en');
    console.log(`  ${effect.short_effect}`);
  }
}

checkAbilities().catch(console.error);
