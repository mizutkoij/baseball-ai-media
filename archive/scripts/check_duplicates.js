const data = require('../data/golden_samples.json');

console.log('Player count:', data.samples.players.length);

const ids = data.samples.players.map(p => p.id);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

console.log('Duplicates:', duplicates);

if (duplicates.length > 0) {
  console.log('\nDuplicate entries:');
  duplicates.forEach(dupId => {
    const entries = data.samples.players.filter(p => p.id === dupId);
    entries.forEach((entry, idx) => {
      console.log(`${idx + 1}. ${entry.name} (${entry.id})`);
    });
  });
}