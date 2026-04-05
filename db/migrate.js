const db = require('./database');
const fs = require('fs');
const path = require('path');

console.log('[migrate] Running schema migration...');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

console.log('[migrate] Schema applied successfully.');
process.exit(0);
