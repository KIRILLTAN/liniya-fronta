'use strict';
/* Мультиплеер по локальной сети. Хост — авторитетный сервер: клиенты присылают действия, хост выполняет их
   за страну клиента и раз в секунду рассылает состояние мира. Сетевой ретранслятор (WebSocket) и поиск комнат
   по UDP встроены в приложение (main.py). */
Object.assign(mp,{ws:null,code:null,port:null,name:'',myId:null,lobby:null,assign:{},snapTimer:null,feedback:[]});

/* =================== КОМАНДЫ =================== */
// Функции, которые клиент может попросить хоста выполнить за свою страну
const NET_CMDS={sendArmyGoal:1,redirectMoveId:1,shipGotoId:1,shipAttack:1,wingStrikeId:1,squadStrikeId:1,shipLoadTroops:1,shipUnload:1,shipLoadStock:1,
  surpriseAttack:1,sendAid:1,buyRangeUp:1,setFacProd:1,nukeLaunch:1};
function uiSnap(){return {mode:ui.mode,wk:ui.wk,salvo:ui.salvo,prio:ui.prio,frac:ui.frac,launchFrom:ui.launchFrom,launchShip:ui.launchShip,adk:ui.adk,placeK:ui.placeK,placeAmt:ui.placeAmt,
  facType:ui.facType,shipType:ui.shipType,squadK:ui.squadK,sel:ui.sel,selU:[...ui.selU],qty:ui.qty,pending:ui.pending,filt:ui.filt,frac2:ui.frac};}
function cmdRun(fn,args){if(mp.role==='client'&&!mp.applying)mpSend({t:'cmd',fn,args,ui:uiSnap()});return window[fn](...args);}
// UI-входы, через которые проходят все действия игрока: на клиенте они выполняются локально и отправляются хосту
function netWrap(name,argsOf){const orig=window[name];window[name]=function(...a){if(mp.role==='client'&&!mp.applying&&!mp.silent)mpSend({t:'ui',fn:name,args:argsOf?argsOf(a):a,ui:uiSnap()});return orig.apply(this,a);};}
netWrap('act',a=>[a[0],a[1],{checked:a[2]&&a[2].checked}]);netWrap('mapClick');netWrap('launchAt');netWrap('sendSelectionTo');
// На хосте чужие действия выполняются «молча»: без тостов, модальных окон, смены вкладок и камеры
for(const n of ['toast','renderPanel','focus','showOver']){const o=window[n];window[n]=function(...a){if(mp.silent){if(n==='toast')mp.feedback.push(a);return;}return o.apply(this,a);};}
const _setMode=setMode;setMode=function(m){if(mp.silent){ui.mode=m;if(m!=='target'){ui.launchFrom=null;ui.lfDrag=null;ui.launchShip=null;}return;}if(m!=='target')ui.launchShip=null;return _setMode(m);};
const _setTab=setTab;setTab=function(t){if(mp.silent){ui.tab=t;return;}return _setTab(t);};
const _saveGame=saveGame;saveGame=function(...a){if(mp.role==='client'){if(!a[1])toast('В сетевой игре сохраняет только хост.','warn');return;}return _saveGame(...a);};
function mpExec(from,msg){const country=mp.assign[from];if(country==null||!C[country]||!C[country].alive)return;
  const keepUi={...ui,selU:new Set(ui.selU)},keepPlayer=player;mp.silent=true;mp.feedback=[];
  try{player=country;Object.assign(ui,msg.ui||{});ui.selU=new Set((msg.ui&&msg.ui.selU)||[]);
    if(msg.t==='cmd'&&NET_CMDS[msg.fn])window[msg.fn](...msg.args);
    else if(msg.t==='ui'&&['act','mapClick','launchAt','sendSelectionTo'].includes(msg.fn)){const a=msg.args;if(msg.fn==='act')window.act(a[0],a[1],a[2]);else window[msg.fn](...a);}}
  catch(e){console.error(e);}
  finally{player=keepPlayer;Object.assign(ui,keepUi);mp.silent=false;}
  for(const f of mp.feedback)if(f[1]==='bad')mpSend({t:'send',to:from,data:{t:'toast',txt:f[0],cls:'bad'}});}

/* =================== СВЯЗЬ =================== */
const hasApi=()=>window.pywebview&&window.pywebview.api;
function mpSend(o){if(mp.ws&&mp.ws.readyState===1)mp.ws.send(JSON.stringify(o));}
function mpConnect(url,hello,onMsg){return new Promise((res,rej)=>{const ws=new WebSocket(url);mp.ws=ws;let ok=false;
  ws.onopen=()=>ws.send(JSON.stringify(hello));
  ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.t==='welcome'){ok=true;mp.myId=m.id;res(m);return;}if(m.t==='error'){rej(new Error(m.msg));ws.close();return;}onMsg(m);};
  ws.onclose=()=>{if(!ok)rej(new Error('Нет связи с комнатой'));else mpClosed();};ws.onerror=()=>{};});}
function mpClosed(){if(!mp.role)return;const was=mp.role;mpReset();if(was==='client'){showOver(`<h2>Связь потеряна</h2><p>Соединение с хостом прервано.</p><button class="btn pri" data-act="toMenu">В главное меню</button>`);}}
function mpReset(){clearInterval(mp.snapTimer);mp.role=null;mp.lobby=null;mp.assign={};try{mp.ws&&mp.ws.close();}catch(e){}mp.ws=null;$('#lobby').style.display='none';$('#speed').style.visibility='';$('#btnSave').style.display='';
  if(hasApi())window.pywebview.api.mp_host_stop();}

/* =================== МЕНЮ «КОМНАТЫ» =================== */
const lobbyEl=document.createElement('div');lobbyEl.id='lobby';document.body.appendChild(lobbyEl);
const lst=document.createElement('style');lst.textContent=`#lobby{position:fixed;inset:0;z-index:35;background:rgba(5,8,12,.88);display:none;align-items:center;justify-content:center;padding:16px}
#lobby .lb{background:var(--panel);border:1px solid var(--line2);border-radius:18px;padding:22px;width:min(980px,100%);max-height:92vh;overflow:auto;box-shadow:var(--shadow)}
#lobby .code{font:700 34px var(--f-mono);letter-spacing:.25em;color:var(--acc)}#lobby .cols{display:grid;grid-template-columns:1fr 1.4fr 1fr;gap:16px;margin-top:14px}
#lobby .card{background:var(--soft)}#lobby select,#lobby input{background:var(--bg);border:1px solid var(--line2);border-radius:8px;padding:6px 8px;color:var(--text)}
@media (max-width:900px){#lobby .cols{grid-template-columns:1fr}}`;document.head.appendChild(lst);
const roomsBtn=document.createElement('button');roomsBtn.className='btn';roomsBtn.id='roomsBtn';roomsBtn.textContent='Комнаты (сеть)';$('#menuLoad').after(roomsBtn);
roomsBtn.onclick=()=>openRooms();
function myName(){try{return localStorage.getItem('lf_name')||'Игрок';}catch(e){return 'Игрок';}}
async function openRooms(scan){if(!hasApi()){showOver(`<h2>Комнаты</h2><p>Сетевая игра работает только в приложении «Линия фронта.exe».</p><button class="btn" data-act="closeOver">Закрыть</button>`);return;}
  let rooms=[];if(scan){try{rooms=JSON.parse(await window.pywebview.api.mp_scan());}catch(e){}}
  showOver(`<h2>Комнаты</h2><p class="muted">Игра по локальной сети. Все игроки должны быть в одной сети (Wi-Fi или кабель). При первом запуске Windows может спросить разрешение для брандмауэра — разрешите доступ в частных сетях.</p>
  <div class="opt" style="margin:10px 0"><span>Ваше имя</span><input class="search" id="mpName" style="max-width:220px" maxlength="20" value="${esc(myName())}"></div>
  <h3>Создать комнату</h3><div class="pair"><input class="search" id="mpRoom" maxlength="30" placeholder="Название комнаты" value="Комната ${esc(myName())}"><button class="btn pri" data-mp="create">Создать</button></div>
  <h3>Найти комнату <button class="btn" data-mp="scan">Обновить список</button></h3>
  ${scan?(rooms.length?rooms.map(r=>`<div class="row"><div class="nm"><b>${esc(r.name)}</b><small>${esc(r.ip)}:${r.port} · игроков ${r.players}${r.started?' · игра идёт':''}</small></div><button class="btn" data-mp="pick" data-ip="${esc(r.ip)}" data-port="${r.port}">Выбрать</button></div>`).join(''):'<p class="muted">Комнат в сети не найдено. Можно ввести адрес хоста вручную.</p>'):'<p class="muted">Нажмите «Обновить список».</p>'}
  <div class="pair"><input class="search" id="mpIp" placeholder="Адрес хоста, например 192.168.1.5" value="${esc(mp.lastIp||'')}"><input class="search" id="mpCode" maxlength="6" placeholder="Код комнаты" style="max-width:140px;text-transform:uppercase"><button class="btn pri" data-mp="join">Войти</button></div>
  <input type="hidden" id="mpPort" value="${mp.lastPort||CONFIG.MP_PORT}">
  <div style="margin-top:12px"><button class="btn" data-act="closeOver">Закрыть</button></div>`);}
$('#over').addEventListener('click',async e=>{const b=e.target.closest('[data-mp]');if(!b)return;const a=b.dataset.mp,nameEl=$('#mpName');
  const name=(nameEl?nameEl.value:myName()).trim()||'Игрок';try{localStorage.setItem('lf_name',name);}catch(_){}
  if(a==='scan'){b.textContent='Поиск…';openRooms(true);}
  else if(a==='pick'){mp.lastIp=b.dataset.ip;mp.lastPort=b.dataset.port;$('#mpIp').value=b.dataset.ip;$('#mpPort').value=b.dataset.port;$('#mpCode').focus();}
  else if(a==='create'){const room=($('#mpRoom').value||'Комната').trim();try{const r=JSON.parse(await window.pywebview.api.mp_host_start(room));await hostStart(r,name,room);}catch(err){toast('Не удалось создать комнату: '+err.message,'bad');}}
  else if(a==='join'){const ip=$('#mpIp').value.trim(),code=$('#mpCode').value.trim().toUpperCase(),port=+$('#mpPort').value||CONFIG.MP_PORT;
    if(!ip||code.length<6){toast('Введите адрес хоста и код из 6 символов.','bad');return;}mp.lastIp=ip;await clientJoin(ip,port,code,name);}});

/* =================== ХОСТ =================== */
async function hostStart(r,name,room){mp.role='host';mp.code=r.code;mp.port=r.port;mp.name=name;mp.ips=r.ips||[];
  await mpConnect(`ws://127.0.0.1:${r.port}`,{t:'hello',role:'host',code:r.code,name},hostMsg);
  mp.lobby={room,code:r.code,ips:mp.ips,port:r.port,players:{0:{name,group:1,conn:true}},groups:[{id:1,name:'Группа 1',votes:{},pick:null}],settings:{diff:1,scen:'2026',speed:6,gmode:'campaign'},started:false};
  $('#over').style.display='none';renderLobby();}
function hostMsg(m){const L=mp.lobby;if(!L)return;
  if(m.t==='join'){const old=Object.entries(L.players).find(([id,p])=>!p.conn&&p.name===m.name);
    if(old){delete L.players[old[0]];L.players[m.id]={...old[1],conn:true};if(mp.assign[old[0]]!=null){mp.assign[m.id]=mp.assign[old[0]];delete mp.assign[old[0]];C[mp.assign[m.id]].isPlayer=true;}}
    else L.players[m.id]={name:m.name,group:null,conn:true,ip:m.ip};
    log(`В комнату вошёл игрок: ${m.name}.`,'ok');toast(`Подключился: ${m.name}`,'ok');lobbyChanged();
    if(L.started&&mp.assign[m.id]!=null)mpSend({t:'send',to:m.id,data:{t:'start',assign:mp.assign,snap:mpSnapshot()}});}
  else if(m.t==='leave'){const p=L.players[m.id];if(!p)return;p.conn=false;toast(`Отключился: ${p.name}`,'warn');
    if(L.started){const cid=mp.assign[m.id];const still=Object.entries(L.players).some(([id,q])=>q.conn&&mp.assign[id]===cid);
      if(cid!=null&&!still&&cid!==player){C[cid].isPlayer=false;log(`В группе страны «${C[cid].name}» никого не осталось — страной управляет компьютер.`,'warn');}}
    else delete L.players[m.id];lobbyChanged();}
  else if(m.t==='msg'){const d=m.data||{};
    if(d.t==='vote'){const p=L.players[m.from];if(!p||L.started)return;const g=L.groups.find(x=>x.id===p.group);if(g){g.votes[m.from]=d.country;lobbyChanged();}}
    else if(d.t==='cmd'||d.t==='ui'){if(L.started)mpExec(m.from,d);}}}
function lobbyChanged(){if(!mp.lobby)return;if(!mp.lobby.started)renderLobby();mpSend({t:'send',to:'all',data:{t:'lobby',lobby:mp.lobby}});}
function hostLobbyAct(a,v,el){const L=mp.lobby;
  if(a==='addGroup'){const id=Math.max(0,...L.groups.map(g=>g.id))+1;L.groups.push({id,name:'Группа '+id,votes:{},pick:null});}
  else if(a==='delGroup'){L.groups=L.groups.filter(g=>g.id!==+v);for(const p of Object.values(L.players))if(p.group===+v)p.group=null;}
  else if(a==='setGroup'){const [pid,gid]=v.split(':');L.players[pid].group=gid?+gid:null;for(const g of L.groups)delete g.votes[pid];}
  else if(a==='kick'){mpSend({t:'kick',id:+v});delete L.players[v];}
  else if(a==='set'){const [k,val]=v.split(':');L.settings[k]=k==='scen'||k==='gmode'?val:+val;}
  else if(a==='pick'){const [gid,cid]=v.split(':');L.groups.find(g=>g.id===+gid).pick=cid===''?null:+cid;}
  else if(a==='vote'){const p=L.players[0],g=L.groups.find(x=>x.id===p.group);if(g)g.votes[0]=+v;}
  else if(a==='start'){hostLaunch();return;}
  else if(a==='leave'){mpReset();return;}
  lobbyChanged();}
function groupCountry(g){const tally={};for(const c of Object.values(g.votes))if(c!=null&&c!=='')tally[c]=(tally[c]||0)+1;
  const best=Math.max(0,...Object.values(tally));const top=Object.keys(tally).filter(k=>tally[k]===best).map(Number);
  if(!top.length)return null;if(top.length===1)return top[0];if(g.pick!=null&&top.includes(g.pick))return g.pick;return top[Math.floor(Math.random()*top.length)];}
function hostLaunch(){const L=mp.lobby,used=new Set(),assign={};
  const me=L.players[0];if(!me.group){toast('Добавьте себя в группу.','bad');return;}
  for(const g of L.groups){const members=Object.keys(L.players).filter(id=>L.players[id].group===g.id);if(!members.length)continue;
    const cid=groupCountry(g);if(cid==null){toast(`${g.name}: участники не выбрали страну.`,'bad');return;}if(used.has(cid)){toast(`Две группы выбрали одну страну: ${C[cid].name}.`,'bad');return;}
    used.add(cid);g.country=cid;for(const id of members)assign[id]=cid;}
  mp.assign=assign;scen=L.settings.scen;ui.gmode=L.settings.gmode;ui.diff=L.settings.diff;resetForMenu();ui.menuSel=assign[0];startGame();
  for(const cid of used){C[cid].isPlayer=true;if(cid!==player)C[cid].money*=1.5;}speed=L.settings.speed;setSpeedUI();
  L.started=true;lobbyEl.style.display='none';
  mpSend({t:'send',to:'all',data:{t:'start',assign,snap:mpSnapshot()}});mpSend({t:'state',started:true});
  clearInterval(mp.snapTimer);mp.snapTimer=setInterval(()=>{if(mp.role==='host'&&started)mpSend({t:'send',to:'all',data:{t:'snap',snap:mpSnapshot()}});},CONFIG.MP_SNAPSHOT_MS);
  log(`Сетевая игра началась. Игроков: ${Object.keys(assign).length}.`,'ok');}
function mpSnapshot(){return {s:serialize(),running,speed,humans:C.filter(c=>c.isPlayer).map(c=>c.id),
  projs:projs.filter(p=>!p.dead).map(p=>({id:p.id,sv:p.sv,owner:p.owner,w:p.w,x:p.x,y:p.y,sx:p.sx,sy:p.sy,tx:p.tx,ty:p.ty,prio:p.prio,delay:p.delay,n:p.n,state:p.state,ang:p.ang,t:p.t,hd:p.hd,wx:p.wx,wy:p.wy,u:p.u,wing:p.wing}))};}

/* =================== КЛИЕНТ =================== */
async function clientJoin(ip,port,code,name){mp.role='client';mp.name=name;
  try{await mpConnect(`ws://${ip}:${port}`,{t:'hello',role:'client',code,name},clientMsg);$('#over').style.display='none';toast('Вы в комнате','ok');}
  catch(e){mp.role=null;toast('Не удалось войти: '+e.message,'bad');}}
function clientMsg(m){
  if(m.t==='lobby'){mp.lobby=m.lobby;if(!started)renderLobby();}
  else if(m.t==='kicked'){mpReset();showOver(`<h2>Вас исключили из комнаты</h2><button class="btn pri" data-act="closeOver">Понятно</button>`);}
  else if(m.t==='hostgone'){mpClosed();}
  else if(m.t==='toast')toast(m.txt,m.cls);
  else if(m.t==='start'){mp.assign=m.assign;const cid=m.assign[mp.myId];if(cid==null){toast('Вы не в группе — наблюдаете за игрой.','warn');}
    lobbyEl.style.display='none';$('#menu').style.display='none';$('#over').style.display='none';
    player=cid??m.snap.humans[0];started=true;over=false;mpApply(m.snap,true);setPlayerColor();
    const c=C[player];$('#cname').textContent=c.name+' (сеть)';ui.sel=c.capital;focus(provs[c.capital].cx,provs[c.capital].cy,c.initProvs>20?1.4:3);
    $('#speed').style.visibility='hidden';$('#btnSave').style.display='none';setTab('prov');log(`Сетевая игра: вы управляете страной «${c.name}».`,'ok');}
  else if(m.t==='snap'){if(started)mpApply(m.snap);}}
function mpApply(sn,first){const d=JSON.parse(sn.s);mp.applying=true;
  try{const prev=provs.map(p=>p.owner+'|'+Math.round(p.dmg*50));
    time=d.time;scen=d.scen;aiMul=d.aiMul;adId=d.adId;
    d.provs.forEach((a,i)=>{const p=provs[i];[p.owner,p.armies,p.b,p.fort,p.dmg,p.build]=a;p.capital=!!a[6];});
    d.C.forEach((x,i)=>{const c=C[i],col=c.color,oc=c.origColor;Object.assign(c,x);c.wars=new Set(x.wars);c.color=col;if(oc)c.origColor=oc;c.isPlayer=sn.humans.includes(i);
      for(const s of (x.custom||[]))if(!c.cat[s.key])buildCustom(c,s);});
    ads=d.ads;moves=d.moves;facs=d.facs||[];facId=d.facId||0;loadExt(d.ext);
    const keep=new Map(projs.map(p=>[p.id,p]));projs=sn.projs.map(p=>{const o=keep.get(p.id);return Object.assign({eng:0,resolved:true,tr:o?o.tr:[]},p);});
    ints=ints.filter(i=>projs.some(p=>p===i.t));salvos={};running=sn.running;speed=sn.speed;setSpeedUI();
    let changed=false;provs.forEach((p,i)=>{if(prev[i]!==p.owner+'|'+Math.round(p.dmg*50)){baseDirty.add(p.id);changed=true;}});if(changed||first){ctrlDirty=true;fogAll();}
    for(const id of [...ui.selU])if(!tokens().some(t=>t.id===id))ui.selU.delete(id);
    syncFac();economyPass();updateVis();panelDirty=true;}
  finally{mp.applying=false;}}
function clientLobbyAct(a,v){if(a==='vote')mpSend({t:'vote',country:+v});else if(a==='leave'){mpReset();}}

/* =================== ЛОББИ =================== */
function renderLobby(){const L=mp.lobby;if(!L){lobbyEl.style.display='none';return;}const host=mp.role==='host',meId=host?0:mp.myId,me=L.players[meId];
  const countries=C.filter(c=>c.alive).sort((a,b)=>b.budget-a.budget);
  const opts=(sel)=>`<option value="">— выбрать страну —</option>`+countries.map(c=>`<option value="${c.id}" ${sel===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
  let h=`<div class="lb"><div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start">
    <div><div class="muted">Комната «${esc(L.room)}» · код для входа</div><div class="code">${esc(L.code)}</div>${host?`<div class="muted">Адрес хоста: ${esc((L.ips||[]).join(', ')||'—')}${L.port!==CONFIG.MP_PORT?':'+L.port:''}</div>`:''}</div>
    <div style="display:flex;gap:8px">${host?`<button class="btn pri" data-lb="start" style="padding:10px 20px">Начать игру</button>`:'<span class="muted">Игру запускает хост</span>'}<button class="btn" data-lb="leave">Выйти</button></div></div>
  <div class="cols"><div class="card"><h3>Игроки</h3>`;
  for(const [id,p] of Object.entries(L.players))h+=`<div class="row"><div class="nm"><b>${esc(p.name)}${+id===0?' (хост)':''}${+id===meId?' — вы':''}</b><small>${p.conn?'в сети':'отключён'}</small></div>
    ${host?`<select data-lbs="setGroup" data-pid="${id}"><option value="">без группы</option>${L.groups.map(g=>`<option value="${g.id}" ${p.group===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select>${+id!==0?`<button class="btn dng" data-lb="kick" data-v="${id}">Кик</button>`:''}`:`<span class="muted">${p.group?esc((L.groups.find(g=>g.id===p.group)||{}).name||''):'без группы'}</span>`}</div>`;
  h+=`</div><div class="card"><h3>Группы и страны ${host?'<button class="btn" data-lb="addGroup">+ группа</button>':''}</h3><div class="muted" style="margin-bottom:8px">Участники группы голосуют за страну и вместе ею управляют. При ничьей решает хост или случай.</div>`;
  for(const g of L.groups){const mem=Object.keys(L.players).filter(id=>L.players[id].group===g.id);const tally={};for(const v of Object.values(g.votes))if(v!=null&&v!=='')tally[v]=(tally[v]||0)+1;
    h+=`<div class="row" style="flex-direction:column;align-items:stretch"><div style="display:flex;justify-content:space-between"><b>${esc(g.name)}</b>${host&&L.groups.length>1?`<button class="btn dng" data-lb="delGroup" data-v="${g.id}">Удалить</button>`:''}</div>
      <small class="muted">Участники: ${mem.map(id=>esc(L.players[id].name)).join(', ')||'нет'}</small>
      <small>Голоса: ${Object.keys(tally).length?Object.entries(tally).map(([c,n])=>`${esc(C[c]?C[c].name:'?')} — ${n}`).join(', '):'пока нет'}</small>
      ${me&&me.group===g.id?`<div class="pair"><span class="muted">Ваш голос</span><select data-lbs="vote">${opts(g.votes[meId])}</select></div>`:''}
      ${host&&Object.keys(tally).length>1?`<div class="pair"><span class="muted">При ничьей</span><select data-lbs="pick" data-gid="${g.id}"><option value="">случайно</option>${Object.keys(tally).map(c=>`<option value="${c}" ${g.pick===+c?'selected':''}>${esc(C[c].name)}</option>`).join('')}</select></div>`:''}</div>`;}
  const S_=L.settings,chip=(k,v,l)=>`<span class="chip ${String(S_[k])===String(v)?'on':''}" ${host?`data-lb="set" data-v="${k}:${v}"`:''}>${l}</span>`;
  h+=`</div><div class="card"><h3>Настройки</h3><div class="muted">Сложность ИИ</div><div class="chips">${chip('diff',.8,'Лёгкая')}${chip('diff',1,'Обычная')}${chip('diff',1.25,'Тяжёлая')}</div>
    <div class="muted" style="margin-top:8px">Карта и сценарий</div><div class="chips">${chip('scen','2026','Мир, октябрь 2026')}${chip('scen','peace','Мирный мир')}</div>
    <div class="muted" style="margin-top:8px">Скорость</div><div class="chips">${chip('speed',3,'3 ч/с')}${chip('speed',6,'6 ч/с')}${chip('speed',12,'12 ч/с')}${chip('speed',24,'24 ч/с')}</div>
    <div class="muted" style="margin-top:8px">Режим</div><div class="chips">${chip('gmode','campaign','Кампания')}${chip('gmode','free','Свобода')}</div>
    ${host?'':'<p class="muted">Настройки меняет хост.</p>'}</div></div></div>`;
  if(lobbyEl.dataset.h!==h&&!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#lobby')&&document.activeElement.tagName==='SELECT')){lobbyEl.innerHTML=h;lobbyEl.dataset.h=h;}
  lobbyEl.style.display='flex';}
lobbyEl.addEventListener('click',e=>{const b=e.target.closest('[data-lb]');if(!b)return;if(mp.role==='host')hostLobbyAct(b.dataset.lb,b.dataset.v);else clientLobbyAct(b.dataset.lb,b.dataset.v);});
lobbyEl.addEventListener('change',e=>{const s=e.target.closest('[data-lbs]');if(!s)return;const a=s.dataset.lbs;
  if(mp.role==='host'){if(a==='setGroup')hostLobbyAct('setGroup',s.dataset.pid+':'+s.value);else if(a==='pick')hostLobbyAct('pick',s.dataset.gid+':'+s.value);else if(a==='vote')hostLobbyAct('vote',s.value);}
  else if(a==='vote')clientLobbyAct('vote',s.value);s.blur();});
