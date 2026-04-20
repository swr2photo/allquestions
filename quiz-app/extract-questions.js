/* eslint-disable @typescript-eslint/no-require-imports */
// Improved script to extract questions from HTML quiz files
const fs = require('fs');
const path = require('path');

const courseDir = path.join(__dirname, '..', 'allquestions', 'course');

function extractPdfInfo(htmlContent) {
  const driveMatch = htmlContent.match(/drive\.google\.com\/file\/d\/([^/"'\s]+)/i);
  const pinMatch = htmlContent.match(/correctPIN\s*[:=]\s*["']([^"']+)/i);
  
  return {
    driveFileId: driveMatch ? driveMatch[1] : null,
    driveUrl: driveMatch ? `https://drive.google.com/file/d/${driveMatch[1]}/preview` : null,
    hasPin: !!pinMatch,
    pin: pinMatch ? pinMatch[1] : null
  };
}

function extractQuizQuestions(htmlContent) {
  // Check if PDF viewer
  if ((htmlContent.includes('pdf-viewer') || htmlContent.includes('pdfjsLib') || 
       htmlContent.includes('renderPage')) && !htmlContent.includes('answer-container')) {
    return { type: 'pdf', questions: [], pdfInfo: extractPdfInfo(htmlContent) };
  }
  
  if (!htmlContent.includes('question')) {
    return { type: 'unknown', questions: [] };
  }

  const questions = [];
  
  // Split by question blocks - support both patterns
  const parts = htmlContent.split(/<div\s+class="question[\s"]/i);
  
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    
    // Get question number
    let questionNum = i;
    const numMatch1 = block.match(/class="question-number"[^>]*>\s*(\d+)/i);
    const numMatch2 = block.match(/rounded-full[^>]*font-bold[^>]*>\s*(\d+)/i);
    if (numMatch1) questionNum = parseInt(numMatch1[1]);
    else if (numMatch2) questionNum = parseInt(numMatch2[1]);
    
    // Get question text
    let questionText = '';
    const textMatch1 = block.match(/class="question-text"[^>]*>([\s\S]*?)<\/p>/i);
    const textMatch2 = block.match(/class="text-lg\s+text-gray-800[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    if (textMatch1) questionText = textMatch1[1];
    else if (textMatch2) questionText = textMatch2[1];
    
    // Clean HTML tags and whitespace
    questionText = questionText.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    
    if (!questionText) continue;
    
    // Get answers
    const choices = [];
    
    // Match answer-container or answer-option with optional "correct" class
    const answerRegex = /<div\s+class="answer-(?:container|option)\s*(correct)?[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let match;
    while ((match = answerRegex.exec(block)) !== null) {
      const isCorrect = !!match[1];
      let text = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (text) {
        choices.push({ text, isCorrect });
      }
    }
    
    if (choices.length > 0 && questionText) {
      questions.push({
        id: questionNum,
        text: questionText,
        choices
      });
    }
  }
  
  return { type: 'quiz', questions };
}

// Process all course folders
const results = {};
const courseFolders = fs.readdirSync(courseDir);
let totalQuestions = 0;

courseFolders.forEach(folder => {
  const folderPath = path.join(courseDir, folder);
  if (!fs.statSync(folderPath).isDirectory()) return;
  
  results[folder] = { quizzes: [] };
  
  const files = fs.readdirSync(folderPath);
  files.forEach(file => {
    if (!file.endsWith('.html')) return;
    
    const filePath = path.join(folderPath, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const extracted = extractQuizQuestions(content);
    
    if (extracted.type === 'quiz') {
      totalQuestions += extracted.questions.length;
      const withCorrect = extracted.questions.filter(q => q.choices.some(c => c.isCorrect)).length;
      extracted.answersFound = withCorrect;
    }
    
    results[folder].quizzes.push({
      filename: file,
      ...extracted
    });
  });
});

// Print summary to stderr
console.error('\n=== EXTRACTION SUMMARY ===');
Object.keys(results).forEach(course => {
  console.error(`\n${course}:`);
  results[course].quizzes.forEach(q => {
    if (q.type === 'quiz') {
      console.error(`  ${q.filename} [quiz] Q=${q.questions.length} correct=${q.answersFound}`);
    } else if (q.type === 'pdf') {
      console.error(`  ${q.filename} [pdf] driveId=${q.pdfInfo?.driveFileId || 'N/A'}`);
    } else {
      console.error(`  ${q.filename} [${q.type}]`);
    }
  });
});
console.error(`\nTotal questions extracted: ${totalQuestions}`);

// Output JSON to stdout
console.log(JSON.stringify(results, null, 2));
