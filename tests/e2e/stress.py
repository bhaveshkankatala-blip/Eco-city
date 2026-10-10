"""Stress test: real mouse/keyboard play, several games in a row, GL object + heap tracking.
usage: python stress.py <html> <games> <sandbox 0/1> <w> <h>"""
import asyncio, sys, random, json, time
from pathlib import Path
from playwright.async_api import async_playwright
HTML, GAMES, SANDBOX = sys.argv[1], int(sys.argv[2]), sys.argv[3] == '1'
W, H = int(sys.argv[4]), int(sys.argv[5])
SP = Path(__file__).parent
INIT = """(()=>{const P=WebGL2RenderingContext.prototype;window.__gl={};
for(const [c,d,k] of [['createBuffer','deleteBuffer','buf'],['createVertexArray','deleteVertexArray','vao'],['createTexture','deleteTexture','tex'],['createFramebuffer','deleteFramebuffer','fbo'],['createProgram','deleteProgram','prog']]){
 const oc=P[c],od=P[d];P[c]=function(){window.__gl[k]=(window.__gl[k]||0)+1;return oc.apply(this,arguments)};P[d]=function(o){if(o)window.__gl[k]=(window.__gl[k]||0)-1;return od.apply(this,arguments)};}
})();"""
random.seed(7)
async def main():
    t0 = time.time()
    page_html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + Path(HTML).read_text() + '</body></html>'
    (SP / 'game.html').write_text(page_html)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'])
        ctx = await b.new_context(viewport={'width': W, 'height': H})
        await ctx.add_init_script(INIT)
        pg = await ctx.new_page(); pg.set_default_timeout(180000)
        errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + (e.stack or str(e))[:500]))
        pg.on('console', lambda m: errs.append('CONSOLE ' + m.text[:300]) if m.type in ('error', 'warning') and 'GL Driver' not in m.text and 'ERR_TUNNEL' not in m.text and 'Failed to load resource' not in m.text else None)
        if SANDBOX:
            (SP / 'host.html').write_text('<!doctype html><html><body style="margin:0"><iframe id="f" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh" src="game.html"></iframe></body></html>')
            await pg.goto((SP / 'host.html').as_uri())
            await pg.wait_for_timeout(3000)
            fr = pg.frames[1]
        else:
            await pg.goto((SP / 'game.html').as_uri()); fr = pg.main_frame
        await pg.wait_for_timeout(3000)
        async def vis(id): return await fr.evaluate("(id)=>{const e=document.getElementById(id);return !!e&&!e.hidden&&e.offsetParent!==null}", id)
        async def stats(tag):
            s = await fr.evaluate("()=>({gl:window.__gl,heap:performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):0,dom:document.getElementsByTagName('*').length,tags:document.getElementById('tags').children.length})")
            print(f'[{time.time()-t0:6.0f}s] {tag}: {json.dumps(s)}', flush=True)
        async def click_map(n, btn='left'):
            box = await pg.locator('iframe').bounding_box() if SANDBOX else {'x': 0, 'y': 0}
            for _ in range(n):
                x = random.randint(int(W * .25), int(W * .75)); y = random.randint(int(H * .2), int(H * .7))
                await pg.mouse.move(x + box['x'], y + box['y'], steps=3)
                await pg.mouse.click(x + box['x'], y + box['y'], button=btn)
        async def play_level(lv):
            tabs = await fr.evaluate("()=>[...document.querySelectorAll('#tabs [data-tab]')].map(b=>b.dataset.tab)")
            for k in range(8):
                tab = random.choice(tabs)
                await fr.click(f'#tabs [data-tab={tab}]')
                cards = await fr.evaluate("()=>[...document.querySelectorAll('#cards .card:not(.locked)')].map(c=>c.dataset.type)")
                if not cards: continue
                await fr.click(f'#cards [data-type={random.choice(cards)}]')
                if await vis('fpick'):
                    sizes = await fr.evaluate("()=>[...document.querySelectorAll('#fpSizes button:not(:disabled)')].length")
                    if sizes: await fr.click(f'#fpSizes button >> nth={random.randrange(sizes)}')
                    await fr.evaluate("()=>document.getElementById('fpNext').click()")
                await click_map(4)
                await pg.keyboard.press(random.choice(['q', 'e', 'w', 'a', '+', '-', 'Escape']))
            # inspect things and press upgrade/install buttons
            await fr.evaluate("()=>{document.querySelector('[data-tab=tools]').click()}"); await fr.click('#cards [data-type=inspect]')
            for k in range(8):
                await click_map(1)
                if await vis('inspector'):
                    n = await fr.evaluate("()=>document.querySelectorAll('#inspector [data-up]').length")
                    if n: await fr.click('#inspector [data-up] >> nth=0')
                    if await fr.evaluate("()=>!!document.getElementById('wk')"):
                        await fr.evaluate("()=>{const w=document.getElementById('wk');w.value=w.min;w.dispatchEvent(new Event('input'))}")
            await pg.mouse.wheel(0, -400); await pg.mouse.wheel(0, 300)
            if await vis('minimap'): await fr.click('#minimap')
            await stats(f'level {lv} built')
        async def run_jump(tag, timeout_one):
            await fr.evaluate("()=>document.getElementById('simSkip').click()")
            n = 0
            for _ in range(400):
                await pg.wait_for_timeout(1000)
                if await vis('eventScreen'):
                    n += 1
                    if timeout_one and n == 1:
                        print('  letting an event time out…', flush=True)
                        for _ in range(200):
                            await pg.wait_for_timeout(1000)
                            if not await vis('eventScreen'): break
                        continue
                    k = await fr.evaluate("()=>document.querySelectorAll('#evChoices button').length")
                    await fr.click(f'#evChoices button >> nth={random.randrange(k)}'); continue
                if await vis('whatScreen'):
                    await fr.click('#whNext'); await pg.wait_for_timeout(1500); return n
                if await vis('simNext'):
                    await fr.click('#simNext'); continue
                await fr.evaluate("()=>{const b=document.getElementById('simSkip');if(!b.hidden)b.click()}")
            raise Exception('jump never finished ' + tag)
        try:
          await games(fr, pg, vis, stats, play_level, run_jump)
        except Exception as ex:
          print('HARNESS STOPPED:', str(ex)[:400]); await pg.screenshot(path=str(SP / 'stopped.png'))
        print('ERRORS:' if errs else 'NO ERRORS'); [print(' ', e) for e in errs[:40]]
        await b.close()
async def games(fr, pg, vis, stats, play_level, run_jump):
        for g in range(GAMES):
            await fr.fill('#teamName', f'Stress {g}'); await fr.fill('#teamRoll', f'R{g}'); await fr.fill('#teamPhone', '9876543210')
            await fr.click('#startGo'); await pg.wait_for_timeout(3000)
            if await vis('guide'):
                for _ in range(4):
                    if await vis('guide'): await fr.click('#guideNext')
            await stats(f'game {g} start')
            for lv in (1, 2, 3):
                await play_level(lv)
                await fr.click('#finishBtn'); await fr.click('#cfYes'); await pg.wait_for_timeout(1500)
                n = await run_jump(f'g{g}l{lv}', timeout_one=(g == 0 and lv == 2))
                print(f'  game {g} level {lv} jump done, events {n}', flush=True)
                if await vis('resultScreen'): break
            await pg.wait_for_timeout(2000)
            score = await fr.evaluate("()=>document.querySelector('#resRing text')?.textContent")
            await pg.screenshot(path=str(SP / f'result{g}.png'))
            print(f'  game {g} result: {score}', flush=True)
            await fr.click('#resDone'); await pg.wait_for_timeout(3000)
            await stats(f'game {g} back at start')
            if g == 0:  # resize like a window snap
                await pg.set_viewport_size({'width': 1280, 'height': 720}); await pg.wait_for_timeout(1500); await pg.set_viewport_size({'width': W, 'height': H}); await pg.wait_for_timeout(1500)
        # GPU reset (driver crash / sleep): does the game come back?
        await fr.evaluate("()=>{window.__lost=document.getElementById('map').getContext('webgl2').getExtension('WEBGL_lose_context');window.__lost.loseContext()}")
        await pg.wait_for_timeout(2000)
        await fr.evaluate("()=>window.__lost.restoreContext()"); await pg.wait_for_timeout(5000)
        await pg.screenshot(path=str(SP / 'after-context-loss.png'))
        await stats('after context loss')
asyncio.run(main())
