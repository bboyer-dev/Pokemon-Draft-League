// The league snapshot supplies coach and roster membership. Only the dex supplies mechanics.
const calc = window.NPLCalc;
const catalog = window.NPLForms;
export const gen = calc.Generations.get(9);
const id = calc.toID;
export const stats = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const presets = {
  neutral: ['No investment', 'Hardy', [0,0,0,0,0,0]],
  physical: ['Max Attack / Speed', 'Adamant', [4,252,0,0,0,252]],
  special: ['Max Sp. Atk / Speed', 'Modest', [4,0,0,252,0,252]],
  balanced: ['Bulky physical offense', 'Adamant', [252,156,0,0,0,100]],
  hp: ['Max HP', 'Hardy', [252,0,0,0,0,0]],
  defense: ['Physically defensive', 'Bold', [252,0,252,0,4,0]],
  specialDefense: ['Specially defensive', 'Calm', [252,0,4,0,252,0]],
};
const table = (values) => Object.fromEntries(stats.map((s,i)=>[s,values[i]]));
export const items = [...gen.items].filter(i=>!catalog.excludedItems.includes(i.id)).map(i=>i.name).sort();
export const moves = [...gen.moves].filter(m=>m.category !== 'Status' && !m.isZ && !m.isMax && m.name!=='(No Move)').map(m=>m.name).sort();
const damagingByID=new Map(moves.map(m=>[id(m),m]));
export function legalMoves(name) {
  return catalog.pools[form(name).pool].map(i=>catalog.moveNames[i]);
}
export function attacks(name) {
  return legalMoves(name).map(m=>damagingByID.get(id(m))).filter(Boolean);
}
const statAbbr={atk:'Atk',def:'Def',spa:'SpA',spd:'SpD',spe:'Spe'};
export function natureLabel(name) {
  const {minus,plus}=gen.natures.get(id(name));
  return name+' ('+(minus===plus?'neutral':'−'+statAbbr[minus]+' / +'+statAbbr[plus])+')';
}
export const natures = [...gen.natures].map(n=>n.name).sort();
export function form(name) {
  const species = gen.species.get(id(name));
  if (!species || !Object.hasOwn(catalog.forms,species.name)) throw Error('Unverified Pokémon form: '+(name || 'missing name'));
  return {...catalog.forms[species.name], name:species.name, types:species.types};
}
export function draftedForms(label) {
  if (id(label)==='aegislash') return ['Aegislash-Shield','Aegislash-Blade'].map(n=>form(n).name);
  const aliases = {'indeedeem':'Indeedee','indeedeef':'Indeedee-F','basculegionmale':'Basculegion'};
  const regions = {Hisuian:'Hisui',Alolan:'Alola',Galarian:'Galar',Paldean:'Paldea'};
  const canonical = aliases[id(label)] || String(label)
    .replace(/^Mega (.+?)(?: ([XYZ]))?$/, (_,n,s)=>n+'-Mega'+(s?'-'+s:''))
    .replace(/^(Hisuian|Alolan|Galarian|Paldean) (.+)$/,(_,r,n)=>n+'-'+regions[r]);
  const f = form(canonical);
  return f.base ? [f.name,form(f.base).name] : [f.name];
}
export function nextOpponent(league, coach) {
  return league.matches.filter(m=>m.season==='s2' && m.status==='scheduled' && m.week>=league.currentWeek && m.coaches.includes(coach))
    .sort((a,b)=>a.week-b.week)[0]?.coaches.find(other=>other!==coach);
}
export function applyPreset(set, key) {
  const [label,nature,values] = presets[key];
  return {...set,preset:key,nature,evs:table(values)};
}
export function newSet(name) {
  const f=form(name);
  return applyPreset({name:f.name,ability:f.abilities[0],item:f.stone||'',ivs:table(stats.map(()=>31)),
    boosts:table(stats.map(()=>0)),abilityOn:f.abilities[0]==='Intimidate'},'neutral');
}
export function validate(set) {
  const f=form(set.name);
  if (!f.abilities.includes(set.ability)) throw Error('Choose a listed ability for '+set.name+'.');
  if (!natures.includes(set.nature)) throw Error('Choose a listed nature.');
  if (set.item && !items.includes(set.item)) throw Error('Choose a recognized held item or leave it empty.');
  if (f.stone && set.item!==f.stone) throw Error(set.name+' requires '+f.stone+'.');
  for (const [key,min,max] of [['evs',0,252],['ivs',0,31],['boosts',-6,6]]) {
    if (!stats.every(s=>Number.isInteger(set[key]?.[s]) && set[key][s]>=min && set[key][s]<=max)) throw Error('Check '+set.name+' '+key+' ('+min+' to '+max+').');
  }
  if (Object.values(set.evs).reduce((a,b)=>a+b,0)>510) throw Error(set.name+' exceeds 510 total EVs.');
}
const conditionalMoves = new Set(['Beat Up','Return','Frustration','Present','Magnitude','Fling','Spit Up','Counter','Mirror Coat','Metal Burst','Bide','Comeuppance','Rage Fist','Last Respects','Pursuit','Assurance','Retaliate','Round','Avalanche','Revenge','Payback','Upper Hand','Focus Punch','Shell Trap','Sucker Punch','Thunderclap','Future Sight','Doom Desire','Endeavor','Final Gambit','Natural Gift','Fickle Beam','Rollout','Ice Ball','Echoed Voice','Trump Card','Fusion Flare','Fusion Bolt','Water Pledge','Fire Pledge','Grass Pledge','Fissure','Horn Drill','Sheer Cold','Guillotine']);
export const defaultField = {weather:'',terrain:'',help:false,reflect:false,light:false,guard:false,burn:false,spread:true,crit:false};
// The upstream calculator clones its inputs and changes Expanding Force's target in Psychic Terrain.
// Pin only that target on the calculation copy when just one foe remains. The engine still
// computes grounding, terrain power, screens, and all damage rounding in doubles.
class SingleTargetExpandingForce extends calc.Move {
  clone() {
    const copy = super.clone();
    Object.defineProperty(copy,'target',{get:()=> 'normal',set() {}});
    return copy;
  }
}
export function damage(a,d,moveName,settings=defaultField) {
  validate(a); validate(d);
  const f={...defaultField,...settings};
  if (!attacks(a.name).includes(moveName)) throw Error('Choose a damaging move from '+a.name+'’s '+form(a.name).source+' learnset.');
  if (conditionalMoves.has(moveName)) throw Error(moveName+' requires battle history, a target action or an effect outside this lab.');
  if (['Disguise','Ice Face'].includes(d.ability)) throw Error('This lab cannot resolve '+d.ability+' interception.');
  if (a.name==='Aegislash-Shield') throw Error('Choose Blade Forme for an attacking Aegislash. Stance Change occurs before it deals damage.');
  const build=(set,burn)=>new calc.Pokemon(gen,set.name,{level:50,ability:set.ability,abilityOn:set.abilityOn,item:set.item||undefined,
    nature:set.nature,gender:set.gender,ivs:set.ivs,evs:set.evs,boosts:set.boosts,status:burn?'brn':''});
  const atk=build(a,f.burn), def=build(d,false);
  const data=gen.moves.get(id(moveName));
  const options={ability:a.ability,item:a.item,isCrit:f.crit};
  if (!f.spread && ['allAdjacent','allAdjacentFoes'].includes(data.target)) options.overrides={target:'normal'};
  const Move=!f.spread && moveName==='Expanding Force' ? SingleTargetExpandingForce : calc.Move;
  const move=new Move(gen,moveName,options);
  const field=new calc.Field({gameType:'Doubles',weather:f.weather||undefined,terrain:f.terrain||undefined,
    attackerSide:{isHelpingHand:f.help},defenderSide:{isLightScreen:f.light,isReflect:f.reflect,isFriendGuard:f.guard}});
  const r=calc.calculate(gen,atk,def,move,field);
  const [low,high]=r.range(), hp=def.maxHP();
  if (![low,high,hp].every(Number.isFinite) || !hp) throw Error('The engine did not return a supported damage range.');
  if (high===0 && !data.basePower && !['Night Shade','Seismic Toss','Super Fang',"Nature's Madness",'Ruination'].includes(moveName))
    throw Error('This variable-power move could not be resolved for the selected state.');
  const rolls=typeof r.damage==='number'?[r.damage]:r.damage.length===16 && r.damage.every(Number.isFinite)?r.damage:null;
  const survival=['Focus Sash','Focus Band'].includes(d.item)||d.ability==='Sturdy';
  let ohko=null, two=null, reason='';
  if (!rolls || move.hits>1 || survival) {
    reason=survival?'Survival item or ability requires turn resolution.':'KO odds depend on individual hits.';
  } else {
    ohko=rolls.filter(v=>v>=hp).length/rolls.length;
    // Two successful uses at fixed conditions. Suppress cases with predictable changes between hits.
    const changes=catalog.changingMoves.includes(id(moveName)) || ['Multiscale','Shadow Shield','Stamina','Weak Armor','Berserk','Color Change','Cotton Down','Sand Spit','Seed Sower','Anger Shell','Water Compaction','Thermal Exchange','Electromorphosis'].includes(d.ability) ||
      /Berry$|Leftovers|Black Sludge|Weakness Policy|Air Balloon|Eject |Red Card|Absorb Bulb|Cell Battery|Luminous Moss|Snowball/.test(d.item) ||
      /Gem$|Throat Spray|Metronome|Power Herb/.test(a.item) || ['Super Fang','Ruination',"Nature's Madness",'Brine','Crush Grip','Hard Press','Wring Out','Knock Off','Fury Cutter','Eruption','Water Spout','Dragon Energy','Acrobatics','Power-Up Punch','Gigaton Hammer','Blood Moon','Fake Out','First Impression','Hyper Beam','Giga Impact','Explosion','Self-Destruct','Misty Explosion','Steel Beam','Mind Blown'].includes(moveName);
    if (changes) reason='Second-use odds depend on a changed battle state.';
    else two=rolls.reduce((count,x)=>count+rolls.filter(y=>x+y>=hp).length,0)/(rolls.length**2);
  }
  return {low,high,hp,rolls,ohko,two,reason,hits:move.hits,category:r.move.category,type:r.move.type};
}
