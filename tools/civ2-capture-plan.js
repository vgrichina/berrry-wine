'use strict';

// One cumulative task allowance. No filesystem census, counter reset, or deletion credit.
const SETUP = ['language', 'heralds', 'intro', 'post-intro', 'world', 'difficulty',
  'civilizations', 'barbarians', 'rules', 'gender', 'tribe', 'name', 'ready',
  'map-entry', 'map-before', 'gameplay-before'];
const ACCEPTANCE = ['orders-menu', 'city-name', 'city-founded-ui', 'first-city-tutorial', 'production-screen'];
const CLEANUP = ['quit-confirmation'];
const KNOWN_ROUTE = [...SETUP, ...ACCEPTANCE, ...CLEANUP];

class CapturePlan {
  constructor(config, now = Date.now) {
    this.config = {...config, route: config.route && [...config.route]}; this.now = now; this.started = false; this.stopped = false;
    this.index = -1; this.attempts = 0; this.successes = 0;
    this.chargedBytes = 0; this.retainedBytes = 0; this.inFlight = false;
    this.records = []; this.verified = false;
  }
  fail(message) { this.stopped = true; throw Error(message); }
  admit() {
    if (this.started) this.fail('plan already started; no allowance reset');
    const c = this.config;
    for (const k of ['totalCaptures', 'perImageBytes', 'retainedBytes', 'totalCaptureBytes',
      'width', 'height', 'setupMs', 'acceptanceMs', 'cleanupMs', 'totalMs', 'cutoff', 'ackTimeoutMs']) {
      if (!Number.isSafeInteger(c[k]) || c[k] <= 0) this.fail('invalid explicit allocation: ' + k);
    }
    if (!c.allocationId || typeof c.allocationId !== 'string') this.fail('explicit task allocationId required');
    this.route = c.route || KNOWN_ROUTE;
    if (!Array.isArray(this.route) || new Set(this.route).size !== this.route.length) this.fail('invalid route');
    // Additional inspected dialogs may be explicitly inserted in acceptance; known reserves cannot disappear.
    let previous = -1;
    for (const stage of KNOWN_ROUTE) {
      const i = this.route.indexOf(stage);
      if (i <= previous) this.fail('missing/reordered required stage: ' + stage);
      previous = i;
    }
    if (this.route.slice(0, SETUP.length).join() !== SETUP.join() || this.route.at(-1) !== 'quit-confirmation') this.fail('invalid reserve boundaries');
    this.minimum = this.route.length;
    if (c.totalCaptures < this.minimum) this.fail(`known route requires minimum ${this.minimum} captures: setup 16; acceptance ${this.minimum - 17} (${this.route.slice(16, -1).join(', ')}); cleanup 1 (quit-confirmation); configured ${c.totalCaptures}`);
    // Worst-case retention is admitted separately from lifetime capture count/bytes.
    const bytes = c.totalCaptures * c.perImageBytes;
    if (!Number.isSafeInteger(bytes) || bytes > c.retainedBytes || bytes > c.totalCaptureBytes) this.fail('capture bytes/retained bytes allocation cannot cover configured count');
    if (c.ackTimeoutMs > Math.min(c.setupMs, c.acceptanceMs, c.cleanupMs)) this.fail('ACK timeout exceeds phase budget');
    const requiredMs = c.setupMs + c.acceptanceMs + c.cleanupMs;
    this.start = this.now(); this.deadline = Math.min(this.start + c.totalMs, c.cutoff);
    if (!Number.isSafeInteger(requiredMs) || this.deadline - this.start < requiredMs) this.fail(`time plan requires ${requiredMs}ms including acceptance ${c.acceptanceMs}ms and cleanup ${c.cleanupMs}ms`);
    this.phaseEnds = {setup: this.deadline - c.acceptanceMs - c.cleanupMs,
      acceptance: this.deadline - c.cleanupMs, cleanup: this.deadline};
    this.started = true;
    return this.snapshot();
  }
  phase(index = this.index) { return index < 16 ? 'setup' : index < this.route.length - 1 ? 'acceptance' : 'cleanup'; }
  guard(operationMs = 0, index = this.index) {
    if (!this.started || this.stopped) this.fail('plan inactive/stopped; no replay');
    if (!Number.isFinite(operationMs) || operationMs < 0 || this.now() + operationMs >= this.phaseEnds[this.phase(index)]) this.fail('deadline reserve: ' + this.phase(index));
  }
  beginCapture(stage) {
    this.guard(this.config.ackTimeoutMs, this.index + 1);
    if (this.inFlight || this.route[this.index + 1] !== stage) this.fail('unknown/out-of-order dialog: ' + stage);
    const future = this.route.length - (this.index + 2);
    if (this.attempts + 1 + future > this.config.totalCaptures) this.fail('capture reserve exhausted');
    if (this.chargedBytes + this.config.perImageBytes * (1 + future) > this.config.totalCaptureBytes ||
        this.retainedBytes + this.config.perImageBytes * (1 + future) > this.config.retainedBytes) this.fail('byte reserve exhausted');
    this.index++; this.attempts++; this.chargedBytes += this.config.perImageBytes;
    this.inFlight = true; this.verified = false;
    this.records.push({stage, attempt: this.attempts, status: 'uncertain', chargedBytes: this.config.perImageBytes});
  }
  observeCaptureBytes(bytes) {
    if (!this.inFlight) this.fail('no capture owned');
    if (!Number.isSafeInteger(bytes) || bytes < 0 || this.records.at(-1).retainedBytes !== undefined) this.fail('invalid/repeated capture observation');
    this.chargedBytes -= this.config.perImageBytes - bytes; this.retainedBytes += bytes;
    Object.assign(this.records.at(-1), {status:'observed',chargedBytes:bytes,retainedBytes:bytes});
    // Record the actual rejected output too; do not hide it by reporting zero retained bytes.
    if (bytes <= 0 || bytes > this.config.perImageBytes || this.retainedBytes > this.config.retainedBytes || this.chargedBytes > this.config.totalCaptureBytes) this.fail('capture bytes/dimensions rejected');
  }
  finishCapture(bytes, width, height) {
    if (!this.inFlight) this.fail('no capture owned');
    if (this.records.at(-1).retainedBytes === undefined) this.observeCaptureBytes(bytes);
    if (bytes !== this.records.at(-1).retainedBytes || width !== this.config.width || height !== this.config.height) this.fail('capture bytes/dimensions rejected');
    this.successes++; this.inFlight = false;
    Object.assign(this.records.at(-1), {status: 'captured', chargedBytes: bytes, retainedBytes: bytes});
  }
  verify() {
    this.guard();
    if (this.inFlight || !this.records.length || this.records.at(-1).status !== 'captured') this.fail('no presented capture to verify');
    this.verified = true;
  }
  beforeInput() {
    this.guard(this.config.ackTimeoutMs);
    if (!this.verified) this.fail('input requires current presented pixel verification');
  }
  snapshot() {
    return {allocationId: this.config.allocationId, minimumCaptures: this.minimum,
      attempts: this.attempts, successes: this.successes, chargedBytes: this.chargedBytes,
      retainedBytes: this.retainedBytes, uncertainRetainedCaptures: this.records.filter(r=>r.retainedBytes===undefined).length,
      stopped: this.stopped, stage: this.route?.[this.index],
      reservedStages: this.route?.slice(this.index + 1), phaseEnds: this.phaseEnds, records: this.records};
  }
}
module.exports = {CapturePlan, SETUP, ACCEPTANCE, CLEANUP, KNOWN_ROUTE};
