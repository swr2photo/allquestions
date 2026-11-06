async function test() {
  const url = 'https://forms.psu.ac.th/main.ec32c6375124a533.js';
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log('Script length:', text.length);
    
    const terms = ['psusubject', 'listsubject', 'subject', 'forms.psu.ac.th/api'];
    for (const term of terms) {
      const regex = new RegExp(term, 'i');
      const match = regex.exec(text);
      if (match) {
        console.log(`Found "${term}" at index:`, match.index);
        console.log('Snippet:', text.substring(Math.max(0, match.index - 150), match.index + 150));
      } else {
        console.log(`"${term}" not found`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
