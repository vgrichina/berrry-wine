'use strict';

// External calls must enter a wrapper, never the internal implementation. In
// particular generated ABI bridges may write their guest stack before reaching
// any shared Win32 helper. Internal calls keep their original targets.
//
// Coverage is closed over ALL function exports in the include closure, with a
// default-deny rule. New API names need no policy update. Observer admission is
// structural, not based on a get_/test_ naming convention.
//
// COST. This runs before every runtime compile, over the whole ~25 MB closure.
// It used to tokenize with a regex per character, build a full token tree for
// every file, do that twice, and rewrite every file (which also defeated the
// compiler's text-keyed frontend reuse). It now:
//   * scans each file ONCE with a charCode scanner that recognizes exactly the
//     tokens parse() does, materializing only the direct children of each
//     top-level form (no deep tree);
//   * deep-parses (parse()'s full node shape) only the forms that carry an
//     export, which are the only ones whose bodies are inspected;
//   * leaves every file WITHOUT an export as the identical string object, so a
//     text-keyed cache upstream hits.
// The emitted text of every file that does carry an export is byte-for-byte
// what the old implementation produced.

// /\s/ over one UTF-16 code unit, without a regex for the ASCII range.
function isSpace(c) {
  if (c === 32 || (c >= 9 && c <= 13)) return true;
  return c > 127 && /\s/.test(String.fromCharCode(c));
}
const OPEN = 40, CLOSE = 41, QUOTE = 34, SEMI = 59, BACKSLASH = 92;

// Index of the next token start at or after i (whitespace and both comment
// kinds skipped), or source.length.
function skipTrivia(source, i) {
  const n = source.length;
  while (i < n) {
    const c = source.charCodeAt(i);
    if (isSpace(c)) { i++; continue; }
    if (c === SEMI && source.charCodeAt(i + 1) === SEMI) {
      const end = source.indexOf('\n', i); i = end < 0 ? n : end; continue;
    }
    if (c === OPEN && source.charCodeAt(i + 1) === SEMI) {
      let depth = 1; i += 2;
      while (i < n && depth) {
        const d = source.charCodeAt(i);
        if (d === OPEN && source.charCodeAt(i + 1) === SEMI) { depth++; i += 2; }
        else if (d === SEMI && source.charCodeAt(i + 1) === CLOSE) { depth--; i += 2; }
        else i++;
      }
      if (depth) throw Error('unterminated WAT comment');
      continue;
    }
    return i;
  }
  return n;
}

// End index of the token starting at i (i is a token start).
function tokenEnd(source, i) {
  const n = source.length, c = source.charCodeAt(i);
  if (c === OPEN || c === CLOSE) return i + 1;
  if (c === QUOTE) {
    i++;
    while (i < n && source.charCodeAt(i) !== QUOTE) {
      if (source.charCodeAt(i) === BACKSLASH) i++;
      i++;
    }
    if (i >= n) throw Error('unterminated WAT string');
    return i + 1;
  }
  while (i < n) {
    const d = source.charCodeAt(i);
    if (d === OPEN || d === CLOSE || isSpace(d)) break;
    i++;
  }
  return i;
}

// Full node at token start i, in parse()'s shape. Returns [node, next index].
function parseNode(source, i) {
  const n = source.length;
  if (i >= n) throw Error('invalid WAT form');
  const end = tokenEnd(source, i), c = source.charCodeAt(i);
  if (c === CLOSE) throw Error('invalid WAT form');
  if (c !== OPEN) return [{ atom: source.slice(i, end), start: i, end }, end];
  const start = i, items = [];
  i = skipTrivia(source, end);
  while (i < n && source.charCodeAt(i) !== CLOSE) {
    const [child, next] = parseNode(source, i);
    items.push(child);
    i = skipTrivia(source, next);
  }
  if (i >= n) throw Error('unclosed WAT form');
  return [{ items, start, end: i + 1 }, i + 1];
}

// The complete token tree, exactly as before: tokens {atom,start,end} and
// lists {items,start,end}. Kept for callers that walk whole files.
function parse(source) {
  const forms = [];
  let i = skipTrivia(source, 0);
  while (i < source.length) {
    const [node, next] = parseNode(source, i);
    forms.push(node);
    i = skipTrivia(source, next);
  }
  return forms;
}

// End of the list whose '(' is at i, without allocating.
function skipList(source, i) {
  const n = source.length;
  let depth = 0;
  for (;;) {
    i = skipTrivia(source, i);
    if (i >= n) throw Error('unclosed WAT form');
    const c = source.charCodeAt(i);
    const end = tokenEnd(source, i);
    if (c === OPEN) depth++;
    else if (c === CLOSE) { if (--depth === 0) return end; }
    i = end;
  }
}

// Top-level forms with their DIRECT children only. A top-level atom is
// {atom,start,end}; a top-level list is {start,end,head,children}, where each
// child is an atom token or {start,end,head} (head = the child's first item if
// it is an atom — parse()'s `head(node)`).
function scanTop(source) {
  const forms = [], n = source.length;
  let i = skipTrivia(source, 0);
  while (i < n) {
    const c = source.charCodeAt(i);
    if (c === CLOSE) throw Error('invalid WAT form');
    if (c !== OPEN) {
      const end = tokenEnd(source, i);
      forms.push({ atom: source.slice(i, end), start: i, end });
      i = skipTrivia(source, end);
      continue;
    }
    const start = i, children = [];
    i = skipTrivia(source, i + 1);
    while (i < n && source.charCodeAt(i) !== CLOSE) {
      if (source.charCodeAt(i) === OPEN) {
        const first = skipTrivia(source, i + 1);
        let head;
        if (first < n) {
          const d = source.charCodeAt(first);
          if (d !== OPEN && d !== CLOSE) head = source.slice(first, tokenEnd(source, first));
        }
        const end = skipList(source, i);
        children.push({ start: i, end, head });
        i = skipTrivia(source, end);
      } else {
        const end = tokenEnd(source, i);
        children.push({ atom: source.slice(i, end), start: i, end });
        i = skipTrivia(source, end);
      }
    }
    if (i >= n) throw Error('unclosed WAT form');
    const head = children[0] && children[0].atom;
    forms.push({ start, end: i + 1, head, children });
    i = skipTrivia(source, i + 1);
  }
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

// A protected closure is recognized by IDENTITY plus an exact snapshot of its
// sources, never by a property a caller could copy or set. Mutating the vfs
// after protection (or building a look-alike object) makes it unprotected
// again, and compileClosure re-protects it.
const protectedState = new WeakMap();
function sealProtected(closure) {
  protectedState.set(closure, { source: closure.source, vfs: closure.vfs, entries: [...closure.vfs] });
  return closure;
}
function isProtectedClosure(closure) {
  const st = closure && typeof closure === 'object' ? protectedState.get(closure) : undefined;
  if (!st || st.source !== closure.source || st.vfs !== closure.vfs || st.vfs.size !== st.entries.length) return false;
  for (const [key, text] of st.entries) if (st.vfs.get(key) !== text) return false;
  return true;
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
  // One scan per distinct text. A file whose text is replaced (normalization
  // below) is rescanned; an unchanged one never is.
  const scans = new Map();
  const scanFile = (file) => {
    const text = vfs.get(file);
    if (text === undefined) throw Error('missing protected-entry source ' + file);
    const hit = scans.get(file);
    if (hit && hit.text === text) return hit.forms;
    const forms = scanTop(text);
    scans.set(file, { text, forms });
    return forms;
  };
  const deep = (file, form) => parseNode(vfs.get(file), form.start)[0];
  // Resolve out-of-line aliases against the whole module before wrapping.
  const definitions = new Map(), external = [], normalization = new Map();
  for (const file of included) for (const form of scanFile(file)) {
    if (form.head === 'include' || form.head === 'module') throw Error('nested protected-entry source requires explicit policy: ' + file);
    if (form.head === 'func' && atom(form.children[1])?.startsWith('$')) definitions.set(atom(form.children[1]), { file, form });
    if (form.head === 'export' && form.children[2] && form.children[2].head === 'func') external.push({ file, form: deep(file, form) });
  }
  const addEdit = (file, edit) => {
    if (!normalization.has(file)) normalization.set(file, []);
    normalization.get(file).push(edit);
  };
  for (const { file, form } of external) {
    const target = definitions.get(atom(form.items[2].items[1]));
    if (!target) throw Error('unresolved external function export: ' + file);
    addEdit(file, { start: form.start, end: form.end, text: '' });
    const nameEnd = target.form.children[1].end;
    addEdit(target.file, { start: nameEnd, end: nameEnd, text: ' (export ' + atom(form.items[1]) + ')' });
  }
  for (const [file, edits] of normalization) {
    let text = vfs.get(file);
    for (const edit of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
    vfs.set(file, text);
  }
  let serial = 0, armedDefined = false;
  for (const file of included) {
    const forms = scanFile(file), source = vfs.get(file), edits = [], wrappers = [];
    // Out-of-line function/table/global exports are rejected rather than left
    // outside the contract. The actual tree currently uses inline functions.
    for (const top of forms) {
      if (!top.children) continue;
      if (top.head !== 'func' && top.children.some(n => n.head === 'export')) {
        throw Error('inline nonfunction export requires explicit policy: ' + file);
      }
      if (top.head === 'global' && atom(top.children[1]) === '$rep_store_step') armedDefined = true;
      if (top.head === 'export') {
        if (!top.children[2] || top.children[2].head !== 'memory' || atom(top.children[1]) !== '"memory"') throw Error('nonfunction export requires explicit policy: ' + file);
        inventory.push({ file, name: 'memory', policy: 'external-memory-requires-exclusive-controller' });
        continue;
      }
      if (top.head !== 'func' || !top.children.some(n => n.head === 'export')) continue;
      const form = parseNode(source, top.start)[0];
      const inline = form.items.filter(n => head(n) === 'export');
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
    // A file with nothing to wrap keeps its exact text (and string identity):
    // the wrapper trailer would have been a comment and whitespace, which emit
    // nothing, and leaving the text alone lets a text-keyed cache upstream hit.
    if (!edits.length && !wrappers.length) continue;
    let out = source;
    for (const edit of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
    out += '\n;; Protected external entry wrappers; internal calls retain their targets.\n' + wrappers.join('\n') + '\n';
    for (const key of [file, 'src/' + file, './' + file]) vfs.set(key, out);
  }
  if (!armedDefined) throw Error('protected export contract requires $rep_store_step');
  return sealProtected({ ...closure, vfs, protectedEntryInventory: inventory });
}

// Every top-level form that IS an export or carries one, as its exact text, in
// order, plus the nesting heads protection refuses. Two texts with the same
// value here have the same protected entry surface.
function exportSurface(text) {
  const out = [];
  for (const top of scanTop(text)) {
    if (!top.children) continue;
    if (top.head === 'include' || top.head === 'module') out.push('<nested ' + top.head + '>');
    else if (top.head === 'export' || top.children.some(n => n.head === 'export')) out.push(text.slice(top.start, top.end));
  }
  return out;
}

// A source overlay applied AFTER protection (the compat artifact's dispatch
// trampoline) without protecting the closure a second time. Sound only if the
// overlay leaves the protected entry surface alone, so that is checked, not
// assumed: every file the overlay changes must keep exactly the same export
// surface, and no file may be added. Anything else throws.
function deriveProtectedClosure(closure, transform) {
  if (!isProtectedClosure(closure)) throw Error('deriveProtectedClosure requires a protected closure');
  const vfs = transform(new Map(closure.vfs));
  for (const [key, text] of vfs) {
    if (!closure.vfs.has(key)) throw Error('protected overlay added a source: ' + key);
    const before = closure.vfs.get(key);
    if (text === before) continue;
    const a = exportSurface(before), b = exportSurface(text);
    if (a.length !== b.length || a.some((s, i) => s !== b[i])) {
      throw Error('protected overlay changed the export surface of ' + key);
    }
  }
  for (const key of closure.vfs.keys()) if (!vfs.has(key)) throw Error('protected overlay removed a source: ' + key);
  return sealProtected({ ...closure, vfs });
}

module.exports = { parse, protectClosure, isRuntimeClosure, isProtectedClosure, deriveProtectedClosure, scanTop };
