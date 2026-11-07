const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'tmp', 'main.js');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');
  console.log(text.substring(2000, 5000));
} else {
  console.log('main.js does not exist.');
}
