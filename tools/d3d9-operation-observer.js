'use strict';

// Test-only instrumentation of the exact loaded CommonJS script, including
// lexical constructor aliases. Never reconstruct it from the on-disk baseline:
// source-injected controls must exercise their actual loaded operations.
const Module = require('node:module');
const inspector = require('node:inspector');
const {pathToFileURL} = require('node:url');

function parser() {
  const m = new Module(__filename);
  // Node ships this parser; fail closed if the installed Node lacks it.
  const source = process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
  if (!source) throw Error('Node bundled JavaScript parser unavailable');
  m._compile(source, __filename + '.acorn');
  return m.exports;
}

function loadedSource(filename) {
  const session = new inspector.Session(), scripts = [];
  session.connect();
  session.on('Debugger.scriptParsed', ({params}) => {
    if (params.url === pathToFileURL(filename).href) scripts.push(params.scriptId);
  });
  try {
    let failure, source;
    session.post('Debugger.enable', {}, error => { failure = error; });
    if (failure || !scripts.length) throw failure || Error('loaded renderer script unavailable');
    session.post('Debugger.getScriptSource', {scriptId:scripts.at(-1)}, (error, result) => {
      failure = error; source = result?.scriptSource;
    });
    if (failure || typeof source !== 'string') throw failure || Error('renderer source unavailable');
    return source;
  } finally { session.disconnect(); }
}

function instrument(source) {
  if (source.includes('__renderOperationObserver')) throw Error('observer binding collision');
  const ast = parser().parse(source, {ecmaVersion:'latest', sourceType:'script'});
  function contains(node, predicate) {
    if (!node || typeof node !== 'object') return false;
    if (predicate(node)) return true;
    return Object.values(node).some(value => Array.isArray(value)
      ? value.some(child => contains(child,predicate)) : contains(value,predicate));
  }
  const outside = () => { throw Error('destructuring reference is outside the observer grammar'); };
  function sensitive(node) {
    return contains(node, n => n.type === 'RestElement' || n.type === 'Property' &&
      (n.computed || n.key.type === 'Literal' && /^(0|[1-9][0-9]*)$/.test(String(n.key.value))));
  }
  function plan(node) {
    if (node.type === 'AssignmentPattern') return plan(node.left);
    if (node.type === 'ArrayPattern') {
      if (sensitive(node)) outside();
      return null;
    }
    return node.type === 'ObjectPattern'
      ? node.properties.filter(p=>p.type !== 'RestElement').map(p=>plan(p.value)) : null;
  }
  function destructure(value, pattern) {
    return '__renderOperationObserver.destructure((' + value + '),' + JSON.stringify(plan(pattern)) + ')';
  }
  function pattern(node) {
    if (node.type === 'ObjectPattern') return '{' + node.properties.map(p => {
      if (p.type === 'RestElement') return '...' + pattern(p.argument);
      const key = p.computed ? '[(' + render(p.key,p,'key') + ')]' : source.slice(p.key.start,p.key.end);
      return key + ':' + pattern(p.value);
    }).join(',') + '}';
    if (node.type === 'AssignmentPattern') {
      const value = render(node.right,node,'right');
      return pattern(node.left) + '=(' + (node.left.type === 'ObjectPattern' ? destructure(value,node.left) : value) + ')';
    }
    if (node.type === 'ArrayPattern') {
      if (sensitive(node)) outside();
      return '[' + node.elements.map(p=>p ? pattern(p) : '').join(',') + ']';
    }
    if (node.type === 'RestElement') return '...' + pattern(node.argument);
    return render(node,{type:'AssignmentExpression'},'left');
  }
  function render(node, parent, key) {
    const children = [];
    for (const [name, value] of Object.entries(node)) {
      if (Array.isArray(value)) {
        for (const child of value) if (child && typeof child.type === 'string') children.push([child,name]);
      } else if (value && typeof value.type === 'string') children.push([value,name]);
    }
    const part = child => render(child, node, Object.keys(node).find(k=>node[k]===child));
    if (node.type === 'ObjectPattern') {
      // Parameter/catch/loop binding initialization has its own evaluation
      // environment. Reject indexed patterns there rather than moving defaults
      // or iterator operations across a scope boundary.
      if (sensitive(node)) outside();
    }
    if (node.type === 'VariableDeclarator' && node.id.type === 'ObjectPattern' && node.init) {
      return pattern(node.id) + '=' + destructure(part(node.init),node.id);
    }
    if (node.type === 'AssignmentExpression' && node.left.type === 'ObjectPattern') {
      return '__renderOperationObserver.destructuredValue((' + pattern(node.left) + '=' + destructure(part(node.right),node.left) + '))';
    }
    if ((node.type === 'AssignmentExpression' && node.operator !== '=' || node.type === 'UpdateExpression') &&
        (node.left || node.argument).type === 'MemberExpression' && (node.left || node.argument).computed) {
      const member = node.left || node.argument;
      if (member.object.type === 'Super' || member.optional) {
        throw Error('computed super or optional update is outside the observer grammar');
      }
      // Keep the native operator (including short circuit and ToNumeric) on a
      // reference facade. Its Get/Set forward to the original receiver. The
      // original key value is retained: native compound Get and Set may each
      // coerce it, with user code between the two conversions.
      const ref = '__renderOperationObserver.reference((' + render(member.object,member,'object') + '),(' +
        render(member.property,member,'property') + ')).value';
      const operation = node.type === 'UpdateExpression'
        ? node.prefix ? '('+node.operator+ref+')' : '('+ref+node.operator+')'
        : '(' + ref + node.operator + '(' + part(node.right) + '))';
      // instrument() also has historical read/construct-only syntax clients.
      // Keep their native lvalue behavior and counter contract. create() always
      // supplies the full reference hook; measured execution never takes this
      // compatibility branch.
      return '(__renderOperationObserver.reference?' + operation + ':(' + source.slice(node.start,node.end) + '))';
    }
    if (node.type === 'ChainExpression' && contains(node, n => n.type === 'MemberExpression' && n.computed) &&
        parent && ((parent.type === 'CallExpression' && key === 'callee') ||
        (parent.type === 'TaggedTemplateExpression' && key === 'tag') ||
        (parent.type === 'UnaryExpression' && parent.operator === 'delete'))) {
      throw Error('optional computed reference is outside the observer grammar');
    }
    if (node.type === 'ChainExpression' && node.expression.type === 'MemberExpression' &&
        node.expression.computed && node.expression.optional) {
      // The lazy key thunk cannot contain suspension: moving it across a
      // function boundary changes its meaning.
      if (contains(node.expression.property, n => ['AwaitExpression','YieldExpression'].includes(n.type) ||
          n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'eval')) {
        throw Error('suspending or direct-eval optional computed access is outside the observer grammar');
      }
      return '__renderOperationObserver.readOptional(' + render(node.expression.object,node.expression,'object')+
        ',()=>(' + render(node.expression.property,node.expression,'property')+'))';
    }
    if (node.type === 'ChainExpression' && contains(node, n => n.type === 'MemberExpression' && n.computed)) {
      throw Error('nonterminal optional computed access is outside the observer grammar');
    }
    if (node.type === 'NewExpression') {
      return '__renderOperationObserver.construct(' + part(node.callee) + ',[' +
        node.arguments.map(part).join(',') + '])';
    }
    // Leave lvalues and method receivers intact. Ordinary computed reads are
    // evaluated exactly once, in their original object/key order.
    const receiver = parent && ((parent.type === 'CallExpression' && key === 'callee') ||
      (parent.type === 'TaggedTemplateExpression' && key === 'tag') ||
      (parent.type === 'AssignmentExpression' && key === 'left') ||
      parent.type === 'UpdateExpression' || parent.type === 'UnaryExpression' && parent.operator === 'delete');
    if (node.type === 'MemberExpression' && node.computed && node.optional) {
      throw Error('nonterminal optional computed access is outside the observer grammar');
    }
    if (node.type === 'MemberExpression' && node.computed && !node.optional && !receiver) {
      if (node.object.type === 'Super') throw Error('computed super read is outside the observer grammar');
      return '__renderOperationObserver.read((' + part(node.object) + '),(' + part(node.property) + '))';
    }
    children.sort((a,b)=>a[0].start-b[0].start);
    let result='', offset=node.start;
    for (const [child,name] of children) {
      if (child.start < offset) continue; // shorthand properties share a node
      result += source.slice(offset,child.start)+render(child,node,name); offset=child.end;
    }
    return result+source.slice(offset,node.end);
  }
  return render(ast);
}

function create(filename) {
  let active = null;
  const destructured = new WeakMap();
  const observer = {
    readOptional(object, key) {
      return object == null ? undefined : observer.read(object,key());
    },
    read(object, key) {
      if (active && active.isSource(object)) {
        // Convert once with native ToPropertyKey (including symbol and object
        // keys); reuse the converted key for the actual indexed access.
        const property = Reflect.ownKeys({[key]:0})[0];
        if (typeof property === 'string' && /^(0|[1-9][0-9]*)$/.test(property) &&
            active.isSource(object,Number(property))) active.counts.indexedSourceReads++;
        return object[property];
      }
      return object[key];
    },
    reference(object, key) {
      return new Proxy({}, {
        get() { return observer.read(object,key); },
        // The trap result leaves strict/sloppy assignment failure to the
        // original expression; primitive receivers must not gain boxed stores.
        set(_target, _property, value) { return Reflect.set(Object(object),key,value,object); },
      });
    },
    destructure(object, plans) {
      if (object == null) throw TypeError('Cannot destructure null or undefined');
      let next = 0;
      const facade = new Proxy({}, {
        get(_target, key) {
          const value = observer.read(object,key), nested = plans[next++];
          return nested && value !== undefined ? observer.destructure(value,nested) : value;
        },
        ownKeys() { return Reflect.ownKeys(Object(object)); },
        getOwnPropertyDescriptor(_target, key) {
          const d = Reflect.getOwnPropertyDescriptor(Object(object),key);
          return d && {...d,configurable:true};
        },
      });
      destructured.set(facade,object);
      return facade;
    },
    destructuredValue(value) { return destructured.get(value); },
    construct(target, args) {
      const result = Reflect.construct(target,args);
      if (active) active.allocation(result,args);
      return result;
    },
  };
  const source = loadedSource(filename), transformed = instrument(source);
  const m = new Module(filename, module);
  m.filename=filename; m.paths=Module._nodeModulePaths(require('node:path').dirname(filename));
  m.__renderOperationObserver=observer;
  const body = parser().parse(transformed,{ecmaVersion:'latest',sourceType:'script'}).body;
  const insertion = body.find(node=>!node.directive)?.start ?? transformed.length;
  // Keep any original directive prologue, especially 'use strict', effective.
  m._compile(transformed.slice(0,insertion)+
    'const __renderOperationObserver=module.__renderOperationObserver;\n'+
    transformed.slice(insertion), filename+'.observed');
  return {exports:m.exports, enter(scope) {
    if (active) throw Error('nested measurement');
    active=scope; return () => {active=null;};
  }};
}
module.exports = {create, instrument};
