/* 우클릭(PC) · 길게 탭(휴대폰) 검색 — 병해 · 해충 통합
 * - 서식에 적힌 병명(병해명)·곤충명(해충명)을 수목 병해/해충 데이터베이스에서 찾아 상세정보를 보여줍니다.
 *   · 병해: Supabase tree_diseases → 기기에 저장된 사본 → 앱 내장 data/diseases.json
 *   · 해충: Supabase tree_insects  → 기기에 저장된 사본 → 앱 내장 data/insects.json
 * - 문장 전체를 대상으로 해도 그 안에 들어 있는 병명·해충명을 자동으로 찾아냅니다.
 * - data-disease="병명" 속성 또는 .disease-target 클래스가 붙은 요소는 그 병명으로 바로 검색합니다.
 * - 외부 사이트(국가생물종지식정보시스템 등) 검색도 함께 제공합니다.
 */
(function(){
  'use strict';
  const PLANT_SEARCH='https://www.nature.go.kr/ekbi/plant/pilbk/selectPlantPilbkScnmIndexList.do';
  const INSECT_SEARCH='https://www.nature.go.kr/kbi/insct/pilbk/selectInsctPilbkScnmIndexList.do';
  const NONGSARO_PEST='https://www.nongsaro.go.kr/portal/ps/psx/psxk/fixFarmTchSch.ps?menuId=PS04315more';
  const BASE=(()=>{try{return new URL('.',document.currentScript.src).href}catch(e){return './'}})();

  /* ---------------- 데이터 원본 정의 ---------------- */
  const SOURCES={
    disease:{
      key:'disease',label:'병해',icon:'🍂',table:'tree_diseases',file:'data/diseases.json',cache:'treeDiseasesCacheV2',
      sciField:'pathogen',color:'#fff4e8',
      fields:[
        ['exam','기출'],['category','구분'],['subcategory','세부 분류'],['pathogen_class','병원체 분류'],['pathogen_group','병원체 속·그룹'],
        ['pathogen','병원체(학명)'],['pathogen_detail','병원체(세부 학명)'],['pathogen_ko','학명 한글 표기'],['name_check','학명 확인 메모'],
        ['host','주요 기주'],['host_plants','기주 식물'],['host_detail','기주·발생 대상'],['intermediate_host','중간기주'],['vector','매개충·전염'],
        ['infection_site','발병 부위'],['symptom','병징'],['sign','표징'],['lifecycle','전염·생활사'],
        ['overwinter','월동태·1차 전염원'],['overwinter_site','월동 장소·발생 조건'],['occurrence','발생 시기·환경'],
        ['diagnosis','진단 요령·유사 병해'],['physical_control','물리적·재배적 방제'],['biological_control','생물적 방제'],
        ['spray_timing','약제 방제 시기'],['chemical_control','화학적 방제'],['note','특징·비고'],['data_source','자료 출처']
      ],
      sub:r=>[r.exam?'📝 '+r.exam:'',r.category,r.pathogen_class,r.host],
      hay:r=>[r.exam,r.host,r.host_plants,r.host_detail,r.intermediate_host,r.vector,r.category,r.subcategory,r.pathogen_class,r.pathogen_group,r.pathogen_detail,r.pathogen_ko,r.infection_site],
      ext:['농사로 병해충방제정보',()=>NONGSARO_PEST],
      note:'※ 약제는 반드시 농약안전정보시스템에서 해당 수목·병해 등록 여부와 안전사용기준을 확인하세요.'
    },
    insect:{
      key:'insect',label:'해충',icon:'🐛',table:'tree_insects',file:'data/insects.json',cache:'treeInsectsCacheV1',
      sciField:'sci_name',color:'#eef6ef',
      fields:[
        ['category','구분'],['order_name','분류 목'],['family','분류 과'],['sci_name','학명'],['host','기주'],
        ['damage_stage','가해 충태'],['generations','발생회수/년'],['overwinter_stage','월동 태'],['overwinter_site','월동 장소'],
        ['distribution','분포 지역'],['host_plants','기주 식물'],['damage_trait','피해 특성'],['damage_sign','피해흔'],
        ['morphology','형태(생식 특성)'],['ecology','생태 특성'],['physical_control','물리적·기계적 방제'],
        ['biological_control','생물적 방제(천적 등)'],['spray_timing','약제살포시기'],['chemical_control','화학적 방제']
      ],
      sub:r=>[r.category,r.order_name,r.family],
      hay:r=>[r.host,r.host_plants,r.category,r.order_name,r.family],
      ext:['곤충자원에서 보기',title=>makeUrl(INSECT_SEARCH,title)],
      note:''
    }
  };
  const ORDER=['disease','insect'];
  const NONE=v=>!v||/^[—-]\s*$/.test(String(v).trim());
  function valueOf(S,r,k){
    let v=r[k];
    if(S.key==='insect'){
      if(k==='morphology')v=[r.morphology,r.morphology2,r.morphology3].filter(Boolean).join('\n');
      if(k==='chemical_control')v=[r.chemical_control,r.chemical_control2].filter(Boolean).join('\n');
    }
    return NONE(v)?'':String(v);
  }

  let menu=null,panel=null,longTimer=null,lastTouch=null,longFired=false,swallowUntil=0,lastShow=0;

  /* ---------------- 데이터 읽기 ---------------- */
  const state={};ORDER.forEach(k=>state[k]={DB:null,p:null,src:''});
  function cfgOk(){return window.SUPABASE_URL&&window.SUPABASE_ANON_KEY&&!String(window.SUPABASE_URL).includes('YOUR-PROJECT')&&!String(window.SUPABASE_ANON_KEY).includes('YOUR_SUPABASE')}
  function sbClient(){
    try{const c=window.TreeSync&&window.TreeSync.getClient&&window.TreeSync.getClient();if(c)return c}catch(e){}
    if(cfgOk()&&window.supabase&&window.supabase.createClient){
      if(!window.__treeInsectClient)window.__treeInsectClient=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
      return window.__treeInsectClient;
    }
    return null;
  }
  async function fromSupabase(S){
    const c=sbClient();if(!c)return null;
    const {data,error}=await c.from(S.table).select('*').order('id').limit(5000);
    if(error||!data||!data.length)return null;
    return data.map(r=>{const o={};Object.keys(r).forEach(k=>{if(r[k]!==null&&r[k]!=='')o[k]=String(r[k])});return o});
  }
  async function fromBundle(S){const r=await fetch(BASE+S.file,{cache:'no-cache'});if(!r.ok)throw new Error('data');return r.json()}
  function loadDB(key){
    const S=SOURCES[key],st=state[key];
    if(st.DB)return Promise.resolve(st.DB);
    if(st.p)return st.p;
    st.p=(async()=>{
      let rows=null;
      try{rows=await Promise.race([fromSupabase(S),new Promise(r=>setTimeout(()=>r(null),6000))]);if(rows){st.src='Supabase 데이터베이스';try{localStorage.setItem(S.cache,JSON.stringify({at:Date.now(),rows}))}catch(e){}}}catch(e){}
      if(!rows){try{const c=JSON.parse(localStorage.getItem(S.cache)||'null');if(c&&c.rows&&c.rows.length){rows=c.rows;st.src='기기에 저장된 데이터베이스 사본'}}catch(e){}}
      if(!rows){try{rows=await fromBundle(S);st.src='앱 내장 데이터'}catch(e){rows=[]}}
      st.DB=index(S,rows);return st.DB;
    })();
    st.p.catch(()=>{st.p=null});
    return st.p;
  }
  const norm=s=>String(s||'').replace(/\s+/g,'').toLowerCase();
  function index(S,rows){
    return rows.map(r=>{
      const raw=String(r.name||''),main=raw.replace(/\(.*?\)/gs,'').trim();
      const keys=new Set([norm(main)]);
      (raw.match(/\(([^)]*)\)/g)||[]).forEach(p=>{const a=norm(p.slice(1,-1));if(a.length>=3)keys.add(a)});
      String(r.alias||'').split(/[,，\n]/).forEach(a=>{a=norm(a);if(a.length>=2)keys.add(a)});
      [...keys].forEach(k=>{if(k.endsWith('류')&&k.length>=4)keys.add(k.slice(0,-1))});
      let sci=String(r[S.sciField]||'').split('\n')[0].trim();if(NONE(sci)||/^—/.test(sci))sci='';
      const sciAll=[r[S.sciField],r.pathogen_detail].filter(Boolean).join(' ');
      const w=sci.toLowerCase().match(/[a-z]+/g)||[],sciKey=w.length>=2?w[0]+w[1]:'',wAll=sciAll.toLowerCase().match(/[a-z]+/g)||w;
      return {src:S.key,r,keys:[...keys].filter(k=>k.length>=2),title:raw.replace(/\s*\n\s*/g,' '),sci,
        sciKey:sciKey.length>=6?sciKey:'',sciW:wAll,sciN:norm(sciAll)||norm(sci),hay:norm(S.hay(r).join(' '))};
    });
  }
  /* 문장 속 이름 찾기 + 짧은 검색어는 이름·학명·기주식물에 포함된 것까지 */
  function match(db,text){
    const t=norm(text);if(!t)return {named:[],related:[]};
    let named=db.filter(x=>x.keys.some(k=>t.includes(k))||(x.sciKey&&t.includes(x.sciKey)));
    named=named.filter(x=>!named.some(y=>y!==x&&y.keys[0].length>x.keys[0].length&&y.keys[0].includes(x.keys[0])));
    let related=[];
    if(t.length<=30){
      related=db.filter(x=>!named.includes(x)&&(x.keys.some(k=>k.includes(t))||(/^[a-z]+$/.test(t)?x.sciW.some(v=>v.startsWith(t)):x.sciN.includes(t))||x.hay.includes(t)));
      related.sort((a,b)=>(b.keys.some(k=>k.includes(t))?1:0)-(a.keys.some(k=>k.includes(t))?1:0));
    }
    return {named,related};
  }

  /* ---------------- 검색어 얻기 ---------------- */
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function selectedText(target){
    const a=document.activeElement;
    for(const el of [target,a]){
      if(el&&el.matches&&el.matches('textarea,input')&&typeof el.selectionStart==='number'&&el.selectionEnd>el.selectionStart){
        const s=el.value.slice(el.selectionStart,el.selectionEnd).trim();if(s)return s;
      }
    }
    const s=window.getSelection?window.getSelection().toString():'';
    return s.replace(/\s+/g,' ').trim();
  }
  function cellOf(target){
    if(!target||!target.closest)return null;
    if(target.closest('.tdoc-ov,.tdoc-fab,#integratedNav,nav,.bio-menu,.bio-panel'))return null;
    if(target.matches('textarea,input'))return target;
    return target.closest('[data-k],td,.cell,.v');
  }
  function getTerm(target){
    // 병명 지정 요소(data-disease / .disease-target)가 가장 우선
    const tagged=target&&target.closest&&target.closest('[data-disease],.disease-target');
    if(tagged&&!tagged.closest('.bio-menu,.bio-panel')){
      const v=(tagged.getAttribute('data-disease')||tagged.textContent||'').trim();if(v)return v;
    }
    const sel=selectedText(target);if(sel)return sel;
    const el=cellOf(target);if(!el)return '';
    if(el.matches('textarea,input'))return String(el.value||'').trim();
    const ta=el.querySelector&&el.querySelector('textarea');
    if(ta&&ta.value)return ta.value.trim();
    return String(el.innerText||el.textContent||'').trim();
  }

  /* ---------------- 메뉴 ---------------- */
  const BTN='display:block;width:100%;border:0;background:#f8fafc;border-radius:9px;padding:10px;margin:3px 0;text-align:left;font:inherit;cursor:pointer;color:#172033;';
  const NOTE='font-size:12px;color:#667085;padding:2px 6px';
  function hide(){if(menu){menu.remove();menu=null}}
  function place(el,x,y){const r=el.getBoundingClientRect();el.style.left=Math.min(Math.max(6,x),innerWidth-r.width-6)+'px';el.style.top=Math.min(Math.max(6,y),innerHeight-r.height-6)+'px'}
  function makeUrl(base,term){const u=new URL(base);u.searchParams.set('searchWrd',term);return u.toString()}
  const plain=t=>String(t).replace(/\(.*?\)/g,'').trim();
  function show(x,y,term){
    if(Date.now()-lastShow<500&&menu)return;
    lastShow=Date.now();hide();
    const short=term.length>40?term.slice(0,40)+'…':term;
    menu=document.createElement('div');menu.className='bio-menu';
    menu.style.cssText='position:fixed;z-index:2147483646;width:min(340px,calc(100vw - 12px));max-height:calc(100vh - 12px);overflow:auto;background:#fff;border:1px solid #cfd7e2;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:6px;font:14px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans KR",sans-serif;color:#172033;';
    menu.innerHTML='<div style="padding:8px 10px 2px;font-size:12px;color:#667085">검색 대상</div><div style="padding:0 10px 8px;font-weight:800;word-break:break-all">'+esc(short)+'</div>'+
      ORDER.map(k=>'<div class="bio-db" data-src="'+k+'" style="border-top:1px solid #eef1f5;padding:6px 4px"><div style="'+NOTE+'">'+SOURCES[k].icon+' '+SOURCES[k].label+' 데이터베이스 찾는 중…</div></div>').join('')+
      '<div style="border-top:1px solid #eef1f5;padding-top:4px"></div>';
    const ext=menu.lastElementChild;
    let extTerm=term;
    const extItems=[['🌿 국가생물종지식정보시스템에서 검색',PLANT_SEARCH,true],['🐞 곤충자원에서 검색',INSECT_SEARCH,true],['🌐 국가생물다양성 정보공유체계에서 검색','https://www.kbr.go.kr/man/home/rsc/rsc01001s.do',true],['🧪 농사로 병해충방제정보 열기',NONGSARO_PEST,false]];
    extItems.forEach(([label,base,q])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText=BTN;b.onclick=()=>{window.open(q?makeUrl(base,extTerm):base,'_blank','noopener');hide()};ext.appendChild(b)});
    const close=document.createElement('button');close.type='button';close.textContent='닫기';
    close.style.cssText='display:block;width:100%;border:0;background:#fff;padding:8px;text-align:center;color:#667085;font:inherit;cursor:pointer;';
    close.onclick=hide;ext.appendChild(close);
    document.body.appendChild(menu);place(menu,x,y);
    const m=menu;
    ORDER.forEach(key=>{
      const S=SOURCES[key];
      loadDB(key).then(db=>{
        if(menu!==m)return;
        const box=m.querySelector('.bio-db[data-src="'+key+'"]');
        const head=S.icon+' '+S.label+' 데이터베이스';
        if(!db.length){box.innerHTML='<div style="'+NOTE+';color:#a12b2b">'+head+'를 불러오지 못했습니다.</div>';place(m,x,y);return}
        const {named,related}=match(db,term);
        if(key==='insect'&&named.length===1&&term.length>named[0].title.length)extTerm=plain(named[0].title);
        const list=named.concat(related);
        if(!list.length){box.innerHTML='<div style="'+NOTE+'">'+head+': 일치하는 '+S.label+' 없음</div>';place(m,x,y);return}
        const LIM=6;
        box.innerHTML='<div style="'+NOTE+';padding-bottom:4px">'+head+' · '+list.length+'건</div>';
        list.slice(0,LIM).forEach((it,i)=>{
          const b=document.createElement('button');b.type='button';b.style.cssText=BTN+'background:'+(i<named.length?S.color:'#f8fafc')+';';
          b.innerHTML='<b>'+esc(it.title)+'</b>'+(i>=named.length?' <span style="font-size:11px;color:#667085">(관련)</span>':'')+'<br><span style="font-size:12px;color:#667085">'+esc(S.sub(it.r).filter(Boolean).join(' · ')||it.sci)+'</span>';
          b.onclick=()=>{hide();openPanel(it,term)};box.appendChild(b);
        });
        if(list.length>LIM){const b=document.createElement('button');b.type='button';b.style.cssText=BTN+'text-align:center;color:#173f5f;font-weight:700';b.textContent=S.label+' 전체 '+list.length+'건 보기';b.onclick=()=>{hide();openList(list,term)};box.appendChild(b)}
        place(m,x,y);
      });
    });
  }

  /* ---------------- 상세 · 목록 화면 ---------------- */
  function closePanel(){if(panel){panel.remove();panel=null}}
  function frame(inner){
    closePanel();
    panel=document.createElement('div');panel.className='bio-panel';
    panel.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.5);display:flex;align-items:flex-end;justify-content:center;font:14px/1.5 system-ui,-apple-system,"Segoe UI","Noto Sans KR",sans-serif';
    panel.innerHTML='<div style="background:#fff;color:#172033;width:100%;max-width:640px;max-height:90vh;overflow:auto;border-radius:16px 16px 0 0;padding:14px 16px calc(16px + env(safe-area-inset-bottom,0px));box-shadow:0 -6px 30px rgba(0,0,0,.3)">'+inner+'</div>';
    if(innerWidth>=700){panel.style.alignItems='center';panel.firstChild.style.borderRadius='16px'}
    panel.addEventListener('pointerdown',e=>{if(e.target===panel)closePanel()});
    panel.querySelectorAll('[data-x]').forEach(b=>b.onclick=closePanel);
    document.body.appendChild(panel);return panel;
  }
  const HB='border:1px solid #cfd7e2;background:#f5f7fa;color:#172033;border-radius:9px;padding:9px 13px;font:600 14px inherit;font-family:inherit;cursor:pointer';
  const XBTN='<button data-x style="border:0;background:transparent;font-size:22px;color:#667085;cursor:pointer;width:40px;height:40px">✕</button>';
  function summary(it){
    const S=SOURCES[it.src],r=it.r;
    return ['['+S.label+'] '+it.title+(it.sci?' ('+it.sci+')':'')].concat(S.fields.filter(([k])=>k!==S.sciField).map(([k,l])=>{const v=valueOf(S,r,k);return v?l+': '+v.replace(/\s*\n\s*/g,' / '):''}).filter(Boolean)).join('\n');
  }
  function openPanel(it,term,back){
    const S=SOURCES[it.src],r=it.r;
    const rows=S.fields.map(([k,l])=>{const v=valueOf(S,r,k);if(!v)return '';
      return '<div style="display:grid;grid-template-columns:118px 1fr;gap:8px;padding:7px 0;border-bottom:1px solid #eef1f5"><div style="color:#475467;font-weight:600;font-size:13px">'+esc(l)+'</div><div style="white-space:pre-wrap;word-break:break-all">'+esc(v)+'</div></div>'}).join('');
    const alias=S.key==='disease'&&r.alias?'<div style="font-size:12px;color:#667085;margin-top:2px">다른 이름: '+esc(r.alias)+'</div>':'';
    const p=frame('<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px"><div><div style="font-size:12px;color:#667085">'+S.icon+' '+S.label+' 데이터베이스 · '+esc(state[S.key].src)+'</div><div style="font-size:20px;font-weight:800">'+esc(it.title)+'</div>'+(it.sci?'<div style="font-style:italic;color:#475467">'+esc(it.sci)+'</div>':'')+alias+'</div>'+XBTN+'</div>'+
      '<div style="margin-top:8px">'+rows+'</div>'+
      (S.note?'<div style="font-size:12px;color:#8a5a00;background:#fff8e6;border-radius:8px;padding:8px 10px;margin-top:10px">'+esc(S.note)+'</div>':'')+
      '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:14px">'+(back?'<button data-back style="'+HB+'">← 목록</button>':'')+'<button data-copy style="'+HB+'">내용 복사</button><button data-ext style="'+HB+'">'+esc(S.ext[0])+'</button><button data-x style="'+HB+';background:#173f5f;color:#fff;border-color:#173f5f">닫기</button></div>');
    p.querySelectorAll('[data-x]').forEach(b=>b.onclick=closePanel);
    p.querySelector('[data-copy]').onclick=async e=>{const t=summary(it);try{await navigator.clipboard.writeText(t);e.target.textContent='복사했습니다'}catch(err){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');e.target.textContent='복사했습니다'}catch(x){}ta.remove()}};
    p.querySelector('[data-ext]').onclick=()=>window.open(S.ext[1](plain(it.title)),'_blank','noopener');
    if(back)p.querySelector('[data-back]').onclick=back;
  }
  function openList(list,term){
    const S=SOURCES[(list[0]&&list[0].src)||'insect'];
    const p=frame('<div style="display:flex;align-items:center;justify-content:space-between"><div style="font-size:18px;font-weight:800">'+S.icon+' “'+esc(term.length>20?term.slice(0,20)+'…':term)+'” '+S.label+' 검색 결과 '+list.length+'건</div>'+XBTN+'</div><div class="bl" style="margin-top:8px"></div>');
    const bl=p.querySelector('.bl');
    list.forEach(it=>{const b=document.createElement('button');b.type='button';b.style.cssText=BTN;b.innerHTML='<b>'+esc(it.title)+'</b><br><span style="font-size:12px;color:#667085">'+esc(SOURCES[it.src].sub(it.r).concat(it.sci).filter(Boolean).join(' · '))+'</span>';b.onclick=()=>openPanel(it,term,()=>openList(list,term));bl.appendChild(b)});
  }

  /* ---------------- 이벤트 ---------------- */
  function onContext(e){
    if(e.target.closest&&e.target.closest('.bio-menu,.bio-panel'))return;
    const term=getTerm(e.target);if(!term)return;
    e.preventDefault();e.stopPropagation();
    show(e.clientX||20,e.clientY||20,term);
  }
  function onTouchStart(e){
    if(e.touches&&e.touches.length>1){cancelLong();return}
    const t=e.target;if(t.closest&&t.closest('.bio-menu,.bio-panel'))return;
    const p=e.touches&&e.touches[0];if(!p)return;
    lastTouch={x:p.clientX,y:p.clientY,target:t};
    clearTimeout(longTimer);
    longTimer=setTimeout(()=>{
      if(!lastTouch)return;
      const term=getTerm(lastTouch.target);
      if(term){longFired=true;show(lastTouch.x,lastTouch.y,term)}
      lastTouch=null;
    },600);
  }
  function onTouchMove(e){const p=e.touches&&e.touches[0];if(lastTouch&&p&&Math.hypot(p.clientX-lastTouch.x,p.clientY-lastTouch.y)>10)cancelLong()}
  function cancelLong(){clearTimeout(longTimer);longTimer=null;lastTouch=null}
  document.addEventListener('contextmenu',onContext,true);
  document.addEventListener('touchstart',onTouchStart,{capture:true,passive:true});
  document.addEventListener('touchmove',onTouchMove,{capture:true,passive:true});
  document.addEventListener('touchend',()=>{clearTimeout(longTimer);longTimer=null;if(longFired){longFired=false;swallowUntil=Date.now()+500}setTimeout(()=>{lastTouch=null},50)},{capture:true,passive:true});
  document.addEventListener('scroll',cancelLong,{capture:true,passive:true});
  // 길게 탭한 직후의 탭은 서식 입력창을 열지 않도록 막음
  document.addEventListener('click',e=>{
    if(Date.now()<swallowUntil&&!(e.target.closest&&e.target.closest('.bio-menu,.bio-panel'))){swallowUntil=0;e.preventDefault();e.stopPropagation();return}
    if(menu&&!menu.contains(e.target))hide();
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){hide();closePanel()}});

  // 미리 불러와 두기(오프라인 대비)
  addEventListener('load',()=>setTimeout(()=>ORDER.forEach(k=>loadDB(k).catch(()=>{})),1500));

  function api(key){
    return {load:()=>loadDB(key),search:async q=>{const db=await loadDB(key);const m=match(db,q);return m.named.concat(m.related)},
      open:(it,q)=>openPanel(it,q||''),openList,source:()=>state[key].src};
  }
  window.TreeInsects=api('insect');
  window.TreeDiseases=api('disease');
  window.TreeBio={
    search:async q=>{const out={};for(const k of ORDER)out[k]=await window['Tree'+(k==='insect'?'Insects':'Diseases')].search(q);return out},
    open:(it,q)=>openPanel(it,q||''),openList,show:(term,x,y)=>show(x==null?20:x,y==null?20:y,term)
  };
})();
