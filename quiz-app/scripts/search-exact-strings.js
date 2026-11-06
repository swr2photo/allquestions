const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'tmp', 'main.js');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');

  const terms = [
    '"subject"', "'subject'",
    '"course"', "'course'",
    '"listsubject"', "'listsubject'",
    '"psusubject"', "'psusubject'",
    '"subjects"', "'subjects'",
    '"courses"', "'courses'"
  ];

  console.log('--- Searching for exact string literals in main.js ---');
  for (const term of terms) {
    let index = 0;
    let count = 0;
    while ((index = text.indexOf(term, index)) !== -1) {
      console.log(`Found exact term ${term} at index ${index}:`);
      console.log('Snippet:', text.substring(Math.max(0, index - 150), index + term.length + 150));
      console.log('-------------------');
      count++;
      index += term.length;
    }
    console.log(`Term ${term} - Total found: ${count}`);
  }
} else {
  console.log('main.js does not exist.');
}
