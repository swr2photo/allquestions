const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'tmp', 'main.js');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');

  // Let's search for string patterns like "/api/some-endpoint" or just endpoints used in the Angular code.
  // We can look for strings enclosed in quotes or template literals: "/something..."
  const regex = /"\/api\/[a-zA-Z0-9_/.-]+"/g;
  let match;
  let count = 0;
  console.log('--- Matches for "/api/..." ---');
  while ((match = regex.exec(text)) !== null && count < 50) {
    console.log(`Found: ${match[0]} at index ${match.index}`);
    count++;
  }
  console.log(`Total found: ${count}`);

  // Let's also search for any keywords related to subject or course in string literals or properties
  console.log('\n--- Matches for subject/course keywords in quotes ---');
  const keywordRegex = /"\/[a-zA-Z0-9_-]*(subject|course|exam|quiz|student)[a-zA-Z0-9_/-]*"/gi;
  count = 0;
  while ((match = keywordRegex.exec(text)) !== null && count < 50) {
    console.log(`Found: ${match[0]} at index ${match.index}`);
    count++;
  }
  console.log(`Total found: ${count}`);
} else {
  console.log('main.js does not exist.');
}
