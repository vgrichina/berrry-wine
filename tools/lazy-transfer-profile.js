'use strict';

// Diagnostic-only source transform. Never installed in the shipping renderer.
module.exports = function instrument(source, timeline = false) {
  const replace = (from, to) => {
    if (source.split(from).length !== 2) throw Error('Transfer profile seam changed: ' + from);
    source = source.replace(from, to);
  };
  replace('drawMs: 0, submitMs: 0, syncMs: 0, uploadMs: 0, textureMs: 0,',
    'drawMs: 0, submitMs: 0, syncMs: 0, uploadMs: 0, textureMs: 0, readPixelsMs: 0, readConvertMs: 0, readMaintenanceMs: 0, uploadConvertMs: 0, uploadGlMs: 0, uploadMaintenanceMs: 0,');
  replace('_upload(t, bytes, pitch, top, bottom) {', '_upload(t, bytes, pitch, top, bottom) {\n      const profileStart = now();');
  const upload = 't.device.gpu.updateColorResource(null, out, { x: 0, y: top, width, height: rows });';
  replace(upload, 'const profileConverted = now();\n      ' + upload + '\n      const profileUploaded = now();');
  replace('else t.shadow = bytes.slice();', `else t.shadow = bytes.slice();
      this.stats.uploadConvertMs += profileConverted - profileStart;
      this.stats.uploadGlMs += profileUploaded - profileConverted;
      this.stats.uploadMaintenanceMs += now() - profileUploaded;`);
  const read = 'gl.readPixels(left, height - bottom, readWidth, readHeight, gl.RGBA, gl.UNSIGNED_BYTE, read);';
  replace(read, 'const profileReadStart = now();\n        ' + read + '\n        const profileReadEnd = now();');
  replace('const rowBytes = readWidth * (t.bpp >> 3), first = top * pitch + left * (t.bpp >> 3);',
    'const profileConverted = now();\n        const rowBytes = readWidth * (t.bpp >> 3), first = top * pitch + left * (t.bpp >> 3);');
  replace('this.stats.syncMs += now() - start;', `this.stats.readPixelsMs += profileReadEnd - profileReadStart;
        this.stats.readConvertMs += profileConverted - profileReadEnd;
        this.stats.readMaintenanceMs += now() - profileConverted;
        this.stats.syncMs += now() - start;`);
  if (timeline) {
    const record = (kind, start, end) => `
      { const spans = globalThis.__wholeRenderSpans ||= [];
        if (spans.length >= 200000) throw Error('render span recorder overflow');
        spans.push(['${kind}', performance.timeOrigin + ${start}, performance.timeOrigin + ${end}]); }
    `;
    replace('const profileReadEnd = now();', 'const profileReadEnd = now();' + record('readPixels','profileReadStart','profileReadEnd'));
    replace('const profileUploaded = now();', 'const profileUploaded = now();' + record('uploadGL','profileConverted','profileUploaded'));
  }
  return source;
};
