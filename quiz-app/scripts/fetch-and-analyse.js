const fs = require('fs');
const path = require('path');

async function downloadAndAnalyse() {
  const url = 'https://forms.psu.ac.th/main.ec32c6375124a533.js';
  const targetDir = path.join(__dirname, '..', 'tmp');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const filePath = path.join(targetDir, 'main.js');
  
  let text = '';
  if (fs.existsSync(filePath)) {
    console.log('Reading from local cache...');
    text = fs.readFileSync(filePath, 'utf8');
  } else {
    console.log('Fetching JS file from server...');
    const res = await fetch(url);
    text = await res.text();
    fs.writeFileSync(filePath, text, 'utf8');
    console.log('Saved JS file to local cache.');
  }

  console.log('Script length:', text.length);

  // Search patterns
  const patterns = [
    { name: 'API URLs / endpoints', regex: /"https?:\/\/[^"]+api[^"]*"/gi },
    { name: 'Forms.psu.ac.th URLs', regex: /forms\.psu\.ac\.th\/[a-zA-Z0-9_/.-]*/gi },
    { name: 'PSU URLs', regex: /[a-zA-Z0-9.-]*psu\.ac\.th[a-zA-Z0-9_/.-]*/gi },
    { name: 'API paths starting with slash', regex: /"\/api\/[^"]+"/gi },
    { name: 'Fetch/Http requests', regex: /fetch\([^)]*\)/gi },
    { name: 'List/Get subject keywords', regex: /subject|course|exam|quiz/gi }
  ];

  for (const pat of patterns) {
    console.log(`\n=== Pattern: ${pat.name} ===`);
    let match;
    let count = 0;
    // Reset regex lastIndex
    pat.regex.lastIndex = 0;
    
    // We only print the first 15 matches to keep output readable
    while ((match = pat.regex.exec(text)) !== null && count < 20) {
      console.log(`Found at index ${match.index}:`);
      console.log('Match:', match[0]);
      console.log('Snippet:', text.substring(Math.max(0, match.index - 80), match.index + match[0].length + 80));
      console.log('-------------------');
      count++;
    }
    console.log(`Total printed: ${count}`);
  }
}

downloadAndAnalyse().catch(console.error);
