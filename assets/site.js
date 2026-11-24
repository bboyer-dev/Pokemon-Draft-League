'use strict';
const league = window.NPL_LEAGUE;
const byId = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const esc = value => String(value).replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));
const name = id => league.coaches[id].name;
const profileLink = (id, season='s2') => 'coaches.html?coach='+encodeURIComponent(id)+(season==='s2'?'':'&season='+season)+'#profile';
const scoutingLink = (id, season='s2') => 'scouting.html?coach='+encodeURIComponent(id)+(season==='s2'?'':'&season='+season);
const external = (url, label) => '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' <span aria-hidden="true">↗</span></a>';
const sortedCoaches = ids => [...new Set(ids)].sort((a,b) => name(a).localeCompare(name(b)));
const activeCoaches = sortedCoaches(Object.keys(league.coaches).filter(id=>league.coaches[id].sheet));
const seasonNames = {s2:'Season 2',s1:'Season 1',mono:'September Monotype'};
const currentMatches = league.matches.filter(match => match.season==='s2');
const optionList = (choices, selected) => choices.map(([id,label])=>'<option value="'+esc(id)+'"'+(id===selected?' selected':'')+'>'+esc(label)+'</option>').join('');
const score = m => m.score ? m.score.join('–') : 'vs';
const roundKey = m => m.week ? 'week-'+m.week : m.round ? 'round-'+m.round : m.phase==='final' ? 'final' : 'playoffs';
function roundLabel(key) {
  if (key.startsWith('week-')) return 'Week '+key.slice(5);
  if (key.startsWith('round-')) return 'Swiss Round '+key.slice(6);
  return {playoffs:'Playoffs',final:'Final'}[key] ?? 'All rounds';
}
function currentRecord(id) {
  return league.standings.find(row=>row.coach===id);
}
function nextFor(id) {
  return currentMatches.filter(m=>m.status==='scheduled' && m.coaches.includes(id) && m.week>=league.currentWeek)
    .sort((a,b)=>a.week-b.week)[0];
}
function replayLinks(m) {
  if (m.status==='forfeit') return '<span class="subtle">Forfeit</span>';
  if (!m.games.length) return m.score ? '<span class="subtle">Replays pending archive intake</span>' : '<span class="subtle">Scheduled</span>';
  const setWinner = m.score && m.score[0]!==m.score[1] ? m.coaches[m.score[0]>m.score[1]?0:1] : null;
  return m.games.map(g=>{
    const gameWinner = g.winner && m.coaches.includes(g.winner) ? name(g.winner) : null;
    const resultClass = gameWinner && setWinner ? (g.winner===setWinner?' replay-win':' replay-loss') : '';
    const label = 'Game '+g.n+' replay'+(gameWinner?' · '+gameWinner+' won':'');
    return '<a class="replay-link'+resultClass+'" href="'+esc(g.url)+'" target="_blank" rel="noopener noreferrer" title="'+esc(label)+'" aria-label="'+esc(label)+'">G'+g.n+' <span aria-hidden="true">↗</span></a>';
  }).join(' ');
}
function matchCard(m, homeCard=false) {
  const [left,right] = m.coaches;
  const label = m.stage ? m.stage.replaceAll('_',' ').replace(/^./,s=>s.toUpperCase()) : roundLabel(roundKey(m));
  const coachSlot = (id,index) => '<div class="match-coach"><a class="coach-name'+
    (m.score&&m.score[index]>m.score[1-index]?' winner':'')+'" href="'+profileLink(id,m.season)+'">'+esc(name(id))+'</a>'+
    (homeCard&&league.coaches[id].dashboard?'<a class="scout-link" href="'+scoutingLink(id,m.season)+'" aria-label="Scouting report for '+esc(name(id))+'">Scouting report</a>':'')+'</div>';
  return '<article id="'+esc(m.id)+'" class="match-card"><div class="match-meta">'+
    '<span>'+esc(label)+'</span><span>Best of '+m.bestOf+'</span></div><div class="match-core">'+
    coachSlot(left,0)+
    '<strong aria-label="'+(m.score?m.score.join(' to '):'versus')+'">'+score(m)+'</strong>'+
    coachSlot(right,1)+'</div>'+
    (homeCard?'':'<div class="match-bottom">'+replayLinks(m)+'</div>')+'</article>';
}
function tableStandings(rows, showTeam) {
  return '<div class="table-wrap"><table><thead><tr><th scope="col">Rank</th><th scope="col">Coach</th>'+
    (showTeam?'<th scope="col">Team</th>':'')+'<th scope="col">Record</th></tr></thead><tbody>'+
    rows.map(s=>'<tr><td>'+s.rank+'</td><th scope="row"><a href="'+profileLink(s.coach)+'">'+esc(name(s.coach))+'</a></th>'+
      (showTeam?'<td>'+esc(s.team)+'</td>':'')+'<td>'+esc(s.record)+'</td></tr>').join('')+'</tbody></table></div>';
}
function sprite(mon,size) {
  return mon.sprite?'<img class="roster-sprite" src="assets/sprites/'+esc(mon.sprite)+'.png" width="'+size+'" height="'+size+'" alt="" loading="lazy">':'';
}
function mvpStandings(rows) {
  return '<div class="table-wrap"><table><thead><tr><th scope="col">Rank</th><th scope="col">Pokémon</th>'+
    '<th scope="col">Coach</th><th scope="col">K–D</th></tr></thead><tbody>'+
    rows.map(row=>'<tr><td>'+row.rank+'</td><th scope="row"><span class="mvp-pokemon">'+sprite(row,30)+esc(row.pokemon)+'</span></th>'+
      '<td><a href="'+profileLink(row.coach)+'">'+esc(name(row.coach))+'</a></td><td>'+esc(row.record)+'</td></tr>').join('')+'</tbody></table></div>';
}
function teamStandings(full=false) {
  return '<div class="trio-grid">'+league.teams.map(team=>'<article class="trio-card"><header><h3><span>#'+team.rank+
    '</span> '+esc(team.name)+'</h3><strong>'+esc(team.record)+'</strong></header><ul class="trio-posters">'+
    team.members.map(id=>'<li><a href="'+profileLink(id)+'"><img src="assets/posters/'+esc(id.slice(6))+'.webp" alt="" width="160" height="100" loading="lazy">'+
      '<span>'+esc(name(id))+'</span></a></li>').join('')+'</ul>'+
    (full?'<dl class="trio-weeks">'+team.weeks.map((record,index)=>'<div><dt>Week '+(index+1)+'</dt><dd>'+esc(record)+'</dd></div>').join('')+'</dl>':'')+
    '</article>').join('')+'</div>';
}
function matchup(m,id) {
  if (!m) return '<p>No upcoming set is listed for '+esc(name(id))+'.</p>';
  const opponent = m.coaches.find(c=>c!==id);
  return '<div class="opponent-preview"><div><p class="eyebrow">'+esc(roundLabel(roundKey(m)))+'</p>'+
    '<h3>vs '+esc(name(opponent))+'</h3></div><div class="button-row"><a class="button" href="'+profileLink(opponent)+'">Opponent profile</a>'+
    (league.coaches[opponent].dashboard?'<a class="button primary" href="'+scoutingLink(opponent)+'">Scout opponent</a>':'')+'</div></div>';
}
function home() {
  const weeks = [...new Set(currentMatches.map(match=>match.week).filter(Number.isInteger))].sort((a,b)=>a-b);
  const picker = byId('week-switch');
  picker.innerHTML=optionList(weeks.map(w=>[w,'Week '+w]),weeks.at(-1));
  function show(w) {
    const list = currentMatches.filter(match=>match.week===w);
    const finished = list.filter(match=>match.score).length;
    byId('home-week').textContent = 'Week '+w+' matchups';
    byId('home-matches').innerHTML = list.map(m=>matchCard(m,true)).join('');
    byId('score-status').textContent = finished+' of '+list.length+' results recorded · Sheet checked '+league.checkedOn;
  }
  show(Number(picker.value));
  picker.addEventListener('change',()=>show(Number(picker.value)));
  byId('home-standings').innerHTML = tableStandings(league.standings.slice(0,5),false);
  byId('home-mvp').innerHTML = mvpStandings(league.mvp.slice(0,5));
  byId('home-teams').innerHTML = teamStandings();
  byId('your-coach').innerHTML='<option value="">Select coach</option>'+optionList(activeCoaches.map(id=>[id,name(id)]));
  byId('opponent-form').addEventListener('submit',e=>{
    e.preventDefault();
    const id=byId('your-coach').value;
    if (id) byId('opponent-result').innerHTML=matchup(nextFor(id),id);
  });
}
const typeColors = {
  Normal:'#696b7a',Fighting:'#a43a2d',Flying:'#4b70a3',Poison:'#90538e',Ground:'#93653e',Rock:'#79693a',Bug:'#58732f',
  Ghost:'#57548c',Steel:'#506d80',Fire:'#a8462f',Water:'#34719e',Grass:'#367646',Electric:'#87661a',Psychic:'#a53b69',
  Ice:'#3b777e',Dragon:'#5155a6',Dark:'#565166',Fairy:'#9a4777'
};
const typePill = t => '<span class="type" style="--type-color:'+esc(typeColors[t]??'#606a82')+'">'+esc(t)+'</span>';
function switchButtons(options, selected, attr) {
  return options.map(([value,label])=>'<button type="button" class="button" '+attr+'="'+esc(value)+
    '" aria-pressed="'+String(value===selected)+'">'+esc(label)+'</button>').join('');
}
function coachDirectory() {
  const seasonControls=byId('coach-seasons');
  const directory=byId('coach-directory');
  const wanted=params.get('coach');
  const competitions={s2:activeCoaches,s1:sortedCoaches(Object.keys(league.historical.s1)),mono:sortedCoaches(Object.keys(league.historical.mono))};
  let season=Object.hasOwn(competitions,params.get('season')) ? params.get('season') :
    (wanted&&!activeCoaches.includes(wanted)&&competitions.s1.includes(wanted)?'s1':'s2');
  const firstCoach = () => competitions[season].includes('coach_brice')?'coach_brice':competitions[season][0];
  let selected=competitions[season].includes(wanted)?wanted:firstCoach();
  function pickers() {
    seasonControls.innerHTML=switchButtons([['s2','Season 2'],['s1','Season 1'],['mono','Monotype']],season,'data-season');
    directory.innerHTML=competitions[season].map(id=>'<a class="button" href="'+profileLink(id,season)+'"'+
      (id===selected?' aria-current="true"':'')+'>'+esc(name(id))+'</a>').join('');
  }
  function show() {
    const coach=league.coaches[selected];
    const active=season==='s2';
    const record=active?currentRecord(selected):league.historical[season][selected];
    const roster=active?coach.roster:record.roster;
    const context=active?record.team:seasonNames[season];
    const sample=active?'Scouting reviewed through '+league.scoutingThrough:
      seasonNames[season]+' · '+record.games+' linked replay games';
    byId('profile').innerHTML='<header class="profile-head"><div><p class="eyebrow">'+esc(context)+'</p><h2>'+esc(coach.name)+'</h2></div>'+
      '<div class="profile-record"><span>'+esc(record.label??'Season 2 record')+'</span><strong>'+esc(record.record)+'</strong></div></header>'+
      '<div class="button-row profile-links">'+(coach.dashboard?'<a class="button primary" href="'+scoutingLink(selected,season)+'">Open scouting dashboard</a>':'')+
      '<a class="button" href="matches.html?coach='+encodeURIComponent(selected)+'&season='+season+'">Match history</a>'+
      (active?external(coach.sheet,'Official coach sheet'):'')+'</div><p class="data-note">'+esc(sample)+'</p>'+
      (active?'<div class="panel"><h3>Next matchup</h3>'+matchup(nextFor(selected),selected)+'</div>':'')+
      '<div class="panel"><h3>'+(active?'Present roster':'Archived Pokémon')+'</h3><ul class="roster-list">'+roster.map(mon=>'<li>'+
        sprite(mon,38)+
        '<div><strong>'+esc(mon.name)+'</strong><span>'+mon.types.map(typePill).join(' ')+'</span></div></li>').join('')+
      '</ul><p class="data-note">'+(active?'League sheet checked '+esc(league.checkedOn):'Pokémon recorded in the '+esc(seasonNames[season])+' archive.')+'</p></div>';
  }
  seasonControls.addEventListener('click',e=>{
    const choice=e.target.closest('button[data-season]')?.dataset.season;
    if(!choice||choice===season)return;
    season=choice;
    if(!competitions[season].includes(selected))selected=firstCoach();
    if(location.protocol!=='file:')history.replaceState(null,'','?'+new URLSearchParams({coach:selected,season}));
    pickers();
    show();
    seasonControls.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
  });
  pickers();
  show();
}
function matches() {
  const season = byId('match-season'), view = byId('match-view'), key = byId('match-key');
  const wantedSeason = params.get('season');
  const wantedCoach=params.get('coach');
  season.value = Object.hasOwn(seasonNames,wantedSeason) ? wantedSeason :
    (wantedCoach&&league.coaches[wantedCoach]&&!activeCoaches.includes(wantedCoach)?'s1':'s2');
  if (params.has('coach')) view.value='coach';
  function updatePicker(desired) {
    const data = league.matches.filter(m=>m.season===season.value);
    const byWeek = view.value==='week';
    const rounds=[...new Set(data.map(roundKey))];
    const choices = byWeek
      ? [['','All rounds'],...rounds.map(r=>[r,roundLabel(r)])]
      : [['','All coaches'],...sortedCoaches(data.flatMap(m=>m.coaches)).map(c=>[c,name(c)])];
    byId('match-key-label').textContent = byWeek ? 'Week / round' : 'Coach';
    key.innerHTML = optionList(choices,desired);
    if (!choices.some(([id])=>id===desired)) key.value='';
  }
  function show() {
    const chosen=league.matches.filter(m=>m.season===season.value &&
      (!key.value || (view.value==='week' ? roundKey(m)===key.value : m.coaches.includes(key.value))));
    const available=chosen.reduce((total,m)=>total+m.games.length,0);
    byId('match-summary').textContent=chosen.length+' '+(chosen.length===1?'set':'sets')+' · '+available+' linked '+(available===1?'replay':'replays')+
      (season.value==='s2'?' · Latest linked replays in Week '+league.archiveThrough:'');
    const groups=new Map();
    for (const match of chosen) {
      const group=roundLabel(roundKey(match));
      if (!groups.has(group)) groups.set(group,[]);
      groups.get(group).push(match);
    }
    byId('match-list').innerHTML=[...groups].map(([label,items])=>'<section class="match-group"><h2>'+esc(label)+'</h2><div class="match-grid">'+items.map(m=>matchCard(m)).join('')+'</div></section>').join('') ||
      '<p>No matches for this selection.</p>';
  }
  function remember() {
    if (location.protocol==='file:') return;
    const q=new URLSearchParams({season:season.value});
    if (view.value==='coach' || key.value) q.set(view.value==='coach'?'coach':'round',key.value);
    history.replaceState(null,'','?'+q);
  }
  function update() {show();remember();}
  season.addEventListener('change',()=>{updatePicker(key.value);update();});
  view.addEventListener('change',()=>{updatePicker('');update();});
  key.addEventListener('change',update);
  updatePicker(params.get('coach')??params.get('round')??(season.value==='s2'?'week-'+league.currentWeek:''));
  show();
  const hash=location.hash.slice(1);
  if (hash) byId(hash)?.scrollIntoView({block:'start'});
}
function rules() {
  byId('rules-source').href=league.links.rulesUrl;
  byId('rules-list').innerHTML=league.rules.map(group=>'<section class="panel"><h2>'+esc(group.title)+'</h2><ul>'+
    group.items.map(rule=>{
      const [intro,...rest]=rule.split(/\r?\n/);
      return '<li>'+esc(intro)+(rest.length?'<ul>'+rest.filter(line=>line.trim()).map(line=>'<li>'+esc(line.trim().replace(/^[-–]\s*/,''))+'</li>').join('')+'</ul>':'')+'</li>';
    }).join('')+'</ul></section>').join('');
}
function leagueSheet() {
  const buttons=[['sheetUrl','Open Google Sheet'],['standingsUrl','Coach standings tab'],['mvpUrl','MVP Race tab'],
    ['teamsUrl','Team standings tab'],['scheduleUrl','Schedule tab'],['rulesUrl','Rules tab']];
  byId('sheet-links').innerHTML=buttons.map(([k,label])=>external(league.links[k],label)).join('');
  const tableControl=byId('standings-switch');
  const tables={
    coach:['Coach standings',()=>tableStandings(league.standings,true)],
    mvp:['MVP race',()=>mvpStandings(league.mvp)],
    team:['Team standings',()=>teamStandings(true)]
  };
  const options=Object.entries(tables).map(([key,[label]])=>[key,label]);
  function show(selection) {
    const [title,render]=tables[selection];
    byId('standings-title').textContent='Season 2 '+title.toLowerCase();
    byId('sheet-standings').innerHTML=render();
    for(const button of tableControl.querySelectorAll('button')) {
      button.setAttribute('aria-pressed',String(button.dataset.table===selection));
    }
  }
  tableControl.innerHTML=switchButtons(options,'coach','data-table');
  tableControl.addEventListener('click',e=>{
    const choice=e.target.closest('button[data-table]')?.dataset.table;
    if(!choice)return;
    show(choice);
    if(location.protocol!=='file:')history.replaceState(null,'','?'+new URLSearchParams({standings:choice}));
  });
  show(Object.hasOwn(tables,params.get('standings'))?params.get('standings'):'coach');
  byId('sheet-checked').textContent='Website snapshot from '+league.checkedOn+'. The linked League Sheet shows current results.';
}
const pages={Home:home,Coaches:coachDirectory,Matches:matches,Rules:rules,'League Sheet':leagueSheet};
pages[document.body.dataset.page]?.();
