const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'tmp', 'main.js');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');
  const index = 113669;
  const start = Math.max(0, index - 500);
  const end = Math.min(text.length, index + 1500);
  console.log('--- Substring from index 113669 ---');
  console.log(text.substring(start, end));
} else {
  console.log('main.js does not exist.');
}
