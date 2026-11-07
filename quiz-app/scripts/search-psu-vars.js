const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'tmp', 'main.js');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');
  
  const terms = ['psuEndpoint', 'psuApiKey'];
  for (const term of terms) {
    console.log(`\n=== References to: ${term} ===`);
    const regex = new RegExp(term, 'g');
    let match;
    let count = 0;
    while ((match = regex.exec(text)) !== null) {
      console.log(`Found at index ${match.index}:`);
      console.log('Snippet:', text.substring(Math.max(0, match.index - 150), match.index + term.length + 150));
      console.log('-------------------');
      count++;
    }
    console.log(`Total found: ${count}`);
  }
} else {
  console.log('main.js does not exist.');
}
