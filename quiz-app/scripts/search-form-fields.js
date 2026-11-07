const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'tmp', 'main.js');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');

  const terms = ['sccw', 'scacr', 'sclcr'];
  console.log('--- Searching for form names in main.js ---');
  for (const term of terms) {
    let index = 0;
    let count = 0;
    while ((index = text.indexOf(term, index)) !== -1 && count < 10) {
      console.log(`Found "${term}" at index ${index}:`);
      console.log('Snippet:', text.substring(Math.max(0, index - 250), index + term.length + 500));
      console.log('-------------------');
      count++;
      index += term.length;
    }
  }
} else {
  console.log('main.js does not exist.');
}
