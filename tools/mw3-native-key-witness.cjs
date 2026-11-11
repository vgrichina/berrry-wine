'use strict';

// Serialized into the ordinary Chromium controller's early capture listener.
// Chromium checkpoints microtasks BETWEEN native event listeners. Neither a
// capture microtask nor a later timer proves which producer emitted an edge.
// Observe the synchronous producer inside the bridge's actual handleKey* call,
// bound to Chromium's current Event object (not its timestamp or key alone).
// This observer never delivers input, consumes a buffer or changes guest state.
function install({getRenderer, rowForEvent}) {
  const installed = new WeakSet();
  return function bind(renderer) {
    if (!renderer || installed.has(renderer)) return;
    installed.add(renderer);
    const names = ['handleKeyDown', 'handleKeyUp', '_recordDirectInputKey'];
    const originals = names.map(name => renderer[name]);
    if (originals.some(f => typeof f !== 'function')) return;
    let frame;
    const wrappers = names.map((name, index) => function(...args) {
      if (index === 2) {
        const current = frame;
        const before = this._diKeyboardSequence;
        const result = originals[index].apply(this, args);
        if (current) {
          const sequence = this._diKeyboardSequence;
          current.records.push({vk:args[0], down:args[1], sequence,
            emitted:Number.isInteger(sequence) && sequence !== before});
        }
        return result;
      }
      const event = globalThis.event;
      const row = event && rowForEvent(event);
      if (!row || this !== renderer) return originals[index].apply(this, args);
      const previous = frame;
      const witness = {kind:'synchronous-key-producer', code:event.code,
        type:event.type, trusted:event.isTrusted, vk:args[0], records:[],
        completed:false, errors:[]};
      if (row.keyWitness) witness.errors.push('duplicate delivery');
      if (getRenderer() !== renderer) witness.errors.push('renderer replaced');
      if (names.some((n, i) => renderer[n] !== wrappers[i])) witness.errors.push('producer wrapper replaced');
      if (event.type !== (index === 0 ? 'keydown' : 'keyup')) witness.errors.push('wrong delivery type');
      if (args[1]?.code !== event.code || args[0] !== event.keyCode) witness.errors.push('wrong delivery key');
      row.keyWitness = witness; frame = witness;
      try {
        const result = originals[index].apply(this, args);
        witness.completed = true;
        return result;
      } catch (error) {
        witness.errors.push('producer threw: ' + error);
        throw error;
      } finally { frame = previous; }
    });
    names.forEach((name, i) => { renderer[name] = wrappers[i]; });
  };
}

module.exports = {install};
