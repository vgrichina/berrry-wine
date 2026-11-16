// Page probe: which D3DIM executor every running app actually drew with.
// WebGL is the default, but a device with no WebGL (or a headless Chrome
// without --gpu) silently keeps the software rasterizer, and the picture
// alone cannot tell the two apart. GPU stream v2: the WAT producer
// (src/09abg-d3dim-gps.wat) counts its own work; `stats` is d3dim_gps_stat:
// `draws` GPU draws, `fallbacks` draws/clears sent to software, readbacks by
// CPU-access site, readback bytes and declines by reason (same layout as
// test/run.js --d3dim-gpu). In Threads mode the live instance is the Worker's.
//   node tools/web-input-probe.js --app=scr_jazz --gpu \
//     --steps="wait:40000;evalfile:tools/page-probes/read-d3dim-gpu.js;shot:/tmp/jazz.png"
(async function () {
  var apps = typeof runningApps !== 'undefined' ? runningApps : [];
  var sites = ['global', 'getDC', 'bltSrc', 'bltDst', 'lock', 'texLoad', 'swDraw', 'release', 'cpuPresent',
    'parkLand', 'prepare', 'texFromRT', 'retarget', 'capture', 'lazy', 'other'];
  var why = ['unused0', 'texture', 'zfunc', 'blendFactor', 'noDepth', 'clearTarget', 'clearBackground', 'unused7'];
  var out = [];
  for (var a = 0; a < apps.length; a++) {
    var wine = apps[a].wine, gpu = wine && wine.d3dimGpu, stats = null;
    var ex = wine && wine.instance && wine.instance.exports;
    var stat = wine && wine.guestWorker ? function (i) { return wine.guestWorker.callExport('d3dim_gps_stat', i); }
      : ex && ex.d3dim_gps_stat ? function (i) { return ex.d3dim_gps_stat(i); } : null;
    if (gpu && stat) {
      var v = [];
      for (var i = 0; i < 43; i++) v.push((await stat(i)) >>> 0);
      stats = { draws: v[0], fallbacks: v[1], readbacks: v[2], flips: v[10], readbackBytes: v[34], sites: {}, declines: {} };
      sites.forEach(function (n, k) { stats.sites[n] = v[16 + k]; });
      why.forEach(function (n, k) { stats.declines[n] = v[35 + k]; });
    }
    out.push({ name: apps[a].name, webglRequested: window.WINE_D3DIM_GPU === true,
      executor: gpu ? 'gpu-stream-v2' : 'software', stats: stats });
  }
  return JSON.stringify(out);
})();
