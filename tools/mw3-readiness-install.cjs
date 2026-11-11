'use strict';
// Prepare the existing ordinary controller's small inputs; no launch, input,
// allocation, admission change or deadline change. Pin outputs before use.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function once(text, old, replacement) {
  assert.equal(text.split(old).length, 2, 'exact retained controller anchor required: ' + old);
  return text.replace(old, replacement);
}

function prefix(source) {
  const a = source.indexOf('const attachDispatch=');
  const b = source.indexOf(',request=function', a);
  assert(a >= 0 && b > a, 'serialized dispatch observer required');
  source = source.slice(0, a) + 'const attachDispatch=' +
    require('./mw3-live-mouse-observation.cjs').attachDispatch +
    ',sample=' + require('./mw3-menu-poll-decision.cjs').sample +
    ',attachKeyboard=' + require('./mw3-keyboard-readiness.cjs').attach +
    ',readKeyboard=' + require('./mw3-keyboard-completion.js').readCompletion + source.slice(b);
  return once(source, 'request,completion,decision:sample,layout:',
    'request,completion,decision:sample,keyboard:{attach:attachKeyboard,sample,readCompletion:readKeyboard},layout:');
}

function prepare(source, destination) {
  source = path.resolve(source); destination = path.resolve(destination);
  assert.notEqual(source, destination);
  assert(fs.statSync(destination).isDirectory());
  const browser = once(fs.readFileSync(path.join(source, 'browser.cjs'), 'utf8'),
    JSON.stringify(path.join(source, 'worker-prefix.js')).slice(1, -1),
    path.join(destination, 'worker-prefix.js'));
  // Persist before identity checks and validation, including decoder failures.
  let observer = fs.readFileSync(path.join(source, 'dispatch-observer.cjs'), 'utf8');
  observer = once(observer, "save('dispatch-last-snapshot.json',v);",
    "save('dispatch-last-snapshot.json',v);save('keyboard-readiness-last.json',{identity,keyboard:v.keyboard});");
  observer = once(observer, "save('dispatch-trace-'+Date.now()+'.json',v);",
    "save('dispatch-trace-'+Date.now()+'.json',v);save('keyboard-readiness-final.json',{identity,keyboard:v.keyboard});");
  const outputs = {'browser.cjs': browser, 'dispatch-observer.cjs': observer,
    'worker-prefix.js': prefix(fs.readFileSync(path.join(source, 'worker-prefix.js'), 'utf8'))};
  // Refuse collisions before writing any prepared input.
  for (const name of Object.keys(outputs)) assert(!fs.existsSync(path.join(destination, name)), name + ' exists');
  for (const [name, text] of Object.entries(outputs)) fs.writeFileSync(path.join(destination, name), text, {flag: 'wx'});
  return Object.keys(outputs);
}

module.exports = {prefix, prepare};
if (require.main === module) {
  assert.equal(process.argv.length, 4, 'usage: node tools/mw3-readiness-install.cjs RETAINED_0500 OWNED_RUN');
  prepare(process.argv[2], process.argv[3]);
}
