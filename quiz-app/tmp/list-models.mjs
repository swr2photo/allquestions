import fs from 'fs';
import path from 'path';

const envPath = path.resolve('d:/allquestions/quiz-app/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/GEMINI_API_KEY=["']?([^"'\n]+)["']?/);
const apiKey = match ? match[1] : null;

if (!apiKey) {
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

try {
  const res = await fetch(url);
  const data = await res.json();
  if (data.models) {
    const list = data.models.map(m => m.name).join('\n');
    fs.writeFileSync('d:/allquestions/quiz-app/tmp/models_raw.txt', list, 'utf8');
    console.log("Wrote models to file.");
  } else {
    console.log("No models found.");
  }
} catch (err) {
  console.error(err);
}
