const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'tmp', 'main.js');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');

  const terms = ['subject', 'course'];
  console.log('--- Searching for substrings in main.js ---');
  for (const term of terms) {
    let index = 0;
    let count = 0;
    while ((index = text.indexOf(term, index)) !== -1 && count < 30) {
      console.log(`Found "${term}" at index ${index}:`);
      console.log('Snippet:', text.substring(Math.max(0, index - 100), index + term.length + 150));
      console.log('-------------------');
      count++;
      index += term.length;
    }
    console.log(`Term "${term}" - Total shown/found: ${count}`);
  }
} else {
  console.log('main.js does not exist.');
}
