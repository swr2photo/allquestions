const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'tmp', 'main.js');
if (fs.existsSync(filePath)) {
  const text = fs.readFileSync(filePath, 'utf8');
  
  const target = 'this.http.get(`${_t?.url?_t.url:t.N.restEndpointUrl}/${Ve}/${$e}`';
  const index = text.indexOf(target);
  if (index !== -1) {
    console.log(`Found target at index ${index}`);
    console.log('Context:\n', text.substring(index - 1000, index + 2000));
  } else {
    console.log('Target string not found.');
  }
} else {
  console.log('main.js does not exist.');
}
