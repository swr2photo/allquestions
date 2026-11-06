const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'tmp', 'main.js');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');
  
  const regex = /\.http\.(get|post|put|delete|patch)\(([^)]+)\)/g;
  let match;
  let count = 0;
  console.log('--- HTTP Requests in main.js ---');
  while ((match = regex.exec(text)) !== null && count < 50) {
    console.log(`Match ${count + 1}:`);
    console.log('Method:', match[1]);
    console.log('URL / Config:', match[2]);
    console.log('Snippet:', text.substring(Math.max(0, match.index - 50), match.index + match[0].length + 100));
    console.log('-------------------');
    count++;
  }
  console.log(`Total printed: ${count}`);
} else {
  console.log('main.js does not exist.');
}
