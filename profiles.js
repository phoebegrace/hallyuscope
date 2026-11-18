(() => {
  const directory=document.querySelector('#profileDirectory');
  if(!directory)return;
  const cards=[...directory.querySelectorAll('[data-artist]')];
  const sections=[...directory.querySelectorAll('[data-artist-section]')];
  const filters=[...directory.querySelectorAll('[data-profile-filter]')];
  const search=document.querySelector('#profileSearch');
  const status=document.querySelector('#profileResults');
  const empty=document.querySelector('#profileEmpty');
  const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const categories=new Set(['girl-groups','boy-groups','soloists']);
  let category=categories.has(location.hash.slice(1))?location.hash.slice(1):'all';
  function render(){
    const term=normalize(search.value);
    let count=0;
    cards.forEach(card=>{
      card.hidden=!(category==='all'||card.dataset.category===category)||!normalize(card.dataset.artist).includes(term);
      if(!card.hidden) count++;
    });
    sections.forEach(section=>{
      const visible=[...section.querySelectorAll('[data-artist]')].filter(card=>!card.hidden).length;
      section.hidden=!visible;
      section.querySelector('[data-section-count]').textContent=visible+' '+(visible===1?'artist':'artists');
    });
    filters.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.profileFilter===category)));
    status.textContent=count+' '+(count===1?'artist':'artists')+(term?' matching “'+search.value+'”':'')+'. Select a photo to enlarge it.';
    empty.hidden=!!count;
  }
  filters.forEach(button=>button.addEventListener('click',()=>{
    category=button.dataset.profileFilter;
    history.replaceState(null,'',location.pathname+location.search+(category==='all'?'':'#'+category));
    render();
  }));
  search.addEventListener('input',render);
  window.addEventListener('hashchange',()=>{category=categories.has(location.hash.slice(1))?location.hash.slice(1):'all';render();});
  const dialog=document.querySelector('#profilePhotoDialog');
  const photo=dialog.querySelector('img');
  directory.addEventListener('click',event=>{
    const button=event.target.closest('[data-enlarge-profile]');
    if(!button)return;
    const card=button.closest('[data-artist]');
    photo.src=button.querySelector('img').src;
    photo.alt=button.querySelector('img').alt;
    dialog.querySelector('figcaption').textContent=card.dataset.artist;
    dialog.showModal();
  });
  dialog.querySelector('button').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  render();
})();
