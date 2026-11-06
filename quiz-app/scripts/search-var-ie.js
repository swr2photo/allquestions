const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'tmp', 'main.js');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');
  
  // Find where \bIe\b is referenced
  const regex = /\bIe\b/g;
  let match;
  let count = 0;
  console.log('--- References to Ie ---');
  while ((match = regex.exec(text)) !== null && count < 30) {
    console.log(`Found Ie at index ${match.index}:`);
    console.log('Snippet:', text.substring(Math.max(0, match.index - 150), match.index + 150));
    console.log('-------------------');
    count++;
  }
  console.log(`Total found: ${count}`);
} else {
  console.log('main.js does not exist.');
}
