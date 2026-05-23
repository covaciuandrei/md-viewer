const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const dom = new JSDOM(html);
const { document } = dom.window;

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('PASS:', msg);
}

assert(document.querySelector('#editor'), '#editor exists');
assert(document.querySelector('#preview'), '#preview exists');
console.log('Phase 1 OK');
