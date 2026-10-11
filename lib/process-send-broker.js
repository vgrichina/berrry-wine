'use strict';

// Request ownership only. Adapters execute on the receiving guest thread and
// report deferred without entering a callback when it is not at a message call.
// A scheduler calls notifyReady after receiver progress; no polling loop here.
class ProcessSendBroker {
  constructor() { this.processes = new Map(); this.requests = new Set(); }

  register(pid, adapter) {
    if (this.processes.has(pid)) throw new Error('Process already registered');
    if (typeof adapter.dispatch !== 'function') throw new TypeError('Missing send dispatcher');
    const endpoint = { pid, adapter, live: true, queue: [], stack: [], readyEpoch: 0 };
    this.processes.set(pid, endpoint);
    return endpoint;
  }

  _live(endpoint) {
    return endpoint?.live && this.processes.get(endpoint.pid) === endpoint;
  }

  _error(code) { return Object.assign(new Error(code), { code }); }

  send(sender, receiver, message, context) {
    if (!this._live(sender)) return Promise.reject(this._error('sender-gone'));
    if (!this._live(receiver)) return Promise.reject(this._error('receiver-gone'));
    // Context is supplied only to a currently executing adapter callback.
    // Reusing a completed context must not bypass another callback's ownership.
    if (context && (!this.requests.has(context.request) || context.request.settled))
      return Promise.reject(this._error('stale-send-context'));
    const chain = context ? context.chain : Symbol('send chain');
    return new Promise((resolve, reject) => {
      const request = { sender, receiver, message: Object.freeze({...message}),
        chain, parent: context?.request || null, resolve, reject,
        settled: false, deferred: false, executing: false };
      this.requests.add(request);
      receiver.queue.push(request);
      this._pump(receiver);
    });
  }

  _settle(request, error, result) {
    if (request.settled) return;
    request.settled = true;
    this.requests.delete(request);
    if (error) request.reject(error);
    else request.resolve(result | 0);
  }

  retire(endpoint) {
    if (!this._live(endpoint)) return;
    endpoint.live = false;
    this.processes.delete(endpoint.pid);
    for (const request of [...this.requests]) {
      if (request.receiver === endpoint || request.sender === endpoint) {
        this._settle(request, this._error(request.receiver === endpoint
          ? 'receiver-gone' : 'sender-gone'));
      }
    }
    // An executing receiver callback still owns its frame after sender exit.
    // Let it unwind; do not inject aborts into a possibly nested guest frame.
    for (const other of this.processes.values()) this._pump(other);
  }

  notifyReady(endpoint) {
    if (!this._live(endpoint)) return;
    endpoint.readyEpoch++;
    for (const request of endpoint.queue) request.deferred = false;
    this._pump(endpoint);
  }

  hasPending(endpoint) {
    return this._live(endpoint) && (endpoint.stack.length > 0 ||
      endpoint.queue.some(request => !request.settled));
  }

  _pump(endpoint) {
    if (!this._live(endpoint)) return;
    endpoint.queue = endpoint.queue.filter(r => !r.settled);
    const owner = endpoint.stack.at(-1);
    const canEnter = request => {
      if (!owner) return true;
      if (request.chain !== owner.chain) return false;
      // Same-chain siblings are independent callbacks too. Only a descendant
      // of the current frame may reenter it, maintaining a real call stack.
      for (let parent=request.parent;parent;parent=parent.parent)
        if (parent === owner) return true;
      return false;
    };
    const index = endpoint.queue.findIndex(r => !r.deferred && canEnter(r));
    if (index < 0) return;
    const request = endpoint.queue.splice(index, 1)[0];
    request.executing = true;
    endpoint.stack.push(request);
    const context = Object.freeze({chain: request.chain, request});
    const admittedEpoch = endpoint.readyEpoch;
    Promise.resolve().then(() => {
      if (request.settled || !this._live(endpoint)) return {unavailable:true};
      return endpoint.adapter.dispatch(request.message, context);
    }).then(reply => {
      if (request.settled) return;
      if (reply?.deferred) {
        request.deferred = endpoint.readyEpoch === admittedEpoch;
        endpoint.queue.unshift(request);
      } else if (reply?.unavailable) {
        this._settle(request, this._error('receiver-gone'));
      } else if (reply?.done === true && Number.isInteger(reply.result)) {
        this._settle(request, null, reply.result);
      } else {
        this._settle(request, this._error('invalid-send-reply'));
      }
    }, error => this._settle(request, error)).finally(() => {
      request.executing = false;
      const index = endpoint.stack.indexOf(request);
      if (index >= 0) endpoint.stack.splice(index, 1);
      this._pump(endpoint);
    });
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { ProcessSendBroker };
else globalThis.ProcessSendBroker = ProcessSendBroker;
