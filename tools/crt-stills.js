#!/usr/bin/env node
'use strict';

// Render fixed reference frames through the browser presentation filter's CRT
// presets and save the output canvas at device resolution.
//
//   node tools/crt-stills.js --frames=sc.png,notepad.png,q2.png --out=DIR \
//        [--presets=off,vga,arcade] [--modes=1280x960@1,900x675@1,800x600@2,1111x777@1.5] \
//        [--curvature] [--headful]
//
// Each frame is a native guest frame (640x480, 320x240, ...). For every mode
// (CSS width x height @ devicePixelRatio) the page sizes an output canvas the
// way index.html does -- backing store = CSS size x DPR -- letterboxes the
// frame into it aspect-fit, and calls PresentationFilter.present() with the
// preset. "off" is the nearest-fit reference. The saved PNG is the canvas's
// own pixels (toDataURL), one per device pixel, so what is inspected is what
// the display is handed, not a screenshot the compositor resampled.
//
// summary.json records, per still, the filter's backend/lastCrt report and
// the mean linear-light luminance of the picture rectangle, plus its ratio to
// the "off" still of the same frame and mode: a CRT preset should land near
// 1.0 (brightness preserved), not visibly darker.
//
// No server and no emulator: the filter is injected into about:blank, so this
// checks the filter alone. Use tools/web-input-probe.js for the real page.
// --headful uses the real GPU (one visible Chrome; coordinate on the board).

const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function arg(name, fallback) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const flag = name => process.argv.includes(`--${name}`);

const FRAMES = (arg('frames', '') || '').split(',').filter(Boolean);
const OUT = arg('out', null);
const PRESETS = arg('presets', 'off,vga,arcade').split(',').filter(Boolean);
const MODES = arg('modes', '1280x960@1,900x675@1,800x600@2,1111x777@1.5').split(',')
  .map(text => {
    const m = /^(\d+)x(\d+)@([\d.]+)$/.exec(text);
    if (!m) throw new Error(`bad mode ${text}; want WxH@DPR`);
    return { width: +m[1], height: +m[2], dpr: +m[3] };
  });
const CURVATURE = flag('curvature');
const HEADFUL = flag('headful');

if (!FRAMES.length || !OUT) {
  console.error('usage: node tools/crt-stills.js --frames=a.png[,b.png] --out=DIR [--presets=..] [--modes=WxH@DPR,..] [--curvature] [--headful]');
  process.exit(2);
}

// Runs in the page: one still.
async function renderStill(frameUrl, mode, preset, curvature) {
  const image = new Image();
  image.src = frameUrl;
  await image.decode();
  const source = document.createElement('canvas');
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  source.getContext('2d').drawImage(image, 0, 0);

  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;background:#000';
  const output = document.createElement('canvas');
  output.style.cssText = `display:block;width:${mode.width}px;height:${mode.height}px`;
  document.body.appendChild(output);
  const backingW = Math.round(mode.width * devicePixelRatio);
  const backingH = Math.round(mode.height * devicePixelRatio);
  const filter = new presentationFilter.PresentationFilter(output);
  filter.resize(backingW, backingH);
  const scale = Math.min(backingW / source.width, backingH / source.height);
  const dstW = Math.round(source.width * scale);
  const dstH = Math.round(source.height * scale);
  const viewport = {
    cropX: 0, cropY: 0, cropW: source.width, cropH: source.height,
    nativeW: source.width, nativeH: source.height,
    dstX: Math.floor((backingW - dstW) / 2), dstY: Math.floor((backingH - dstH) / 2),
    dstW, dstH, outputW: backingW, outputH: backingH,
    multiplier: Math.floor(scale), background: '#000000',
  };
  filter.present(source, 'nearest', { preset, curvature }, { viewport });
  const pixels = output.getContext('2d').getImageData(viewport.dstX, viewport.dstY, dstW, dstH).data;
  const lut = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    lut[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  let sum = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    sum += 0.2126 * lut[pixels[i]] + 0.7152 * lut[pixels[i + 1]] + 0.0722 * lut[pixels[i + 2]];
  }
  return {
    png: output.toDataURL('image/png'),
    backing: [backingW, backingH],
    viewport: [viewport.dstX, viewport.dstY, dstW, dstH],
    devicePixelScale: filter._devicePixelScale(),
    backend: filter.lastBackend,
    crt: filter.lastCrt,
    error: filter.lastError ? String(filter.lastError.message || filter.lastError) : null,
    meanLinearLuminance: sum / (pixels.length / 4),
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const filterSource = fs.readFileSync(path.join(ROOT, 'lib', 'presentation-filter.js'), 'utf8');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-crt-stills-'));
  const browser = await puppeteer.launch({
    headless: !HEADFUL,
    executablePath: CHROME,
    userDataDir: profile,
    timeout: 30000,
    args: ['--no-sandbox', '--no-first-run', '--no-default-browser-check'].concat(
      HEADFUL ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
  });
  const summary = { headful: HEADFUL, chrome: await browser.version(), curvature: CURVATURE, stills: [] };
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => console.error('pageerror', error.message));
    summary.renderer = null;
    for (const mode of MODES) {
      await page.setViewport({ width: mode.width, height: mode.height, deviceScaleFactor: mode.dpr });
      await page.goto('about:blank');
      await page.addScriptTag({ content: filterSource });
      if (!summary.renderer) {
        summary.renderer = await page.evaluate(() => {
          const gl = document.createElement('canvas').getContext('webgl');
          const info = gl && gl.getExtension('WEBGL_debug_renderer_info');
          return gl ? (info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'no webgl';
        });
      }
      for (const file of FRAMES) {
        const frameUrl = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
        const base = path.basename(file, path.extname(file));
        const offMean = {};
        for (const preset of PRESETS) {
          const result = await page.evaluate(renderStill, frameUrl, mode, preset, CURVATURE);
          const name = `${base}-${preset}${CURVATURE ? '-curve' : ''}-${mode.width}x${mode.height}@${mode.dpr}.png`;
          fs.writeFileSync(path.join(OUT, name),
            Buffer.from(result.png.slice(result.png.indexOf(',') + 1), 'base64'));
          delete result.png;
          if (preset === 'off') offMean.value = result.meanLinearLuminance;
          const record = Object.assign({ file: name, frame: base, preset, mode }, result,
            offMean.value ? { brightnessVsOff: +(result.meanLinearLuminance / offMean.value).toFixed(3) } : {});
          summary.stills.push(record);
          console.log(`${name}  ${record.backend}  mask=${record.crt ? record.crt.mask : '-'}` +
            `  lines=${record.crt ? record.crt.lines : '-'}  vsOff=${record.brightnessVsOff || '-'}` +
            `${record.error ? `  error=${record.error}` : ''}`);
        }
      }
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
