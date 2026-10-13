'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const { PNG } = require('pngjs');
const pause = ms => new Promise(r => setTimeout(r, ms));
module.exports = async function route(page, output) {
  const shot = async name => {
    await page.screenshot({ path: path.join(output, `route-${name}.png`) });
    const windows = await page.evaluate(() => Object.values(sharedRenderer.windows).filter(w => w?.visible)
      .map(w => ({ title:w.title, className:w.className, x:w.x,y:w.y,width:w.width,height:w.height })));
    fs.writeFileSync(path.join(output, `route-${name}.json`), JSON.stringify(windows, null, 2));
    console.log('AoE2 route', name, JSON.stringify(windows));
    assert(!windows.some(w => w.title === 'Error'), `AoE2 error dialog at ${name}; inspect capture and console`);
  };
  const click = async (x,y) => {
    const p = await page.evaluate(([x,y]) => {
      const c = document.getElementById('screen'), b = c.getBoundingClientRect();
      const v = sharedRenderer._exclusivePresentationViewport;
      if (v?.nativeW) {
        x = (v.dstX + (x-v.nativeX)*v.dstW/v.nativeW)*c.width/v.outputW;
        y = (v.dstY + (y-v.nativeY)*v.dstH/v.nativeH)*c.height/v.outputH;
      }
      return {x:b.left+x*b.width/c.width, y:b.top+y*b.height/c.height};
    },[x,y]);
    await page.mouse.click(p.x,p.y,{delay:150}); await pause(3000);
  };
  await shot('eula');
  await click(162,432);
  await page.waitForFunction(() => !Object.values(sharedRenderer.windows).some(w => w?.visible && /End User License/.test(w.title)), {timeout:30000});
  await pause(12000); await shot('menu');
  await click(363,31); await shot('new-player');
  await click(419,300); await page.keyboard.type('Codex',{delay:150}); await pause(1000); await shot('typed-name');
  await click(324,355); await shot('single-player');
  await click(608,170); await shot('random-map');
  await click(119,569); await shot('map-choice');
  await click(300,568); await pause(30000); await shot('gameplay');
  const png = PNG.sync.read(Buffer.from(await (await page.$('#screen')).screenshot()));
  let green = 0;
  for(let i=0;i<png.data.length;i+=4) {
    const [r,g,b] = png.data.subarray(i,i+3);
    if(g>40 && g>r*1.15 && g>b*1.15) green++;
  }
  assert(green/(png.width*png.height)>.15, 'AoE2 terrain not reached; inspect route captures');
};
