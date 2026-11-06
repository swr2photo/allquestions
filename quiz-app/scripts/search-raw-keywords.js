const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'tmp', 'main.js');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');

  // Search for any quoted strings containing subject or course
  const regex = /"([^"\\]*(?:subject|course)[^"\\]*)"/gi;
  let match;
  let count = 0;
  console.log('--- Matches for quoted strings containing "subject" or "course" ---');
  while ((match = regex.exec(text)) !== null && count < 60) {
    console.log(`Found: "${match[1]}" at index ${match.index}`);
    count++;
  }
  console.log(`Total found: ${count}`);
} else {
  console.log('main.js does not exist.');
}
