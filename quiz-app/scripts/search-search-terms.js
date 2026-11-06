const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'tmp', 'main.js');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');

  // Search for quoted strings containing search, query, lookup, find, filter, select
  const regex = /"([^"\\]*(?:search|lookup|query|find|filter|select)[^"\\]*)"/gi;
  let match;
  let count = 0;
  console.log('--- Matches for quoted strings containing search-related terms ---');
  while ((match = regex.exec(text)) !== null && count < 60) {
    // Exclude long matched blocks or webpack paths if any
    if (match[1].length < 100) {
      console.log(`Found: "${match[1]}" at index ${match.index}`);
      count++;
    }
  }
  console.log(`Total found: ${count}`);
} else {
  console.log('main.js does not exist.');
}
