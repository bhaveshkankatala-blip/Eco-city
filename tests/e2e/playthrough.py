"""
End-to-end playthrough: start a team, build in all three levels, run every time jump,
reach the result screen. Saves screenshots to tests/e2e/out/ and fails on any page error.

Setup (once):  pip install playwright && python -m playwright install chromium
Run:           npm run build:test && python tests/e2e/playthrough.py [width height]

Uses the test build (dist/test.html), which exposes window.__t (game state + helpers)
and window.R3 (3D view). On machines without a GPU, Chromium falls back to software
WebGL (SwiftShader): it works but each frame takes ~0.5 s, so the run takes several minutes.
"""
import asyncio, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests' / 'e2e' / 'out'
PUT = (Path(__file__).parent / 'put.js').read_text()
FINISH = "()=>window.__t.finishLevel()"


async def main():
    w, h = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1366, 768)
    test_html = ROOT / 'dist' / 'test.html'
    if not test_html.exists():
        sys.exit('dist/test.html not found. Run: npm run build:test')
    OUT.mkdir(parents=True, exist_ok=True)
    # wrap in a full document like the hosting page does
    page_file = OUT / 'page.html'
    page_file.write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + test_html.read_text() + '</body></html>')
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': w, 'height': h})
        pg.set_default_timeout(300000)
        errs = []
        pg.on('pageerror', lambda e: errs.append(e.stack[:600] if e.stack else str(e)))
        shot = lambda name: pg.screenshot(path=str(OUT / f'{name}.png'))
        await pg.goto(page_file.as_uri()); await pg.wait_for_timeout(3000)
        await shot('0-start')
        await pg.fill('#teamName', 'Test Team'); await pg.click('#startForm button[type=submit]'); await pg.wait_for_timeout(4000)
        await pg.evaluate(PUT, [['foodFarm', 4], ['coalPlant', 1], ['goldFactory', 1], ['cashFarm', 1]])
        await pg.wait_for_timeout(2000); await shot('1-level1')
        await pg.evaluate(FINISH); await pg.wait_for_timeout(2000); await pg.click('#simSkip'); await pg.wait_for_timeout(2000)
        await pg.click('#simNext'); await pg.wait_for_timeout(3000)
        await pg.evaluate(PUT, [['solar', 3], ['dam', 1], ['apartment', 1], ['community', 2], ['school', 1], ['waterPlant', 1], ['foodFarm', 3], ['road', 8], ['wind', 2]])
        await pg.wait_for_timeout(2000); await shot('2-level2')
        await pg.evaluate(FINISH); await pg.wait_for_timeout(6000); await shot('3-time-jump')
        await pg.click('#simSkip'); await pg.wait_for_timeout(1500); await pg.click('#simNext'); await pg.wait_for_timeout(3000)
        await pg.evaluate(PUT, [['battery', 1], ['granary', 2], ['hospital', 1], ['itPark', 1], ['forest', 8], ['foodFarm', 2], ['wind', 2], ['recycling', 1], ['waterPlant', 1], ['park', 2], ['road', 6]])
        await pg.wait_for_timeout(3000); await shot('4-level3')
        await pg.evaluate(FINISH); await pg.wait_for_timeout(1500); await pg.click('#simSkip'); await pg.wait_for_timeout(2500)
        await shot('5-final-run')
        await pg.click('#simNext'); await pg.wait_for_timeout(3000); await shot('6-result')
        score = await pg.evaluate("()=>document.querySelector('#resRing text').textContent")
        await b.close()
    print('Final SDG score shown:', score)
    print('Screenshots in', OUT)
    if errs:
        print('PAGE ERRORS:\n' + '\n'.join(errs)); sys.exit(1)
    print('No page errors.')


asyncio.run(main())
