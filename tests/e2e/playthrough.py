"""
End-to-end playthrough (v2): register a team, use the guide, build in all three levels
(factories of several blocks, upgrades), answer every checkpoint event, read every
"What happened" card and reach the result screen. Saves screenshots to tests/e2e/out/
and fails on any page error.

Setup (once):  pip install playwright && python -m playwright install chromium
Run:           npm run build:test && python tests/e2e/playthrough.py [width height]

Uses the test build (dist/test.html), which exposes window.__t (game state + helpers)
and window.R3 (3D view). Without a GPU Chromium uses software WebGL (SwiftShader):
it works but each frame takes ~0.5 s, so the run takes several minutes.
"""
import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests' / 'e2e' / 'out'
PUT = (Path(__file__).parent / 'put.js').read_text()
FINISH = "()=>window.__t.finishLevel()"
VIS = "(id)=>!document.getElementById(id).hidden"


async def run_jump(pg, shot, tag):
    """Skip through a time jump, answering events, until the What happened card shows."""
    await pg.evaluate("()=>document.getElementById('simSkip').click()")
    n = 0
    while True:
        await pg.wait_for_timeout(1500)
        if await pg.evaluate(VIS, 'eventScreen'):
            n += 1
            if n == 1: await shot(f'{tag}-event')
            await pg.click('#evChoices button >> nth=0'); await pg.wait_for_timeout(800)
            if n == 1: await shot(f'{tag}-event-outcome')
            await pg.evaluate("()=>{const b=document.getElementById('evGo');if(b&&!document.getElementById('eventScreen').hidden)b.click()}"); continue
        if await pg.evaluate(VIS, 'simNext'):
            await pg.click('#simNext'); await pg.wait_for_timeout(1500)
            await shot(f'{tag}-what-happened'); await pg.click('#whNext'); await pg.wait_for_timeout(2500)
            return n
        await pg.evaluate("()=>{const b=document.getElementById('simSkip');if(!b.hidden)b.click()}")


async def main():
    w, h = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (1366, 768)
    test_html = ROOT / 'dist' / 'test.html'
    if not test_html.exists():
        sys.exit('dist/test.html not found. Run: npm run build:test')
    OUT.mkdir(parents=True, exist_ok=True)
    page_file = OUT / 'page.html'
    page_file.write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + test_html.read_text() + '</body></html>')
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': w, 'height': h})
        pg.set_default_timeout(int(sys.argv[3]) if len(sys.argv) > 3 else 300000)
        errs = []
        pg.on('pageerror', lambda e: errs.append(e.stack[:600] if e.stack else str(e)))
        shot = lambda name: pg.screenshot(path=str(OUT / f'{name}.png'))
        try:
            score, n2, n3 = await steps(pg, shot)
        except Exception:
            print('PAGE ERRORS so far:\n' + '\n'.join(errs)); raise
        await b.close()
    print('Events answered: Level 2 jump', n2, '· final run', n3)
    print('Final SDG score shown:', score)
    print('Screenshots in', OUT)
    if errs:
        print('PAGE ERRORS:\n' + '\n'.join(errs)); sys.exit(1)
    print('No page errors.')


async def steps(pg, shot):
        await pg.goto((OUT / 'page.html').as_uri()); await pg.wait_for_timeout(3000)
        await shot('0-start')
        await pg.click('#startSdg'); await pg.wait_for_timeout(800); await shot('0b-sdg-page'); await pg.click('#sdgClose')
        await pg.fill('#teamName', 'Test Team'); await pg.fill('#teamRoll', '23CSB0A12'); await pg.fill('#teamPhone', '98765 43210')
        await pg.click('#startGo'); await pg.wait_for_timeout(4000)
        await shot('1a-guide')
        await pg.click('#guideSkip')
        await pg.evaluate(PUT, [['foodFarm', 6], ['coalPlant', 1, 2], ['goldFactory', 1, 1], ['cashFarm', 1]])
        # pick the coal factory tool and hover a coal block to show the size/path picker
        await pg.evaluate("""()=>{const t=window.__t,S=t.S;document.querySelector('[data-tab=energy]').click();
          setTimeout(()=>{document.querySelector('[data-type=coalPlant]').click();const i=S.tiles.findIndex(x=>x.t==='coal'&&!x.b&&t.E.inLevel(1,x.x,x.y));t.ui.size=2;t.setHover(i);},100)}""")
        await pg.wait_for_timeout(2500); await shot('1b-level1-factory-picker')
        await pg.evaluate("""()=>{const t=window.__t,S=t.S;t.ui.tool=null;const i=S.tiles.findIndex(x=>x.dep&&!x.b&&t.E.inLevel(1,x.x,x.y));t.clickTile(i);}""")
        await pg.wait_for_timeout(1500); await shot('1c-level1-block-info')
        await pg.evaluate(FINISH); await pg.wait_for_timeout(1500)
        await run_jump(pg, shot, '2')
        await pg.evaluate(PUT, [['solar', 3], ['dam', 1], ['apartment', 1], ['community', 2], ['school', 1], ['waterPlant', 1], ['foodFarm', 3], ['road', 8], ['wind', 2]])
        # open a hut and a coal factory: upgrade cards
        await pg.evaluate("""()=>{const t=window.__t,S=t.S;const h=Object.values(S.buildings).find(b=>b.type==='hut');t.E.upgrade(S,h.id,'solar');
          const f=Object.values(S.buildings).find(b=>b.type==='coalPlant');t.ui.tool=null;t.clickTile(f.tiles[0]);}""")
        await pg.wait_for_timeout(2500); await shot('3-level2-upgrade-cards')
        await pg.evaluate(FINISH); await pg.wait_for_timeout(1500)
        n2 = await run_jump(pg, shot, '4')
        await pg.evaluate(PUT, [['battery', 1], ['granary', 2], ['hospital', 1], ['itPark', 1], ['forest', 8], ['foodFarm', 2], ['wind', 2], ['recycling', 1], ['waterPlant', 1], ['park', 2], ['road', 6]])
        await pg.wait_for_timeout(3000); await shot('5-level3')
        await pg.evaluate(FINISH); await pg.wait_for_timeout(1500)
        n3 = await run_jump(pg, shot, '6')
        await pg.wait_for_timeout(2000); await shot('7-result')
        score = await pg.evaluate("()=>document.querySelector('#resRing text').textContent")
        return score, n2, n3


asyncio.run(main())
