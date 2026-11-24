const normalize = value => value.toLowerCase().replace(/[^a-z0-9]+/g,'');
const limit = 8;

// The input is a draft search. Only a committed option changes the calculator.
export function mountPicker(host, {key, label, values, recent, selected, allowEmpty, onSelect}) {
  const input = host.querySelector('input');
  const list = host.querySelector('[role=listbox]');
  const status = host.querySelector('[role=status]');
  const listId = host.id+'-options';
  list.id = listId;
  list.setAttribute('aria-label',label);
  input.dataset.key = key;
  input.setAttribute('aria-controls',listId);
  input.value = selected;
  input.placeholder = 'Search '+label.toLowerCase()+'…';
  let choices = [], active = -1, editing = false;

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded','false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }
  function highlight(index) {
    active = index;
    [...list.children].forEach((option,i)=>option.setAttribute('aria-selected',String(i===active)));
    if(active>=0){
      input.setAttribute('aria-activedescendant',list.children[active].id);
      list.children[active].scrollIntoView({block:'nearest'});
    }else input.removeAttribute('aria-activedescendant');
  }
  function show(query) {
    const term=normalize(query);
    let found;
    if(term){
      const matches=values.filter(name=>normalize(name).includes(term));
      found=matches.filter(name=>normalize(name).startsWith(term)).concat(matches.filter(name=>!normalize(name).startsWith(term)));
    } else {
      found=[...new Set([selected,...recent,...values].filter(Boolean))];
      if(allowEmpty)found.unshift('');
    }
    choices=found.slice(0,limit);
    list.replaceChildren(...choices.map((name,i)=>{
      const option=document.createElement('li');
      option.setAttribute('role','option'); option.id=listId+'-'+i; option.dataset.index=i;
      option.textContent=name||'No held item';
      return option;
    }));
    status.textContent=!found.length?'No matches.':term&&found.length>limit?'Showing '+limit+' of '+found.length+'. Keep typing to narrow the list.':'';
    list.hidden=!choices.length;
    input.setAttribute('aria-expanded',String(!!choices.length));
    highlight(-1);
  }
  function commit(value) {
    selected=value;input.value=value;editing=false;status.textContent='';close();
    onSelect(value);
  }
  function finish() {
    if(editing){
      const exact=values.find(name=>normalize(name)===normalize(input.value));
      if(exact) return commit(exact);
      if(allowEmpty&&!input.value.trim())return commit('');
      status.textContent='Selection kept. Choose a matching '+label.toLowerCase()+'.';
    }else status.textContent='';
    editing=false;input.value=selected;close();
  }
  input.addEventListener('focus',()=>{input.select();show('');});
  input.addEventListener('click',()=>{if(list.hidden&&!editing)show('');});
  input.addEventListener('input',()=>{editing=true;show(input.value);});
  input.addEventListener('blur',finish);
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      event.preventDefault();editing=false;input.value=selected;status.textContent='';close();
    }else if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();if(list.hidden)show(editing?input.value:'');
      if(choices.length)highlight((active<0?(event.key==='ArrowDown'?0:choices.length-1):
        (active+(event.key==='ArrowDown'?1:-1)+choices.length)%choices.length));
    }else if(event.key==='Enter'&&!list.hidden){
      event.preventDefault();commit(choices[Math.max(0,active)]);
    }
  });
  list.addEventListener('pointerdown',event=>event.preventDefault());
  list.addEventListener('click',event=>{
    const option=event.target.closest('[role=option]');
    if(option)commit(choices[Number(option.dataset.index)]);
  });
}
