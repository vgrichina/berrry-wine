'use strict';

// Request ownership only. Adapters execute on the receiving guest thread and
// report deferred without entering a callback when it is not at a message call.
// A scheduler calls notifyReady after receiver progress; no polling loop here.
class ProcessSendBroker {
  constructor() { this.processes = new Map(); this.requests = new Set(); }

  register(pid, adapter) {
    if (this.processes.has(pid)) throw new Error('Process already registered');
    if (typeof adapter.dispatch !== 'function') throw new TypeError('Missing send dispatcher');
    const endpoint = { pid, adapter, live: true, queue: [], stack: [], readyEpoch: 0, threads: new Map() };
    this.processes.set(pid, endpoint);
    return endpoint;
  }

  _live(endpoint) {
    return endpoint?.live && this.processes.get(endpoint.pid) === endpoint;
  }

  _error(code) { return Object.assign(new Error(code), { code }); }

  async send(sender, receiver, message, context, senderLink) {
    if (!this._live(sender)) return Promise.reject(this._error('sender-gone'));
    if (senderLink && sender.adapter.ownsLink && !sender.adapter.ownsLink(senderLink))
      throw this._error('sender-gone');
    if (!this._live(receiver)) return Promise.reject(this._error('receiver-gone'));
    // Context is supplied only to a currently executing adapter callback.
    // Reusing a completed context must not bypass another callback's ownership.
    if (context && (!this.requests.has(context.request) || context.request.settled ||
        context.request.receiver !== sender ||
        (sender.adapter.resolve && context.request.lane.link !== senderLink)))
      return Promise.reject(this._error('stale-send-context'));
    const link = receiver.adapter.resolve ? await receiver.adapter.resolve(message) : undefined;
    if (!this._live(receiver) || (receiver.adapter.resolve && !link)) throw this._error('receiver-gone');
    if (!this._live(sender)) throw this._error('sender-gone');
    if (senderLink && sender.adapter.ownsLink && !sender.adapter.ownsLink(senderLink))
      throw this._error('sender-gone');
    if (context && (!this.requests.has(context.request) || context.request.settled))
      throw this._error('stale-send-context');
    let lane = receiver;
    if (link !== undefined) {
      lane = receiver.threads.get(link);
      if (!lane) {
        lane = { link, queue: [], stack: [], readyEpoch: 0, endpoint: receiver };
        receiver.threads.set(link, lane);
      }
    }
    const chain = context ? context.chain : Symbol('send chain');
    return new Promise((resolve, reject) => {
      const request = { sender, senderLink, receiver, lane, message: Object.freeze({...message}),
        chain, parent: context?.request || null, resolve, reject,
        settled: false, deferred: false, executing: false };
      this.requests.add(request);
      request.unsubscribeRetiring = senderLink?.onRetiring?.(() =>
        this._settle(request, this._error('sender-gone')));
      // onRetiring may call back synchronously for an already retired link.
      if (request.settled) { request.unsubscribeRetiring?.(); return; }
      request.unsubscribeReceiverRetiring = link?.onRetiring?.(() => {
        request.receiverRetiring = true;
        // An in-flight adapter still owns its frame/retirement receipt. If it
        // returns deferred below, no frame was entered and cancellation wins.
        if (!request.executing) this._settle(request, this._error('receiver-gone'));
      });
      if (request.settled) { request.unsubscribeReceiverRetiring?.(); return; }
      lane.queue.push(request);
      this._pump(receiver, lane);
    });
  }

  enterWait(context, link, token) {
    const request = context?.request;
    if (!this.requests.has(request) || request.settled || request.lane.stack.at(-1) !== request ||
        request.lane.link !== link || !Number.isSafeInteger(token?.frameToken) ||
        !Number.isSafeInteger(token?.waitEpoch) || request.wait)
      throw this._error('stale-send-context');
    const wait = Object.freeze({ frameToken: token.frameToken, waitEpoch: token.waitEpoch, yield: token.yield || 10 });
    request.wait = wait;
    request.lane.readyEpoch++;
    for (const queued of request.lane.queue) queued.deferred = false;
    this._pump(request.receiver, request.lane);
    return async () => {
      if (request.wait === wait) request.wait = null;
      await this._waitTop(request);
    };
  }

  async enterThreadWait(endpoint, link, token) {
    if (!this._live(endpoint) || !link || token?.frameToken !== 0 || !Number.isSafeInteger(token.waitEpoch))
      throw this._error('stale-send-context');
    let lane = endpoint.threads.get(link);
    if (!lane) {
      lane = { link, queue: [], stack: [], readyEpoch: 0, endpoint };
      endpoint.threads.set(link, lane);
    }
    // Admission may already be in flight when the Worker captures the root
    // wait. Its atomic guard defers that unowned offer; let the broker receipt
    // drain before publishing the new token.
    while (lane.stack.length) await lane.stack.at(-1).unwound;
    if (!this._live(endpoint) || (endpoint.adapter.ownsLink && !endpoint.adapter.ownsLink(link)))
      throw this._error('sender-gone');
    if (lane.wait) throw this._error('stale-send-context');
    lane.wait = Object.freeze({...token});
    lane.readyEpoch++;
    for (const queued of lane.queue) queued.deferred = false;
    this._pump(endpoint, lane);
    return async () => {
      lane.wait = null;
      while (lane.stack.length) await lane.stack.at(-1).unwound;
    };
  }

  async _waitTop(request) {
    while (request.lane.stack.includes(request) && request.lane.stack.at(-1) !== request)
      await request.lane.stack.at(-1).unwound;
  }

  _settle(request, error, result) {
    if (request.settled) return;
    request.settled = true;
    request.unsubscribeRetiring?.();
    request.unsubscribeReceiverRetiring?.();
    const queued = request.lane.queue.indexOf(request);
    if (queued >= 0) request.lane.queue.splice(queued, 1);
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

  notifyReady(endpoint, link) {
    if (!this._live(endpoint)) return;
    if (link !== undefined) {
      const lane = endpoint.threads.get(link);
      if (!lane) return;
      lane.readyEpoch++;
      for (const request of lane.queue) request.deferred = false;
      this._pump(endpoint, lane);
      return;
    }
    endpoint.readyEpoch++;
    for (const request of endpoint.queue) request.deferred = false;
    for (const lane of endpoint.threads.values()) {
      lane.readyEpoch++;
      for (const request of lane.queue) request.deferred = false;
    }
    this._pump(endpoint);
  }

  hasPending(endpoint, link) {
    const lanes = link === undefined ? [endpoint, ...endpoint.threads.values()] : [endpoint.threads.get(link)];
    return this._live(endpoint) && lanes.some(lane => lane && (lane.stack.length > 0 ||
      lane.queue.some(request => !request.settled)));
  }

  _pump(endpoint, lane) {
    if (!this._live(endpoint)) return;
    if (!lane) {
      for (const target of [endpoint, ...endpoint.threads.values()]) this._pump(endpoint, target);
      return;
    }
    for (const request of [...lane.queue]) {
      if (!this._live(request.sender) || (request.senderLink && request.sender.adapter.ownsLink &&
          !request.sender.adapter.ownsLink(request.senderLink)))
        this._settle(request, this._error('sender-gone'));
      else if (request.receiverRetiring || (lane.link && endpoint.adapter.ownsLink &&
          !endpoint.adapter.ownsLink(lane.link)))
        this._settle(request, this._error('receiver-gone'));
    }
    lane.queue = lane.queue.filter(r => !r.settled);
    const owner = lane.stack.at(-1);
    const canEnter = request => {
      if (!owner) return true;
      if (request.chain !== owner.chain) return !!owner.wait;
      // Same-chain siblings are independent callbacks too. Only a descendant
      // of the current frame may reenter it, maintaining a real call stack.
      for (let parent=request.parent;parent;parent=parent.parent)
        if (parent === owner) return true;
      return false;
    };
    const index = lane.queue.findIndex(r => !r.deferred && canEnter(r));
    if (index < 0) return;
    const request = lane.queue.splice(index, 1)[0];
    request.executing = true;
    let release;
    request.unwound = new Promise(resolve => { release = resolve; });
    lane.stack.push(request);
    const context = Object.freeze({chain: request.chain, request});
    const admittedEpoch = lane.readyEpoch;
    const admission = owner?.wait || (!owner && lane.wait);
    Promise.resolve().then(() => {
      if (request.settled || !this._live(endpoint)) return {unavailable:true};
      if (request.receiverRetiring || (lane.link && endpoint.adapter.ownsLink &&
          !endpoint.adapter.ownsLink(lane.link))) return {unavailable:true};
      if (!this._live(request.sender) || (request.senderLink && request.sender.adapter.ownsLink &&
          !request.sender.adapter.ownsLink(request.senderLink))) throw this._error('sender-gone');
      return endpoint.adapter.dispatch(request.message, context, lane.link, admission);
    }).then(async reply => {
      await this._waitTop(request);
      if (request.settled) return;
      if (reply?.deferred) {
        if (request.receiverRetiring || (lane.link && endpoint.adapter.ownsLink &&
            !endpoint.adapter.ownsLink(lane.link))) {
          this._settle(request, this._error('receiver-gone'));
          return;
        }
        request.deferred = lane.readyEpoch === admittedEpoch;
        lane.queue.unshift(request);
      } else if (reply?.unavailable) {
        this._settle(request, this._error('receiver-gone'));
      } else if (reply?.done === true && Number.isInteger(reply.result)) {
        this._settle(request, null, reply.result);
      } else {
        this._settle(request, this._error('invalid-send-reply'));
      }
    }, async error => {
      await this._waitTop(request);
      this._settle(request, error);
    }).finally(() => {
      request.executing = false;
      const index = lane.stack.indexOf(request);
      if (index >= 0) lane.stack.splice(index, 1);
      release();
      this._pump(endpoint, lane);
    });
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { ProcessSendBroker };
else globalThis.ProcessSendBroker = ProcessSendBroker;
