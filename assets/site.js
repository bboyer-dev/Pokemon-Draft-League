'use strict';
const league = window.NPL_LEAGUE;
const byId = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const esc = value => String(value).replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));
const name = id => league.coaches[id].name;
const profileLink = id => league.coaches[id].sheet
  ? 'coaches.html?coach='+encodeURIComponent(id)+'#profile'
  : 'matches.html?coach='+encodeURIComponent(id)+'&season=s1';
const matchLink = match => 'matches.html?season='+match.season+'&round='+encodeURIComponent(roundKey(match))+'#'+match.id;
const external = (url, label) => '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' <span aria-hidden="true">↗</span></a>';
const sortedCoaches = ids => [...new Set(ids)].sort((a,b) => name(a).localeCompare(name(b)));
const activeCoaches = sortedCoaches(Object.keys(league.coaches).filter(id=>league.coaches[id].sheet));
const seasonNames = {s2:'Season 2',s1:'Season 1',mono:'September Monotype'};
const currentMatches = league.matches.filter(match => match.season==='s2');
const nextMatches = currentMatches.filter(match => match.week===league.nextWeek);
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
  return m.games.map(g=>'<a class="replay-link" href="'+esc(g.url)+'" target="_blank" rel="noopener noreferrer" aria-label="Game '+g.n+' replay, '+esc(name(m.coaches[0]))+' vs '+esc(name(m.coaches[1]))+'">G'+g.n+' <span aria-hidden="true">↗</span></a>').join(' ');
}
function matchCard(m, compact=false) {
  const [left,right] = m.coaches;
  const label = m.stage ? m.stage.replaceAll('_',' ').replace(/^./,s=>s.toUpperCase()) : roundLabel(roundKey(m));
  return '<article id="'+esc(m.id)+'" class="match-card"><div class="match-meta">'+
    '<span>'+esc(label)+'</span><span>Best of '+m.bestOf+'</span></div><div class="match-core">'+
    '<a class="'+(m.score&&m.score[0]>m.score[1]?'winner':'')+'" href="'+profileLink(left)+'">'+esc(name(left))+'</a>'+
    '<strong aria-label="'+(m.score?m.score.join(' to '):'versus')+'">'+score(m)+'</strong>'+
    '<a class="'+(m.score&&m.score[1]>m.score[0]?'winner':'')+'" href="'+profileLink(right)+'">'+esc(name(right))+'</a></div>'+
    '<div class="match-bottom">'+(compact?'<a href="'+matchLink(m)+'">Match details</a>':replayLinks(m))+'</div></article>';
}
function tableStandings(rows, showTeam) {
  return '<div class="table-wrap"><table><thead><tr><th scope="col">Rank</th><th scope="col">Coach</th>'+
    (showTeam?'<th scope="col">Team</th>':'')+'<th scope="col">Record</th></tr></thead><tbody>'+
    rows.map(s=>'<tr><td>'+s.rank+'</td><th scope="row"><a href="'+profileLink(s.coach)+'">'+esc(name(s.coach))+'</a></th>'+
      (showTeam?'<td>'+esc(s.team)+'</td>':'')+'<td>'+esc(s.record)+'</td></tr>').join('')+'</tbody></table></div>';
}
function matchup(m,id) {
  if (!m) return '<p>No upcoming set is listed for '+esc(name(id))+'.</p>';
  const opponent = m.coaches.find(c=>c!==id);
  return '<div class="opponent-preview"><div><p class="eyebrow">'+esc(roundLabel(roundKey(m)))+'</p>'+
    '<h3>vs '+esc(name(opponent))+'</h3></div><div class="button-row"><a class="button" href="'+profileLink(opponent)+'">Opponent profile</a>'+
    (league.coaches[opponent].dashboard?'<a class="button primary" href="scouting.html?coach='+opponent+'">Scout opponent</a>':'')+'</div></div>';
}
function home() {
  const choices = [league.currentWeek,...(nextMatches.length?[league.nextWeek]:[])];
  const currentWeekComplete = currentMatches
    .filter(match=>match.week===league.currentWeek)
    .every(match=>match.score!==null);
  byId('week-switch').innerHTML = choices.map(w=>'<button type="button" class="button" data-week="'+w+'">Week '+w+'</button>').join('');
  function show(w) {
    const list = currentMatches.filter(match=>match.week===w);
    const finished = list.filter(match=>match.score).length;
    byId('home-week').textContent = 'Week '+w+' matchups';
    byId('home-matches').innerHTML = list.map(m=>matchCard(m,true)).join('');
    byId('score-status').textContent = finished+' of '+list.length+' results recorded · Sheet checked '+league.checkedOn;
    for (const btn of byId('week-switch').querySelectorAll('button')) btn.setAttribute('aria-pressed',String(Number(btn.dataset.week)===w));
  }
  show(currentWeekComplete && nextMatches.length ? league.nextWeek : league.currentWeek);
  byId('week-switch').addEventListener('click',e=>{
    const btn = e.target.closest('[data-week]');
    if (btn) show(Number(btn.dataset.week));
  });
  byId('home-standings').innerHTML = tableStandings(league.standings.slice(0,5),false);
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
function coachDirectory() {
  let selected=activeCoaches.includes(params.get('coach')) ? params.get('coach') : 'coach_brice';
  byId('coach-directory').innerHTML=activeCoaches.map(id=>'<a class="button" href="'+profileLink(id)+'">'+esc(name(id))+'</a>').join('');
  function show() {
    const coach=league.coaches[selected];
    const standing=currentRecord(selected);
    byId('profile').innerHTML='<header class="profile-head"><div><p class="eyebrow">'+esc(standing.team)+'</p><h2>'+esc(coach.name)+'</h2></div>'+
      '<div class="profile-record"><span>Season 2 record</span><strong>'+esc(standing.record)+'</strong></div></header>'+
      '<div class="button-row profile-links">'+(coach.dashboard?'<a class="button primary" href="scouting.html?coach='+selected+'">Open scouting dashboard</a>':'')+
      '<a class="button" href="matches.html?coach='+selected+'">Match history</a>'+external(coach.sheet,'Official coach sheet')+'</div>'+
      (coach.dashboard?'<p class="data-note">Scouting reviewed through '+esc(league.scoutingThrough)+'</p>':'<p class="data-note">Full scouting dashboard pending</p>')+
      '<div class="panel"><h3>Next matchup</h3>'+matchup(nextFor(selected),selected)+'</div>'+
      '<div class="panel"><h3>Present roster</h3><ul class="roster-list">'+coach.roster.map(mon=>'<li>'+
        (mon.sprite?'<img class="roster-sprite" src="assets/sprites/'+esc(mon.sprite)+'.png" width="38" height="38" alt="" loading="lazy">':'')+
        '<div><strong>'+esc(mon.name)+'</strong><span>'+mon.types.map(typePill).join(' ')+'</span></div></li>').join('')+
      '</ul><p class="data-note">League sheet checked '+esc(league.checkedOn)+'</p></div>';
    for(const link of byId('coach-directory').querySelectorAll('a')){
      if(link.href.includes('coach='+selected+'#')) link.setAttribute('aria-current','true');
      else link.removeAttribute('aria-current');
    }
  }
  show();
}
function matches() {
  const season = byId('match-season'), view = byId('match-view'), key = byId('match-key');
  const wantedSeason = params.get('season');
  season.value = seasonNames[wantedSeason] ? wantedSeason : 's2';
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
  const buttons=[['sheetUrl','Open Google Sheet'],['standingsUrl','Standings tab'],['scheduleUrl','Schedule tab'],['rulesUrl','Rules tab']];
  byId('sheet-links').innerHTML=buttons.map(([k,label])=>external(league.links[k],label)).join('');
  byId('sheet-standings').innerHTML=tableStandings(league.standings,true);
  byId('sheet-checked').textContent='Website snapshot from '+league.checkedOn+'. The linked League Sheet shows current results.';
}
const pages={Home:home,Coaches:coachDirectory,Matches:matches,Rules:rules,'League Sheet':leagueSheet};
pages[document.body.dataset.page]?.();
