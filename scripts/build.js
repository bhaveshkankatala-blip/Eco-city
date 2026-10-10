#!/usr/bin/env node
// Builds the single-file game: src/index.html + the four scripts -> dist/index.html
// Usage: node scripts/build.js            -> dist/index.html (production)
//        node scripts/build.js --test     -> dist/test.html (exposes window.__t for automated tests)
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = p => fs.readFileSync(path.join(root, 'src', p), 'utf8');
const test = process.argv.includes('--test');

let html = src('index.html');
let game = src('game.js');
if (test) {
  game = game.replace('/*TEST*/', 'window.__t={get S(){return S}, E, refresh, finishLevel, ui, clickTile, setHover};');
}
// engine.js (simulation) + gl.js (WebGL engine) + world.js (3D scene) share one script tag, game.js (UI) the next
const engine = [src('engine.js'), src('gl.js'), src('world.js')].join('\n');
if (!html.includes('/*ENGINE*/') || !html.includes('/*GAME*/')) throw new Error('src/index.html is missing the /*ENGINE*/ or /*GAME*/ placeholder');
// use a function replacer so "$&" etc. inside the code are not treated as patterns
html = html.replace('/*ENGINE*/', () => engine).replace('/*GAME*/', () => game);

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, test ? 'test.html' : 'index.html');
fs.writeFileSync(out, html);
console.log('Built ' + path.relative(root, out) + ' (' + Math.round(html.length / 1024) + ' KB)');
