'use strict';
// Native children inherit real readonly media separately from mutable state.
// Replay the pinned mount plan; never export borrowed media as writable files.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const { VirtualFS } = require('./filesystem');
const mediaCli = require('./media-cli');
const metadataKeys = ['volumeLabels', 'volumeSerials', 'driveTypes', 'volumeSizes'];

function statIdentity(s) {
  if (!s.isFile()) throw new Error('readonly media source is not a regular file');
  return [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].map(String);
}
function sourceIdentity(file) {return statIdentity(fs.statSync(file,{bigint:true}));}
function assertSourceOwner(source, identity) {
  if (!source || !Number.isInteger(source.fd) || source.fd<0 || JSON.stringify(statIdentity(fs.fstatSync(source.fd,{bigint:true})))!==JSON.stringify(identity))
    throw new Error('readonly media source ownership revoked or replaced');
}
function sourcePin(file, owner) {
  const before = sourceIdentity(file), h = crypto.createHash('sha256');
  if(owner)assertSourceOwner(owner,before);
  const fd = fs.openSync(file, 'r'), bytes = Buffer.alloc(1024 * 1024);
  try { for (;;) { const n = fs.readSync(fd, bytes, 0, bytes.length, null); if (!n) break; h.update(bytes.subarray(0, n)); } }
  finally { fs.closeSync(fd); }
  if (JSON.stringify(before) !== JSON.stringify(sourceIdentity(file))) throw new Error('readonly media source changed while pinning');
  return { path: path.resolve(file), identity: before, sha256: h.digest('hex') };
}
function canonical(key, directory = false) {
  if (typeof key !== 'string' || !/^[a-z]:\\/.test(key) && !(directory && /^[a-z]:$/.test(key)))
    throw new Error('unsafe readonly media path');
  const parts = key.slice(3).split('\\');
  if (!(directory && key.length <= 3) && parts.some(p => !p || p === '.' || p === '..' || /[/\x00:]/.test(p)))
    throw new Error('unsafe readonly media path');
  if (key !== key.toLowerCase()) throw new Error('noncanonical readonly media path');
  return key;
}
function tree(vfs, drives) {
  const onDrive = key => drives.includes(String(key).slice(0, 1));
  const dirs = [...vfs.dirs].filter(onDrive).map(k => canonical(k, true)).sort();
  const files = [...vfs.files].filter(([k]) => onDrive(k)).map(([key, e]) => {
    canonical(key);
    if (!e._provider) throw new Error('readonly media entry lost source provider: ' + key);
    if (!Number.isSafeInteger(e._size) || e._size < 0 || !Number.isSafeInteger(e._offset || 0) || (e._offset || 0) < 0)
      throw new Error('invalid readonly media provider window');
    return [key, e.attrs, e._offset || 0, e._size, e.name];
  }).sort((a,b) => a[0].localeCompare(b[0]));
  const metadata = Object.fromEntries(metadataKeys.map(k => [k, drives.filter(d => vfs[k]?.has(d)).map(d => [d, vfs[k].get(d)])]));
  for (const d of drives) if (!vfs.readOnlyDrives.has(d)) throw new Error('readonly media drive became writable');
  const discs = drives.filter(d => vfs.cdAudioDrives?.has(d)).map(d => {
    const disc=vfs.cdAudioDrives.get(d);
    return [d,{drive:disc.drive,root:disc.root,firstTrack:disc.firstTrack,lastTrack:disc.lastTrack,
      leadOutSector:disc.leadOutSector,volumeLabel:disc.volumeLabel,
      tracks:disc.tracks.map(({load,indexes,...fields})=>({...fields,indexes:[...indexes]}))}];
  });
  return { drives, dirs, files, metadata, discs };
}
function entryMetadata(vfs, layout) {
  return layout.files.map(([key]) => [key, ...['creationTime','lastAccessTime','lastWriteTime'].map(k => {
    const value=vfs.files.get(key)[k];
    if (!value || !Number.isInteger(value.lo) || !Number.isInteger(value.hi) || value.lo<0 || value.hi<0 || value.lo>0xffffffff || value.hi>0xffffffff)
      throw new Error('invalid readonly media file time');
    return {lo:value.lo,hi:value.hi};
  })]);
}
function remember(vfs, media) {
  const drive = media.plan.mountRoot?.slice(0, 1).toLowerCase();
  if (!drive || !vfs.readOnlyDrives.has(drive)) throw new Error('media mount is not a readonly drive');
  const layout = tree(vfs, [drive]);
  const entries = new Map(layout.files.map(([k]) => [k, { entry: vfs.files.get(k), provider: vfs.files.get(k)._provider }]));
  const sourceOwners=media.paths.map(p=>media.parts.find(part=>path.resolve(part.hostPath)===path.resolve(p))?.source);
  const record = { recipe: { paths: media.paths.map(p => path.resolve(p)), exePath: media.candidate.path },
    sources: media.paths.map((p,i)=>sourcePin(p,sourceOwners[i])), sourceOwners,
    layout, entries, fileMetadata:entryMetadata(vfs,layout) };
  if (!vfs.readonlyMediaContexts) vfs.readonlyMediaContexts = [];
  if (vfs.readonlyMediaContexts.some(r => r.layout.drives.includes(drive))) throw new Error('readonly media drive already owned');
  vfs.readonlyMediaContexts.push(record);
  return record;
}
function capture(vfs) {
  const owned = new Set((vfs.readonlyMediaContexts || []).flatMap(r => r.layout.drives));
  for (const drive of vfs.readOnlyDrives) if (!owned.has(drive))
    throw new Error('readonly media drive has no source ownership: ' + drive);
  return (vfs.readonlyMediaContexts || []).map(record => {
    if (JSON.stringify(tree(vfs, record.layout.drives)) !== JSON.stringify(record.layout))
      throw new Error('readonly media directory or metadata changed');
    if (JSON.stringify(entryMetadata(vfs, record.layout)) !== JSON.stringify(record.fileMetadata))
      throw new Error('readonly media file metadata changed');
    for (const [key, held] of record.entries) {
      if (vfs.files.get(key) !== held.entry || held.entry._provider !== held.provider)
        throw new Error('readonly media source entry replaced: ' + key);
    }
    for (const [i,s] of record.sources.entries()) {
      if (JSON.stringify(sourceIdentity(s.path)) !== JSON.stringify(s.identity))
        throw new Error('readonly media source replaced or changed');
      assertSourceOwner(record.sourceOwners[i],s.identity);
    }
    return { recipe: record.recipe, sources: record.sources, layout: record.layout, fileMetadata:record.fileMetadata };
  });
}
async function restore(vfs, records) {
  if (!Array.isArray(records)) throw new Error('invalid readonly media context');
  const staged = new VirtualFS(), opened = [];
  try {
    for (const record of records) {
      if (!record || !Array.isArray(record.recipe?.paths) || !Array.isArray(record.sources) || !record.layout)
        throw new Error('invalid readonly media context');
      for (const k of record.layout.dirs) canonical(k, true);
      for (const [k] of record.layout.files) canonical(k);
      if (record.recipe.paths.length !== record.sources.length || record.recipe.paths.some((p,i) => p !== record.sources[i].path))
        throw new Error('readonly media source list mismatch');
      for (const s of record.sources) if (JSON.stringify(sourcePin(s.path)) !== JSON.stringify(s))
        throw new Error('readonly media source pin mismatch');
      const media = await mediaCli.analyzeMediaPaths(record.recipe.paths, { exePath: record.recipe.exePath });
      opened.push(media);
      await media.plan.mount(staged);
      if (JSON.stringify(tree(staged, record.layout.drives)) !== JSON.stringify(record.layout))
        throw new Error('readonly media remount identity mismatch');
      if (!Array.isArray(record.fileMetadata) || record.fileMetadata.length!==record.layout.files.length)
        throw new Error('invalid readonly media file metadata');
      for (let i=0;i<record.fileMetadata.length;i++) {
        const [key,...times]=record.fileMetadata[i];
        if(key!==record.layout.files[i][0] || times.length!==3)throw new Error('invalid readonly media file metadata');
        for(const [j,k]of ['creationTime','lastAccessTime','lastWriteTime'].entries())staged.files.get(key)[k]=times[j];
      }
      entryMetadata(staged,record.layout);
      remember(staged, media);
    }
    // Refuse collisions before adopting anything into the child's world.
    const drives = records.flatMap(r => r.layout.drives);
    if ([...vfs.files.keys(), ...vfs.dirs].some(k => drives.includes(k.slice(0,1))) || drives.some(d => vfs.readOnlyDrives.has(d)))
      throw new Error('readonly media conflicts with child namespace');
    staged.cwd = vfs.cwd;
    vfs.adoptFrom(staged);
    return opened;
  } catch (error) { for (const media of opened) mediaCli.closeMedia(media); throw error; }
}
module.exports = { remember, capture, restore, tree, canonical, sourcePin };
