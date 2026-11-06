const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'tmp', 'main.js');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');
  
  const patterns = [
    { name: '.list("...', regex: /\.list\(\s*["'][a-zA-Z0-9_-]+["']/g },
    { name: '.load("...', regex: /\.load\(\s*["'][a-zA-Z0-9_-]+["']/g },
    { name: '.create("...', regex: /\.create\(\s*["'][a-zA-Z0-9_-]+["']/g }
  ];

  for (const pat of patterns) {
    console.log(`\n=== Pattern: ${pat.name} ===`);
    let match;
    let count = 0;
    while ((match = pat.regex.exec(text)) !== null && count < 20) {
      console.log(`Found at index ${match.index}:`);
      console.log('Match:', match[0]);
      console.log('Snippet:', text.substring(Math.max(0, match.index - 100), match.index + 200));
      console.log('-------------------');
      count++;
    }
    console.log(`Total found: ${count}`);
  }
} else {
  console.log('main.js does not exist.');
}
