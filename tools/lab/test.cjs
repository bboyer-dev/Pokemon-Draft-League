const {before, test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const upstream = require('@smogon/calc');
const {Battle, Dex} = require('@pkmn/sim');
const root = require('node:path').resolve(__dirname,'../..');
global.window={};
const context=vm.createContext({window,console});
vm.runInContext(fs.readFileSync(root+'/assets/lab/engine.js','utf8'),context);
window.NPLCalc=context.NPLCalc;
require('../../assets/lab/forms.js');
require('../../data/league.js');
let lab;
before(async()=>{ lab=await import('../../assets/lab/model.mjs'); });

function showdownSet(set,move) {
  return {name:set.name,species:set.name,item:set.item,ability:set.ability,nature:set.nature,
    level:50,evs:set.evs,ivs:set.ivs,moves:[move,'Protect']};
}
// Independent battle implementation. Disable random criticals and enumerate only the legal damage rolls.
function simulator(a,d,moveName,f) {
  const battle=new Battle({formatid:'gen9doublescustomgame',seed:[42,23,11,7]});
  for(const [side,mon] of [['p1',a],['p2',d]]) {
    const ally=side==='p2' && f.guard?{species:'Clefairy',ability:'Friend Guard'}:{species:'Magikarp',ability:'Swift Swim'};
    battle.setPlayer(side,{name:side,team:[showdownSet(mon,moveName),{...ally,level:50,moves:['Protect']}]});
  }
  battle.makeChoices('team 12','team 12');
  const atk=battle.p1.active[0],def=battle.p2.active[0];
  if (d.ability==='Intimidate' && !d.abilityOn) atk.boosts.atk=0;
  if (f.help) atk.addVolatile('helpinghand',battle.p1.active[1]);
  if (f.reflect) def.side.addSideCondition('reflect',def);
  if (f.light) def.side.addSideCondition('lightscreen',def);
  if (f.burn) atk.setStatus('brn');
  if (f.weather) battle.field.setWeather(({Rain:'raindance',Sun:'sunnyday'})[f.weather],atk);
  if (f.terrain) battle.field.setTerrain(f.terrain.toLowerCase()+'terrain',atk);
  const values=[];
  for(let roll=85;roll<=100;roll++){
    battle.randomizer=n=>Math.floor(n*roll/100);
    const move=battle.dex.getActiveMove(moveName);
    move.willCrit=!!f.crit;
    battle.singleEvent('ModifyMove',move,null,atk,def,move,move);
    move.spreadHit=f.spread!==false && ['allAdjacentFoes','allAdjacent'].includes(move.target);
    values.push(battle.actions.getDamage(atk,def,move,true)||0);
  }
  battle.destroy();
  return values;
}
function check(a,d,move,f={}) {
  const result=lab.damage(a,d,move,f);
  const g=upstream.Generations.get(9);
  const mon=(s,burn)=>new upstream.Pokemon(g,s.name,{...s,level:50,status:burn?'brn':''});
  const rawMove=g.moves.get(upstream.toID(move));
  const m=new upstream.Move(g,move,{isCrit:f.crit,ability:a.ability,item:a.item,
    overrides:f.spread===false && ['allAdjacent','allAdjacentFoes'].includes(rawMove.target)?{target:'normal'}:{}});
  const official=upstream.calculate(g,mon(a,f.burn),mon(d),m,new upstream.Field({gameType:'Doubles',weather:f.weather,terrain:f.terrain,
    attackerSide:{isHelpingHand:f.help},defenderSide:{isReflect:f.reflect,isLightScreen:f.light,isFriendGuard:f.guard}}));
  assert.deepEqual([result.low,result.high],official.range());
  assert.deepEqual(Array.from(result.rolls),[].concat(official.damage));
  const expected=simulator(a,d,move,f);
  const actual=result.rolls.length===1?Array(16).fill(result.rolls[0]):Array.from(result.rolls);
  assert.deepEqual(actual,expected,move+' '+JSON.stringify(f));
  return result;
}
const scizor=()=>({...lab.applyPreset(lab.newSet('Scizor'),'physical'),ability:'Technician',item:'Life Orb'});
test('Level 50 Scizor into Mega Floette and Scream Tail, all rolls and KO thresholds',()=>{
  const a=scizor(),floette=lab.applyPreset(lab.newSet('Floette-Mega'),'hp');
  const base=check(a,floette,'Bullet Punch');
  assert.deepEqual([base.low,base.high,base.hp,base.ohko],[166,198,181,8/16]);
  const hh=check(a,floette,'Bullet Punch',{help:true});assert.equal(hh.ohko,1);
  for(const help of [false,true]) check(a,lab.newSet('Scream Tail'),'Bullet Punch',{help});
  const bulky=check(a,lab.applyPreset(lab.newSet('Scream Tail'),'defense'),'Bullet Punch');
  assert.equal(bulky.two,229/256);assert.equal(bulky.ohko,0);
});
test('Mega Gyarados Waterfall, entry Intimidate, rain, sun and burn',()=>{
  const a=lab.applyPreset(lab.newSet('Gyarados-Mega'),'physical'),d=lab.newSet('Landorus-Therian');
  assert.equal(check(a,d,'Waterfall').low,126);
  assert.equal(check(a,{...d,abilityOn:false},'Waterfall').low,186);
  for(const f of [{weather:'Rain'},{weather:'Sun'},{burn:true}])check(a,d,'Waterfall',f);
});
test('Doubles screens, critical hits, Friend Guard, Helping Hand and resisted physical damage',()=>{
  const a=scizor(),d=lab.newSet('Armarouge');
  for(const f of [{},{reflect:true},{light:true},{reflect:true,crit:true},{guard:true},{help:true,guard:true}])check(a,d,'Bullet Punch',f);
});
test('Special Helping Hand, screens, spread, single target doubles and Psychic Terrain',()=>{
  const a=lab.applyPreset(lab.newSet('Armarouge'),'special'),d=lab.newSet('Scizor');
  for(const f of [{},{help:true},{light:true},{reflect:true},{spread:false},{spread:false,light:true}])check(a,d,'Heat Wave',f);
  check(a,d,'Psychic',{terrain:'Psychic'});
  const zero=lab.damage(scizor(),lab.newSet('Scream Tail'),'Bullet Punch',{terrain:'Psychic'});
  assert.deepEqual([zero.low,zero.high,zero.ohko],[0,0,0]);
  check(lab.newSet('Garchomp-Mega-Z'),lab.newSet('Landorus-Therian'),'Earth Power');
});
test('New Mega forms deal damage under standard EV, IV and nature mechanics',()=>{
  const d=lab.newSet('Scream Tail');
  for(const [name,move] of [['Garchomp-Mega-Z','Earth Power'],['Floette-Mega','Moonblast'],['Raichu-Mega-Y','Thunderbolt'],
    ['Golisopod-Mega','Iron Head'],['Staraptor-Mega','Brave Bird'],['Dragalge-Mega','Sludge Bomb']]) {
    const a=lab.applyPreset(lab.newSet(name),'special');
    a.ivs.spa=19;
    check(a,d,move);
  }
});
test('Every current roster slot and eligible Mega base agrees with Showdown and the Gen 9 calculator',()=>{
  const league=window.NPL_LEAGUE,entries=Object.values(league.coaches).flatMap(c=>c.roster||[]);
  assert.ok(entries.length>0);
  for(const entry of entries) {
    const forms=lab.draftedForms(entry.name);
    for(const name of forms){
      const f=lab.form(name),s=lab.gen.species.get(upstream.toID(name)),ps=Dex.species.get(name);
      assert.deepEqual({...s.baseStats},ps.baseStats);assert.deepEqual([...s.types],ps.types);
      assert.deepEqual(f.abilities,[...new Set(Object.values(ps.abilities))]);
      if(ps.isMega){assert.equal(f.stone,ps.requiredItem);assert.equal(forms[1],ps.changesFrom||ps.baseSpecies);}
      assert.ok(fs.existsSync(root+'/assets/sprites/'+entry.sprite+'.png'));
    }
  }
  assert.equal(lab.draftedForms('Mega Floette')[1],'Floette-Eternal');
  assert.equal(lab.nextOpponent({currentWeek:6,matches:[{season:'s2',status:'scheduled',week:7,coaches:['a','c']},{season:'s2',status:'scheduled',week:6,coaches:['b','a']}]},'a'),'b');
});
test('Bad forms, missing data, illegal inputs, survival effects and unsupported states',()=>{
  const a=scizor(),d=lab.newSet('Floette-Mega');
  for(const invalid of [undefined,'Unknown Mega','Mega Missing'])assert.throws(()=>lab.draftedForms(invalid));
  for(const changes of [{item:''},{ability:'Levitate'},{nature:'unknown'},{ivs:{...d.ivs,hp:-1}},{evs:{...d.evs,hp:252,def:252,spd:252}}])
    assert.throws(()=>lab.damage(a,{...d,...changes},'Bullet Punch'));
  for(const move of ['Protect','Max Flare','Fissure','Rage Fist'])assert.throws(()=>lab.damage(a,d,move));
  const sash=lab.damage(a,{...lab.newSet('Scream Tail'),item:'Focus Sash'},'Bullet Punch');assert.equal(sash.ohko,null);
  const multi=lab.damage(lab.newSet('Maushold'),d,'Population Bomb');assert.equal(multi.ohko,null);assert.ok(multi.high>=multi.low);
  assert.equal(lab.damage(a,d,'Seismic Toss').low,50);
  const psychic=lab.newSet('Armarouge'),target=lab.newSet('Scizor');
  check(psychic,target,'Expanding Force',{terrain:'Psychic',spread:true});
  const single=lab.damage(psychic,target,'Expanding Force',{terrain:'Psychic',spread:false,light:true});
  assert.deepEqual(Array.from(single.rolls),simulator(psychic,target,'Expanding Force',{terrain:'Psychic',spread:false,light:true}));
});

test('Showdown imports validate before replacing the selected set',async()=>{
  const {importSet}=await import('../../assets/lab/import.mjs');
  const roster=window.NPL_LEAGUE.coaches.coach_brice.roster;
  const paste='Arthur (Scizor) (M) @ Life Orb\nAbility: Technician\nTera Type: Bug\nIVs: 0 SpA\n- Protect\n- Bullet Punch';
  const {set,move,note}=importSet(paste,roster);
  assert.equal(set.ivs.spa,0);assert.equal(set.ivs.atk,31);assert.equal(set.gender,'M');assert.equal(move,'Bullet Punch');assert.match(note,/ignore/);
  for(const bad of ['Unknownmon','Scizor\nLevel: 100','Scizor\nLevel: 50abc','Scizor\nEVs: 800 HP','Scizor\nEVs: 4 HP / 4 HP',
    'Scizor\n- Bad move','Gyarados-Mega @ Life Orb','Scizor\n\nFoongus','Scizor\nAbility: Levitate'])assert.throws(()=>importSet(bad,roster));
});
