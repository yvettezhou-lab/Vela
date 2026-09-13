(() => {
  const KEY='vela.home.memoryImage.v1';
  const read=()=>{try{return localStorage.getItem(KEY)||''}catch{return ''}};
  const compress=file=>new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>{const im=new Image();im.onload=()=>{const max=1600,s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.82))};im.onerror=reject;im.src=r.result};
    r.onerror=reject;r.readAsDataURL(file);
  });
  const apply=box=>{
    if(!box||box.dataset.memoryBound==='1')return;
    box.dataset.memoryBound='1';
    const saved=read();
    if(saved)box.style.setProperty('--vela-memory-image',`url("${saved}")`);
    const input=document.createElement('input');input.type='file';input.accept='image/*';input.hidden=true;
    const button=document.createElement('button');button.type='button';button.className='v3-memory-edit';button.setAttribute('aria-label','Change memory image');button.innerHTML='<span>＋</span>';
    button.addEventListener('click',e=>{e.stopPropagation();input.click()});
    input.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=await compress(file);localStorage.setItem(KEY,data);box.style.setProperty('--vela-memory-image',`url("${data}")`)}catch{}input.value=''});
    box.append(button,input);
  };
  const sync=()=>apply(document.querySelector('#vela-home-v3 .v3-memory'));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync);else sync();
  new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});
})();
