// Flatten the signed SVG into a self-contained image before drawing it.
// SVGs loaded as images cannot fetch their own photos, logos or web fonts.
async function exportSocialCard(url) {
  async function get(url) {
    const response=await fetch(url);
    if(!response.ok) throw new Error('Could not load a social card asset ('+response.status+').');
    return response;
  }
  async function dataUrl(blob) {
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(new Error('Could not read the social card asset.'));
      reader.readAsDataURL(blob);
    });
  }
  const response=await get(url);
  const doc=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
  if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg') throw new Error('The social card could not be rendered.');
  await Promise.all([...doc.querySelectorAll('image')].map(async image=>{
    const src=image.getAttribute('href')||image.getAttributeNS('http://www.w3.org/1999/xlink','href');
    if(!src) throw new Error('The social card is missing an image.');
    const embedded=src.startsWith('data:')?src:await dataUrl(await (await get(src)).blob());
    image.setAttribute('href',embedded);
    image.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',embedded);
  }));
  const fontResponse=await get('https://fonts.googleapis.com/css2?family=Archivo:wght@500;800&display=swap');
  let fontCss=await fontResponse.text();
  for(const match of [...fontCss.matchAll(/url\(([^)]+)\)/g)]) {
    const src=match[1].replace(/^['"]|['"]$/g,'');
    const embedded=await dataUrl(await (await get(src)).blob());
    fontCss=fontCss.split(match[0]).join('url('+embedded+')');
  }
  for(const style of doc.querySelectorAll('style')) style.textContent=style.textContent.replace(/@import\s+url\([^)]*\)\s*;/g,'');
  const style=doc.createElementNS('http://www.w3.org/2000/svg','style');
  style.textContent=fontCss;
  doc.documentElement.prepend(style);
  const blob=new Blob([new XMLSerializer().serializeToString(doc)],{type:'image/svg+xml'});
  const objectUrl=URL.createObjectURL(blob);
  try {
    const image=await new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(new Error('Could not export the edited social card.'));
      image.src=objectUrl;
    });
    const canvas=document.createElement('canvas');
    canvas.width=1080;canvas.height=1350;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#01229a';ctx.fillRect(0,0,1080,1350);
    ctx.drawImage(image,0,0,1080,1350);
    const jpeg=canvas.toDataURL('image/jpeg',0.94);
    if(!jpeg.startsWith('data:image/jpeg;base64,')) throw new Error('JPEG export is unavailable in this browser.');
    return jpeg.split(',')[1];
  } finally {URL.revokeObjectURL(objectUrl);}
}
