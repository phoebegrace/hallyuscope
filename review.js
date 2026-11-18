(() => {
  const $ = s => document.querySelector(s);
  const login = $('#reviewLogin');
  const desk = $('#reviewDesk');
  const form = $('#reviewLoginForm');
  const msg = $('#reviewLoginMessage');
  const list = $('#reviewQueueList');
  const editor = $('#reviewEditor');
  const pipeline = $('#reviewPipeline');
  let password = sessionStorage.getItem('hallyuscope_review_password') || '';
  let items = [];
  let current = null;
  let filter = 'pending_review';
  let autoPublish = false;
  let queueUpdatedAt = '';
  let shopeeAlbums = [];

  const esc = (s='') => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function ago(value){
    const t=Date.parse(value||'');
    if(!Number.isFinite(t)) return 'recently';
    const seconds=Math.max(0,Math.round((Date.now()-t)/1000));
    if(seconds<60) return 'just now';
    const mins=Math.floor(seconds/60);
    if(mins<60) return mins+' min'+(mins===1?'':'s')+' ago';
    const hours=Math.floor(mins/60);
    if(hours<24) return hours+' hr'+(hours===1?'':'s')+' ago';
    const days=Math.floor(hours/24);
    return days+' day'+(days===1?'':'s')+' ago';
  }

  async function api(action='list', body={}) {
    const r = await fetch('/api/review', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-review-password':password},
      body:JSON.stringify({action,...body})
    });
    const data = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function counts() {
    const c = {discovered:0,pending_review:0,published:0,skipped:0};
    items.forEach(x=>{ if(c[x.status]!==undefined) c[x.status]++; });
    pipeline.innerHTML = [
      ['Discovered',c.discovered],
      ['Pending review',c.pending_review],
      ['Published',c.published],
      ['Skipped',c.skipped]
    ].map(([label,n],i)=>'<div class="review-stage"><span>'+(i+1).toString().padStart(2,'0')+'</span><strong>'+n+'</strong><small>'+label+'</small></div>').join('');
  }

  function renderList() {
    const shown = filter==='all' ? items : items.filter(x=>x.status===filter);
    list.innerHTML = shown.length ? shown.map(x=>`
      <button type="button" class="review-story ${current?.id===x.id?'active':''}" data-id="${esc(x.id)}">
        <span class="review-story-tag">${esc(x.category||'HALLYU NEWS')}</span>
        <strong>${esc(x.headline||'Untitled draft')}</strong>
        <small>${esc(x.source?.publisher||'Source')} · ${esc(x.status||'pending_review')} · Pulled ${esc(ago(x.createdAt||x.sourcePublishedAt||queueUpdatedAt))}</small>
      </button>`).join('') : '<p class="review-empty">Nothing in this stage yet.</p>';
  }

  function renderEditor() {
    if(!current){ editor.innerHTML='<div class="review-empty">Select a story to review it.</div>'; return; }
    editor.innerHTML = `
      <div class="review-editor-head">
        <div><span class="eyebrow">${esc(current.category||'HALLYU NEWS')}</span><span class="review-status">${esc(current.status||'pending_review')}</span></div>
        <a href="/article/${encodeURIComponent(current.slug || current.id)}" target="_blank" rel="noopener">Public preview ↗</a>
      </div>
      <div class="review-image-block">
        <div class="review-image-preview">
          ${current.imageUrl ? '<img src="'+esc(current.imageUrl)+'" alt="Article image preview" referrerpolicy="no-referrer">' : '<div class="review-image-empty">Needs Image</div>'}
        </div>
        <div class="review-image-meta">
          <span class="eyebrow">ARTICLE IMAGE</span>
          <div class="review-image-status ${current.imageType==='official'?'official':'original'}">${current.imageType==='official'?'Verified Official Asset':'HallyuScope Original'}</div>
          <label>Image source
            <select id="editImageType">
              <option value="hallyuscope_original" ${current.imageType!=='official'?'selected':''}>HallyuScope Original</option>
              <option value="official" ${current.imageType==='official'?'selected':''}>Verified Official Asset</option>
            </select>
          </label>
          <label>Image URL<input id="editImageUrl" value="${esc(current.imageUrl||'')}" placeholder="https://..."></label>
          <div class="review-upload-row"><label class="review-upload-btn">Upload image<input type="file" id="editImageUpload" accept="image/jpeg,image/png,image/webp,image/gif" hidden></label><span class="meta" id="reviewImageUploadMessage">JPG, PNG, WebP or GIF, up to 3 MB. The file is saved to the site's editorial images.</span></div>
          ${current.sourceImageUrl ? '<details class="review-image-reference"><summary>Internal source thumbnail reference</summary><p class="meta">'+esc(current.sourceImageUrl)+'</p></details>' : ''}
          <p class="meta">Only choose “Verified Official Asset” for an image from the artist, agency, promoter, venue, ticketing partner, or another clearly official source.</p>
        </div>
      </div>
      <label>Headline<input id="editHeadline" value="${esc(current.headline||'')}"></label>
      <label>Dek<textarea id="editDek" rows="3">${esc(current.dek||'')}</textarea></label>
      <label>Article body<textarea id="editBody" rows="18">${esc((current.body||[]).join('\n\n'))}</textarea></label>
      <div class="review-editor-grid">
        <label>Category<input id="editCategory" value="${esc(current.category||'HALLYU NEWS')}"></label>
        <label>SEO description<textarea id="editSeo" rows="4">${esc(current.seoDescription||'')}</textarea></label>
      </div>
      <section class="review-social">
        <div class="review-social-head">
          <div>
            <span class="eyebrow">META SOCIAL</span>
            <h3>Facebook + Instagram</h3>
          </div>
          <span class="review-social-status">${esc(current.socialStatus||'Not posted')}</span>
        </div>
        <div class="review-social-platforms">
          <label class="review-check"><input id="socialFacebook" type="checkbox" ${current.socialPlatforms?.facebook!==false?'checked':''}> Facebook</label>
          <label class="review-check"><input id="socialInstagram" type="checkbox" ${current.socialPlatforms?.instagram!==false?'checked':''}> Instagram</label>
        </div>
        <label>Social caption<textarea id="editSocialCaption" rows="6">${esc(current.socialCaption||current.dek||'')}</textarea></label>
        <label>Hashtags<input id="editSocialHashtags" value="${esc(Array.isArray(current.socialHashtags)?current.socialHashtags.join(' '):(current.socialHashtags||''))}" placeholder="#HallyuScope #Kpop #KpopNews #Manila #KoreanCulture"></label>
        <label>Social image URL<input id="editSocialImageUrl" value="${esc(current.socialImageUrl||'')}" placeholder="Generate from the HTML/CSS template"></label>
        <div class="review-upload-row"><label class="review-upload-btn">Upload image<input type="file" id="editSocialImageUpload" accept="image/jpeg,image/png,image/webp,image/gif" hidden></label><span class="meta" id="reviewSocialUploadMessage">JPG, PNG, WebP or GIF, up to 3 MB — or generate a social card below.</span></div>
        <p class="meta">The HallyuScope renderer creates a 1080 × 1350 SVG preview card from the article image, category, headline, and description. It is preview-only; the social preview image uses the editorial feature image.</p>
        <div class="review-social-actions">
          <button type="button" class="review-generate-card" data-generate-card="1">Generate social card</button>
          <a class="review-preview-card" id="reviewPreviewCard" href="${esc(current.socialImageUrl||'#')}" target="_blank" rel="noopener" ${current.socialImageUrl?'':'hidden'}>Preview card</a>
          <button type="button" class="review-save-social" data-action="save">Save social draft</button>
          <button type="button" class="review-post-meta" data-meta-post="1">Post to selected Meta accounts</button>
        </div>
        <p class="meta" id="reviewSocialMessage"></p>
      </section>

      <details class="review-source"><summary>Source used for reporting</summary>
        <p><strong>${esc(current.source?.publisher||'Unknown')}</strong></p>
        <p>${esc(current.source?.title||'')}</p>
        <p class="meta">${esc(current.source?.url||'')}</p>
      </details>
      <div class="review-actions">
        <button type="button" class="review-save" data-action="save">Save changes</button>
        <button type="button" class="review-approve" data-action="publish">Approve & Publish</button>
        <button type="button" class="review-skip" data-action="skip">Skip</button>
      </div>
      <p class="meta" id="reviewActionMessage"></p>`;
  }

  function renderAutoPublish(){
    const toggle=$('#autoPublishToggle');
    const label=$('#autoPublishLabel');
    if(toggle) toggle.checked=autoPublish;
    if(label) label.textContent=autoPublish?'On':'Off';
    document.querySelector('.review-autopublish')?.classList.toggle('is-on',autoPublish);
  }

  function shopeeLinkRow(label,url){
    return `<div class="review-shopee-link">
      <input class="review-shopee-label" type="text" value="${esc(label)}" placeholder="Version, e.g. Standard Ver." aria-label="Album version">
      <input class="review-shopee-url" type="url" inputmode="url" value="${esc(url)}" placeholder="https://shopee.ph/... or https://shope.ee/..." aria-label="Shopee affiliate link">
      <button type="button" class="review-shopee-remove" aria-label="Remove this version">\u00d7</button>
    </div>`;
  }

  function renderShopee(){
    const listEl=$('#reviewShopeeList');
    if(!listEl) return;
    if(!shopeeAlbums.length){
      listEl.innerHTML='<p class="meta">No albums yet.</p>';
      return;
    }
    listEl.innerHTML = shopeeAlbums.map(a=>{
      const links=(Array.isArray(a.buyLinks)&&a.buyLinks.length?a.buyLinks:(a.buyLink?[{label:'Buy on Shopee',url:a.buyLink}]:[]));
      const rows=(links.length?links:[{label:'',url:''}]).map(l=>shopeeLinkRow(l.label||'',l.url||'')).join('');
      const n=links.filter(l=>l.url).length;
      return `
      <div class="review-shopee-row">
        ${a.cover ? '<img src="'+esc(a.cover)+'" alt="" loading="lazy">' : '<span class="review-shopee-initial">'+esc((a.artist||'H').charAt(0))+'</span>'}
        <div class="review-shopee-info"><strong>${esc(a.title||'Release')}</strong><small>${esc(a.artist||'')} · ${esc(a.date||'')}</small></div>
        <div class="review-shopee-links" data-shopee-album="${esc(a.id)}">
          ${rows}
          <button type="button" class="review-shopee-add">+ Add version</button>
        </div>
        <span class="review-shopee-state">${n ? n+(n===1?' link':' links') : 'No link'}</span>
      </div>`;}).join('');
  }

  async function loadShopee(){
    const note=$('#reviewShopeeMessage');
    try{
      const data=await api('buy_links_list');
      shopeeAlbums=(data.albums||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
      renderShopee();
      if(note) note.textContent='';
    }catch(err){
      const listEl=$('#reviewShopeeList');
      if(listEl) listEl.innerHTML='<p class="meta">Could not load the album links: '+esc(err.message)+'</p>';
    }
  }

  async function load(){
    const data = await api('list');
    items = data.items || [];
    autoPublish = data.autoPublish === true;
    queueUpdatedAt = data.updatedAt || '';
    const pulled=$('#reviewPulledAt');
    if(pulled) pulled.textContent='Last data pull '+ago(queueUpdatedAt);
    counts();
    renderAutoPublish();
    if(current) current = items.find(x=>x.id===current.id) || null;
    renderList(); renderEditor();
    loadShopee().catch(()=>{});
  }

  async function loginNow(){
    try{
      await load();
      login.hidden=true; desk.hidden=false;
      sessionStorage.setItem('hallyuscope_review_password',password);
    }catch(e){
      sessionStorage.removeItem('hallyuscope_review_password');
      msg.textContent=e.message;
      throw e;
    }
  }

  form.addEventListener('submit', async e=>{
    e.preventDefault();
    password=$('#reviewPassword').value;
    msg.textContent='Checking…';
    try{await loginNow(); msg.textContent='';}catch{}
  });

  list.addEventListener('click',e=>{
    const b=e.target.closest('[data-id]'); if(!b)return;
    current=items.find(x=>x.id===b.dataset.id)||null;
    renderList(); renderEditor();
  });

  $('#reviewFilters').addEventListener('click',e=>{
    const b=e.target.closest('[data-filter]'); if(!b)return;
    filter=b.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));
    renderList();
  });

  editor.addEventListener('click',async e=>{
    const b=e.target.closest('[data-action]'); if(!b||!current)return;
    const action=b.dataset.action;
    const note=$('#reviewActionMessage');
    const patch={
      headline:$('#editHeadline').value.trim(),
      dek:$('#editDek').value.trim(),
      body:$('#editBody').value.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean),
      category:$('#editCategory').value.trim(),
      seoDescription:$('#editSeo').value.trim(),
      imageUrl:$('#editImageUrl')?.value.trim() || '',
      imageType:$('#editImageType')?.value || 'hallyuscope_original',
      socialCaption:$('#editSocialCaption')?.value.trim() || '',
      socialHashtags:$('#editSocialHashtags')?.value.trim() || '',
      socialImageUrl:$('#editSocialImageUrl')?.value.trim() || '',
      socialPlatforms:{
        facebook:$('#socialFacebook')?.checked !== false,
        instagram:$('#socialInstagram')?.checked !== false
      }
    };
    note.textContent='Saving…';
    try{
      const data=await api('update',{id:current.id,operation:action,patch});
      items=data.items||items;
      current=items.find(x=>x.id===current.id)||null;
      note.textContent=action==='publish'?'Published.':action==='skip'?'Skipped.':'Saved.';
      counts(); renderList(); renderEditor();
    }catch(err){ note.textContent=err.message; }
  });

  editor.addEventListener('click',async e=>{
    const b=e.target.closest('[data-generate-card]'); if(!b||!current)return;
    const note=$('#reviewSocialMessage');
    const rawImage=$('#editImageUrl')?.value.trim() || '';
    const fallbackImage=current.imageUrl || '';
    const image=rawImage.includes('/api/social-card') ? fallbackImage : (rawImage || fallbackImage);
    const headline=$('#editHeadline')?.value.trim() || current.headline || '';
    const category=$('#editCategory')?.value.trim() || current.category || 'HALLYU NEWS';
    const description=$('#editSocialCaption')?.value.trim() || $('#editDek')?.value.trim() || current.dek || '';
    if(!image){ note.textContent='Add an article image first.'; return; }
    if(!headline){ note.textContent='Add a headline first.'; return; }
    note.textContent='Generating social card…';
    b.disabled=true;
    try{
      const r=await fetch('/api/social-card-url',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-review-password':password},
        body:JSON.stringify({image,category,headline,description})
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.error||'Could not generate social card');
      const input=$('#editSocialImageUrl');
      if(input) input.value=data.imageUrl||'';
      const preview=$('#reviewPreviewCard');
      if(preview&&data.imageUrl){ preview.href=data.imageUrl; preview.hidden=false; }
      note.textContent='Social card ready. Preview it before posting.';
    }catch(err){ note.textContent=err.message; }
    finally{ b.disabled=false; }
  });

  async function uploadImage(file, kind){
    const inputId = kind==='social' ? '#editSocialImageUrl' : '#editImageUrl';
    const msgId = kind==='social' ? '#reviewSocialUploadMessage' : '#reviewImageUploadMessage';
    const msg = $(msgId);
    const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
    if(!file) return;
    if(!allowed.includes(file.type)){ if(msg) msg.textContent='Only JPG, PNG, WebP or GIF images.'; return; }
    if(file.size > 3*1024*1024){ if(msg) msg.textContent='Image must be under 3 MB.'; return; }
    if(msg) msg.textContent='Uploading…';
    try{
      const data = await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
        reader.onerror=()=>reject(new Error('Could not read the image file'));
        reader.readAsDataURL(file);
      });
      const r=await fetch('/api/upload-image',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-review-password':password},
        body:JSON.stringify({id:current?.id||'',kind,mime:file.type,data})
      });
      const res=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(res.error||'Upload failed');
      const input=$(inputId);
      if(input) input.value=res.imageUrl||'';
      if(kind==='article'){
        const prev=document.querySelector('.review-image-preview');
        if(prev) prev.innerHTML='<img src="'+esc(res.imageUrl)+'" alt="Article image preview" referrerpolicy="no-referrer">';
      }else{
        const preview=$('#reviewPreviewCard');
        if(preview&&res.imageUrl){ preview.href=res.imageUrl; preview.hidden=false; }
      }
      if(msg) msg.textContent='Uploaded. Save the draft to keep it.';
    }catch(err){ if(msg) msg.textContent=err.message; }
  }

  editor.addEventListener('change',e=>{
    if(e.target.id==='editImageUpload') uploadImage(e.target.files[0],'article');
    if(e.target.id==='editSocialImageUpload') uploadImage(e.target.files[0],'social');
  });

  editor.addEventListener('click',async e=>{
    const b=e.target.closest('[data-meta-post]'); if(!b||!current)return;
    const note=$('#reviewSocialMessage');
    const socialImage=$('#editSocialImageUrl')?.value.trim() || '';
    const featureImage=$('#editImageUrl')?.value.trim() || current.imageUrl || '';
    // The SVG social card is preview-only: Meta rejects SVG images with
    // "(#100) Invalid parameter". Post the editorial feature photo instead
    // whenever the social image is a generated card.
    const imageUrl=socialImage.includes('/api/social-card') ? featureImage : socialImage;
    const isSvg=/\.svg(\?|$)/i.test(imageUrl) || imageUrl.includes('/api/social-card');
    const payload={
      id:current.id,
      slug:current.slug || '',
      caption:$('#editSocialCaption')?.value.trim() || current.socialCaption || current.dek || '',
      hashtags:$('#editSocialHashtags')?.value.trim() || current.socialHashtags || '',
      imageUrl,
      facebook:$('#socialFacebook')?.checked === true,
      instagram:$('#socialInstagram')?.checked === true
    };
    if(!payload.facebook&&!payload.instagram){ note.textContent='Choose Facebook and/or Instagram first.'; return; }
    if(payload.instagram&&!payload.imageUrl){ note.textContent='Instagram needs a public JPG/PNG image URL first.'; return; }
    if(isSvg){ note.textContent='Meta needs a real photo (JPG/PNG). The SVG social card is preview-only — set the article image to a photo first.'; return; }
    note.textContent='Posting…';
    b.disabled=true;
    try{
      const r=await fetch('/api/meta-publish',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-review-password':password},
        body:JSON.stringify(payload)
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.error||'Meta publish failed');
      note.textContent='Posted'+(data.facebook?.id?' to Facebook':'')+(data.instagram?.id?' to Instagram':'')+'.';
      await load();
    }catch(err){ note.textContent=err.message; }
    finally{ b.disabled=false; }
  });

  $('#reviewRefresh').addEventListener('click',()=>load().catch(()=>{}));
  const shopeeListEl=$('#reviewShopeeList');
  if(shopeeListEl) shopeeListEl.addEventListener('click',e=>{
    const add=e.target.closest('.review-shopee-add');
    if(add){
      const box=add.closest('[data-shopee-album]');
      if(box) add.insertAdjacentHTML('beforebegin',shopeeLinkRow('',''));
      return;
    }
    const rem=e.target.closest('.review-shopee-remove');
    if(rem){
      const box=rem.closest('[data-shopee-album]');
      const row=rem.closest('.review-shopee-link');
      if(box&&row){
        row.remove();
        if(!box.querySelector('.review-shopee-link')){
          box.querySelector('.review-shopee-add').insertAdjacentHTML('beforebegin',shopeeLinkRow('',''));
        }
      }
    }
  });
  const shopeeSaveBtn=$('#reviewShopeeSave');
  if(shopeeSaveBtn) shopeeSaveBtn.addEventListener('click',async ()=>{
    const note=$('#reviewShopeeMessage');
    const links={};
    document.querySelectorAll('[data-shopee-album]').forEach(box=>{
      links[box.dataset.shopeeAlbum]=[...box.querySelectorAll('.review-shopee-link')].map(row=>({
        label:row.querySelector('.review-shopee-label').value.trim(),
        url:row.querySelector('.review-shopee-url').value.trim()
      })).filter(r=>r.url);
    });
    if(note) note.textContent='Saving…';
    shopeeSaveBtn.disabled=true;
    try{
      const data=await api('buy_links_save',{links});
      (data.albums||[]).forEach(a=>{
        const found=shopeeAlbums.find(x=>x.id===a.id);
        if(found){ found.buyLink=a.buyLink||''; found.buyLinks=a.buyLinks||[]; }
      });
      renderShopee();
      if(note) note.textContent=data.changed ? 'Saved. The album pages will pick the new links up within a few minutes.' : 'No changes to save.';
    }catch(err){
      if(note) note.textContent=err.message;
    }finally{
      shopeeSaveBtn.disabled=false;
    }
  });
  $('#autoPublishToggle').addEventListener('change',async e=>{
    const wanted=e.target.checked;
    const label=$('#autoPublishLabel');
    if(label) label.textContent='Saving…';
    e.target.disabled=true;
    try{
      const data=await api('set_auto_publish',{enabled:wanted});
      autoPublish=data.autoPublish===true;
      renderAutoPublish();
    }catch(err){
      e.target.checked=autoPublish;
      renderAutoPublish();
      alert(err.message);
    }finally{e.target.disabled=false;}
  });
  $('#reviewLogout').addEventListener('click',()=>{
    sessionStorage.removeItem('hallyuscope_review_password'); password=''; desk.hidden=true; login.hidden=false; $('#reviewPassword').value='';
  });

  if(password) loginNow().catch(()=>{login.hidden=false;desk.hidden=true;});
})();