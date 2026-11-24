import {mountPicker} from './picker.mjs';
import {importSet} from './import.mjs';
import {damage,defaultField,draftedForms,form,items,attacks,legalMoves,statusMove,natureLabel,natures,newSet,nextOpponent,presets,stats,applyPreset} from './model.mjs';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opt=(value,label,selected)=>'<option value="'+escape(value)+'"'+(value===selected?' selected':'')+'>'+escape(label)+'</option>';
const options=(values,current)=>values.map(v=>opt(v,v,current)).join('');
const select=(label,key,content,wide=false)=>'<label'+(wide?' class="wide"':'')+'>'+label+'<select data-key="'+key+'">'+content+'</select></label>';
function picker(role,key,label,wide=false) {
  const p='pick-'+role+'-'+key;
  return '<div class="lab-picker'+(wide?' wide':'')+'" id="'+p+'"><label>'+label+
    '<input role="combobox" aria-autocomplete="list" aria-expanded="false" autocomplete="off" aria-describedby="'+p+'-status"></label>'+
    '<ul role="listbox" hidden></ul><small role="status" id="'+p+'-status"></small></div>';
}
const suggestedItems=['Life Orb','Focus Sash','Choice Scarf','Sitrus Berry','Assault Vest','Leftovers'];
function firstAttack(name){return form(name).suggestions[0]||attacks(name)[0]||'';}
const field={...defaultField};
const labels={help:'Helping Hand',reflect:'Reflect',light:'Light Screen',guard:'Friend Guard',burn:'Attacker burned',spread:'Multiple targets in range',crit:'Critical hit'};
const statLabels={hp:'HP',atk:'Atk',def:'Def',spa:'Sp. Atk',spd:'Sp. Def',spe:'Speed'};
const activeRole={a:null,d:null};
const league=window.NPL_LEAGUE;
const params=new URLSearchParams(location.search);
const origin=params.get('coach'), returnSeason=params.get('season')||'s2';
const ids=Object.keys(league?.coaches||{}).filter(k=>league.coaches[k].roster?.length).sort((a,b)=>league.coaches[a].name.localeCompare(league.coaches[b].name));
const builds=new Map();
const conditionText=()=>[field.weather,field.terrain&&field.terrain+' Terrain',...Object.keys(labels).filter(k=>field[k]&&k!=='spread').map(k=>labels[k]),field.spread?'Multiple targets in range':'One target in range'].filter(Boolean).join(' · ');
const pct=(n)=>n==null?'—':Number((100*n).toFixed(2))+'%';
const range=r=>(100*r.low/r.hp).toFixed(1)+'–'+(100*r.high/r.hp).toFixed(1)+'%';
const keyFor=(coach,entry)=>coach+'|'+entry.name;
function slot(coach,entry) {
  const key=keyFor(coach,entry);
  if (!builds.has(key)) {
    try {
      const forms=draftedForms(entry.name);
      const set=newSet(forms[0]);
      builds.set(key,{coach,entry,forms,set,move:firstAttack(set.name)});
    } catch(error) { builds.set(key,{coach,entry,error:error.message}); }
  }
  return builds.get(key);
}
function changeCoach(role,coach) {
  activeRole[role]=coach?slot(coach,league.coaches[coach].roster[0]):null;
}
function fallbackOpponent(coach) {return nextOpponent(league,coach);}
function coachControls() {
  for(const role of ['a','d']){
    const coach=activeRole[role]?.coach||'';
    $('coach-'+role).innerHTML=opt('','Choose a coach',coach)+ids.filter(id=>role==='a'||id!==activeRole.a?.coach).map(id=>opt(id,league.coaches[id].name,coach)).join('');
  }
  const coach=activeRole.a?.coach;
  // Preserve a historical dashboard as the return destination for that entry point.
  const back=league.coaches[origin] ? origin : coach;
  $('back').href=back?'scouting.html?'+new URLSearchParams({coach:back,season:back===origin?returnSeason:'s2'}):'scouting.html';
}
function buildNote(set) {
  const evs=stats.filter(s=>set.evs[s]).map(s=>set.evs[s]+' '+statLabels[s]).join(' / ')||'0 EVs';
  const ivs=stats.every(s=>set.ivs[s]===31)?'31 IVs in all stats':stats.map(s=>set.ivs[s]+' '+statLabels[s]).join(' / ')+' IVs';
  return natureLabel(set.nature)+' · '+evs+' · '+ivs;
}
function stages(set,s) {
  return Array.from({length:13},(_,i)=>opt(i-6,(i>6?'+':'')+(i-6),set.boosts[s])).join('');
}
function advanced(role,set) {
  return '<div class="stats"><strong>Stat</strong><b>EV</b><b>IV</b><b>Stage</b>'+stats.map(s=>{
    const numeric=(key,max)=>'<input type="number" min="0" max="'+max+'" step="1" data-key="'+key+'" data-stat="'+s+'" aria-label="'+role+' '+statLabels[s]+' '+key+'" value="'+escape(set[key][s])+'">';
    return '<strong>'+statLabels[s]+'</strong>'+numeric('evs',252)+numeric('ivs',31)+(s==='hp'?'<span>—</span>':'<select data-key="boosts" data-stat="'+s+'" aria-label="'+role+' '+statLabels[s]+' stage">'+stages(set,s)+'</select>');
  }).join('')+'</div><small>Stages are applied before entry abilities. Enable Intimidate for a fresh entry drop. Set it off for a drop already included in the stages.</small>';
}
function side(role) {
  const node=$('side-'+role), x=activeRole[role], title=role==='a'?'Attacker':'Defender';
  const expanded=node.querySelector('details')?.open;
  node.innerHTML='<h2>'+title+'</h2>';
  if (!x){node.innerHTML+='<p>Choose a current Season 2 coach.</p>';return;}
  const roster=league.coaches[x.coach].roster;
  const rosterPicker=select('Drafted Pokémon','entry',roster.map(mon=>opt(mon.name,mon.name,x.entry.name)).join(''));
  if (x.error){node.innerHTML+=rosterPicker+'<p class="error">'+escape(x.error)+'</p>';return;}
  const s=x.set, data=form(s.name);
  const sprite=s.name===x.forms[0]||s.name.startsWith('Aegislash-')?x.entry.sprite:s.name.toLowerCase().replace(/[’']/g,'');
  node.innerHTML+='<div class="identity">'+(sprite?'<img alt="" src="assets/sprites/'+encodeURIComponent(sprite)+'.png">':'')+'<div><strong>'+escape(s.name)+'</strong><span class="sub">'+escape(data.types.join(' / '))+'</span></div></div>';
  const item=data.stone?'<label>Required Mega Stone<input readonly value="'+escape(data.stone)+'"></label>':picker(role,'item','Held item');
  const moveList=role==='a'?picker(role,'move','Move',true)+'<small class="wide move-note">'+escape(data.source)+' learnset · '+legalMoves(s.name).length+' league-legal moves</small>':'';
  const conditionalAbilities=['Intimidate','Flash Fire','Electromorphosis','Stakeout','Unburden','Slow Start','Plus','Minus','Wind Power','Intrepid Sword','Dauntless Shield'];
  const abilityOn=conditionalAbilities.includes(s.ability)?'<label class="tick"><input type="checkbox" data-key="abilityOn"'+(s.abilityOn?' checked':'')+'> '+(s.ability==='Intimidate'?'Apply entry Intimidate':'Conditional ability active')+'</label>':'';
  node.innerHTML+='<div class="fields">'+rosterPicker+select('Battle form','form',options(x.forms,s.name))+moveList+
    select('Ability','ability',options(data.abilities,s.ability))+item+
    select('EV preset','preset',opt('custom','Custom',s.preset)+Object.entries(presets).map(([k,v])=>opt(k,v[0],s.preset)).join(''))+
    select('Nature','nature',natures.map(n=>opt(n,natureLabel(n),s.nature)).join(''))+'</div><p class="set-assumptions"></p>'+abilityOn+
    '<details'+(expanded?' open':'')+'><summary>Advanced stats &amp; boosts</summary>'+advanced(title,s)+
    '<label>Import one Showdown set<textarea data-paste rows="4" spellcheck="false" placeholder="Paste a Showdown export"></textarea></label><button type="button" data-import>Load set</button><small data-import-result role="status"></small></details>';
  if(!data.stone)mountPicker($('pick-'+role+'-item'),{key:'item',label:'Held item',values:items,recent:suggestedItems,
    selected:s.item,allowEmpty:true,onSelect:value=>{s.item=value;forecast();}});
  if(role==='a')mountPicker($('pick-a-move'),{key:'move',label:'Move',values:legalMoves(s.name),maxResults:Infinity,recent:data.suggestions,
    selected:x.move,allowEmpty:false,onSelect:value=>{x.move=value;forecast();}});
  node.querySelector('.set-assumptions').textContent=buildNote(s);
  const image=node.querySelector('img');
  if (image) image.onerror=()=>{image.onerror=null;image.src='assets/sprites/'+encodeURIComponent(x.entry.sprite)+'.png';image.alt='Drafted roster slot';};
}
function forecast() {
  const a=activeRole.a,d=activeRole.d;
  try {
    if (!a?.set||!d?.set) throw Error('Select two verified current-roster Pokémon.');
    const status=statusMove(a.move);
    if (status) {
      $('output').innerHTML='<p><strong>'+escape(a.move)+'</strong> · '+escape(status.type)+' · Status</p><p>'+escape(status.effect)+'</p><small>This move has no direct damage roll. To model its effect on a later attack, set the relevant boosts or field conditions.</small>';
      if ($('compare').open) comparison();
      return;
    }
    const r=damage(a.set,d.set,a.move,field);
    $('output').innerHTML='<p>'+escape(a.set.name)+' · '+escape(a.move)+' → '+escape(d.set.name)+'</p><div class="numbers"><div><strong>'+range(r)+'</strong>'+r.low+'–'+r.high+' damage / '+r.hp+' HP</div><div><strong>'+pct(r.ohko)+'</strong>OHKO</div><div><strong>'+pct(r.two)+'</strong>KO within two uses</div></div>'+
      '<div class="hp-track" aria-hidden="true"><i style="width:'+Math.min(100,100*r.high/r.hp)+'%"></i><b style="width:'+Math.min(100,100*r.low/r.hp)+'%"></b></div>'+
      '<p class="sub">'+escape(r.type+' · '+r.category+' · '+conditionText())+'</p>'+
      (r.rolls?'<div class="rolls" aria-label="Damage rolls in HP">'+r.rolls.map(v=>'<span>'+v+'</span>').join('')+'</div>':'<p>Engine assumes '+r.hits+' hits for this range.</p>')+
      '<small>Full HP at the start. Odds assume successful hits and fixed conditions, excluding residual damage, healing and random secondary effects. Presets are hypothetical builds.</small>'+
      (r.reason?'<small>'+escape(r.reason)+'</small>':'');
  }catch(error){$('output').innerHTML='<p class="error">'+escape(error.message)+'</p>';}
  if ($('compare').open) comparison();
}
function comparison() {
  const a=activeRole.a,d=activeRole.d;
  if (!a?.set||!d){$('comparison').textContent='Choose both coaches and an attacker.';return;}
  if(statusMove(a.move)){$('comparison').textContent=a.move+' is a status move. Choose a damaging move to compare opponents.';return;}
  const rows=league.coaches[d.coach].roster.map(entry=>{
    const x=slot(d.coach,entry);
    let result,odds='—';
    try {if(x.error)throw Error(x.error);const r=damage(a.set,x.set,a.move,field);result=range(r);odds=pct(r.ohko);}
    catch(error){result=error.message;}
    return '<tr><td><button type="button" data-load="'+escape(entry.name)+'">'+escape(x.set?.name||entry.name)+'</button></td><td>'+escape(result)+'</td><td>'+odds+'</td><td>'+escape(x.set?[buildNote(x.set),x.set.ability,x.set.item].filter(Boolean).join(' · '):'Unavailable')+'</td></tr>';
  }).join('');
  $('comparison').innerHTML='<div class="comparison-scroll"><table><thead><tr><th>Opponent</th><th>Damage</th><th>OHKO</th><th>Defensive assumptions</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function refresh() { coachControls();side('a');side('d');forecast(); }
function edit(role,target) {
  const x=activeRole[role], k=target.dataset.key, value=target.value;
  if (!x||!k)return;
  if(k==='entry') activeRole[role]=slot(x.coach,league.coaches[x.coach].roster.find(e=>e.name===value));
  else if(k==='form'){
    const prev=x.set,next=newSet(value);
    if(!legalMoves(value).includes(x.move))x.move=firstAttack(value);
    x.set={...prev,name:next.name,item:next.item,ability:next.ability,abilityOn:next.abilityOn};
  }else if(k==='preset'){if (value!=='custom')x.set=applyPreset(x.set,value);else x.set.preset='custom';}
  else if(k==='move')x.move=value;
  else if(k==='ability'){x.set.ability=value;x.set.abilityOn=value==='Intimidate';}
  else if(k==='abilityOn')x.set.abilityOn=target.checked;
  else if(['evs','ivs','boosts'].includes(k)) {x.set[k][target.dataset.stat]=target.value===''?NaN:Number(value);if(k==='evs')x.set.preset='custom';}
  else {x.set[k]=value;if(k==='nature')x.set.preset='custom';}
  if(['entry','form','preset','ability'].includes(k)) side(role);
  else {
    const panel=$('side-'+role);
    panel.querySelector('.set-assumptions').textContent=buildNote(x.set);
    panel.querySelector('[data-key=preset]').value=x.set.preset;
  }
  if(activeRole.a===activeRole.d) side(role==='a'?'d':'a');
  forecast();
}
function init() {
  $('notice').textContent='';
  if (!ids.length) throw Error('The Season 2 roster snapshot is unavailable.');
  const a=origin?(ids.includes(origin)?origin:null):(ids.includes('coach_brice')?'coach_brice':ids[0]);
  const requested=params.get('opponent');
  const d=requested?(ids.includes(requested) && requested!==a?requested:null):(a?fallbackOpponent(a):null);
  if (!a || requested && !d) $('notice').textContent='This coach or opponent has no current Season 2 roster. Choose an active coach below.';
  else if (!d) $('notice').textContent='No upcoming opponent is scheduled. Choose a defending coach.';
  changeCoach('a',a);changeCoach('d',d);
  $('conditions').innerHTML=Object.entries(labels).map(([k,label])=>'<label class="tick"><input type="checkbox" id="'+k+'"'+(field[k]?' checked':'')+'> '+label+'</label>').join('');
  for(const role of ['a','d']){
    $('coach-'+role).onchange=e=>{
      const coach=e.target.value;changeCoach(role,coach);
      if (role==='a') changeCoach('d',coach?fallbackOpponent(coach):null);
      $('notice').textContent='';refresh();
    };
    $('side-'+role).addEventListener('click',e=>{
      if(!e.target.closest('[data-import]'))return;
      const panel=$('side-'+role), coach=activeRole[role].coach;
      try{
        const imported=importSet(panel.querySelector('[data-paste]').value,league.coaches[coach].roster);
        const x=slot(coach,imported.entry);
        x.set=imported.set;x.move=imported.move;activeRole[role]=x;
        side(role);forecast();panel.querySelector('[data-import-result]').textContent=imported.note;
      }catch(error){panel.querySelector('[data-import-result]').textContent=error.message;}
    });
    $('side-'+role).addEventListener('input',e=>{if(e.target.type==='number')edit(role,e.target);});
    $('side-'+role).addEventListener('change',e=>{if(e.target.tagName==='SELECT'||e.target.type==='checkbox')edit(role,e.target);});
  }
  $('swap').onclick=()=>{[activeRole.a,activeRole.d]=[activeRole.d,activeRole.a];refresh();};
  for (const k of ['weather','terrain',...Object.keys(labels)]) $(k).onchange=e=>{field[k]=e.target.type==='checkbox'?e.target.checked:e.target.value;forecast();};
  $('compare').ontoggle=()=>{if($('compare').open)comparison();};
  $('comparison').onclick=e=>{
    const name=e.target.closest('[data-load]')?.dataset.load;
    if(!name)return;
    activeRole.d=slot(activeRole.d.coach,league.coaches[activeRole.d.coach].roster.find(m=>m.name===name));side('d');forecast();
    $('side-d').querySelector('[data-key=entry]')?.focus();
  };
  refresh();
}
try {init();} catch (error) {$('notice').textContent='Matchup Lab could not load. '+error.message;}
