'use strict';

// Opt-in run.js instrumentation for the shareware diablo_s.exe only.
// 0x40dd6b is the back-edge target of the actual gameplay message/tick loop.
// A WASM breakpoint stops on EVERY iteration, independent of the slice budget.
// All arms boot with the experimental decoder disabled. Guest time advances
// 50ms per gameplay iteration; it is constant during each iteration, including
// across budget yields. Warmup, measurement and input use this semantic boundary.
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const LOOP = 0x40dd6b;
function createBenchmark({ out, warmup = 100, iterations = 600, enabled = 1,
  apiCount = () => 0, walking = false, renderer = null, profile = null }) {
  if (!out || !Number.isInteger(warmup) || warmup < 1 ||
      !Number.isInteger(iterations) || iterations < 1 || ![0, 1].includes(enabled))
    throw new Error('invalid gameplay benchmark options');
  let ex, memory, active = false, iteration = 0, clock = 0, started = false;
  let startWall, startCpu, startLoad, startHash, startApi, startChains, startFast, frames = 0, latest = null;
  let digest = crypto.createHash('sha256');
  const samples = [];
  const positions = [], checkpoints = [], inputEvents = [];
  let profiler = null;
  let realtime = null;
  const post = (method, params = {}) => new Promise((resolve, reject) =>
    profiler.post(method, params, (error, result) => error ? reject(error) : resolve(result)));
  // Opposite around the world viewport's tile anchor (320,176). Using two
  // targets below the anchor drifted into the river and became an idle test.
  const route = [[320, 270], [320, 82]];
  function player() {
    const index = ex.guest_read32(0x4ad1a8) >>> 0;
    if (index > 3) throw new Error('invalid Diablo player index ' + index);
    return [ex.guest_read32(0x4ad1e8 + index * 0x54d8),
      ex.guest_read32(0x4ad1ec + index * 0x54d8)];
  }
  const hash = b => crypto.createHash('sha256').update(b).digest('hex');
  function picture() {
    if (!latest) throw new Error('benchmark has no DirectDraw primary frame');
    const { dib, pal, bpp } = latest;
    if (bpp !== 8) throw new Error(`expected Diablo 8bpp, got ${bpp}`);
    return Buffer.concat([Buffer.from(memory.buffer, dib, 640 * 480),
      Buffer.from(memory.buffer, pal, 1024)]);
  }
  function capture(suffix, bytes = picture()) {
    const { PNG } = require('pngjs');
    const png = new PNG({ width: 640, height: 480 });
    let life = 0, mana = 0;
    for (let y = 0; y < 480; y++) for (let x = 0; x < 640; x++) {
      const i = y * 640 + x, p = 640 * 480 + bytes[i] * 4;
      const r = bytes[p], g = bytes[p + 1], b = bytes[p + 2];
      png.data[i * 4] = r; png.data[i * 4 + 1] = g; png.data[i * 4 + 2] = b;
      png.data[i * 4 + 3] = 255;
      if (y >= 365 && y < 436 && x >= 110 && x < 186 && r > 40 && r > g * 2 && r > b * 2) life++;
      if (y >= 365 && y < 436 && x >= 455 && x < 531 && b > 40 && b > r * 1.5 && b > g * 1.2) mana++;
    }
    fs.writeFileSync(out + '.' + suffix + '.png', PNG.sync.write(png));
    if (life < 800 || mana < 400) throw new Error(`not gameplay: HUD orbs ${life}/${mana}`);
    return { life, mana };
  }
  return {
    get active() { return active; },
    get now() { return realtime ? (clock + Date.now() - realtime.wallOrigin) | 0 : clock; },
    get done() { return iteration >= warmup + iterations; },
    init(exports, mem) {
      ex = exports; memory = mem;
      if (ex.set_bench_candidate) ex.set_bench_candidate(0);
      ex.set_bp(LOOP);
    },
    present(kind, slot, bpp, dib, pal) {
      if (kind !== 5) return;
      latest = { bpp, dib: dib >>> 0, pal: pal >>> 0 };
      if (realtime) realtime.frames++;
      if (active && iteration >= warmup && iteration < warmup + iterations) {
        frames++;
        // Hash all presented pixels and palette; one matching final frame
        // alone would miss a different trajectory through the workload.
        digest.update(picture());
      }
    },
    async boundary(ticks) {
      if (realtime) {
        const elapsed = Number(process.hrtime.bigint() - realtime.start) / 1e6;
        const xy = player().join(',');
        realtime.positions.add(xy);
        // Real-clock diagnostic: no breakpoint/debug dispatch checks, input
        // queued at host slice boundaries as it is during normal execution.
        while (realtime.event < 8) {
          const event = realtime.event, leg = Math.floor(event / 2);
          const due = leg * 3000 + (event % 2 ? 2250 : 0);
          if (elapsed < due) break;
          const target = route[leg % route.length];
          if (event % 2) renderer.handleMouseUp(...target, 1);
          else { renderer.handleMouseMove(...target); renderer.handleMouseDown(...target, 1); }
          realtime.event++;
        }
        if (elapsed < 10000) return false;
        const cpu = process.cpuUsage(realtime.cpu);
        const result = await post('Profiler.stop');
        profiler.disconnect();
        fs.writeFileSync(profile + '.realtime.cpuprofile', JSON.stringify(result.profile));
        fs.writeFileSync(profile + '.realtime.json', JSON.stringify({
          wallMs: elapsed, cpuMs: (cpu.user + cpu.system) / 1000,
          presents: realtime.frames, uniquePositions: realtime.positions.size,
          breakpointEnabled: ex.get_bp_addr(), load: os.loadavg(),
        }, null, 2));
        renderer.handleMouseUp(...route[3 % route.length], 1);
        return true;
      }
      if (ex.get_eip() !== LOOP || ex.get_last_run_halt() !== 5) return false;
      if (!active) {
        if (!ex.set_benchmark_chain_bp || !ex.get_page_fast)
          throw new Error('benchmark requires chain-preserving breakpoint build');
        ex.set_benchmark_chain_bp(1);
        active = true; clock = ticks;
        if (ex.set_bench_candidate) ex.set_bench_candidate(enabled);
        // Same cache reset in every arm; warmup pays for re-decoding.
        ex.set_loop_aoe_fill_emit(0);
        console.log('[gameplay-bench] entered gameplay at guest tick ' + clock);
      } else iteration++;
      if (iteration === warmup) {
        capture('start');
        startHash = hash(picture());
        startApi = apiCount();
        startChains = ex.get_chain_hits();
        startFast = ex.get_page_fast() >>> 0;
        startLoad = os.loadavg();
        if (profile) {
          profiler = new (require('inspector').Session)();
          profiler.connect();
          await post('Profiler.enable');
          await post('Profiler.setSamplingInterval', { interval: 1000 });
          await post('Profiler.start');
        }
        startCpu = process.cpuUsage(); startWall = process.hrtime.bigint();
        started = true;
        console.log('[gameplay-bench] measurement started');
      }
      if (started && iteration > warmup && (iteration - warmup) % 100 === 0)
        samples.push({ iteration: iteration - warmup, load: os.loadavg() });
      if (iteration === warmup + iterations) {
        const wallMs = Number(process.hrtime.bigint() - startWall) / 1e6;
        const cpu = process.cpuUsage(startCpu);
        if (profiler) {
          const result = await post('Profiler.stop');
          profiler.disconnect();
          fs.writeFileSync(profile, JSON.stringify(result.profile));
        }
        const hud = capture('end');
        for (const checkpoint of checkpoints) capture('walk-' + checkpoint.iteration, checkpoint.pixels);
        const uniquePositions = new Set(positions.map(p => p.xy.join(','))).size;
        const moved = positions.filter((p, i) => i && p.xy.join(',') !== positions[i - 1].xy.join(','));
        const movingLegs = new Set(moved.map(p => Math.floor(p.iteration / 60))).size;
        if (walking && (uniquePositions < 3 || moved.length < 20 || movingLegs < 8)) {
          fs.writeFileSync(out + '.rejected.json', JSON.stringify({ positions, inputEvents,
            uniquePositions, tileTransitions: moved.length, movingLegs }, null, 2));
          throw new Error(`walking stalled: ${uniquePositions} positions, ${moved.length} tile transitions, ${movingLegs} moving legs`);
        }
        const chainHits = Number(ex.get_chain_hits() - startChains);
        const fastTransfers = ((ex.get_page_fast() >>> 0) - startFast) >>> 0;
        if (chainHits + fastTransfers <= 0) throw new Error('benchmark disabled fast block transfers');
        const result = { schema: 3, chainHits, fastTransfers, scenario: walking ? 'Tristram walking' : 'Tristram idle', enabled,
          profile, positions, uniquePositions, tileTransitions: moved.length, movingLegs, inputEvents,
          warmup, iterations, guestMs: iterations * 50, frames, apiCalls: apiCount() - startApi,
          startHash, endHash: hash(picture()), frameHash: digest.digest('hex'),
          wallMs, cpuMs: (cpu.user + cpu.system) / 1000,
          hud,
          cpuMsPerPresent: (cpu.user + cpu.system) / 1000 / frames,
          loadBefore: startLoad, loadAfter: os.loadavg(), samples };
        if (!frames) throw new Error('benchmark measured no presents');
        fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
        console.log('[gameplay-bench] ' + JSON.stringify(result));
        if (profile && walking) {
          ex.clear_bp();
          profiler = new (require('inspector').Session)();
          profiler.connect();
          await post('Profiler.enable');
          await post('Profiler.setSamplingInterval', { interval: 1000 });
          await post('Profiler.start');
          realtime = { start: process.hrtime.bigint(), wallOrigin: Date.now(), cpu: process.cpuUsage(),
            frames: 0, positions: new Set(), event: 0 };
          console.log('[gameplay-bench] real-clock profile started; breakpoint disabled');
          return false;
        }
        return true;
      }
      clock += 50;
      if (walking && iteration >= warmup) {
        const step = iteration - warmup;
        positions.push({ iteration: step, xy: player() });
        if (step > 0 && step % 120 === 0) checkpoints.push({ iteration: step, pixels: picture() });
        const target = route[Math.floor(step / 60) % route.length];
        const phase = step % 60;
        if (phase === 0) {
          renderer.handleMouseMove(...target);
          inputEvents.push({ iteration: step, action: 'move', target });
        } else if (phase === 1) {
          renderer.handleMouseDown(...target, 1);
          inputEvents.push({ iteration: step, action: 'down', target });
        } else if (phase === 45) {
          renderer.handleMouseUp(...target, 1);
          inputEvents.push({ iteration: step, action: 'up', target });
        }
      }
      return false;
    },
  };
}
module.exports = { createBenchmark };
