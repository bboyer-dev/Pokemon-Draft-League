// Rebuild checked-in browser assets from the pinned upstream packages.
const fs = require('node:fs');
const { buildSync } = require('esbuild');
const { Dex } = require('@pkmn/dex');
const { Generations, toID } = require('@smogon/calc');
const { Dex: SimDex } = require('@pkmn/sim');
const { execFileSync } = require('node:child_process');
const champions = SimDex.mod('champions', require('@pkmn/mods/champions'));
const sv = SimDex.forGen(9);
const nativeGames = JSON.parse(execFileSync('python3',['tools/lab/native-pools.py'], {maxBuffer:16*1024*1024}));
const banned = new Set(['return','frustration','fissure','horndrill','guillotine','sheercold','batonpass','doubleteam','minimize']);
function learnset(entry) {
  const champ = champions.species.get(entry.id);
  if (champ.exists && !champ.isNonstandard) return ['Champions',champions.species.getMovePool(champ.id)];
  const source = sv.species.get(entry.battleOnly && typeof entry.battleOnly==='string' ? entry.battleOnly : entry.id);
  const nativeSV = source.exists && !source.isNonstandard;
  if (nativeSV) return ['Scarlet / Violet',sv.species.getMovePool(source.id)];
  for (const [game, records] of Object.entries(nativeGames)) {
    if (!records[source.id]) continue;
    const pool = new Set(records[source.id]);
    // Carry moves learned by an evolving Pokémon within the same game. Regional
    // evolutions acquired as a finished regional form use their own table.
    let child=source;
    while (child.prevo && !child.evoRegion) {
      const parent=sv.species.get(child.prevo);
      if(!records[parent.id])break;
      for(const move of records[parent.id])pool.add(move);
      child=parent;
    }
    return [game,pool];
  }
  return ['Unavailable',[]];
}
const gen = Generations.get(9);
const dex = Dex.mod('gen9');
const suggestions = ['Bullet Punch','Waterfall','Earth Power','Earthquake','Expanding Force','Dazzling Gleam','Moonblast','Heat Wave','Rock Slide','Hyper Voice','Shadow Ball','Make It Rain','Close Combat','Hydro Pump','Thunderbolt','Sludge Bomb','Ice Beam','Knock Off','Brave Bird','Draco Meteor','Iron Head','Psychic','Energy Ball','Bug Buzz','Extreme Speed','Body Press','Fake Out','U-turn'];
async function build() {
  const forms = {};
  const moveNames = [...new Set(sv.moves.all().map(m=>m.name))].sort();
  const moveIndices = new Map(moveNames.map((m,i)=>[toID(m),i]));
  const poolIndices = new Map();
  const pools = [];
  for (const species of gen.species) {
    const entry = dex.species.get(species.name);
    if (!entry.exists) continue;
    const abilities = [...new Set(Object.values(entry.abilities))];
    if (!abilities.every(a => gen.abilities.get(toID(a)))) continue;
    if (entry.types.join() !== species.types.join() ||
        Object.entries(entry.baseStats).some(([stat, value]) => species.baseStats[stat] !== value)) continue;
    const form = { abilities };
    if (entry.isMega) {
      const stone = gen.items.get(toID(entry.requiredItem));
      const base = entry.changesFrom || entry.baseSpecies;
      if (!stone?.megaStone || stone.megaStone[base] !== species.name || !gen.species.get(toID(base))) continue;
      form.stone = stone.name;
      form.base = base;
    }
    const [source, learned] = learnset(entry);
    const legal = [...learned].filter(m=>moveIndices.has(m) && !banned.has(m) && !m.startsWith('hiddenpower'));
    const indices = legal.map(m=>moveIndices.get(m)).sort((a,b)=>a-b);
    const key = indices.join(',');
    if (!poolIndices.has(key)) { poolIndices.set(key,pools.length); pools.push(indices); }
    form.source = source;
    form.pool = poolIndices.get(key);
    const available = suggestions.filter(m => legal.includes(toID(m)));
    const weight = m => {
      const move = gen.moves.get(toID(m));
      return 2 * Number(entry.types.includes(move.type)) + Number((move.category==='Physical') === (entry.baseStats.atk>=entry.baseStats.spa));
    };
    form.suggestions = available.sort((a,b)=>weight(b)-weight(a)).slice(0,5);
    forms[species.name] = form;
  }
  const excludedItems = [...gen.items].filter(i => dex.items.get(i.name).zMove || dex.items.get(i.name).zMoveType).map(i=>i.id);
  const changingMoves = [...gen.moves].filter(m => {
    const entry = dex.moves.get(m.name);
    return entry.self?.boosts || entry.selfdestruct || entry.flags?.recharge || entry.flags?.charge ||
      entry.recoil || entry.forceSwitch || entry.selfSwitch || entry.drain || entry.willCrit && entry.self;
  }).map(m=>m.id);
  fs.mkdirSync('assets/lab', { recursive: true });
  fs.writeFileSync('assets/lab/forms.js', 'window.NPLForms = '+JSON.stringify({forms, excludedItems, changingMoves, moveNames, pools})+';\n');
  // A classic script also supports opening a downloaded branch directly from disk.
  buildSync({entryPoints:['assets/lab/app.mjs'],bundle:true,minify:true,format:'iife',supported:{'template-literal':false},outfile:'assets/lab/application.js'});
  buildSync({entryPoints:['@smogon/calc'],bundle:true,minify:true,platform:'browser',format:'iife',globalName:'NPLCalc',
    outfile:'assets/lab/engine.js',banner:{js:'/* @smogon/calc 0.12.0 | MIT | see licenses.txt */'}});

}
build().catch(error=>{console.error(error);process.exitCode=1;});
