'use strict';
// Native children inherit real readonly media separately from mutable state.
// Replay the pinned mount plan; never export borrowed media as writable files.
const fs = require('node:fs');
const path = require('node:path');
const { VirtualFS } = require('./filesystem');
const mediaCli = require('./media-cli');
const metadataKeys = ['volumeLabels', 'volumeSerials', 'driveTypes', 'volumeSizes'];

const {sourceIdentity,assertSourceOwner,sourcePin,prepareRestore,consumePreparation}=require('./readonly-media-source-pin');
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
function remember(vfs, media) { return rememberPinned(vfs, media, null); }
function rememberPinned(vfs, media, preparedPins) {
  const drive = media.plan.mountRoot?.slice(0, 1).toLowerCase();
  if (!drive || !vfs.readOnlyDrives.has(drive)) throw new Error('media mount is not a readonly drive');
  const layout = tree(vfs, [drive]);
  const entries = new Map(layout.files.map(([k]) => [k, { entry: vfs.files.get(k), provider: vfs.files.get(k)._provider }]));
  const sourceOwners=media.paths.map(p=>media.parts.find(part=>path.resolve(part.hostPath)===path.resolve(p))?.source);
  const record = { recipe: { paths: media.paths.map(p => path.resolve(p)), exePath: media.candidate.path },
    sources: media.paths.map((p,i)=>{
      if (!preparedPins) return sourcePin(p,sourceOwners[i]);
      const pin=preparedPins[i];
      if (!pin || pin.path!==path.resolve(p) || JSON.stringify(sourceIdentity(p))!==JSON.stringify(pin.identity))
        throw new Error('readonly media prepared source changed');
      assertSourceOwner(sourceOwners[i],pin.identity);
      return pin;
    }), sourceOwners,
    layout, entries, fileMetadata:entryMetadata(vfs,layout) };
  if (!vfs.readonlyMediaContexts) vfs.readonlyMediaContexts = [];
  if (vfs.readonlyMediaContexts.some(r => r.layout.drives.includes(drive))) throw new Error('readonly media drive already owned');
  vfs.readonlyMediaContexts.push(record);
  return record;
}
// Explicit --iso mounts have no executable-selection plan. Keep the exact
// ISO parser options, drive and live provider owner instead of inventing one.
function mountIso(vfs, file, options = {}) { return mountIsoPinned(vfs,file,options,null); }
function mountIsoPinned(vfs, file, options, preparedPins) {
  const { NodeFileProvider } = require('./byte-provider');
  const iso = require('./iso9660');
  const drive=String(options.drive || 'D').replace(/:$/, '').toLowerCase();
  const prefer=options.prefer || 'joliet';
  if (!/^[a-z]$/.test(drive) || !['primary','joliet'].includes(prefer)) throw new Error('invalid owned ISO mount options');
  const source=new NodeFileProvider(file);
  try {
    const view={size:source.size,readRange:(offset,length)=>source.readRangeSync(offset,length)};
    const result=iso.mountIso(vfs,view,{drive,prefer,provider:source});
    const media={paths:[path.resolve(file)],parts:[{hostPath:path.resolve(file),source}],
      plan:{mountRoot:drive+':\\'},candidate:{path:null}};
    const record=rememberPinned(vfs,media,preparedPins);
    record.recipe={kind:'iso9660',paths:media.paths,drive,prefer};
    return {...result,media};
  } catch(error) {source.close();throw error;}
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
// Per-launch preparation capability, never a source/digest cache. Only this
// module can mint the pins used by restore. The independent worker hashes all
// bytes while the main thread constructs its CPU/imports; it does not mount or
// adopt a namespace. Its successful exit is joined before consuming any pin.
async function restore(vfs, records, preparation=null) {
  if (!Array.isArray(records)) throw new Error('invalid readonly media context');
  const prepared=preparation ? await consumePreparation(records,preparation) : null;
  const preparedPins=prepared?.pins;
  const staged = new VirtualFS(), opened = [];
  try {
    for (const [index,record] of records.entries()) {
      if (!record || !Array.isArray(record.recipe?.paths) || !Array.isArray(record.sources) || !record.layout)
        throw new Error('invalid readonly media context');
      for (const k of record.layout.dirs) canonical(k, true);
      for (const [k] of record.layout.files) canonical(k);
      if (record.recipe.paths.length !== record.sources.length || record.recipe.paths.some((p,i) => p !== record.sources[i].path))
        throw new Error('readonly media source list mismatch');
      const explicitIso=record.recipe.kind==='iso9660';
      if (explicitIso && record.recipe.paths.length!==1) throw new Error('invalid owned ISO source list');
      if (record.recipe.kind && !explicitIso) throw new Error('unsupported readonly media recipe');
      // An explicit ISO mount pins the bytes through its actual live provider
      // in remember(). Compare that pin before adopting the staged namespace;
      // hashing the same image before the mount would scan it twice. For
      // other plans, retain the fresh pre-analysis pins and bind them to the
      // actual live remount providers below rather than hashing every source
      // again in remember(). Prepared pins are launch-local and one-use.
      const pins=preparedPins?.[index] || (!explicitIso ? record.sources.map(s=>sourcePin(s.path)) : null);
      if (!explicitIso && JSON.stringify(pins)!==JSON.stringify(record.sources))
        throw new Error('readonly media source pin mismatch');
      const media = explicitIso
        ? mountIsoPinned(staged,record.recipe.paths[0],record.recipe,preparedPins?.[index] || null).media
        : await mediaCli.analyzeMediaPaths(record.recipe.paths, { exePath: record.recipe.exePath });
      opened.push(media);
      if (explicitIso && JSON.stringify(staged.readonlyMediaContexts.at(-1).sources) !== JSON.stringify(record.sources))
        throw new Error('readonly media source pin mismatch');
      if (!explicitIso) await media.plan.mount(staged);
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
      if (explicitIso) {
        // Install the authenticated times after comparing the real remount;
        // retain the provider ownership created by mountIso.
        staged.readonlyMediaContexts.at(-1).fileMetadata=entryMetadata(staged,record.layout);
      } else rememberPinned(staged, media, pins);
    }
    // Refuse collisions before adopting anything into the child's world.
    const drives = records.flatMap(r => r.layout.drives);
    if ([...vfs.files.keys(), ...vfs.dirs].some(k => drives.includes(k.slice(0,1))) || drives.some(d => vfs.readOnlyDrives.has(d)))
      throw new Error('readonly media conflicts with child namespace');
    // A prepared digest may finish before initialization. Recheck its path,
    // live provider, tree and metadata at the actual adoption boundary too.
    capture(staged);
    prepared?.assertActive();
    staged.cwd = vfs.cwd;
    vfs.adoptFrom(staged);
    return opened;
  } catch (error) { for (const media of opened) mediaCli.closeMedia(media); throw error; }
}
module.exports = { remember, mountIso, capture, restore, prepareRestore, tree, canonical, sourcePin };
