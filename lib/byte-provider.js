// Byte providers — one interface for "where the bytes actually live".
//
// Phase ① of docs/design-byo-media.md. A container mount (zip, iso9660) or a
// bare imported file names its bytes through a *provider*, and the VFS stores
// a lazy entry pointing at one instead of a materialized Uint8Array. That is
// what lets a 638MB ISO be a drive letter without a 638MB allocation.
//
// A provider is the smallest thing that can answer "give me these bytes":
//
//   {
//     size: Number,                                  // total bytes
//     readRange(off, len) -> Promise<Uint8Array>,    // always present
//     readRangeSync(off, len) -> Uint8Array | null,  // optional fast path
//   }
//
// `readRangeSync` is what a Node fd or an already-resident buffer can do and a
// `fetch` cannot. Callers must treat its absence — and a null return — as
// "ask asynchronously", never as "no bytes": the guest's ReadFile is
// synchronous WAT, so a miss has to surface as a distinguishable *pending*
// result that parks the guest, not as a silent short read.
//
// `ChunkCache` is the piece that makes that affordable. It slices a provider
// into fixed 256KB chunks with an LRU bound and read-ahead, so an app reading
// a file front to back pays one async round trip per chunk rather than one per
// ReadFile. Its `tryRead` is the synchronous cache-hit path the guest takes
// almost always; `fill` is the async miss path the host runs while the guest
// is parked.
//
// Dual-environment on purpose (module.exports + window.byteProvider, same as
// lib/vfs-persistence.js): the CLI harness and the browser mount identical
// containers, which is what keeps `test/run.js --zip=`/`--iso=` honest
// coverage of the browser path.
(function () {
  'use strict';

  // 1MB range requests: one HTTP round trip per MB instead of per 64-256KB,
  // so a parked guest read waits on fewer trips. 16 chunks of 1MB = 16MB
  // resident per open container, the same bound as before. Era media reads in
  // long forward runs, so the bound is about not pinning a whole ISO, not
  // about hit rate.
  const DEFAULT_CHUNK_SIZE = 1024 * 1024;
  const DEFAULT_MAX_CHUNKS = 16;
  // Chunks fetched in the background ahead of a SEQUENTIAL read (one that
  // continues where the previous read of this cache ended). Random access
  // never prefetches.
  const DEFAULT_PREFETCH = 2;

  function safeInteger(value, label) {
    const number = Number(value);
    if (!Number.isSafeInteger(number)) {
      throw new RangeError(`${label} must be a safe integer (got ${value})`);
    }
    return number;
  }

  function safeSize(value, label) {
    const number = safeInteger(value, label);
    if (number < 0) throw new RangeError(`${label} must be non-negative (got ${value})`);
    return number;
  }

  function clampRange(size, off, len) {
    const bound = safeSize(size, 'provider size');
    const requestedStart = safeInteger(off, 'range offset');
    const requestedLength = safeInteger(len, 'range length');
    const start = Math.max(0, Math.min(bound, requestedStart));
    const count = Math.min(Math.max(0, requestedLength), bound - start);
    return { start, end: start + count, len: count };
  }

  // ---- providers ---------------------------------------------------------

  // Bytes already in memory. The degenerate provider: every read is a hit, so
  // a mount backed by one never yields. Useful for small entries (an inflated
  // zip member), for archives nested inside an already-resident buffer, and as
  // the control arm in tests.
  class BytesProvider {
    constructor(bytes, name) {
      this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      this.size = this.bytes.length;
      this.name = name || '<bytes>';
    }
    readRangeSync(off, len) {
      const r = clampRange(this.size, off, len);
      return this.bytes.subarray(r.start, r.end);
    }
    readRange(off, len) {
      return Promise.resolve(this.readRangeSync(off, len));
    }
    close() {}
  }

  // A sub-range of another provider, presented as a provider in its own right.
  // An ISO file is (LBA*2048, length) inside the image; a stored zip member is
  // (localHeaderEnd, compressedSize) inside the archive. Both are this.
  class SliceProvider {
    constructor(parent, offset, length, name) {
      this.parent = parent;
      const parentSize = safeSize(parent.size, 'SliceProvider parent size');
      this.offset = Math.max(0, safeInteger(offset, 'SliceProvider offset'));
      const avail = Math.max(0, parentSize - this.offset);
      this.size = length === undefined ? avail
        : Math.min(avail, Math.max(0, safeInteger(length, 'SliceProvider length')));
      this.name = name || ((parent.name || '<slice>') + '+' + this.offset);
    }
    readRangeSync(off, len) {
      if (!this.parent.readRangeSync) return null;
      const r = clampRange(this.size, off, len);
      return this.parent.readRangeSync(this.offset + r.start, r.len);
    }
    readRange(off, len) {
      const r = clampRange(this.size, off, len);
      return this.parent.readRange(this.offset + r.start, r.len);
    }
    close() {}
  }

  // Node fs, positional reads off one fd. The CLI fast path: `readRangeSync`
  // is a real `fs.readSync`, so a headless run of a lazily-mounted container
  // never parks the guest at all.
  //
  // `{sync: false}` suppresses that fast path so the *async* machinery — the
  // pending result, the IO_WAIT yield, the retried read — runs in the CLI too.
  // Without it the yield path would ship untested, since the browser is the
  // only place it would ever fire.
  class NodeFileProvider {
    constructor(path, opts) {
      const options = opts || {};
      // Required lazily so this file stays loadable in the browser, where
      // there is no fs to read from.
      const fs = require('fs');
      this._fs = fs;
      this.path = path;
      this.name = path;
      this.fd = fs.openSync(path, 'r');
      this.size = safeSize(fs.fstatSync(this.fd).size, 'Node file size');
      this._sync = options.sync !== false;
      // Async-only providers can add a delay per read, so a headless run can
      // stand in for a slow network (test/run.js --lazy-ranges=MS).
      this._latencyMs = Math.max(0, Number(options.latencyMs) || 0);
    }
    _readAt(off, len) {
      const r = clampRange(this.size, off, len);
      const out = new Uint8Array(r.len);
      let got = 0;
      while (got < r.len) {
        const n = this._fs.readSync(this.fd, out, got, r.len - got, r.start + got);
        if (n <= 0) break;
        got += n;
      }
      return got === r.len ? out : out.subarray(0, got);
    }
    readRangeSync(off, len) {
      if (!this._sync) return null;
      return this._readAt(off, len);
    }
    readRange(off, len) {
      // Still one readSync under the hood — the point of the promise is the
      // event-loop turn, which is what the yield path needs to exercise.
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          try { resolve(this._readAt(off, len)); } catch (e) { reject(e); }
        }, this._latencyMs);
      });
    }
    close() {
      if (this.fd !== null && this.fd !== undefined) {
        try { this._fs.closeSync(this.fd); } catch (_) {}
        this.fd = null;
      }
    }
  }

  // A browser File/Blob. `slice()` is zero-copy until `arrayBuffer()` is
  // awaited, so a dropped 638MB ISO costs nothing until something reads it —
  // this is the "session only" import in the design doc.
  class BlobProvider {
    constructor(blob, name) {
      this.blob = blob;
      this.size = safeSize(blob.size, 'Blob size');
      this.name = name || blob.name || '<blob>';
    }
    readRangeSync() { return null; }
    readRange(off, len) {
      const r = clampRange(this.size, off, len);
      if (!r.len) return Promise.resolve(new Uint8Array(0));
      return this.blob.slice(r.start, r.end).arrayBuffer()
        .then(ab => new Uint8Array(ab));
    }
    close() {}
  }

  // HTTP Range. `open()` is async because the size comes from the server:
  // a HEAD, or a one-byte GET when HEAD is not allowed. A server without
  // `Accept-Ranges: bytes` is rejected loudly rather than silently degraded to
  // whole-file downloads — a 600MB surprise download is worse than an error.
  class HttpRangeProvider {
    constructor(url, size, opts) {
      const options = opts || {};
      this.url = url;
      this.size = safeSize(size, 'HTTP resource size');
      this.validateRange = options.validateRange === true;
      // acceptWhole: a host that ignores Range answers 200 with the whole
      // file. For a resource whose size is known and bounded (host.js only
      // sets this on a sized entry no larger than one release part), keep
      // that body and serve every later read from it instead of failing --
      // the same bytes an eager load would have fetched, once.
      this.acceptWhole = options.acceptWhole === true;
      this._whole = null;
      this.name = options.name || url.replace(/^.*\//, '') || url;
      this._fetch = options.fetch ||
        (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
      if (!this._fetch) throw new Error('HttpRangeProvider: no fetch available');
    }
    static open(url, opts) {
      const options = opts || {};
      const doFetch = options.fetch ||
        (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
      if (!doFetch) return Promise.reject(new Error('HttpRangeProvider: no fetch available'));
      return doFetch(url, { method: 'HEAD' }).then(res => {
        // (A sized entry skips this HEAD entirely: see acceptWhole.)
        if (!res.ok) throw new Error(`HttpRangeProvider: HEAD ${url} → ${res.status}`);
        const ranges = res.headers.get('accept-ranges');
        if (!ranges || ranges.toLowerCase() === 'none') {
          throw new Error(`HttpRangeProvider: ${url} does not advertise Accept-Ranges`);
        }
        const len = parseInt(res.headers.get('content-length') || '', 10);
        if (!(len >= 0)) throw new Error(`HttpRangeProvider: ${url} has no Content-Length`);
        return new HttpRangeProvider(url, len, options);
      });
    }
    readRangeSync(off, len) {
      if (!this._whole) return null;
      const r = clampRange(this.size, off, len);
      return this._whole.slice(r.start, r.end);
    }
    readRange(off, len) {
      const r = clampRange(this.size, off, len);
      if (!r.len) return Promise.resolve(new Uint8Array(0));
      if (this._whole) return Promise.resolve(this._whole.slice(r.start, r.end));
      return this._fetch(this.url, {
        headers: { Range: `bytes=${r.start}-${r.end - 1}` },
      }).then(res => {
        if (res.status === 200 && this.acceptWhole) {
          return res.arrayBuffer().then(ab => {
            const whole = new Uint8Array(ab);
            if (whole.length !== this.size) {
              throw new Error(`HttpRangeProvider: ${this.url} answered 200 with ${whole.length} bytes, ` +
                `expected the whole ${this.size}`);
            }
            this._whole = whole;
            return whole.slice(r.start, r.end).buffer;
          });
        }
        // 206 is the contract. A 200 means the server ignored the header and
        // is sending the whole file; say so instead of quietly mis-slicing.
        if (res.status !== 206) {
          throw new Error(`HttpRangeProvider: ${this.url} answered ${res.status}, expected 206`);
        }
        if (this.validateRange) {
          const header = res.headers && res.headers.get('content-range');
          const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(header || '');
          if (!match || Number(match[1]) !== r.start || Number(match[2]) !== r.end - 1 || Number(match[3]) !== this.size) {
            throw new Error('HttpRangeProvider: ' + this.url + ' Content-Range disagrees with manifest size/request');
          }
        }
        return res.arrayBuffer();
      }).then(ab => {
        const bytes = new Uint8Array(ab);
        if (bytes.length !== r.len) {
          throw new Error(`HttpRangeProvider: ${this.url} returned ${bytes.length} bytes for ` +
            `@${r.start}+${r.len}`);
        }
        return bytes;
      });
    }
    close() {}
  }

  // Several providers end to end as one. The release host cannot store a file
  // over 20MB, so tools/deploy-berrry.js publishes it as name.part000,
  // name.part001, ... (host.js fetchAssetBytes joins them for a whole-file
  // load); this lets a ranged mount read across those parts the same way.
  class ConcatProvider {
    constructor(parts, name) {
      if (!Array.isArray(parts) || !parts.length) throw new Error('ConcatProvider: no parts');
      this.parts = parts;
      this.starts = [];
      let size = 0;
      for (const part of parts) {
        this.starts.push(size);
        size = safeSize(size + safeSize(part.size, 'ConcatProvider part size'),
          'ConcatProvider total size');
      }
      this.size = size;
      this.name = name || parts[0].name || '<parts>';
    }
    _pieces(off, len) {
      const r = clampRange(this.size, off, len);
      const pieces = [];
      for (let i = 0; i < this.parts.length && r.len; i++) {
        const start = this.starts[i], end = start + this.parts[i].size;
        const from = Math.max(r.start, start), to = Math.min(r.end, end);
        if (to > from) pieces.push({ part: this.parts[i], off: from - start, len: to - from });
      }
      return { r, pieces };
    }
    _join(r, pieces, chunks) {
      // Validate each part before joining: a short part shifts every later
      // part left and leaves a zero-filled tail of the expected total length,
      // hiding the truncation from consumers such as ChunkCache.
      for (let i = 0; i < pieces.length; i++) {
        if (chunks[i].length !== pieces[i].len) {
          throw new Error(`ConcatProvider: part ${pieces[i].part.name || i} returned ` +
            `${chunks[i].length} bytes for @${pieces[i].off}, expected ${pieces[i].len}`);
        }
      }
      if (chunks.length === 1) return chunks[0];
      const out = new Uint8Array(r.len);
      let at = 0;
      for (const bytes of chunks) { out.set(bytes, at); at += bytes.length; }
      return out;
    }
    readRangeSync(off, len) {
      const { r, pieces } = this._pieces(off, len);
      const chunks = [];
      for (const p of pieces) {
        const bytes = p.part.readRangeSync ? p.part.readRangeSync(p.off, p.len) : null;
        if (!bytes) return null;
        chunks.push(bytes);
      }
      return this._join(r, pieces, chunks);
    }
    readRange(off, len) {
      const { r, pieces } = this._pieces(off, len);
      if (!pieces.length) return Promise.resolve(new Uint8Array(0));
      return Promise.all(pieces.map(p => p.part.readRange(p.off, p.len)))
        .then(chunks => this._join(r, pieces, chunks.map(c => c instanceof Uint8Array ? c : new Uint8Array(c))));
    }
    close() { for (const part of this.parts) if (part.close) part.close(); }
  }

  // ---- chunk cache -------------------------------------------------------

  // Fixed-size chunks with an LRU bound and forward read-ahead. Presents the
  // same provider shape as what it wraps, plus the two methods the VFS read
  // path actually wants:
  //
  //   tryRead(off, len) -> Uint8Array | null    null == miss, go ask
  //   fill(off, len)    -> Promise              satisfy that miss
  //
  // `tryRead` returns a fresh Uint8Array when a read straddles two chunks, and
  // a subarray view when it does not — callers must not retain it across a
  // later `fill`, which is fine because every caller copies into guest memory
  // immediately.
  class ChunkCache {
    constructor(provider, opts) {
      const options = opts || {};
      this.provider = provider;
      this.size = safeSize(provider.size, 'ChunkCache provider size');
      this.name = provider.name;
      this.chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
      this.maxChunks = options.maxChunks || DEFAULT_MAX_CHUNKS;
      // How many chunks past the requested one a miss pulls in the same round
      // trip -- only while the access is sequential, so a random read fetches
      // just what it needs.
      this.readAhead = options.readAhead === undefined ? 1 : options.readAhead;
      // false = the pre-1MB behaviour (read ahead on every miss); kept for the
      // CLI's --lazy-cache=legacy measurement arm.
      this.sequentialReadAhead = options.sequentialReadAhead !== false;
      // How many chunks ahead a sequential read starts fetching in the
      // background (not awaited), so a forward scan rarely parks at all.
      // Never more than half the cache, so prefetch cannot evict what is read.
      this.prefetch = Math.min(options.prefetch === undefined ? DEFAULT_PREFETCH : options.prefetch,
        Math.max(0, Math.floor(this.maxChunks / 2)));
      this._lastEnd = -1;      // end of the previous read; -1 = none yet
      this._sequential = false;
      this._fetched = new Set(); // chunk indices ever fetched (for over-fetch)
      this._used = new Set();    // chunk indices a read has actually touched
      this._chunks = new Map();  // index → Uint8Array (Map iteration order = LRU)
      // Chunks a caller asked to keep resident for the life of the cache
      // (`preload`). They sit outside the LRU and its maxChunks bound: a range
      // the guest reads where it cannot park must never be evicted by the
      // streaming reads around it.
      this._pinned = new Map();  // index → Uint8Array
      this._inflight = new Map(); // index → Promise
      this.stats = { hits: 0, misses: 0, fetches: 0, bytesFetched: 0, pinnedChunks: 0, pinnedBytes: 0,
        prefetches: 0 };
    }

    // Bytes fetched in chunks no read ever touched: the price of read-ahead
    // and prefetch.
    get overFetchBytes() {
      let bytes = 0;
      for (const idx of this._fetched) {
        if (this._used.has(idx)) continue;
        bytes += Math.min(this.chunkSize, this.size - idx * this.chunkSize);
      }
      return bytes;
    }

    // Track whether reads continue one another, and keep the next chunks
    // coming while they do. A read is sequential when it starts within one
    // chunk after (or slightly before) where the previous read ended.
    _noteRead(start, end, last) {
      const prev = this._lastEnd;
      this._sequential = prev >= 0 && start >= prev - 4096 && start <= prev + this.chunkSize;
      this._lastEnd = end;
      if (!this._sequential || !this.prefetch || !this.provider.readRange) return;
      const lastPossible = this.size ? Math.floor((this.size - 1) / this.chunkSize) : -1;
      for (let idx = last + 1; idx <= Math.min(lastPossible, last + this.prefetch); idx++) {
        if (this._has(idx) || this._inflight.has(idx)) continue;
        this.stats.prefetches++;
        // Background: a failed prefetch is not an error -- the read that
        // needs that chunk will fetch (and report) it itself.
        this._fetchChunk(idx).catch(() => {});
      }
    }

    _has(idx) { return this._pinned.has(idx) || this._chunks.has(idx); }

    _touch(idx, bytes) {
      // Re-insert to move to the young end of the Map's insertion order.
      if (this._chunks.has(idx)) this._chunks.delete(idx);
      this._chunks.set(idx, bytes);
      while (this._chunks.size > this.maxChunks) {
        const oldest = this._chunks.keys().next();
        if (oldest.done) break;
        this._chunks.delete(oldest.value);
      }
    }

    _get(idx) {
      const pinned = this._pinned.get(idx);
      if (pinned !== undefined) return pinned;
      const bytes = this._chunks.get(idx);
      if (bytes === undefined) return undefined;
      this._touch(idx, bytes);
      return bytes;
    }

    _chunkSync(idx) {
      if (!this.provider.readRangeSync) return null;
      const start = idx * this.chunkSize;
      const want = Math.min(this.chunkSize, this.size - start);
      const bytes = this.provider.readRangeSync(start, want);
      if (!bytes) return null;
      // Copy: a provider may hand back a view of a buffer it will reuse.
      const owned = new Uint8Array(bytes);
      if (owned.length !== want) {
        throw new Error(`ChunkCache: provider returned ${owned.length} bytes for ` +
          `@${start}+${want}`);
      }
      this._touch(idx, owned);
      this._fetched.add(idx);
      this.stats.fetches++;
      this.stats.bytesFetched += owned.length;
      return owned;
    }

    // Synchronous read. Returns null on a miss — never a short read, so a
    // caller can never mistake "not here yet" for "end of file".
    tryRead(off, len) {
      const r = clampRange(this.size, off, len);
      if (!r.len) return new Uint8Array(0);
      const first = Math.floor(r.start / this.chunkSize);
      const last = Math.floor((r.end - 1) / this.chunkSize);
      const parts = [];
      for (let idx = first; idx <= last; idx++) {
        let bytes = this._get(idx);
        if (bytes === undefined) bytes = this._chunkSync(idx);
        if (!bytes) {
          this.stats.misses++;
          // Sequential-ness is decided on the attempt, so the fill this miss
          // triggers knows whether to read ahead.
          const prev = this._lastEnd;
          this._sequential = prev >= 0 && r.start >= prev - 4096 && r.start <= prev + this.chunkSize;
          return null;
        }
        parts.push(bytes);
      }
      this.stats.hits++;
      for (let idx = first; idx <= last; idx++) this._used.add(idx);
      this._noteRead(r.start, r.end, last);
      if (first === last) {
        const base = first * this.chunkSize;
        return parts[0].subarray(r.start - base, r.end - base);
      }
      const out = new Uint8Array(r.len);
      let written = 0;
      for (let idx = first; idx <= last; idx++) {
        const base = idx * this.chunkSize;
        const from = Math.max(r.start, base) - base;
        const to = Math.min(r.end, base + this.chunkSize) - base;
        out.set(parts[idx - first].subarray(from, to), written);
        written += to - from;
      }
      return out;
    }

    _fetchChunk(idx) {
      const existing = this._inflight.get(idx);
      if (existing) return existing;
      const start = idx * this.chunkSize;
      const want = Math.min(this.chunkSize, Math.max(0, this.size - start));
      const p = Promise.resolve(this.provider.readRange(start, want)).then(bytes => {
        const owned = bytes instanceof Uint8Array ? new Uint8Array(bytes) : new Uint8Array(bytes || 0);
        this._inflight.delete(idx);
        // A Range server returning fewer bytes did not satisfy this chunk.
        // Caching it as complete makes tryRead's cross-chunk copy advance by
        // the expected width and leave the missing tail zero-filled — a
        // plausible, silent corruption. The provider contract is exact bytes
        // or rejection, including the naturally shorter final chunk.
        if (owned.length !== want) {
          throw new Error(`ChunkCache: provider returned ${owned.length} bytes for ` +
            `@${start}+${want}`);
        }
        this._touch(idx, owned);
        this._fetched.add(idx);
        this.stats.fetches++;
        this.stats.bytesFetched += owned.length;
        return owned;
      }, err => {
        this._inflight.delete(idx);
        throw err;
      });
      this._inflight.set(idx, p);
      return p;
    }

    // Asynchronously make `tryRead(off, len)` succeed. A sequential access
    // (see _noteRead) pulls `readAhead` extra chunks in the same turn; a
    // random one fetches only the chunks it covers.
    fill(off, len) {
      const r = clampRange(this.size, off, len);
      if (!r.len) return Promise.resolve();
      const first = Math.floor(r.start / this.chunkSize);
      const last = Math.floor((r.end - 1) / this.chunkSize);
      const lastPossible = this.size ? Math.floor((this.size - 1) / this.chunkSize) : 0;
      const ahead = (this._sequential || !this.sequentialReadAhead) ? this.readAhead : 0;
      const stop = Math.min(lastPossible, last + ahead);
      const pending = [];
      for (let idx = first; idx <= stop; idx++) {
        if (this._has(idx)) continue;
        pending.push(this._fetchChunk(idx));
      }
      return Promise.all(pending).then(() => undefined);
    }

    // Provider shape, so a ChunkCache can itself back a mount or be sliced.
    readRangeSync(off, len) { return this.tryRead(off, len); }
    readRange(off, len) {
      const hit = this.tryRead(off, len);
      if (hit) return Promise.resolve(hit);
      return this.fill(off, len).then(() => {
        const bytes = this.tryRead(off, len);
        if (!bytes) throw new Error('ChunkCache: fill did not satisfy read');
        return bytes;
      });
    }
    // Chunk indices covering a list of [start, end) byte ranges.
    chunksFor(ranges) {
      const set = new Set();
      const lastPossible = this.size ? Math.floor((this.size - 1) / this.chunkSize) : -1;
      for (const range of ranges || []) {
        const start = Math.max(0, safeInteger(range[0], 'preload range start'));
        const end = Math.min(this.size, safeInteger(range[1], 'preload range end'));
        if (!(end > start)) continue;
        const last = Math.min(lastPossible, Math.floor((end - 1) / this.chunkSize));
        for (let idx = Math.floor(start / this.chunkSize); idx <= last; idx++) set.add(idx);
      }
      return [...set].sort((a, b) => a - b);
    }

    _pin(idx, bytes) {
      if (this._pinned.has(idx)) return;
      this._chunks.delete(idx);
      this._pinned.set(idx, bytes);
      this.stats.pinnedChunks++;
      this.stats.pinnedBytes += bytes.length;
    }

    // Fetch every chunk overlapping `ranges` and keep it resident (see
    // `_pinned`). Resolves once all of them are; rejects on the first chunk
    // that still fails after `retries` more attempts, or as soon as `signal`
    // aborts (a chunk already in flight still lands in this cache, which is
    // harmless: its bytes are the file's bytes). `onProgress({loaded, total})`
    // reports bytes, and `total` is exact because every chunk's length is known.
    preload(ranges, opts) {
      const options = opts || {};
      const indices = this.chunksFor(ranges);
      const lengthOf = idx => Math.min(this.chunkSize, this.size - idx * this.chunkSize);
      const total = indices.reduce((sum, idx) => sum + lengthOf(idx), 0);
      let loaded = 0;
      const report = () => {
        if (options.onProgress) {
          try { options.onProgress({ loaded, total }); } catch (_) { /* never fail a load */ }
        }
      };
      const queue = [];
      for (const idx of indices) {
        const resident = this._get(idx);
        if (resident !== undefined) {
          this._pin(idx, resident);
          loaded += resident.length;
        } else {
          queue.push(idx);
        }
      }
      report();
      const retries = options.retries === undefined ? 2 : Math.max(0, options.retries | 0);
      const backoffMs = options.backoffMs === undefined ? 250 : Math.max(0, options.backoffMs);
      const aborted = () => !!(options.signal && options.signal.aborted);
      const abortError = () => {
        const error = new Error('Asset loading cancelled');
        error.name = 'AbortError';
        return error;
      };
      const fetchPinned = async (idx) => {
        for (let attempt = 0; ; attempt++) {
          if (aborted()) throw abortError();
          try {
            const bytes = await this._fetchChunk(idx);
            this._pin(idx, bytes);
            loaded += bytes.length;
            report();
            return;
          } catch (error) {
            if (aborted()) throw abortError();
            if (attempt >= retries) {
              if (error && typeof error === 'object') error.attempts = attempt + 1;
              throw error;
            }
            await new Promise(resolve => setTimeout(resolve, backoffMs * (attempt + 1)));
          }
        }
      };
      let next = 0;
      const workers = Array.from(
        { length: Math.min(queue.length, Math.max(1, options.concurrency || 4)) },
        async () => {
          while (next < queue.length) await fetchPinned(queue[next++]);
        });
      return Promise.all(workers).then(() => ({ chunks: indices.length, bytes: total }));
    }

    close() { if (this.provider.close) this.provider.close(); }
  }

  // A preload range list as written by tools/io-range-census.js --emit:
  // {schemaVersion: 1, size, ranges: [[start, end], ...]}, or a bare array of
  // ranges. Throws when the list does not describe a file of `size` bytes -- a
  // list measured against different bytes would pin the wrong ranges, and the
  // caller must then load the whole file instead.
  function preloadRangesFor(list, size) {
    let ranges = list;
    if (!Array.isArray(list)) {
      if (!list || list.schemaVersion !== 1 || !Array.isArray(list.ranges)) {
        throw new Error('preload range list: expected {schemaVersion: 1, ranges: [...]}');
      }
      if (list.size !== null && list.size !== undefined && Number(list.size) !== Number(size)) {
        throw new Error(`preload range list was measured on ${list.size} bytes, file is ${size}`);
      }
      ranges = list.ranges;
    }
    for (const range of ranges) {
      if (!Array.isArray(range) || range.length !== 2 ||
          !Number.isSafeInteger(range[0]) || !Number.isSafeInteger(range[1]) ||
          range[0] < 0 || range[1] < range[0] || range[1] > size) {
        throw new Error(`preload range list: bad range ${JSON.stringify(range)} for ${size} bytes`);
      }
    }
    return ranges;
  }

  // Wrap anything provider-shaped in a cache unless it already is one.
  function cached(provider, opts) {
    if (provider instanceof ChunkCache) return provider;
    return new ChunkCache(provider, opts);
  }

  const api = {
    DEFAULT_CHUNK_SIZE,
    DEFAULT_MAX_CHUNKS,
    BytesProvider,
    SliceProvider,
    NodeFileProvider,
    BlobProvider,
    HttpRangeProvider,
    ConcatProvider,
    ChunkCache,
    cached,
    preloadRangesFor,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.byteProvider = api;
})();
