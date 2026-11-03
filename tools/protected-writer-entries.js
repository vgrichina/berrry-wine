'use strict';

// External calls must enter a wrapper, never the internal implementation. In
// particular generated ABI bridges may write their guest stack before reaching
// any shared Win32 helper. Internal calls keep their original targets.
//
// Coverage is closed over ALL function exports in the include closure, with a
// default-deny rule. New API names need no policy update. Observer admission is
// structural, not based on a get_/test_ naming convention.
function parse(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) { i++; continue; }
    if (source.startsWith(';;', i)) {
      const end = source.indexOf('\n', i); i = end < 0 ? source.length : end; continue;
    }
    if (source.startsWith('(;', i)) {
      let depth = 1; i += 2;
      while (i < source.length && depth) {
        if (source.startsWith('(;', i)) { depth++; i += 2; }
        else if (source.startsWith(';)', i)) { depth--; i += 2; }
        else i++;
      }
      if (depth) throw Error('unterminated WAT comment');
      continue;
    }
    const start = i;
    if ('()'.includes(source[i])) i++;
    else if (source[i] === '"') {
      i++;
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\') i++;
        i++;
      }
      if (i === source.length) throw Error('unterminated WAT string');
      i++;
    } else while (i < source.length && !/[\s()]/.test(source[i])) i++;
    tokens.push({ atom: source.slice(start, i), start, end: i });
  }
  let cursor = 0;
  function node() {
    const token = tokens[cursor++];
    if (!token || token.atom === ')') throw Error('invalid WAT form');
    if (token.atom !== '(') return token;
    const items = [];
    while (cursor < tokens.length && tokens[cursor].atom !== ')') items.push(node());
    if (cursor === tokens.length) throw Error('unclosed WAT form');
    return { items, start: token.start, end: tokens[cursor++].end };
  }
  const forms = [];
  while (cursor < tokens.length) forms.push(node());
  return forms;
}
const head = node => node.items && node.items[0] && node.items[0].atom;
const atom = node => node && node.atom;
const declarations = new Set(['export', 'param', 'result', 'local', 'type']);
const readonly = new Set([
  'global.get', 'local.get',
  'i32.const', 'i64.const', 'f32.const', 'f64.const',
  'i32.load', 'i32.load8_u', 'i32.load8_s', 'i32.load16_u', 'i32.load16_s',
  'i64.load', 'f32.load', 'f64.load',
  'i32.add', 'i32.sub', 'i32.mul', 'i32.and', 'i32.or', 'i32.xor',
  'i32.shl', 'i32.shr_u', 'i32.shr_s', 'i32.eq', 'i32.ne', 'i32.eqz',
  'i32.lt_u', 'i32.le_u', 'i32.gt_u', 'i32.ge_u', 'select',
  'i32.wrap_i64', 'i64.extend_i32_u', 'region.addr', 'region.end', 'region.size',
]);
function pure(node) {
  if (!node.items) return true;
  return readonly.has(head(node)) && node.items.slice(1).every(pure);
}

// compileClosure is also a public compiler adapter for small inline modules.
// Runtime identity must survive copying the closure or removing its entry tag:
// neither an absent arming global nor an option can opt the runtime out.
function isRuntimeClosure(closure) {
  if (/(^|\/)main\.watx$/.test(closure.entry || '')) return true;
  const pending = [closure.source], seen = new Set();
  while (pending.length) {
    const source = pending.pop();
    if (seen.has(source)) continue;
    seen.add(source);
    // These identifiers are runtime contracts, not arbitrary helper names.
    if (/\$rep_store_step\b|\$instruction_watch\b|\$WIN16_TASK_ENTRY\b/.test(source) ||
        /\(export\s+"(?:set_rep_store_step|set_instruction_watchpoint)"/.test(source)) return true;
    for (const m of source.matchAll(/\(include\s+"([^"]+)"\s*\)/g)) {
      if (/(^|\/)(?:main\.watx|00-regions\.wat)$/.test(m[1])) return true;
      const text = closure.vfs.get(m[1]);
      if (text !== undefined) pending.push(text);
    }
  }
  return false;
}

function protectClosure(closure) {
  const vfs = new Map(closure.vfs), inventory = [], exportsSeen = new Set();
  const included = [...closure.source.matchAll(/\(include\s+"([^"]+)"\s*\)/g)].map(m => m[1]);
  // The runtime manifest contains only includes. Reject flattened, nested or
  // augmented roots rather than silently leaving root exports unwrapped.
  let root = parse(closure.source);
  if (root.length === 1 && head(root[0]) === 'module') root = root[0].items.slice(1);
  if (!included.length || root.some(form => head(form) !== 'include')) {
    throw Error('protected runtime requires an include-only root');
  }
  // Resolve out-of-line aliases against the whole module before wrapping.
  const definitions = new Map(), external = [], normalization = new Map();
  for (const file of included) for (const form of parse(vfs.get(file))) {
    if (head(form) === 'include' || head(form) === 'module') throw Error('nested protected-entry source requires explicit policy: ' + file);
    if (head(form) === 'func' && atom(form.items[1])?.startsWith('$')) definitions.set(atom(form.items[1]), { file, form });
    if (head(form) === 'export' && head(form.items[2]) === 'func') external.push({ file, form });
  }
  const addEdit = (file, edit) => {
    if (!normalization.has(file)) normalization.set(file, []);
    normalization.get(file).push(edit);
  };
  for (const { file, form } of external) {
    const target = definitions.get(atom(form.items[2].items[1]));
    if (!target) throw Error('unresolved external function export: ' + file);
    addEdit(file, { start: form.start, end: form.end, text: '' });
    addEdit(target.file, { start: target.form.items[1].end, end: target.form.items[1].end, text: ' (export ' + atom(form.items[1]) + ')' });
  }
  for (const [file, edits] of normalization) {
    let text = vfs.get(file);
    for (const edit of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
    vfs.set(file, text);
  }
  let serial = 0, armedDefined = false;
  for (const file of included) {
    const source = vfs.get(file);
    if (source === undefined) throw Error('missing protected-entry source ' + file);
    const forms = parse(source), edits = [], wrappers = [];
    // Out-of-line function/table/global exports are rejected rather than left
    // outside the contract. The actual tree currently uses inline functions.
    for (const form of forms) {
      if (head(form) !== 'func' && form.items?.some(n => head(n) === 'export')) {
        throw Error('inline nonfunction export requires explicit policy: ' + file);
      }
      if (head(form) === 'global' && atom(form.items[1]) === '$rep_store_step') armedDefined = true;
      if (head(form) === 'export') {
        if (head(form.items[2]) !== 'memory' || atom(form.items[1]) !== '"memory"') throw Error('nonfunction export requires explicit policy: ' + file);
        inventory.push({ file, name: 'memory', policy: 'external-memory-requires-exclusive-controller' });
        continue;
      }
      if (head(form) !== 'func') continue;
      const inline = form.items.filter(n => head(n) === 'export');
      if (!inline.length) continue;
      const id = serial++;
      const originalName = atom(form.items[1]);
      const target = originalName && originalName.startsWith('$') ? originalName : '$protected_impl_' + id;
      if (target !== originalName) edits.push({ start: form.items[0].end, end: form.items[0].end, text: ' ' + target });
      const params = [], results = [];
      for (const field of form.items) {
        if (head(field) === 'type') throw Error('exported type use requires explicit policy: ' + file);
        if (head(field) === 'param') params.push(...field.items.slice(1).map(atom).filter(s => !s.startsWith('$')));
        if (head(field) === 'result') results.push(...field.items.slice(1).map(atom));
      }
      if (![...params, ...results].every(t => ['i32', 'i64', 'f32', 'f64'].includes(t))) throw Error('unsupported exported signature: ' + file);
      const body = form.items.slice(originalName && originalName.startsWith('$') ? 2 : 1).filter(n => !declarations.has(head(n)));
      const observer = body.length > 0 && body.every(n => n.items && pure(n));
      for (const exp of inline) {
        const quoted = atom(exp.items[1]), name = JSON.parse(quoted);
        if (exportsSeen.has(name)) throw Error('duplicate protected export ' + name);
        exportsSeen.add(name);
        let policy = observer ? 'structural-read-only' : 'reject-before-entry';
        if (name === 'run') {
          if (target !== '$run' || params.join() !== 'i32' || results.length) throw Error('run entry signature drift');
          policy = 'supported-native-run';
        }
        if (name === 'set_rep_store_step') {
          if (params.join() !== 'i32' || results.length) throw Error('arm entry signature drift');
          policy = 'explicit-arm-disarm';
        }
        const readerWidth = name === 'guest_read32' ? 4 : name === 'guest_read8' ? 1 : 0;
        if (readerWidth) {
          if (params.join() !== 'i32' || results.join() !== 'i32') throw Error('reader signature drift');
          policy = 'direct-window-observer';
        }
        edits.push({ start: exp.start, end: exp.end, text: '' });
        const signature = params.map(t => ' (param ' + t + ')').join('') + results.map(t => ' (result ' + t + ')').join('');
        let guard = policy === 'reject-before-entry' ? '(if (global.get $rep_store_step) (then (unreachable)))' : '';
        if (readerWidth) {
          // Armed observations never enter g2w's fault/SEH paths. Bounds are
          // checked before the load, including wrap and the whole word.
          guard = `(if (global.get $rep_store_step) (then
            (if (i32.gt_u (i32.add (i32.sub (local.get 0) (global.get $image_base)) (global.get $GUEST_BASE))
                          (i32.sub (region.end $DIRECT_WINDOW) (i32.const ${readerWidth}))) (then (unreachable)))
            (return (i32.load${readerWidth === 1 ? '8_u' : ''} (i32.add (i32.sub (local.get 0) (global.get $image_base)) (global.get $GUEST_BASE))))))`;
        }
        wrappers.push(`(func (export ${quoted})${signature}\n ${guard}\n (call ${target}${params.map((_, i) => ' (local.get ' + i + ')').join('')}))`);
        inventory.push({ file, name, target, params, results, policy });
      }
    }
    let out = source;
    for (const edit of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
    out += '\n;; Protected external entry wrappers; internal calls retain their targets.\n' + wrappers.join('\n') + '\n';
    for (const key of [file, 'src/' + file, './' + file]) vfs.set(key, out);
  }
  if (!armedDefined) throw Error('protected export contract requires $rep_store_step');
  return { ...closure, vfs, protectedEntryInventory: inventory };
}

module.exports = { parse, protectClosure, isRuntimeClosure };
