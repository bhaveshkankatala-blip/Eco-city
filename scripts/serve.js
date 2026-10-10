#!/usr/bin/env node
// Minimal static server for local play/testing. No dependencies.
// Usage: node scripts/serve.js [port]   then open http://localhost:8080
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = +process.argv[2] || +process.env.PORT || 8080;
const dir = path.join(__dirname, '..', 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(dir, url === '/' ? 'index.html' : url);
  if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found. Run "npm run build" first.'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => console.log('EcoCity running at http://localhost:' + port));
