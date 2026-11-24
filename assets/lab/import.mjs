import {Sets} from '@pkmn/sets';
import {draftedForms,gen,moves,newSet,validate} from './model.mjs';
const id=window.NPLCalc.toID;
// Accept a single standard export. Validate before touching the session's selected build.
export function importSet(text, roster) {
  const lines=text.trim().split(/\r?\n/).map(s=>s.trim());
  if (!lines[0] || lines.some(l=>!l || l.startsWith('==='))) throw Error('Paste exactly one Showdown set.');
  const fields=new Set();
  for(const line of lines.slice(1)){
    if (/^-\s+\S/.test(line)) continue;
    const field=line.match(/^(Ability|Level|EVs|IVs|Tera Type|Shiny|Happiness|Pokeball):\s*\S/)?.[1]?.toLowerCase() ||
      (/^[A-Za-z]+ Nature$/.test(line)?'nature':null);
    if (!field || fields.has(field)) throw Error('Unrecognized or duplicate set line: '+line);
    fields.add(field);
    if(field==='level' && !/^Level:\s*50$/.test(line)) throw Error('This lab supports level 50.');
    if (field==='evs'||field==='ivs'){
      const parts=line.slice(line.indexOf(':')+1).split('/').map(v=>v.trim().match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i));
      if(parts.some(p=>!p)||new Set(parts.map(p=>p[2].toLowerCase())).size!==parts.length) throw Error('Invalid stat spread: '+line);
    }
  }
  const parsed=Sets.importSet(lines.join('\n'));
  if (parsed.level!==undefined && parsed.level!==50) throw Error('This lab supports level 50. Change the exported level first.');
  let entry,name;
  for (const mon of roster){
    let forms;
    try {forms=draftedForms(mon.name);} catch {continue;}
    const wanted=id(parsed.species);
    name=forms.find(n=>id(n)===wanted) || (id(mon.name)===wanted?forms[0]:undefined);
    if(name){entry=mon;break;}
  }
  if(!entry) throw Error('This species or form is outside the selected coach’s active roster.');
  const set=newSet(name);
  set.item=parsed.item||'';
  set.ability=parsed.ability||set.ability;
  set.abilityOn=set.ability==='Intimidate';
  set.nature=parsed.nature||'Hardy';
  Object.assign(set.evs,parsed.evs);Object.assign(set.ivs,parsed.ivs);
  set.gender=parsed.gender||undefined;
  const speciesGender=gen.species.get(id(name)).gender;
  if (set.gender && speciesGender && set.gender!==speciesGender) throw Error('The exported gender conflicts with the selected form.');
  set.preset='custom';
  validate(set);
  const moveNames=(parsed.moves||[]).map(m=>{
    const move=gen.moves.get(id(m.replace(/[\[\]]/g,'')));
    if(!move||move.isZ||move.isMax)throw Error('Unrecognized or unsupported imported move: '+m);
    return move.name;
  });
  if(moveNames.length>4)throw Error('A set may contain at most four moves.');
  const move=moveNames.find(m=>moves.includes(m))||'';
  let note='Loaded '+name+' at level 50.';
  if(parsed.teraType)note+=' League rules ignore the exported Tera Type.';
  if(!parsed.ability)note+=' Assumed '+set.ability+'.';
  return {entry,set,move,note};
}
