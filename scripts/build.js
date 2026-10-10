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
  game = game.replace('/*TEST*/', 'window.__t={get S(){return S}, set S(v){S=v}, E, refresh, finishLevel, ui, clickTile, setHover, goLevel, showResult};');
}
// engine.js (simulation) + gl.js (WebGL engine) + world.js (3D scene) share one script tag, game.js (UI) the next
const engine = [src('engine.js'), src('gl.js'), src('world.js')].join('\n');
// in-game text: src/content.js defaults, optionally overridden by src/content.json (ChatGPT content pack)
let content = src('content.js');
const cj = path.join(root, 'src', 'content.json');
if (fs.existsSync(cj)) {
  const json = JSON.parse(fs.readFileSync(cj, 'utf8')); // throws on bad JSON so a broken pack never ships
  content = 'window.ECO_CONTENT_OVERRIDE=' + JSON.stringify(json).replace(/</g, '\\u003c') + ';\n' + content;
}
// event-day settings baked into the build (e.g. the Google Sheet link): src/config.json
const cfg = path.join(root, 'src', 'config.json');
if (fs.existsSync(cfg)) content = 'window.ECO_CONFIG=' + JSON.stringify(JSON.parse(fs.readFileSync(cfg, 'utf8'))).replace(/</g, '\\u003c') + ';\n' + content;
if (!html.includes('/*CONTENT*/')) throw new Error('src/index.html is missing the /*CONTENT*/ placeholder');
html = html.replace('/*CONTENT*/', () => content);
if (!html.includes('/*ENGINE*/') || !html.includes('/*GAME*/')) throw new Error('src/index.html is missing the /*ENGINE*/ or /*GAME*/ placeholder');
// use a function replacer so "$&" etc. inside the code are not treated as patterns
html = html.replace('/*ENGINE*/', () => engine).replace('/*GAME*/', () => game);

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, test ? 'test.html' : 'index.html');
fs.writeFileSync(out, html);
console.log('Built ' + path.relative(root, out) + ' (' + Math.round(html.length / 1024) + ' KB)');
