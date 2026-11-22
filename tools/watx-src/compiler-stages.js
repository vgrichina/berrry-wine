// ═══════════════════════════════════════════════════════════════
// WATX COMPILER — Stages 2-4: Include, Macro, Type Checker
// ═══════════════════════════════════════════════════════════════

// --- Stage 2: Include Resolver ---
function resolveIncludes(forms, vfs, included = new Set(), filename = '<main>', parseContext = null) {
  const result = [];
  for (const form of forms) {
    if (Array.isArray(form) && form.length >= 3 && watxValue(form[1]) === 'include') {
      const path = watxValue(form[2])?.replace(/"/g, '') || '';
      if (included.has(path)) continue;
      if (!vfs.has(path)) {
        const e = new Error(`Missing include '${path}' referenced from ${filename}`);
        e.line = watxNodeLine(form);
        e.col = watxNodeCol(form);
        e.file = filename;
        throw e;
      }
      included.add(path);
      const src = vfs.get(path);
      const subForms = parseSource(src, path, parseContext);
      const resolved = resolveIncludes(subForms, vfs, included, path, parseContext);
      // Avoid passing every included top-level form as a call argument. Large
      // projects can exceed browser/Node argument-stack limits here.
      for (const resolvedForm of resolved) result.push(resolvedForm);
    } else {
      result.push(form);
    }
  }
  return result;
}

// --- Compile-time options, constants and conditionals ---------------------
//
//   (defoption NAME TYPE DEFAULT "doc")   TYPE: bool | i32 | i64 | (enum a b ...)
//   (defconst NAME EXPR)
//   (option NAME) (target FEATURE) (const NAME)          -- in EXPR / conditions
//   (if-const COND (then FORMS...) (else FORMS...))
//   (cond-const (COND FORMS...) ... (else FORMS...))
//
// Values come from the build (`options.define`, `options.tailCalls`, `mode`,
// `options.targets`), never from the program text after the point of use: a
// name is visible only after its declaration in include order, so a file can
// be compiled knowing the build options and the files before it. The chosen
// branch splices like `begin`; the other branch is parsed (it is part of the
// source text) but never expanded, so it may name things that only exist in
// the other configuration. See docs/watx-language-compile-time.md in the
// vendoring tree.
var WATX_CFG_TARGETS = ['tail-calls', 'simd', 'threads', 'multi-memory', 'production'];

function watxCfgError(message, node) {
  var e = new Error(message);
  var loc = typeof node === 'number' ? node : watxFormLoc(node);
  if (loc !== undefined) { e.line = watxNodeLine(loc); e.col = watxNodeCol(loc); e.file = watxNodeFile(loc); }
  return e;
}

function createWatxCompileEnv(options) {
  options = options || {};
  var targets = new Map();
  targets.set('tail-calls', options.tailCalls !== false);
  targets.set('production', options.mode === 'production');
  var given = options.targets || {};
  for (var k of Object.keys(given)) {
    if (WATX_CFG_TARGETS.indexOf(k) < 0) {
      throw new Error("options.targets: unknown target feature '" + k + "' (known: " + WATX_CFG_TARGETS.join(', ') + ')');
    }
    if ((k === 'tail-calls' || k === 'production') && !!given[k] !== targets.get(k)) {
      throw new Error("options.targets['" + k + "'] contradicts " + (k === 'tail-calls' ? 'options.tailCalls' : 'options.mode'));
    }
    targets.set(k, !!given[k]);
  }
  var defines = new Map();
  var raw = options.define || {};
  for (var d of Object.keys(raw)) defines.set(d, raw[d]);
  return {
    targets: targets,
    defines: defines,
    decls: new Map(),   // name -> { kind:'option'|'const', seq, value, type, deps, file, doc, loc }
    byLoc: new Map(),   // packed form location -> decl, so a re-expansion never redeclares
    seq: 0,             // declarations so far, in include order
    limit: Infinity,    // pass 2: only declarations with seq < limit are visible
    phase: 'header',    // 'header' (pass 1, in order) | 'body' (re-expanding one form)
    file: '<main>',     // the file whose forms are being expanded (cache-key attribution)
    reads: new Map(),   // file -> Set of 'option NAME' / 'target FEATURE'
    fileFixed: false,   // true when the caller sets `file` per form (streaming)
  };
}

function watxCfgNoteReads(env, keys) {
  if (!keys.size) return;
  var set = env.reads.get(env.file);
  if (!set) { set = new Set(); env.reads.set(env.file, set); }
  for (var k of keys) set.add(k);
}

// An integer literal as a BigInt: decimal or 0x hex, optional sign, `_` digit
// separators. Floats and NaN/inf payloads are refused.
function watxCfgParseInt(text, where) {
  var s = String(text).replace(/_/g, '');
  var neg = false;
  if (s[0] === '-' || s[0] === '+') { neg = s[0] === '-'; s = s.slice(1); }
  if (!/^(0[xX][0-9a-fA-F]+|[0-9]+)$/.test(s)) {
    throw watxCfgError("'" + text + "' is not an integer literal (compile-time values are integers and booleans)", where);
  }
  var v = BigInt(s);
  return neg ? -v : v;
}

function watxCfgTypeName(type) {
  return type.t === 'enum' ? '(enum ' + type.members.join(' ') + ')' : type.t === 'int' ? type.w : type.t;
}

var WATX_CFG_I32_MIN = -(1n << 31n), WATX_CFG_I32_LIM = 1n << 32n;
var WATX_CFG_I64_MIN = -(1n << 63n), WATX_CFG_I64_LIM = 1n << 64n;
function watxCfgFits(v, w) {
  return w === 'i32' ? (v >= WATX_CFG_I32_MIN && v < WATX_CFG_I32_LIM) : (v >= WATX_CFG_I64_MIN && v < WATX_CFG_I64_LIM);
}

// A build-supplied define, coerced to the option's declared type. Strings are
// what a command line gives; JS booleans/numbers/BigInts what an API caller does.
function watxCfgCoerceDefine(name, raw, type, where, role) {
  role = role || 'define';
  var bad = function () {
    return watxCfgError(role + " " + name + "=" + String(raw) + ": expected " + watxCfgTypeName(type), where);
  };
  if (type.t === 'bool') {
    if (raw === true || raw === 'true') return { t: 'bool', v: true };
    if (raw === false || raw === 'false') return { t: 'bool', v: false };
    throw bad();
  }
  if (type.t === 'int') {
    var v;
    if (typeof raw === 'bigint') v = raw;
    else if (typeof raw === 'number' && Number.isInteger(raw)) v = BigInt(raw);
    else if (typeof raw === 'string') { try { v = watxCfgParseInt(raw, where); } catch (e) { throw bad(); } }
    else throw bad();
    if (!watxCfgFits(v, type.w)) throw watxCfgError(role + " " + name + "=" + String(raw) + " does not fit " + type.w, where);
    return { t: 'int', v: v, w: type.w };
  }
  if (typeof raw !== 'string' || type.members.indexOf(raw) < 0) throw bad();
  return { t: 'enum', v: raw, members: type.members, owner: name };
}

function watxCfgLookup(env, name, kind, where, acc) {
  var d = env.decls.get(name);
  if (!d || d.seq >= env.limit) {
    throw watxCfgError("(" + kind + " " + name + "): no " + (kind === 'option' ? 'defoption' : 'defconst') +
      " for '" + name + "' earlier in include order", where);
  }
  if (d.kind !== kind) throw watxCfgError("'" + name + "' is a " + (d.kind === 'option' ? 'defoption' : 'defconst') +
    "; read it with (" + d.kind + " " + name + ")", where);
  if (kind === 'option') acc.add('option ' + name);
  else for (var k of d.deps) acc.add(k);
  return d.value;
}

// Evaluate a compile-time expression. `acc` collects the options and targets
// read (transitively through constants). Every operand is evaluated -- no
// short circuit -- so a misspelled name fails even on the branch not taken.
function watxCfgEval(node, env, acc, where) {
  if (!Array.isArray(node)) {
    var a = watxValue(node), ty = watxType(node);
    if (ty === 'number') return { t: 'int', v: watxCfgParseInt(a, where) };
    if (a === 'true' || a === 'false') return { t: 'bool', v: a === 'true' };
    if (ty === 'string') throw watxCfgError('a string is not a compile-time value: ' + a, where);
    return { t: 'sym', v: a };
  }
  var head = watxValue(node[1]);
  var args = node.slice(2);
  var self = node;
  var ev = function (n) { return watxCfgEval(n, env, acc, self); };
  var arity = function (min, max) {
    if (args.length < min || (max !== undefined && args.length > max)) {
      throw watxCfgError('(' + head + ') takes ' + (max === min ? min : max === undefined ? 'at least ' + min : min + '-' + max) +
        ' operand(s), got ' + args.length, self);
    }
  };
  var want = function (v, t, what) {
    if (v.t !== t) throw watxCfgError('(' + head + ') ' + what + ': expected ' + (t === 'int' ? 'an integer' : 'a boolean') +
      ', got ' + (v.t === 'sym' ? "the bare name '" + v.v + "'" : v.t === 'enum' ? 'an enum value' : v.t === 'int' ? 'an integer' : 'a boolean'), self);
    return v.v;
  };
  var name = function () {
    var n = watxValue(args[0]);
    if (args.length !== 1 || Array.isArray(args[0]) || watxType(args[0]) !== 'symbol') {
      throw watxCfgError('(' + head + ' NAME) takes one name', self);
    }
    return n;
  };
  switch (head) {
    case 'option': return watxCfgLookup(env, name(), 'option', self, acc);
    case 'const': return watxCfgLookup(env, name(), 'const', self, acc);
    case 'target': {
      var f = name();
      if (WATX_CFG_TARGETS.indexOf(f) < 0) throw watxCfgError("(target " + f + "): unknown feature (known: " + WATX_CFG_TARGETS.join(', ') + ')', self);
      if (!env.targets.has(f)) throw watxCfgError("(target " + f + "): this build does not say whether it targets " + f +
        " (pass options.targets['" + f + "'])", self);
      acc.add('target ' + f);
      return { t: 'bool', v: env.targets.get(f) };
    }
    case 'not': arity(1, 1); return { t: 'bool', v: !want(ev(args[0]), 'bool', 'operand') };
    case 'and': case 'or': {
      arity(1);
      var vals = args.map(function (x) { return want(ev(x), 'bool', 'operand'); });
      return { t: 'bool', v: head === 'and' ? vals.every(Boolean) : vals.some(Boolean) };
    }
    case 'eq': case 'ne': {
      arity(2, 2);
      var x = ev(args[0]), y = ev(args[1]), same;
      if (x.t === 'sym' && y.t === 'enum') { var tmp = x; x = y; y = tmp; }
      if (x.t === 'enum' && y.t === 'sym') {
        if (x.members.indexOf(y.v) < 0) throw watxCfgError("'" + y.v + "' is not a member of " + x.owner + "'s (enum " + x.members.join(' ') + ')', self);
        same = x.v === y.v;
      } else if (x.t === 'enum' && y.t === 'enum') {
        if (x.members.join(' ') !== y.members.join(' ')) throw watxCfgError('(' + head + ') compares values of two different enums', self);
        same = x.v === y.v;
      } else if (x.t === y.t && (x.t === 'int' || x.t === 'bool')) {
        same = x.v === y.v;
      } else {
        throw watxCfgError('(' + head + ') operands have different types (' + x.t + ', ' + y.t + ')', self);
      }
      return { t: 'bool', v: head === 'eq' ? same : !same };
    }
    case 'lt': case 'le': case 'gt': case 'ge': {
      arity(2, 2);
      var l = want(ev(args[0]), 'int', 'left operand'), r = want(ev(args[1]), 'int', 'right operand');
      return { t: 'bool', v: head === 'lt' ? l < r : head === 'le' ? l <= r : head === 'gt' ? l > r : l >= r };
    }
    case 'add': case 'mul': case 'and-bits': case 'or-bits': {
      arity(1);
      var ns = args.map(function (x) { return want(ev(x), 'int', 'operand'); });
      var acc0 = ns[0];
      for (var i = 1; i < ns.length; i++) {
        acc0 = head === 'add' ? acc0 + ns[i] : head === 'mul' ? acc0 * ns[i] : head === 'and-bits' ? (acc0 & ns[i]) : (acc0 | ns[i]);
      }
      return { t: 'int', v: acc0 };
    }
    case 'sub': {
      arity(1, 2);
      var s0 = want(ev(args[0]), 'int', 'operand');
      return { t: 'int', v: args.length === 1 ? -s0 : s0 - want(ev(args[1]), 'int', 'operand') };
    }
    case 'shl': case 'shr': {
      arity(2, 2);
      var b = want(ev(args[0]), 'int', 'value'), c = want(ev(args[1]), 'int', 'shift count');
      if (c < 0n || c > 63n) throw watxCfgError('(' + head + ') shift count must be 0..63, got ' + c, self);
      return { t: 'int', v: head === 'shl' ? b << c : b >> c };
    }
    default:
      throw watxCfgError("'" + head + "' is not a compile-time operator (option target const not and or eq ne lt le gt ge add sub mul shl shr and-bits or-bits)", self);
  }
}

// A declaration form, registered in include order. Returns true when it was
// registered now, false when this exact form was registered before (a pass-2
// re-expansion of the same text), in which case it only becomes visible.
function watxCfgDeclare(form, env) {
  var loc = watxFormLoc(form);
  var prior = loc !== undefined ? env.byLoc.get(loc) : undefined;
  if (prior) { if (prior.seq + 1 > env.limit) env.limit = prior.seq + 1; return false; }
  if (env.phase === 'body') throw watxCfgError('internal: a compile-time declaration first seen while re-expanding a body', form);
  var head = watxValue(form[1]);
  var name = watxValue(form[2]);
  if (Array.isArray(form[2]) || watxType(form[2]) !== 'symbol') throw watxCfgError('(' + head + ' NAME ...) needs a name', form);
  if (env.decls.has(name)) {
    var was = env.decls.get(name);
    throw watxCfgError("'" + name + "' is already declared (" + (was.kind === 'option' ? 'defoption' : 'defconst') +
      (was.file ? ' in ' + was.file + ':' + was.line : '') + ')', form);
  }
  var decl;
  if (head === 'defoption') {
    if (form.length !== 6) throw watxCfgError('(defoption NAME TYPE DEFAULT "doc") takes four operands, got ' + (form.length - 2), form);
    var tn = form[3], type;
    if (Array.isArray(tn)) {
      if (watxValue(tn[1]) !== 'enum' || tn.length < 3) throw watxCfgError('(defoption ' + name + '): an enum type is (enum a b ...)', form);
      var members = tn.slice(2).map(function (m) {
        if (Array.isArray(m) || watxType(m) !== 'symbol') throw watxCfgError('(enum ...) members are names', form);
        return watxValue(m);
      });
      if (new Set(members).size !== members.length) throw watxCfgError('(defoption ' + name + '): duplicate enum member', form);
      type = { t: 'enum', members: members };
    } else {
      var tv = watxValue(tn);
      if (tv === 'bool') type = { t: 'bool' };
      else if (tv === 'i32' || tv === 'i64') type = { t: 'int', w: tv };
      else throw watxCfgError("(defoption " + name + "): type must be bool, i32, i64 or (enum ...), got '" + tv + "'", form);
    }
    if (Array.isArray(form[4])) throw watxCfgError('(defoption ' + name + '): the default is a literal', form);
    var dflt = watxCfgCoerceDefine(name, watxValue(form[4]), type, form, 'default');
    if (watxType(form[5]) !== 'string') throw watxCfgError('(defoption ' + name + '): the last operand is its description string', form);
    var value = env.defines.has(name) ? watxCfgCoerceDefine(name, env.defines.get(name), type, form) : dflt;
    decl = { kind: 'option', name: name, type: type, value: value, defaultValue: dflt, defined: env.defines.has(name),
             doc: JSON.parse(watxValue(form[5])), deps: new Set(['option ' + name]) };
  } else {
    if (form.length !== 4) throw watxCfgError('(defconst NAME EXPR) takes two operands', form);
    var deps = new Set();
    var cv = watxCfgEval(form[3], env, deps, form);
    if (cv.t !== 'int' && cv.t !== 'bool') throw watxCfgError('(defconst ' + name + '): a constant is an integer or a boolean', form);
    watxCfgNoteReads(env, deps);
    decl = { kind: 'const', name: name, value: cv, deps: deps };
  }
  decl.seq = env.seq++;
  decl.file = loc !== undefined ? watxNodeFile(loc) : null;
  decl.line = loc !== undefined ? watxNodeLine(loc) : 0;
  env.decls.set(name, decl);
  if (loc !== undefined) env.byLoc.set(loc, decl);
  return true;
}

// The forms of the branch a conditional selects, unexpanded.
function watxCfgChoose(form, env) {
  var head = watxValue(form[1]);
  var cond = function (c, where) {
    var acc = new Set();
    var r = watxCfgEval(c, env, acc, where);
    watxCfgNoteReads(env, acc);
    if (r.t !== 'bool') throw watxCfgError('(' + head + ') condition must be a boolean', where);
    return r.v;
  };
  var arm = function (n, want) {
    return Array.isArray(n) && watxValue(n[1]) === want;
  };
  if (head === 'if-const') {
    if (form.length < 4 || form.length > 5 || !arm(form[3], 'then') || (form.length === 5 && !arm(form[4], 'else'))) {
      throw watxCfgError('(if-const COND (then FORMS...) (else FORMS...)) -- the else arm is optional', form);
    }
    return cond(form[2], form) ? form[3].slice(2) : form.length === 5 ? form[4].slice(2) : [];
  }
  var chosen = null;
  for (var i = 2; i < form.length; i++) {
    var clause = form[i];
    if (!Array.isArray(clause) || clause.length < 2) throw watxCfgError('(cond-const (COND FORMS...) ... (else FORMS...))', form);
    if (watxValue(clause[1]) === 'else') {
      if (i !== form.length - 1) throw watxCfgError('(cond-const): (else ...) must be the last clause', clause);
      if (!chosen) chosen = clause.slice(2);
      continue;
    }
    if (cond(clause[1], clause) && !chosen) chosen = clause.slice(2);
  }
  return chosen || [];
}

// `(const NAME)` as an instruction operand: the literal, range-checked for the
// instruction it feeds.
function watxCfgConstLiteral(form, env, parentHead) {
  var acc = new Set();
  var v = watxCfgEval(form, env, acc, form);
  watxCfgNoteReads(env, acc);
  var n = v.t === 'bool' ? (v.v ? 1n : 0n) : v.v;
  var w = parentHead === 'i32.const' ? 'i32' : 'i64';
  if (!watxCfgFits(n, w)) throw watxCfgError('(const ' + watxValue(form[2]) + ') = ' + n + ' does not fit ' + w, form);
  return String(n);
}

// --- Stage 3: Macro Expander ---
function expandMacros(forms, env) {
  if (!env) env = createWatxCompileEnv({});
  const macros = new Map();
  let gensymCounter = 0;

  function gensym(base) { return `$__gs_${base}_${gensymCounter++}`; }

  function collectMacros(formList) {
    const out = [];
    for (const form of formList) {
      if (Array.isArray(form) && watxValue(form[1]) === 'defmacro') {
        const sig = form[2];
        if (Array.isArray(sig)) {
          const name = watxValue(sig[1]) || sig[1];
          const params = sig.slice(2).map(p => watxValue(p) || p);
          const body = form.slice(3);
          macros.set(typeof name === 'string' ? name : name, { params, body });
        }
      } else {
        out.push(form);
      }
    }
    return out;
  }

  function interpolateName(template, bindings) {
    let result = template;
    for (const [k, v] of Object.entries(bindings)) {
      const val = watxValue(v) || String(v);
      result = result.replace(new RegExp(`\\{[^}]*${k.replace('$', '\\$')}[^}]*\\}`, 'g'), (match) => {
        let r = match.slice(1, -1);
        for (const [bk, bv] of Object.entries(bindings)) {
          const bval = watxValue(bv) || String(bv);
          r = r.replace(bk, bval.replace('$', ''));
        }
        return '$' + r;
      });
    }
    return result;
  }

  function substitute(template, bindings) {
    if (Array.isArray(template)) {
      if (watxValue(template[1]) === 'begin') {
        const spliced = template.slice(2).flatMap(t => {
          const r = substitute(t, bindings);
          return Array.isArray(r) && r._isBegin ? r : [r];
        });
        // Tagged, so the caller splices it: a `(begin ...)` body used to come
        // back as a plain array and was pushed as ONE child, which the encoder
        // then dropped without a word (see expandForm below).
        spliced._isBegin = true;
        return spliced;
      }
      const result = [template[0]];
      for (let i = 1; i < template.length; i++) {
        result.push(substitute(template[i], bindings));
      }
      return result;
    }
    if (watxType(template) === 'symbol') {
      const val = watxValue(template);
      if (bindings[val] !== undefined) return bindings[val];
      if (val.includes('{')) {
        const newVal = interpolateName(val, bindings);
        return cloneWatxAtomValue(template, newVal);
      }
      return template;
    }
    return template;
  }

  // `top` is true only for a module-level position (a top-level form, or what
  // a top-level macro call or conditional splices there); declarations are
  // refused anywhere else.
  function expandForm(form, top = false, parentHead = null) {
    if (!Array.isArray(form)) return form;
    const head = watxValue(form[1]);
    if (head === 'if-const' || head === 'cond-const') {
      const out = [];
      for (const item of watxCfgChoose(form, env)) {
        const itemHead = Array.isArray(item) ? watxValue(item[1]) : null;
        if (itemHead === 'include' || itemHead === 'defmacro') {
          throw watxCfgError(`(${itemHead} ...) inside a compile-time conditional is not supported in v1 ` +
            '(includes and macros are resolved before any condition is evaluated)', item);
        }
        const r = expandForm(item, top, parentHead);
        if (Array.isArray(r) && r._isBegin) out.push(...r); else out.push(r);
      }
      out._isBegin = true;
      return out;
    }
    if (head === 'defoption' || head === 'defconst') {
      if (!top) throw watxCfgError(`(${head} ...) is a module-level declaration`, form);
      watxCfgDeclare(form, env);
      const none = [];
      none._isBegin = true;
      return none;
    }
    if (head === 'const') return watxCfgConstLiteral(form, env, parentHead);
    if (head === 'option' || head === 'target') {
      throw watxCfgError(`(${head} ...) is only valid in a compile-time condition or defconst; ` +
        'bind a value with (defconst NAME EXPR) and use (const NAME)', form);
    }
    if (head && macros.has(head)) {
      const macro = macros.get(head);
      const args = form.slice(2);
      // Macro arity was unchecked in BOTH directions, and both silently: a
      // surplus argument was dropped by `params.forEach` (which iterates the
      // parameters, never the arguments), and a missing one bound `undefined`,
      // which `substitute` then spliced into the body as a hole. The module
      // compiled either way and computed as if the extra argument had never been
      // written — the shape of an edit that reorders or renames a macro's
      // parameters and leaves every call site quietly one behind.
      if (args.length !== macro.params.length) {
        const e = new Error(
          `macro ${head} takes ${macro.params.length} argument(s) ` +
          `(${macro.params.join(' ') || '—'}), got ${args.length}`);
        const loc = watxFormLoc(form);
        if (loc !== undefined) { e.line = watxNodeLine(loc); e.col = watxNodeCol(loc); e.file = watxNodeFile(loc); }
        throw e;
      }
      const bindings = {};
      macro.params.forEach((p, i) => { bindings[p] = args[i]; });
      // Expand every body form in turn, splicing at both levels: a `(begin
      // ...)` in the template comes back from `substitute` as a tagged list
      // of forms, and a body form that is itself a multi-form macro call
      // comes back from `expandForm` as one. Either used to be pushed as a
      // single element, so a multi-form macro called from inside another
      // macro's body lost its expansion (test/watx-compiler-macro-body.test.js).
      const result = [];
      for (const e of macro.body.map(b => substitute(b, bindings))) {
        for (const item of (Array.isArray(e) && e._isBegin ? e : [e])) {
          const r = expandForm(item, top, parentHead);
          if (Array.isArray(r) && r._isBegin) result.push(...r); else result.push(r);
        }
      }
      if (result.length === 1) return result[0];
      result._isBegin = true;
      return result;
    }
    let result = null;
    for (let i = 1; i < form.length; i++) {
      const child = form[i];
      const expandedChild = expandForm(child, false, head);
      // A multi-form macro expansion is an `_isBegin` array of forms, and it
      // must be SPLICED into the parent, one child per form. Until 2026-09-19
      // it was pushed as a single child here, and a macro with more than one
      // body form used anywhere below module level — inside a function body —
      // compiled to nothing: the module validated, the function ran, and the
      // expansion's instructions were simply absent (the whole emulator's
      // dispatch step vanished this way and every app "ran" zero ops). The
      // module-level path in expandModule already spliced; this is the same
      // splice for every nested position.
      const spliceBegin = Array.isArray(expandedChild) && expandedChild._isBegin;
      if (result) {
        if (spliceBegin) result.push(...expandedChild); else result.push(expandedChild);
      } else if (spliceBegin || expandedChild !== child) {
        result = form.slice(0, i);
        if (spliceBegin) result.push(...expandedChild); else result.push(expandedChild);
      }
    }
    if (!result) return form;
    return result;
  }

  let expanded = collectMacros(forms);
  expanded = expanded.flatMap(f => {
    // Pass-1 attribution of compile-time reads to the file being expanded;
    // a streaming caller (one descriptor at a time) has already set it.
    if (env.phase === 'header' && !env.fileFixed) {
      const loc = watxFormLoc(f);
      if (loc !== undefined) env.file = watxNodeFile(loc);
    }
    const r = expandForm(f, true);
    return Array.isArray(r) && r._isBegin ? r : [r];
  });
  return expanded;
}

// --- Export wrappers -------------------------------------------------------
//
//   (export-wrap (match SELECTOR) (prologue FORMS...))
//   SELECTOR: (all) (name "a" ...) (prefix "p" ...) (pure) (not S) (and S...) (or S...)
//
// Runs once, after pass 1 has seen every module-level form, on the expanded
// module-level forms (function HEADERS in the streaming compiler). Each
// function export a declaration matches is moved onto a generated function
// with the same signature whose body is the prologue followed by a call to the
// original; several matching declarations nest in declaration order, the
// first outermost. Internal calls keep their targets. Generated wrappers are
// appended after every other form, so existing function indices do not move,
// and each moved export keeps its position in the export section.
//
// `(pure)` is INFERRED, conservatively, from the macro-expanded body: true only
// when the function has no `(effects ...)` clause, is not an import, has a
// non-empty body written as folded expressions, and every instruction in it is
// a read: local.get, global.get, a *.const, a load (including layout
// load.field/load.elem/load.field-elem), a numeric/SIMD operator that is not a
// store or an atomic, select, or a region/layout constant (region.addr/end/
// size, size-of, offset-of, elem-addr). Anything else -- a store, local.set,
// global.set, any call, control flow, memory.*/table.* instructions,
// unreachable -- makes it impure. A trap (a load out of bounds, a division by
// zero) is not a side effect.
var WATX_PURE_HEADS = new Set([
  'local.get', 'global.get', 'select',
  'load.field', 'load.elem', 'load.field-elem',
  'region.addr', 'region.end', 'region.size', 'size-of', 'offset-of', 'elem-addr',
]);
var WATX_PURE_PREFIX = /^(i32|i64|f32|f64|v128|i8x16|i16x8|i32x4|i64x2|f32x4|f64x2)\./;
var WATX_DECL_HEADS = { param: 1, result: 1, local: 1, type: 1, export: 1, effects: 1 };

function watxHeadIsPure(head) {
  if (typeof head !== 'string') return false;
  head = watxLayoutMemargHead(head).head;
  if (WATX_PURE_HEADS.has(head)) return true;
  return WATX_PURE_PREFIX.test(head) && head.indexOf('store') < 0 && head.indexOf('atomic') < 0;
}

function watxExprIsPure(node) {
  if (!Array.isArray(node)) return true;            // an operand atom
  if (!watxHeadIsPure(watxValue(node[1]))) return false;
  for (var i = 2; i < node.length; i++) if (!watxExprIsPure(node[i])) return false;
  return true;
}

// body: the function's forms after its name (header clauses included or not).
function watxBodyIsPure(body) {
  var any = false;
  for (var i = 0; i < body.length; i++) {
    var n = body[i];
    if (!Array.isArray(n)) return false;              // flat (unfolded) instruction: not analyzed
    var h = watxValue(n[1]);
    if (h === 'effects') return false;
    if (WATX_DECL_HEADS[h]) continue;
    if (!watxExprIsPure(n)) return false;
    any = true;
  }
  return any;
}

function watxParseExportSelector(node) {
  if (!Array.isArray(node)) throw watxCfgError('export-wrap selector: expected (all) (name ...) (prefix ...) (pure) (not S) (and S...) (or S...)', node);
  var op = watxValue(node[1]);
  var args = node.slice(2);
  var strings = function () {
    if (!args.length || args.some(function (a) { return Array.isArray(a) || watxType(a) !== 'string'; })) {
      throw watxCfgError('(' + op + ' "..." ...) takes one or more strings', node);
    }
    return args.map(function (a) { return JSON.parse(watxValue(a)); });
  };
  switch (op) {
    case 'all': case 'pure':
      if (args.length) throw watxCfgError('(' + op + ') takes no operands', node);
      return { op: op };
    case 'name': return { op: op, names: new Set(strings()) };
    case 'prefix': return { op: op, prefixes: strings() };
    case 'not':
      if (args.length !== 1) throw watxCfgError('(not S) takes one selector', node);
      return { op: op, args: [watxParseExportSelector(args[0])] };
    case 'and': case 'or':
      if (!args.length) throw watxCfgError('(' + op + ' S...) takes one or more selectors', node);
      return { op: op, args: args.map(watxParseExportSelector) };
    default:
      throw watxCfgError("export-wrap: unknown selector '" + op + "'", node);
  }
}

function watxSelectorText(s) {
  if (s.op === 'all' || s.op === 'pure') return '(' + s.op + ')';
  if (s.op === 'name') return '(name ' + Array.from(s.names).map(function (n) { return JSON.stringify(n); }).join(' ') + ')';
  if (s.op === 'prefix') return '(prefix ' + s.prefixes.map(function (n) { return JSON.stringify(n); }).join(' ') + ')';
  return '(' + s.op + ' ' + s.args.map(watxSelectorText).join(' ') + ')';
}

function watxSelectorUsesPure(s) {
  return s.op === 'pure' || (!!s.args && s.args.some(watxSelectorUsesPure));
}

// `pure()` is lazy: purity costs a body parse in the streaming compiler, so
// cheaper operands of and/or are decided first (selectors have no effects, so
// the order cannot change the answer).
function watxSelectorMatch(s, name, pure) {
  switch (s.op) {
    case 'all': return true;
    case 'pure': return pure();
    case 'name': return s.names.has(name);
    case 'prefix': return s.prefixes.some(function (p) { return name.indexOf(p) === 0; });
    case 'not': return !watxSelectorMatch(s.args[0], name, pure);
    default: {
      var ordered = s.args.filter(function (a) { return !watxSelectorUsesPure(a); })
        .concat(s.args.filter(watxSelectorUsesPure));
      for (var i = 0; i < ordered.length; i++) {
        var m = watxSelectorMatch(ordered[i], name, pure);
        if (s.op === 'and' && !m) return false;
        if (s.op === 'or' && m) return true;
      }
      return s.op === 'and';
    }
  }
}

// Inline export registration for a function form at index fi. A function
// export-wrap touched lists every clause it had, moved or not, in written
// order; it registers them all here (a moved one under its wrapper's name), so
// the export section's insertion order is the same as without the wrap. Returns
// true when it did, and the caller then skips export clauses in the form; a
// moved clause met on its wrapper is skipped too (clause._watxMoved).
function watxHomeExports(form, name, fi, out) {
  var list = form._watxExportClauses;
  if (!list) return false;
  for (var i = 0; i < list.length; i++) {
    out.push({ exportName: (watxValue(list[i].clause[2]) || '').replace(/"/g, ''), kind: 'func', ref: list[i].ref || name, formIndex: fi });
  }
  return true;
}

function watxCloneTree(n) {
  return Array.isArray(n) ? n.map(watxCloneTree) : n;
}

// forms: expanded module-level forms. bodyOf(funcForm) returns that function's
// expanded body forms (or null if unavailable). Returns { forms, report }; a
// module with no export-wrap declaration comes back as the same array.
function applyWatxExportWraps(forms, bodyOf) {
  var V = watxValue;
  var isWrap = function (f) { return Array.isArray(f) && V(f[1]) === 'export-wrap'; };
  if (!forms.some(isWrap)) return { forms: forms, report: null };
  var decls = [], rest = [];
  for (var fi = 0; fi < forms.length; fi++) {
    var f = forms[fi];
    if (!isWrap(f)) { rest.push(f); continue; }
    var m = f[2], p = f[3];
    if (f.length !== 4 || !Array.isArray(m) || V(m[1]) !== 'match' || m.length !== 3 ||
        !Array.isArray(p) || V(p[1]) !== 'prologue') {
      throw watxCfgError('(export-wrap (match SELECTOR) (prologue FORMS...))', f);
    }
    var loc = watxFormLoc(f);
    decls.push({ index: decls.length, selector: watxParseExportSelector(m[2]), prologue: p.slice(2), loc: loc,
                 file: loc !== undefined ? watxNodeFile(loc) : null, line: loc !== undefined ? watxNodeLine(loc) : 0 });
  }

  // Signatures of everything an export can name.
  var funcs = new Map();
  var sigOf = function (parts, from) {
    var params = [], results = [], effects = false;
    for (var i = from; i < parts.length; i++) {
      var part = parts[i];
      if (!Array.isArray(part)) continue;
      var k = V(part[1]);
      if (k === 'param') for (var j = 2; j < part.length; j++) { var t = V(part[j]); if (t && t.charAt(0) !== '$') params.push(t); }
      else if (k === 'result') for (var r = 2; r < part.length; r++) results.push(V(part[r]));
      else if (k === 'effects') effects = true;
      else if (k === 'type') throw watxCfgError('export-wrap: a (type ...) function signature is not supported; spell (param ...)/(result ...)', part);
    }
    return { params: params, results: results, effects: effects };
  };
  for (var ri = 0; ri < rest.length; ri++) {
    var g = rest[ri];
    if (!Array.isArray(g)) continue;
    var h = V(g[1]);
    if (h === 'func') {
      var fname = typeof g[2] === 'string' && g[2].charAt(0) === '$' ? g[2] : null;
      var info = Object.assign({ form: g, name: fname, imported: false }, sigOf(g, 2));
      if (fname) funcs.set(fname, info);
      g._watxWrapInfo = info;
    } else if ((h === 'import' || h === 'wasm-import') && Array.isArray(g[4]) && V(g[4][1]) === 'func' &&
               typeof g[4][2] === 'string' && g[4][2].charAt(0) === '$') {
      funcs.set(g[4][2], Object.assign({ form: null, name: g[4][2], imported: true }, sigOf(g[4], 3)));
    }
  }

  var purity = new Map();
  var pureOf = function (info) {
    if (purity.has(info)) return purity.get(info);
    var v = false;
    if (!info.imported && !info.effects) {
      var body = bodyOf(info.form);
      v = !!body && watxBodyIsPure(body);
    }
    purity.set(info, v);
    return v;
  };

  var report = {
    declarations: decls.map(function (d) {
      return { index: d.index, file: d.file, line: d.line, match: watxSelectorText(d.selector), prologueForms: d.prologue.length };
    }),
    exports: [],
  };
  var wrappers = [];
  var serial = 0;
  var sanitize = function (s) { return s.replace(/[^A-Za-z0-9_]/g, '_'); };
  var wrapExport = function (exportName, info, at, moveExport) {
    var matched = decls.filter(function (d) {
      return watxSelectorMatch(d.selector, exportName, function () { return pureOf(info); });
    });
    var row = { name: exportName, target: info.name, wrappers: matched.map(function (d) { return d.index; }),
                pure: purity.has(info) ? purity.get(info) : null };
    report.exports.push(row);
    if (!matched.length) return;
    if (!info.name) {
      // An anonymous exported function needs a name for the wrapper to call.
      info.name = '$__xw_impl_' + (serial++);
      info.form.splice(2, 0, info.name);
      row.target = info.name;
    }
    var id = serial++;
    var next = info.name;
    var made = [];
    for (var j = matched.length - 1; j >= 0; j--) {
      var d = matched[j];
      var wloc = d.loc;
      var wname = '$__xw' + d.index + '_' + id + '_' + sanitize(exportName);
      var w = [wloc, 'func', wname];
      if (j === 0) w.push(moveExport(wname, wloc));
      for (var pi = 0; pi < info.params.length; pi++) w.push([wloc, 'param', info.params[pi]]);
      for (var qi = 0; qi < info.results.length; qi++) w.push([wloc, 'result', info.results[qi]]);
      for (var fi2 = 0; fi2 < d.prologue.length; fi2++) w.push(watxCloneTree(d.prologue[fi2]));
      var call = [wloc, 'call', next];
      for (var li = 0; li < info.params.length; li++) call.push([wloc, 'local.get', String(li)]);
      w.push(call);
      made.push(w);
      next = wname;
    }
    row.wrapperFunctions = made.map(function (w) { return w[2]; }).reverse();
    for (var mi = made.length - 1; mi >= 0; mi--) wrappers.push(made[mi]);
    report.wrapped = (report.wrapped || 0) + 1;
  };

  for (var ei = 0; ei < rest.length; ei++) {
    var e = rest[ei];
    if (!Array.isArray(e)) continue;
    var eh = V(e[1]);
    if (eh === 'func') {
      var clauses = [];
      for (var ci = 2; ci < e.length; ci++) if (Array.isArray(e[ci]) && V(e[ci][1]) === 'export') clauses.push(e[ci]);
      if (!clauses.length) continue;
      // Every export clause of this form keeps its written place in the
      // export section, whether it stays here or moves to a wrapper: the
      // export collectors register all of them HERE, in written order, from
      // this list (watxHomeExports), and skip a moved clause on its wrapper.
      var homeList = clauses.map(function (c) { return { clause: c, ref: null }; });
      e._watxExportClauses = homeList;
      homeList.forEach(function (entry) {
        wrapExport(JSON.parse(V(entry.clause[2])), e._watxWrapInfo, ei, function (wname) {
          e.splice(e.indexOf(entry.clause), 1);
          entry.ref = wname;
          entry.clause._watxMoved = true;
          return entry.clause;
        });
      });
    } else if (eh === 'export' && Array.isArray(e[3]) && V(e[3][1]) === 'func') {
      var ref = V(e[3][2]);
      var tinfo = funcs.get(ref);
      if (!tinfo) throw watxCfgError("export-wrap: export " + V(e[2]) + " names '" + ref + "', which is not a named function", e);
      var desc = e[3];
      wrapExport(JSON.parse(V(e[2])), tinfo, ei, function (wname) { desc[2] = wname; return null; });
    } else if (eh === 'wasm-export') {
      var wref = V(e[3]);
      var winfo = funcs.get(wref);
      if (!winfo) throw watxCfgError("export-wrap: export " + V(e[2]) + " names '" + wref + "', which is not a named function", e);
      var wform = e;
      wrapExport(JSON.parse(V(e[2])), winfo, ei, function (wname) { wform[3] = wname; return null; });
    }
  }
  for (var wi = 0; wi < wrappers.length; wi++) {
    // A wrapper whose export moved out of line carries no clause.
    var wf = wrappers[wi];
    for (var z = wf.length - 1; z >= 2; z--) if (wf[z] === null) wf.splice(z, 1);
  }
  for (var ri2 = 0; ri2 < rest.length; ri2++) if (Array.isArray(rest[ri2])) delete rest[ri2]._watxWrapInfo;
  return { forms: rest.concat(wrappers), report: report };
}

// --- Stage 4: Bidirectional Type/Region Checker ---
// Valid scalar/vector type tokens for a `let` annotation, `if` block type, etc.
// v128 (WASM SIMD) added by the SIMD track 2026-08-12 (shared host-SIMD substrate).
// NOT the layout-field set — see WATX_LAYOUT_FIELD_TYPES immediately below.
var VALTYPE_TOKENS = ["i32","i64","f32","f64","v128","u8","ptr","weak"];

// ── The complete set of types a `(layout …)` field may declare ──────────────
//
// SINGLE SOURCE OF TRUTH, shared by three consumers that must never disagree:
//   * checkTypes() below refuses anything outside it, AT THE DECLARATION —
//     one located error per bad field instead of one per access site;
//   * lowerIR()'s sizeOfType() (compiler-codegen.js) reads the widths to lay
//     the struct out;
//   * emitLayoutAccess() (compiler-codegen.js) keys its load/store op table on
//     exactly these names, and throws an internal compiler-bug error on a name
//     this table admits and that one does not.
// The three files are concatenated in parser → stages → codegen order
// (tools/watx.js, lib/watx-launcher.js), so codegen sees this binding.
//
// WHY IT IS NOT VALTYPE_TOKENS. A layout field is a MEMORY ACCESS OF A FIXED
// WIDTH, and the two sets differ in both directions:
//   * `v128` is a real valtype and a legal `let` annotation, but there is no
//     v128 entry in emitLayoutAccess — a `(field v v128)` was accepted by the
//     checker and then compiled to a FOUR-byte i32 access over a sixteen-byte
//     field, with the struct laid out four bytes wide to match. It is refused
//     here rather than left as an accepted-invalid; add it to both tables (the
//     0xFD-prefixed v128.load/v128.store, align 4) if a field ever wants it.
//   * `u8`/`s8`/`u16`/`s16` are access WIDTHS, not valtypes: each loads and
//     stores as i32 through the sub-width ops. `ptr`/`weak` are 4-byte i32
//     fields that carry a documentation-only distinction.
// Any type name starting with `ptr` is a 4-byte pointer field — the `ptr*`
// spelling of §158 in docs/watx-layout-migration-design.md, which lets a field
// name the record it points at (`ptr$WndRecord`). That prefix rule is applied
// explicitly by watxLayoutFieldSize() below, not as a fallback.
var WATX_LAYOUT_FIELD_TYPES = {
  i32: 4, ptr: 4, weak: 4,
  u8: 1, s8: 1, u16: 2, s16: 2,
  i64: 8, f32: 4, f64: 8,
};
// Byte width of a layout field type, or null when the type is not one.
function watxLayoutFieldSize(t) {
  if (typeof t !== 'string') return null;
  if (Object.prototype.hasOwnProperty.call(WATX_LAYOUT_FIELD_TYPES, t)) return WATX_LAYOUT_FIELD_TYPES[t];
  if (t.indexOf('ptr') === 0) return 4;
  return null;
}
// The set as a sorted list, for a diagnostic that tells the author what to write.
function watxLayoutFieldTypeList() {
  return Object.keys(WATX_LAYOUT_FIELD_TYPES).sort().join(', ') + ', ptr<Name>';
}
function checkTypes(forms, options = {}) {
  var V = watxValue, T = watxType;
  var A = watxAt, N = watxFormLength, SL = watxFormSlice;
  const collectWarnings = options.collectWarnings !== false;
  var errors = [], warnings = [];
  var layouts = new Map(), fieldsByLayout = new Map(), functions = new Map(), regions = new Set(["static"]), importSigs = new Map();
  var functionDecls = [], inlineExportDecls = [], anonymousFuncId = 0;
  // Source order of the two declaration kinds that own a function signature.
  // The emitter needs the *interleaving* of imports and functions to number the
  // type section the way lib/compile-wat.js does, and by the time it runs the
  // (func ...) forms are no longer top-level forms it can see. This single pass
  // is the last place both are visible together, so record the sequence here.
  var declOrder = [];
  function fieldKey(layoutName, fieldName) { return layoutName + "\u0000" + fieldName; }
  function loc(form) {
    if (form && (watxFormLoc(form) !== undefined || form.line)) return { line: watxNodeLine(form), col: watxNodeCol(form) };
    return { line: 0, col: 0 };
  }
  function addError(msg, form) { var l = loc(form); errors.push({ msg: msg, line: l.line, col: l.col }); }
  function addWarning(msg, form) { if (!collectWarnings) return; var l = loc(form); warnings.push({ msg: msg, line: l.line, col: l.col }); }
  for (var fi = 0; fi < forms.length; fi++) { var form = forms[fi];
    if (!Array.isArray(form)) continue; var head = V(A(form,0));
    if (head === "layout") { var name = V(A(form,1)); if (name) { var fields = [];
      for (var i = 2; i < N(form); i++) { var fieldForm=A(form,i); if (Array.isArray(fieldForm) && V(A(fieldForm,0)) === "field") {
        var fname = V(A(fieldForm,1)), ftype = V(A(fieldForm,2)) || "i32";
        // An unrecognized field type is a HARD, LOCATED ERROR at the declaration.
        // It used to be addWarning(), which is not a refusal at all: warnings never
        // fail the build, and in production mode (collectWarnings:false, the mode
        // tools/watx-closure.js builds the emulator with) addWarning returns
        // immediately and the finding was not even printed. The field then reached
        // emitLayoutAccess, whose op table fell back to the i32 group, and the
        // access was silently four bytes wide over a field of some other size.
        // Refusing at the declaration rather than at the access is deliberate: one
        // diagnostic naming the field, not one per call site.
        if (fname) { if (watxLayoutFieldSize(ftype)===null) addError("Layout "+name+": field "+fname+" has unknown field type '"+ftype+"'"+((ftype==="i8"||ftype==="i16")?" — a sub-width field is an ACCESS WIDTH, not a valtype, so spell the signedness: "+(ftype==="i8"?"u8 or s8":"u16 or s16"):"")+". Layout field types are: "+watxLayoutFieldTypeList()+".", fieldForm); var field={ name: fname, type: ftype }; fields.push(field); fieldsByLayout.set(fieldKey(name,fname),field); } } }
      if (layouts.has(name)) addWarning("Duplicate layout: "+name, form); layouts.set(name, fields); } }
    // Tier 2 declarations (docs/watx-typed-pointers-design.md §4). Registered
    // here for ONE reason that is not advisory: the unknown-field-type refusal
    // above is the located one, and it runs in production. Without this, a
    // `(field x i8 4)` inside a union variant would skip it and surface instead
    // as lowerIR's unlocated "WATX internal: no byte width" — the exact wart
    // Tier 1 just removed for plain layouts. The offsets are NOT computed here;
    // lowerIR owns those, and a second copy of that arithmetic is what the
    // shared lowerFields() exists to prevent.
    if (head === "layout-union" || head === "view") {
      var uname = V(A(form,1));
      if (uname) {
        var collect = function (owner, holder, target) {
          for (var ci = 1; ci < N(holder); ci++) {
            var cf = A(holder,ci);
            if (!Array.isArray(cf) || V(A(cf,0)) !== "field") continue;
            var cn = V(A(cf,1)), ct = V(A(cf,2)) || "i32";
            if (!cn) continue;
            if (watxLayoutFieldSize(ct)===null)
              addError(owner+": field "+cn+" has unknown field type '"+ct+"'"+((ct==="i8"||ct==="i16")?" — a sub-width field is an ACCESS WIDTH, not a valtype, so spell the signedness: "+(ct==="i8"?"u8 or s8":"u16 or s16"):"")+". Layout field types are: "+watxLayoutFieldTypeList()+".", cf);
            var fr = { name: cn, type: ct };
            target.push(fr); fieldsByLayout.set(fieldKey(owner, cn), fr);
          }
        };
        if (head === "view") { var vfl = []; collect(uname, form, vfl); layouts.set(uname, vfl); }
        else {
          var pfx = [];
          for (var pi2 = 2; pi2 < N(form); pi2++) {
            var pc = A(form,pi2);
            if (Array.isArray(pc) && V(A(pc,0)) === "prefix") collect(uname, pc, pfx);
          }
          layouts.set(uname, pfx.slice());
          for (var vi2 = 2; vi2 < N(form); vi2++) {
            var vc = A(form,vi2);
            if (!Array.isArray(vc) || V(A(vc,0)) !== "variant") continue;
            var vn2 = V(A(vc,1)); if (!vn2) continue;
            var vfields = pfx.map(function(f){ var c={}; for(var k in f)c[k]=f[k]; fieldsByLayout.set(fieldKey(vn2,f.name),c); return c; });
            collect(vn2, vc, vfields);
            layouts.set(vn2, vfields);
          }
        }
      }
    }
    if (head === "func") {
      var cursor = 1;
      var explicitName = V(A(form,cursor)) && V(A(form,cursor)).charAt(0) === "$" ? V(A(form,cursor++)) : null;
      var name = explicitName || "$__anonymous_" + (anonymousFuncId++);
      var params = [], results = [], body = [], effectsClause = null;
      var homeExports = watxHomeExports(form, name, fi, inlineExportDecls);
      for (var i = cursor; i < N(form); i++) {
        var part=A(form,i);
        if (Array.isArray(part)) {
          var kind = V(A(part,0));
          if (kind === "param") {
            var pending = null;
            for (var pj = 1; pj < N(part); pj++) {
              var pv = V(A(part,pj));
              if (pv && pv.charAt(0) === "$") pending = pv;
              else if (pv) { params.push({name:pending,type:pv}); pending = null; }
            }
          } else if (kind === "result") {
            for (var j = 1; j < N(part); j++) results.push(V(A(part,j)) || "i32");
          } else if (kind === "effects") {
            effectsClause = part;
          } else if (kind === "export") {
            if (!homeExports && !part._watxMoved) inlineExportDecls.push({exportName:(V(A(part,1)) || "").replace(/"/g, ""),kind:"func",ref:name,formIndex:fi});
          } else {
            body.push(part);
          }
        } else {
          body.push(part);
        }
      }
      var fd = {name:name,params:params,results:results,locals:[],body:body,effectsClause:effectsClause,form:form,sigLoc:watxFormLoc(form),hasEffects:!!effectsClause};
      functionDecls.push(fd);
      declOrder.push("func");
      if (!fd.hasEffects && name.indexOf("$__")!==0) addWarning("Function "+name+" missing (effects ...) clause", form);
      functions.set(name, fd);
    }
    if (head === "wasm-import" || head === "import") { var sig = A(form,3);
      if (Array.isArray(sig) && V(A(sig,0)) === "func") { var funcName=V(A(sig,1))||"",ip=[],ir=[];
        for (var i=2;i<N(sig);i++) { var sigPart=A(sig,i); if (Array.isArray(sigPart)) { var k2=V(A(sigPart,0));
          if (k2==="param") { for (var j=1;j<N(sigPart);j++){var iv=V(A(sigPart,j))||"i32";if(iv.charAt(0)!=="$")ip.push(iv);} }
          else if (k2==="result") { for (var j=1;j<N(sigPart);j++) ir.push(V(A(sigPart,j))||"i32"); } } }
        importSigs.set(funcName, {params:ip,results:ir}); declOrder.push("import"); } }
    if (head === "with-region") { var rn = V(A(form,1)); if(rn) regions.add(rn); }
  }
  function stackType(t) { if(typeof t==="number"){if(t===0x7f)return"i32";if(t===0x7e)return"i64";if(t===0x7d)return"f32";if(t===0x7c)return"f64";if(t===0x7b)return"v128";}
    // The sub-width layout field types (u8/s8/u16/s16) and the pointer-ish ones
    // all sit in an i32 on the stack — the sub-width load/store ops widen and
    // truncate. `ptr` is prefix-matched for the `ptr$Rec` spelling that names
    // the pointee (see WATX_LAYOUT_FIELD_TYPES).
    if(t==="weak"||t==="u8"||t==="s8"||t==="u16"||t==="s16"||t==="region-handle")return"i32";
    if(typeof t==="string"&&t.indexOf("ptr")===0)return"i32"; return t||"i32"; }
  // SIMD (0xFD-prefix) op-name shape prefixes — used to identify v128-producing ops
  // without enumerating every opcode name. Scalar-returning SIMD ops (extract_lane_*,
  // any_true, all_true) are handled explicitly BEFORE this fallback returns 'v128'.
  function isSimdShapeHead(hd) {
    return typeof hd === "string" && (
      hd.indexOf("v128.")===0 || hd.indexOf("i8x16.")===0 || hd.indexOf("i16x8.")===0 ||
      hd.indexOf("i32x4.")===0 || hd.indexOf("i64x2.")===0 || hd.indexOf("f32x4.")===0 ||
      hd.indexOf("f64x2.")===0);
  }
  function checkFuncBody(funcInfo) { var form=funcInfo.form,params=funcInfo.params,results=funcInfo.results;
    var localEnv = new Map(); for(var pi=0;pi<params.length;pi++) if(params[pi].name) localEnv.set(params[pi].name,stackType(params[pi].type));
    var bodyExprs = []; for(var i=2;i<N(form);i++){var part=A(form,i);if(Array.isArray(part)){var k=V(A(part,0));if(k==="param"||k==="result"||k==="effects"||k==="export")continue;}bodyExprs.push(part);}
    function synthesize(expr) { if(!Array.isArray(expr)){if(T(expr)==="number")return String(V(expr)).indexOf(".")>=0?"f32":"i32";if(T(expr)==="symbol")return localEnv.has(V(expr))?localEnv.get(V(expr)):"i32";return"i32";}
      // A layout accessor's `.memarg` modifier picks the LOWERING, not the
      // operation (see watxLayoutMemargHead in compiler-parser.js). Strip it
      // here, or `load.field.memarg` misses every head test below and falls
      // through to the "i32" default -- silently mistyping an f32/f64/i64 field
      // read for the one spelling the codegen is about to emit differently.
      var hd=watxLayoutMemargHead(V(A(expr,0))).head;if(!hd)return"i32";
      // SIMD (v128) first — scalar-returning extracts/reductions BEFORE the shape-prefix
      // fallback, so `(let $x (i32x4.extract_lane v 0))` types $x as i32, not v128.
      if(hd==="v128.any_true"||hd==="i8x16.all_true"||hd==="i16x8.all_true"||hd==="i32x4.all_true"||hd==="i64x2.all_true") return"i32";
      // bitmask reduces a vector to a scalar mask (migration gap G2) -- must be checked
      // before the shape-prefix fallback below, exactly like all_true/extract_lane.
      if(hd==="i8x16.bitmask"||hd==="i16x8.bitmask"||hd==="i32x4.bitmask"||hd==="i64x2.bitmask") return"i32";
      if(hd==="i8x16.extract_lane_s"||hd==="i8x16.extract_lane_u"||hd==="i16x8.extract_lane_s"||hd==="i16x8.extract_lane_u"||hd==="i32x4.extract_lane") return"i32";
      if(hd==="i64x2.extract_lane") return"i64";
      if(hd==="f32x4.extract_lane") return"f32";
      if(hd==="f64x2.extract_lane") return"f64";
      if(isSimdShapeHead(hd)) return"v128";
      if(hd.indexOf("i32.")===0)return"i32";if(hd.indexOf("i64.")===0)return"i64";if(hd.indexOf("f32.")===0)return"f32";if(hd.indexOf("f64.")===0)return"f64";
      if(["f32.convert_i32_s","f32.convert_i32_u","f32.demote_f64","f32.reinterpret_i32"].indexOf(hd)>=0)return"f32";
      if(["i32.trunc_f32_s","i32.trunc_f32_u","i32.reinterpret_f32","i32.wrap_i64"].indexOf(hd)>=0)return"i32";
      if(hd==="i64.extend_i32_s")return"i64";if(hd==="f64.promote_f32")return"f64";
      if(hd==="call"){var fn=V(A(expr,1));var im=importSigs.get(fn);if(im&&im.results.length>0)return stackType(im.results[0]);var uf=functions.get(fn);if(uf&&uf.results.length>0)return stackType(uf.results[0]);return"i32";}
      if(hd==="local.get"){var n=V(A(expr,1));return(n&&localEnv.has(n))?localEnv.get(n):"i32";}
      if(hd==="load.field"||hd==="load.elem"||hd==="load.field-elem"){var ln=V(A(expr,1)),fn=V(A(expr,2)),lo=layouts.get(ln);if(lo){var f=fieldsByLayout.get(fieldKey(ln,fn));if(f)return stackType(f.type);}return"i32";}
      if(hd==="let"){var nm=V(A(expr,1));if(N(expr)>=4&&T(A(expr,2))==="symbol"&&VALTYPE_TOKENS.indexOf(V(A(expr,2)))>=0){var dt=stackType(V(A(expr,2)));if(nm)localEnv.set(nm,dt);return dt;}if(nm&&A(expr,2)){var it=synthesize(A(expr,2));localEnv.set(nm,it);return it;}return"i32";}
      if(hd==="if"){if(T(A(expr,1))==="symbol"&&["i32","i64","f32","f64","v128"].indexOf(V(A(expr,1)))>=0)return stackType(V(A(expr,1)));return"i32";}
      if(hd==="select")return N(expr)>=3?synthesize(A(expr,1)):"i32";
      if(hd==="region.alloc"||hd==="region.addr"||hd==="region.size"||hd==="region.end"||hd==="set!"||hd==="local.set"||hd==="store.field"||hd==="store.elem"||hd==="store.field-elem")return"i32";
      // block/loop may carry a standard (result T) signature (migration gap G4); it wins
      // over the "type of the last body expression" guess.
      if(hd==="block"||hd==="loop"){
        var lb=T(A(expr,1))==="symbol"&&V(A(expr,1))&&V(A(expr,1)).charAt(0)==="$";
        var sig=A(expr,lb?2:1);
        if(Array.isArray(sig)&&V(A(sig,0))==="result") return stackType(V(A(sig,1))||"i32");
        if(sig&&!Array.isArray(sig)&&T(sig)==="symbol"&&VALTYPE_TOKENS.indexOf(V(sig))>=0) return stackType(V(sig));
        return N(expr)>=2?synthesize(A(expr,N(expr)-1)):"i32";
      }
      if(hd==="begin"||hd==="with-region")return N(expr)>=2?synthesize(A(expr,N(expr)-1)):"i32";
      if(["nop","drop","br","br_if","return"].indexOf(hd)>=0)return"i32";return"i32";}
    function checkExpr(expr,expected,context){var actual=synthesize(expr);if(actual!==expected)addWarning("Type mismatch in "+context+": expected "+expected+", got "+actual,expr);}
    function walkExpr(expr){if(!Array.isArray(expr))return;var hd=watxLayoutMemargHead(V(A(expr,0))).head;if(!hd)return;
      if(hd==="let"){var nm=V(A(expr,1));if(N(expr)>=4&&T(A(expr,2))==="symbol"&&VALTYPE_TOKENS.indexOf(V(A(expr,2)))>=0){var dt=stackType(V(A(expr,2)));if(nm)localEnv.set(nm,dt);checkExpr(A(expr,3),dt,"let "+nm+" init");walkExpr(A(expr,3));}else if(nm&&A(expr,2)){localEnv.set(nm,synthesize(A(expr,2)));walkExpr(A(expr,2));}return;}
      if(hd==="set!"||hd==="local.set"){var nm=V(A(expr,1));if(nm&&localEnv.has(nm)&&A(expr,2)){checkExpr(A(expr,2),localEnv.get(nm),"set! "+nm);walkExpr(A(expr,2));}return;}
      if(hd==="call"){var fn=V(A(expr,1));var ep=null;var im=importSigs.get(fn);if(im)ep=im.params;else{var uf=functions.get(fn);if(uf)ep=uf.params.map(function(p){return p.type});}if(ep){var args=SL(expr,2);for(var ai=0;ai<Math.min(args.length,ep.length);ai++)checkExpr(args[ai],stackType(ep[ai]),"call "+fn+" arg "+ai);if(args.length!==ep.length)addError("call "+fn+": expected "+ep.length+" args, got "+args.length+" (wrong number of arguments)",expr);}for(var i=2;i<N(expr);i++)walkExpr(A(expr,i));return;}
      if(hd==="store.field"){var ln=V(A(expr,1)),fn=V(A(expr,2)),lo=layouts.get(ln);if(lo){var f=fieldsByLayout.get(fieldKey(ln,fn));if(f&&A(expr,4))checkExpr(A(expr,4),stackType(f.type),"store.field "+ln+"."+fn);if(!f)addWarning("Unknown field "+fn+" in layout "+ln,expr);}else if(ln)addWarning("Unknown layout "+ln,expr);for(var i=3;i<N(expr);i++)walkExpr(A(expr,i));return;}
      if(hd==="store.elem"){var ln=V(A(expr,1)),fn=V(A(expr,2)),lo=layouts.get(ln);if(lo){var f=fieldsByLayout.get(fieldKey(ln,fn));if(f&&A(expr,5))checkExpr(A(expr,5),stackType(f.type),"store.elem "+ln+"."+fn);}for(var i=3;i<N(expr);i++)walkExpr(A(expr,i));return;}
      if(hd==="load.field"){var ln=V(A(expr,1)),fn=V(A(expr,2)),lo=layouts.get(ln);if(!lo&&ln)addWarning("Unknown layout "+ln,expr);else if(lo&&fn&&!fieldsByLayout.has(fieldKey(ln,fn)))addWarning("Unknown field "+fn+" in layout "+ln,expr);for(var i=3;i<N(expr);i++)walkExpr(A(expr,i));return;}
      if(hd==="store.field-elem"){var ln=V(A(expr,1)),fn=V(A(expr,2)),lo=layouts.get(ln);if(lo){var f=fieldsByLayout.get(fieldKey(ln,fn));if(f&&A(expr,5))checkExpr(A(expr,5),stackType(f.type),"store.field-elem "+ln+"."+fn);if(!f)addWarning("Unknown field "+fn+" in layout "+ln,expr);}else if(ln)addWarning("Unknown layout "+ln,expr);for(var i=3;i<N(expr);i++)walkExpr(A(expr,i));return;}
      if(hd==="load.field-elem"){var ln=V(A(expr,1)),fn=V(A(expr,2)),lo=layouts.get(ln);if(!lo&&ln)addWarning("Unknown layout "+ln,expr);else if(lo&&fn&&!fieldsByLayout.has(fieldKey(ln,fn)))addWarning("Unknown field "+fn+" in layout "+ln,expr);for(var i=3;i<N(expr);i++)walkExpr(A(expr,i));return;}
      if(hd==="if"){var ci=1;if(T(A(expr,1))==="symbol"&&["i32","i64","f32","f64","v128"].indexOf(V(A(expr,1)))>=0)ci=2;if(A(expr,ci)){checkExpr(A(expr,ci),"i32","if condition");walkExpr(A(expr,ci));}for(var i=ci+1;i<N(expr);i++)if(Array.isArray(A(expr,i)))walkExpr(A(expr,i));return;}
      if(hd==="with-region"){for(var i=3;i<N(expr);i++)if(Array.isArray(A(expr,i)))walkExpr(A(expr,i));return;}
      if(hd==="begin"||hd==="block"){for(var i=1;i<N(expr);i++)walkExpr(A(expr,i));return;}
      if(hd==="loop"){for(var i=2;i<N(expr);i++)walkExpr(A(expr,i));return;}
      // br_if: the CONDITION is always the last operand. The standard folded form for a
      // typed target block carries a branch value before it (migration gap G4), so
      // reading argument 2 unconditionally would type-check the wrong expression.
      if(hd==="br_if"){var hl=T(A(expr,1))==="symbol"&&V(A(expr,1))&&V(A(expr,1)).charAt(0)==="$";
        var cond=hl?A(expr,N(expr)-1):A(expr,1);
        if(hl&&N(expr)<3)cond=null;
        if(cond){checkExpr(cond,"i32","br_if condition");walkExpr(cond);}
        if(hl&&N(expr)>3)walkExpr(A(expr,2));
        return;}
      // br_table accepts both standard folded WAT and the explicit WATX labels group:
      //   (br_table $l0 $l1 ... $default <i32-idx-expr>)
      //   (br_table (labels $l0 $l1 ...) $default <i32-idx-expr>)
      if(hd==="br_table"){
        var first=A(expr,1), grouped=Array.isArray(first)&&V(A(first,0))==="labels";
        var defaultLabel=grouped?A(expr,2):A(expr,N(expr)-2);
        var indexExpr=grouped?A(expr,3):A(expr,N(expr)-1);
        if(!grouped&&N(expr)<3) addError("br_table: expected default label and index expression",expr);
        if(!defaultLabel) addError("br_table: missing default label",expr);
        if(!indexExpr) addError("br_table: missing index expression",expr);
        else { checkExpr(indexExpr,"i32","br_table index"); walkExpr(indexExpr); }
        return;
      }
      if(hd==="return"){if(A(expr,1)&&results.length>0){checkExpr(A(expr,1),stackType(results[0]),"return value");walkExpr(A(expr,1));}return;}
      // Bulk-memory: (memory.copy dst src len) / (memory.fill dst val len) -- all args i32, pushes NOTHING.
      // Arity + i32 check here; the emitter treats these as void (exprProducesValue returns false).
      if(hd==="memory.copy"||hd==="memory.fill"){
        if(N(expr)!==4) addError(hd+": expected 3 args (dst,"+(hd==="memory.copy"?"src":"val")+",len), got "+(N(expr)-1),expr);
        for(var i=1;i<Math.min(N(expr),4);i++){ checkExpr(A(expr,i),"i32",hd+" arg "+(i-1)); walkExpr(A(expr,i)); }
        return;
      }
      for(var i=1;i<N(expr);i++)if(Array.isArray(A(expr,i)))walkExpr(A(expr,i));}
    if(results.length>0&&bodyExprs.length>0){var lastExpr=bodyExprs[bodyExprs.length-1],lastType=synthesize(lastExpr),expectedResult=stackType(results[0]);
      if(lastType!==expectedResult)addWarning("Function "+(funcInfo.params.length?V(A(form,1)):"??")+": body produces "+lastType+", declared result is "+expectedResult,lastExpr);}
    for(var bi=0;bi<bodyExprs.length;bi++)walkExpr(bodyExprs[bi]);
  }
  // Required production diagnostics are emitted by codegen with exact opcode
  // context. Advisory type warnings are disabled there, so avoid a duplicate
  // full-module body walk.
  if(options.requiredOnly)return {errors:errors,warnings:warnings,layouts:layouts,functions:functions,regions:regions,importSigs:importSigs,functionDecls:functionDecls,inlineExportDecls:inlineExportDecls,declOrder:declOrder};
  for(var entry of functions){var name=entry[0],funcInfo=entry[1];
    try{checkFuncBody(funcInfo);}catch(e){console.warn("[WATX checker] Error checking "+name+":",e.message);addWarning("Type checker internal error in "+name+": "+e.message,funcInfo.form);}}
  if(errors.length>0)console.log("[WATX checker] "+errors.length+" error(s), "+warnings.length+" warning(s)");
  var foldedWarnings=errors.map(function(e){var r={};for(var k in e)r[k]=e[k];r.msg="[TYPE ERROR] "+e.msg;r.isTypeError=true;return r;}).concat(warnings);
  return {errors:errors,warnings:foldedWarnings,layouts:layouts,functions:functions,regions:regions,importSigs:importSigs,functionDecls:functionDecls,inlineExportDecls:inlineExportDecls,declOrder:declOrder};
}
