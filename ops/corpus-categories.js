'use strict';

// Editorial browsing categories for identities in the local candidate manifest.
// These do not assert installation, gameplay, compatibility or licensing.
// Installers are grouped with their target title, not by packaging format.
const groups = [
  ['action-adventure', 'Action / adventure', ['beyond-good-evil-demo', 'return-fire-demo', 'pirates-2004', 'gta2-demo']],
  ['adventure', 'Adventure', ['scummvm-fotaq', 'gog-free-beneath-a-steel-sky', 'gog-free-flight-of-the-amazon-queen', 'gog-free-lure-of-the-temptress']],
  ['arcade', 'Arcade / brick breakers', ['dxball', 'qbob', 'jardinains', 'reflexive-ricochet-xtreme']],
  ['fighting', 'Fighting', ['little-fighter-2-installer']],
  ['platform', 'Platform games', ['cave-story', 'jazz-jackrabbit-2-demo-installer', 'icy-tower']],
  ['puzzle-board', 'Puzzle / board games', ['snood', 'winboard-installer', 'tetrinet', 'moorhuhn-3-puzzles', 'reflexive-zuma-deluxe', 'reflexive-collapse-crunch']],
  ['racing', 'Racing / driving', ['need-for-speed-2-demo', 'need-for-speed-3-demo', 'need-for-speed-2-full', 'need-for-speed-2-se-full', 'generally', 'elasto-mania']],
  ['role-playing', 'Role-playing', ['baldurs-gate2-demo', 'dungeons-of-dredmor-release', 'dungeons-of-dredmor', 'nethack-win32', 'diablo-2-demo-installer', 'fallout-demo', 'diablo-shareware', 'gog-free-elder-scrolls-arena', 'gog-free-elder-scrolls-daggerfall', 'gog-free-ultima-iv', 'deus-ex-demo', 'icewind-dale-demo', 'baldurs-gate-noninteractive-demo', 'baldurs-gate-interactive-demo', 'baldurs-gate-chapters-1-2-demo', 'arcanum-demo']],
  ['shooters', 'Shooters', ['serious-sam-demo', 'forsaken-demo', 'quake-2-demo-installer', 'half-life-uplink-installer', 'gog-free-shadow-warrior-classic', 'unreal-special-edition', 'unreal-tournament-demo-348', 'unreal-tournament-2003-demo', 'unreal-tournament-2004-demo', 'unreal-tournament-3-demo-installer', 'moorhuhn', 'moorhuhn-2', 'moorhuhn-winter', 'moorhuhn-3', 'gallinelle-xxl', 'reflexive-crimsonland', 'reflexive-alien-shooter']],
  ['sports-simulation', 'Sports / simulation', ['blobby-volley', 'simgolf-demo-installer', 'moorhuhn-tennis']],
  ['strategy', 'Strategy / tactics', ['disciples2-demo', 'liquid-war', 'pocket-tanks-installer', 'heroes-3-demo-installer', 'heroes-2-demo', 'starcraft-shareware', 'worms-2-demo', 'civilization-2-win16', 'civilization-2-mge-win32', 'warcraft3-demo', 'myth-the-fallen-lords', 'populous-the-beginning-demo']],
  ['tools', 'Applications / tools', ['generally-track-editor', 'putty', 'virtualdub', '7zip-file-manager', 'povray-installer', 'dependency-walker', 'far-manager-170', 'winrar-310']],
  ['collections', 'Collections / extras', ['best-of-moorhuhn']],
];
const assignments = new Map();
for (const [id, label, candidates] of groups) {
  for (const candidate of candidates) {
    if (assignments.has(candidate)) throw new Error(`Duplicate category assignment: ${candidate}`);
    assignments.set(candidate, { id, label, basis: 'Editorial category for the title identified in test/candidate-corpus/manifest.json; not gameplay verification.' });
  }
}
// Exact registry identities, including the Windows Entertainment Pack variants.
// Unknown identities are intentionally left for review rather than title guesses.
const registryGroups = [
  ['shooters', 'Shooters', ['quake3_demo','forsaken_demo','diehard_nakatomi_demo','ut348_demo','blood2_demo','avp_alien_demo','avp_marine_demo','descent3_demo','daikatana_demo','delta_force_demo']],
  ['graphics-demos', 'Graphics demos / screensavers', ['heaven7','cashcow','bakkslide7','ptct','wep16_idlewild','wep16_lifegen']],
  ['action-adventure', 'Action / adventure', ['hitman_glide_demo','hype_glide_demo','tomb_raider_2_demo','tomb_raider_3_demo','die_by_the_sword_demo','drakan_demo','asghan_demo']],
  ['sports-simulation', 'Sports / simulation', ['mw3','freespace_demo','comanche_gold_demo']],
  ['strategy', 'Strategy / tactics', ['mcm','myth_tfl','braveheart_demo']],
  // test/binaries/SOURCES.md identifies Bricks as Klotski, not a brick breaker.
  ['puzzle-board', 'Puzzle / board games', ['fourstones','pawn','runenlegen','jigssawme','empipe','marbles','bricks']],
  ['collections', 'Collections / extras', ['winarc']],
  ['tools', 'Applications / tools', ['claass','xp_eos','tour98','welcome98','windows_installer_20']],
  ['platform', 'Platform games', ['croc2_demo','abedemo','captain_claw_demo']],
  ['adventure', 'Adventure', ['broken_sword_demo','curse_monkey_island_demo','atlantis_demo','dark_earth_demo']],
  ['role-playing', 'Role-playing', ['darkstone_demo','diablo_demo','morrowind','anachronox_demo','crusaders_mm_demo','dungeon_siege_demo']],
  ['strategy', 'Strategy / tactics', ['aoe1','aoe2','black_white_2_demo','caesar3_demo','dungeon_keeper_demo','total_annihilation_demo','red_alert_95_demo','dark_colony_demo','disciples_demo','commandos_demo','age_of_wonders_demo','age_of_wonders2_demo','alpha_centauri_demo','dark_reign_demo','populous_tb_demo','anno1602_demo']],
  ['sports-simulation', 'Sports / simulation', ['rct','simcity2000_demo','simcity2000_net','ski32','wep16_ski','wep16_fujigolf']],
  ['racing', 'Racing / driving', ['nfs2se_glide_demo','daytona_usa_deluxe_demo','colin_mcrae_rally_demo','carmageddon2_demo','driver_demo','cmr2_demo','re_volt_demo','midtown_madness_trial']],
  ['arcade', 'Arcade / brick breakers', ['atomic_bomberman_june_demo','pinball','pinball_plus95','snake','rodent2000','wep16_rattler','wep16_rodent','wep16_jezzball','wep16_maxwell']],
  ['puzzle-board', 'Puzzle / board games', ['freecell','freecell16','cruel','golf','pegged','taipei','tictac','reversi','winmine_wep','mshearts16','sol','sol16','spider','tetravex','tworld','winmine','winmine16','qblackjack','pyramid','peaks','funtris','cwordzap','wep16_blakjak','wep16_chess','wep16_chips','wep16_cruel','wep16_freecell','wep16_gofigure','wep16_golf','wep16_jigsawed','wep16_klotski','wep16_pegged','wep16_pipe','wep16_stones','wep16_tetravex','wep16_tetris','wep16_tic','wep16_tictacdp','wep16_tp','wep16_tripeaks','wep16_tutstomb','wep16_winmine','wep16_wordzap']],
  ['tools', 'Applications / tools', ['notepad','notepad98','calc','mspaint','mspaint98','mspaint_ep','wordpad','write','regedit','taskman','sndrec32_98','sndrec32_xp','sndvol32','cdplayer','explorer98','cleanmgr','fontview','hypertrm','kodakimg','kodakprv','mirc59','mplay32','mplayer','rsrcmtr','sysmon','telnet','vol98','winipcfg','winamp','winamp_mod','winamp291_inst','winamp295_inst','simcity2000_net_server']],
];
for (const [id,label,candidates] of registryGroups) for (const candidate of candidates) {
  if (assignments.has(candidate)) throw new Error(`Duplicate registry category: ${candidate}`);
  assignments.set(candidate,{id,label,basis:'Editorial category from the exact app identity in lib/apps.js and test/binaries/SOURCES.md; not gameplay verification.'});
}
function classifyCandidate(candidate) {
  if (candidate.registryOnly && candidate.executables?.some(p => /^test\/binaries\/(screensavers|dx-sdk)\//.test(p))) {
    return {id:'graphics-demos',label:'Graphics demos / screensavers',basis:'Registry executable belongs to the local screensavers or DirectX SDK fixture collection.'};
  }
  return assignments.get(candidate.id) || { id: 'unclassified', label: 'Unclassified', basis: 'No reviewed category assignment for this candidate.' };
}
module.exports = { classifyCandidate, groups };
