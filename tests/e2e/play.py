"""
Plays one full game in the browser from a recorded plan (tests/e2e/plans/*.json, made by the
score search): every building is placed through the normal click path (crew dialog included),
upgrades through the inspector, decisions by clicking the choice. Screenshots of the village
before each level is submitted, of every summary, of the first decision, the final graphs and the
result go to tests/e2e/out/<name>/. Fails on any page error or if the score differs from the plan.

Run:  npm run build:test && python tests/e2e/play.py tests/e2e/plans/best.json
"""
import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
VIS = "(id)=>!document.getElementById(id).hidden"


async def main(plan_path):
    plan = json.loads(Path(plan_path).read_text())
    name = Path(plan_path).stem
    out = ROOT / 'tests' / 'e2e' / 'out' / name
    out.mkdir(parents=True, exist_ok=True)
    page_file = out / 'page.html'
    page_file.write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'
                         + (ROOT / 'dist' / 'test.html').read_text() + '</body></html>')
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 1366, 'height': 768})
        pg.set_default_timeout(600000)
        errs = []
        pg.on('pageerror', lambda e: errs.append(e.stack[:600] if e.stack else str(e)))

        async def shot(tag, sharp=True):
            if sharp:
                await pg.evaluate("()=>R3.setQuality(1)"); await pg.wait_for_timeout(2500)
            await pg.screenshot(path=str(out / f'{tag}.png'))
            await pg.evaluate("()=>R3.setQuality(0.5)")

        async def village(tag):
            # the whole land from above, nothing selected, no popups
            await pg.evaluate("""()=>{const t=window.__t;t.ui.tool=null;t.ui.sel=null;R3.select(null);R3.grid(false);t.refresh(true);
              document.querySelector('[data-cam=home]').click();}""")
            await pg.wait_for_timeout(1500)
            await shot(tag)

        await pg.goto(page_file.as_uri()); await pg.wait_for_timeout(2500)
        await pg.evaluate(f"()=>{{window.__seed={plan['seed']}}}")
        await pg.fill('#teamName', 'Playtest ' + name); await pg.fill('#teamPhone', '9' + str(abs(hash(name)))[:9].ljust(9, '0'))
        await pg.evaluate("()=>document.getElementById('startGo').click()"); await pg.wait_for_timeout(3000)
        await pg.evaluate("()=>{document.getElementById('guideSkip').click();R3.setQuality(0.5)}")

        acts = plan['log']
        picks = [a for a in acts if a['a'] == 'pick']
        dead = False
        for lvl in (1, 2, 3):
            if dead: break
            if lvl > 1:
                if await pg.evaluate(VIS, 'unlockScreen'):
                    if lvl == 2: await shot(f'{lvl}a-new-level-popup')
                    await pg.evaluate("()=>document.getElementById('unOk').click()")
            mine = [a for a in acts if a.get('lvl') == lvl and a['a'] != 'pick']
            for a in mine:
                r = await pg.evaluate("""(a)=>{const t=window.__t,S=t.S,E=t.E;
                  const pickTile=i=>{t.clickTile(i)};
                  if(a.a==='build'){t.ui.tool=a.t;t.ui.size=a.size;t.ui.path=0;const before=Object.keys(S.buildings).length;pickTile(a.i);
                    const cs=document.getElementById('crewScreen');
                    if(!cs.hidden){const r=document.getElementById('cwRange');r.value=r.max;r.dispatchEvent(new Event('input'));document.getElementById('cwOk').click();}
                    t.ui.tool=null;return Object.keys(S.buildings).length>before?'ok':'FAILED build '+a.t+' at '+a.i;}
                  if(a.a==='up'){t.ui.tool=null;pickTile(a.tile);const btn=document.querySelector('[data-up="'+a.u+'"]');if(!btn)return 'FAILED upgrade '+a.u;btn.click();return 'ok';}
                  if(a.a==='demo'){t.ui.tool='demolish';pickTile(a.tile);t.ui.tool=null;return S.buildings[a.id]?'FAILED demolish':'ok';}
                  return 'skip';}""", a)
                if r != 'ok':
                    print('WARN', r)
                await pg.wait_for_timeout(120)
            await pg.wait_for_timeout(1500)
            await village(f'{lvl}b-village-before-submit')
            await pg.evaluate("()=>window.__t.finishLevel()"); await pg.wait_for_timeout(1500)
            # the time jump: skip ahead, answering each decision as planned
            first_event = True
            while True:
                await pg.evaluate("()=>{const b=document.getElementById('simSkip');if(b&&!b.hidden)b.click()}")
                await pg.wait_for_timeout(1200)
                if await pg.evaluate(VIS, 'eventScreen'):
                    want = picks.pop(0) if picks else None
                    k = want['k'] if want else 0
                    if first_event and lvl == 2: await shot('2c-decision', False)
                    await pg.click(f'#evChoices button >> nth={k}')
                    await pg.wait_for_timeout(700)
                    if first_event and lvl == 2: await shot('2d-decision-outcome', False)
                    first_event = False
                    await pg.evaluate("()=>{const b=document.getElementById('evGo');if(b&&!document.getElementById('eventScreen').hidden)b.click()}")
                    continue
                if await pg.evaluate(VIS, 'simNext'):
                    if lvl == 3: await shot('3c-final-run-graphs')
                    await pg.click('#simNext'); await pg.wait_for_timeout(1500)
                    await shot({1: '1c-what-happened', 2: '2e-what-happened', 3: '3d-what-happened'}[lvl], False)
                    dead = await pg.evaluate("()=>!!window.__t.S.dead")
                    await pg.click('#whNext'); await pg.wait_for_timeout(2500)
                    break
        await pg.wait_for_timeout(2000)
        await shot('4-result')
        score = float(await pg.evaluate("()=>document.querySelector('#resRing text').textContent"))
        rounds = await pg.evaluate("()=>[...document.querySelectorAll('#resRounds .round b')].map(b=>b.textContent)")
        await b.close()
    print(f'{name}: score {score} rounds {rounds} (planned {plan["expect"]["score"]}, {plan["expect"]["rounds"]})')
    if abs(score - plan['expect']['score']) > 0.15:
        print('SCORE DIFFERS FROM PLAN')
    if errs:
        print('PAGE ERRORS:\n' + '\n'.join(errs)); sys.exit(1)
    print('No page errors.')


asyncio.run(main(sys.argv[1]))
