async function fetchIndex() {
  const url = 'https://forms.psu.ac.th/';
  try {
    const res = await fetch(url);
    const html = await res.text();
    console.log('HTML Length:', html.length);
    
    // Find script tags
    const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["']/gi;
    let match;
    console.log('--- Script Tags ---');
    while ((match = scriptRegex.exec(html)) !== null) {
      console.log('Script URL:', match[1]);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
fetchIndex();
