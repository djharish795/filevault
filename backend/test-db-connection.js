const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/test-db',
  method: 'GET',
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n=== DATABASE TEST RESULT ===\n');
    const result = JSON.parse(data);
    console.log(JSON.stringify(result, null, 2));
    console.log('\n=== TEST COMPLETED ===\n');
    process.exit(result.success ? 0 : 1);
  });
});

req.on('error', (error) => {
  console.error('ERROR:', error.message);
  process.exit(1);
});

req.end();
