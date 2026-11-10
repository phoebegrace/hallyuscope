(() => {
  const $=s=>document.querySelector(s);
  const login=$('#aiLogin');
  const workspace=$('#aiWorkspace');
  const form=$('#aiLoginForm');
  let password=sessionStorage.getItem('hallyuscope_review_password')||'';
  let research=null;

  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function call(action,body={}){
    const r=await fetch('/api/ai-center',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-review-password':password},
      body:JSON.stringify({action,...body})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error||'AI Center request failed');
    return data;
  }

  function unlock(){
    if(password){login.hidden=true;workspace.hidden=false;}
    else{login.hidden=false;workspace.hidden=true;}
  }

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    password=$('#aiPassword').value.trim();
    const msg=$('#aiLoginMessage');
    msg.textContent='Checking…';
    try{
      await call('ping');
      sessionStorage.setItem('hallyuscope_review_password',password);
      msg.textContent='';
      unlock();
    }catch(err){msg.textContent=err.message;}
  });

  $('#aiResearch').addEventListener('click',async()=>{
    const seed=$('#aiSeed').value.trim();
    const notes=$('#aiNotes').value.trim();
    const status=$('#aiStatus');
    if(!seed){status.textContent='Paste a URL or headline first.';return;}
    status.textContent='Researching the story and cross-checking sources…';
    $('#aiResearch').disabled=true;
    try{
      const data=await call('research',{seed,notes});
      research=data;
      const draft=data.draft||{};
      $('#aiResearchSummary').textContent=data.researchSummary||'';
      $('#aiFacts').innerHTML=(data.facts||[]).map(x=>'<div><span>FACT</span><p>'+esc(x)+'</p></div>').join('');
      $('#aiSources').innerHTML=(data.sources||[]).map((s,i)=>'<article><span>'+(i+1).toString().padStart(2,'0')+'</span><div><strong>'+esc(s.publisher||'Source')+'</strong><p>'+esc(s.title||'')+'</p><a href="'+esc(s.url||'#')+'" target="_blank" rel="noopener">Open source ↗</a></div></article>').join('');
      $('#aiSourceCount').textContent=(data.sources||[]).length+' sources';
      $('#aiCategory').value=draft.category||'HALLYU NEWS';
      $('#aiHeadline').value=draft.headline||'';
      $('#aiDek').value=draft.dek||'';
      $('#aiBody').value=(draft.body||[]).join('\n\n');
      $('#aiSeo').value=draft.seoDescription||'';
      $('#aiSocial').value=draft.socialCaption||'';
      $('#aiHashtags').value=(draft.socialHashtags||[]).slice(0,5).join(' ');
      $('#aiResult').hidden=false;
      status.textContent='Research complete. Review the sources and edit the draft before saving.';
      $('#aiResult').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(err){status.textContent=err.message;}
    finally{$('#aiResearch').disabled=false;}
  });

  $('#aiSave').addEventListener('click',async()=>{
    if(!research)return;
    const status=$('#aiSaveStatus');
    const draft={
      category:$('#aiCategory').value.trim()||'HALLYU NEWS',
      headline:$('#aiHeadline').value.trim(),
      dek:$('#aiDek').value.trim(),
      body:$('#aiBody').value.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean),
      seoDescription:$('#aiSeo').value.trim(),
      socialCaption:$('#aiSocial').value.trim(),
      socialHashtags:$('#aiHashtags').value.split(/\s+/).map(x=>x.trim()).filter(Boolean).slice(0,5)
    };
    if(!draft.headline||!draft.body.length){status.textContent='Headline and article body are required.';return;}
    status.textContent='Sending to Pending Review…';
    $('#aiSave').disabled=true;
    try{
      const data=await call('save',{
        seed:$('#aiSeed').value.trim(),
        notes:$('#aiNotes').value.trim(),
        researchSummary:research.researchSummary||'',
        facts:research.facts||[],
        sources:research.sources||[],
        draft
      });
      status.innerHTML='Added to Pending Review. <a href="/review">Open Review queue →</a>';
    }catch(err){status.textContent=err.message;}
    finally{$('#aiSave').disabled=false;}
  });

  unlock();
})();
