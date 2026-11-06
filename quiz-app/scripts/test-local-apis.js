const http = require('http');

async function testEndpoint(path) {
  return new Promise((resolve) => {
    const escapedPath = encodeURI(path);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: escapedPath,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log(`\n=== GET ${path} (Status: ${res.statusCode}) ===`);
        try {
          const json = JSON.parse(data);
          // Print summary of the response
          if (json.success !== undefined) console.log('Success:', json.success);
          if (json.courses) console.log('Courses count:', json.courses.length);
          if (json.categories) console.log('Categories count:', json.categories.length);
          if (json.totalRows) console.log('Sheet rows count:', json.totalRows);
          if (json.results) console.log('Search results count:', json.results.length);
          if (json.error) console.log('Error:', json.error);
          if (json.detail) console.log('Detail:', json.detail);
          
          // Print a snippet of keys or first item
          if (Array.isArray(json.courses) && json.courses.length > 0) {
            console.log('First course:', { id: json.courses[0].id, title: json.courses[0].title });
          }
          if (Array.isArray(json.results) && json.results.length > 0) {
            console.log('First search result:', {
              courseTitle: json.results[0].courseTitle,
              quizTitle: json.results[0].quizTitle,
              questionText: json.results[0].questionText.substring(0, 60) + '...'
            });
          }
        } catch (e) {
          console.log('Response is not JSON:', data.substring(0, 200));
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`Problem with request to ${path}: ${e.message}`);
      resolve();
    });

    req.end();
  });
}

async function run() {
  console.log('Waiting 15 seconds for server to start...');
  await new Promise((r) => setTimeout(r, 15000));
  
  await testEndpoint('/api/courses');
  await testEndpoint('/api/gened/courses');
  await testEndpoint('/api/sheets');
  await testEndpoint('/api/search?q=พลเมือง');
}

run().catch(console.error);
