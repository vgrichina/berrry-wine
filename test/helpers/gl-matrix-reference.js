'use strict';
// The reference matrix math of the retired JS GL frontend (lib/gl-compat.js,
// deleted with gl-retire; last at 3eea041c5), kept verbatim because the WAT
// matrix mirror in src/09a8f-gl-matrix.wat was made to match it bit for bit
// and its tests still check that. Float32 column-major, as GL stores them.
function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] +
        a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function frustum(l, r, b, t, n, f) {
  const out = new Float32Array(16);
  out[0] = 2 * n / (r - l); out[5] = 2 * n / (t - b);
  out[8] = (r + l) / (r - l); out[9] = (t + b) / (t - b);
  out[10] = -(f + n) / (f - n); out[11] = -1;
  out[14] = -(2 * f * n) / (f - n);
  return out;
}
function ortho(l, r, b, t, n, f) {
  const out = identity();
  out[0] = 2 / (r - l); out[5] = 2 / (t - b); out[10] = -2 / (f - n);
  out[12] = -(r + l) / (r - l); out[13] = -(t + b) / (t - b);
  out[14] = -(f + n) / (f - n);
  return out;
}
function perspective(fovy, aspect, nearValue, farValue) {
  const radians = fovy * Math.PI / 360;
  const top = nearValue * Math.tan(radians);
  const right = top * aspect;
  return frustum(-right, right, -top, top, nearValue, farValue);
}
function lookAt(eyeX, eyeY, eyeZ, centerX, centerY, centerZ, upX, upY, upZ) {
  let fx = centerX - eyeX, fy = centerY - eyeY, fz = centerZ - eyeZ;
  let length = Math.hypot(fx, fy, fz) || 1;
  fx /= length; fy /= length; fz /= length;
  let sx = fy * upZ - fz * upY;
  let sy = fz * upX - fx * upZ;
  let sz = fx * upY - fy * upX;
  length = Math.hypot(sx, sy, sz) || 1;
  sx /= length; sy /= length; sz /= length;
  const ux = sy * fz - sz * fy;
  const uy = sz * fx - sx * fz;
  const uz = sx * fy - sy * fx;
  return new Float32Array([
    sx, ux, -fx, 0,
    sy, uy, -fy, 0,
    sz, uz, -fz, 0,
    -(sx * eyeX + sy * eyeY + sz * eyeZ),
    -(ux * eyeX + uy * eyeY + uz * eyeZ),
    fx * eyeX + fy * eyeY + fz * eyeZ,
    1,
  ]);
}


module.exports = { identity, multiply, frustum, ortho, perspective, lookAt };
