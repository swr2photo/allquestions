const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'tmp', 'main.js');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');
  
  // Find where Ie is referenced in extends patterns or constructor patterns
  const regex = /extends\s+Ie/g;
  let match;
  let count = 0;
  console.log('--- Classes extending Ie ---');
  while ((match = regex.exec(text)) !== null) {
    console.log(`Found "extends Ie" at index ${match.index}:`);
    console.log('Snippet:', text.substring(Math.max(0, match.index - 200), match.index + 500));
    console.log('-------------------');
    count++;
  }
  console.log(`Total found: ${count}`);
} else {
  console.log('main.js does not exist.');
}
