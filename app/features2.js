'use strict';
/* Склад, панель пусков на карте, предпросмотр ПВО и синий цвет своей страны. Подключается после features.js. */

/* =================== СВОЯ СТРАНА — СИНЯЯ =================== */
const PLAYER_BLUE='#2f6fd1';
function setPlayerColor(){for(const c of C)if(c.origColor){c.color=c.origColor;delete c.origColor;}
  if(player>=0){const c=C[player];c.origColor=c.color;c.color=PLAYER_BLUE;$('#flag').style.background=PLAYER_BLUE;}repaintAll();}

/* =================== СКЛАД: САМ ВЫБИРАЮ И СТАВЛЮ =================== */
function depot(c){return c.depot||(c.depot={inf:0,tank:0,art:0});}
function amtChips(key,cur){return `<div class="chips">${[1,5,10,'all'].map(v=>`<span class="chip ${cur===v?'on':''}" data-act="${key}" data-k="${v}">${v==='all'?'Все':'×'+v}</span>`).join('')}</div>`;}
tabArs=function(){const c=C[player],dp=depot(c);ui.placeAmt=ui.placeAmt??'all';
  let h=`<div class="hint">Всё, что выпустили заводы, лежит здесь. Выберите, что и сколько, и поставьте на карту сами. Дроны и ракеты можно запускать и с панели внизу карты.</div>`;
  h+=`<h3>Войска на складе</h3>${amtChips('placeAmt',ui.placeAmt)}`;
  const tg=Object.keys(GROUND).filter(k=>dp[k]>=1);if(!tg.length)h+=`<div class="muted" style="margin-top:6px">Пусто. Закажите войска во вкладке «Заводы».</div>`;
  for(const k of tg)h+=`<div class="row"><div class="nm"><b>${GROUND[k].n}</b><small>${esc(c.cat[k].model||'')}</small></div><span class="num" style="min-width:36px;text-align:right">${Math.floor(dp[k])}</span><button class="btn pri" data-act="placeTroops" data-k="${k}">Разместить</button></div>`;
  h+=`<h3>ПВО на складе</h3>`;const rk=Object.keys(c.adRes).filter(k=>c.adRes[k]>0);
  if(!rk.length)h+=`<div class="muted">Пусто. Закажите ПВО во вкладке «Заводы».</div>`;
  for(const k of rk)h+=`<div class="row"><div class="nm"><b>${esc(c.cat[k].n)}</b><small>${c.cat[k].range} км · ${esc(c.cat[k].d)}</small></div><span class="num">${c.adRes[k]}</span><button class="btn pri" data-act="deploy" data-k="${k}">Поставить</button></div>`;
  h+=`<h3>Дроны и ракеты</h3><div class="muted" style="margin-bottom:6px">Залп</div>${qtyChips([1,3,5,10,25,50,'all'],'salvo',ui.salvo)}
  <div class="muted" style="margin:8px 0 6px">Цель удара</div><div class="chips">${Object.keys(PRIO).map(k=>`<span class="chip ${ui.prio===k?'on':''}" data-act="prio" data-k="${k}">${PRIO[k]}</span>`).join('')}</div>
  ${ui.pending!=null?`<div class="hint" style="border-color:var(--acc)">Цель: <b>${esc(provs[ui.pending].name)}</b>. Нажмите «Выбрать цель» у нужного средства. <button class="btn" data-act="clearPending">Сбросить</button></div>`:''}`;
  for(const k of wkeys(c)){const Wp=c.cat[k],n=c.stock[k]|0;
    h+=`<div class="row"><span style="width:30px;flex:none;color:var(--text)">${wIcon(Wp,28)}</span><div class="nm"><b>${esc(Wp.n)}</b><small>${Wp.range==='front'?'линия фронта':'до '+Wp.range+' км'} · ${esc(Wp.d)}</small></div><span class="num" style="min-width:40px;text-align:right">${sb.infStock?'∞':n}</span><button class="btn pri" data-act="launch" data-k="${k}" ${n||sb.infStock?'':'disabled'}>Выбрать цель</button></div>`;}
  const by={};for(const a of ads)if(a.owner===player)by[a.type]=(by[a.type]||0)+1;
  h+=`<h3>Стоит на карте</h3><div class="kv">${Object.keys(ADT).map(k=>`<span>${esc(c.cat[k].n)}</span><b>${by[k]||0}</b>`).join('')}</div>
  <div class="kv" style="margin-top:8px"><span>Сбито вражеских целей</span><b>${c.st.intercepted}</b><span>Потеряно своих дронов и ракет</span><b>${c.st.lost}</b></div>`;
  return h;};
function placeTroopsAt(pi){const c=C[player],dp=depot(c),k=ui.placeK,p=provs[pi];
  if(pi<0||p.owner!==player)return 'Войска можно поставить только в свой город.';
  const n=ui.placeAmt==='all'?Math.floor(dp[k]):Math.min(+ui.placeAmt,Math.floor(dp[k]));if(n<1)return 'На складе пусто.';
  dp[k]-=n;army(p,player)[k]+=n;fx.push({kind:'text',x:p.cx,y:p.cy,t:0,max:1.5,txt:`+${n} ${GROUND[k].n.toLowerCase()}`,col:'#ffd27a'});economyPass();
  if(dp[k]<1)setMode(null);toast(`${GROUND[k].n} ×${n} → ${p.name}`,'ok');panelDirty=true;return null;}

/* =================== ПАНЕЛЬ ПУСКОВ НА КАРТЕ =================== */
function wIcon(W_,sz){const k=projKind(W_),c='currentColor';let p='';
  if(k==='small')p=`<path d="M6 6L18 18M18 6L6 18" stroke="${c}" stroke-width="2"/><circle cx="6" cy="6" r="3.2" fill="none" stroke="${c}" stroke-width="1.6"/><circle cx="18" cy="6" r="3.2" fill="none" stroke="${c}" stroke-width="1.6"/><circle cx="6" cy="18" r="3.2" fill="none" stroke="${c}" stroke-width="1.6"/><circle cx="18" cy="18" r="3.2" fill="none" stroke="${c}" stroke-width="1.6"/><rect x="10" y="10" width="4" height="4" fill="${c}"/>`;
  else if(k==='drone')p=`<path d="M22 12L5 3H2.5L7 12L2.5 21H5Z" fill="${c}"/><path d="M2 3H6M2 21H6" stroke="${c}" stroke-width="2"/>`;
  else if(k==='recon')p=`<rect x="2" y="11" width="19" height="2" fill="${c}"/><rect x="11" y="1.5" width="3" height="21" fill="${c}"/><path d="M4 12L1.5 7M4 12L1.5 17" stroke="${c}" stroke-width="2"/>`;
  else if(k==='cruise')p=`<path d="M23 12L20 10.5H3V13.5H20Z" fill="${c}"/><path d="M12 10.5L9 5H7.5L9.5 10.5M12 13.5L9 19H7.5L9.5 13.5M5 10.5L3 7.5V16.5L5 13.5" fill="${c}"/><path d="M3 12H0" stroke="#f59e0b" stroke-width="2.5"/>`;
  else if(k==='ballistic'||k==='nuke'){const f=k==='nuke'?'#f5c518':c;p=`<path d="M23 12L18 9.5H5V14.5H18Z" fill="${f}"/><path d="M7 9.5L3.5 6V18L7 14.5" fill="${f}"/><path d="M3.5 12H0" stroke="#f59e0b" stroke-width="3"/>${k==='nuke'?'<rect x="12" y="9.5" width="2" height="5" fill="#111"/>':''}`;}
  else p=`<circle cx="12" cy="12" r="6" fill="${c}"/>`;
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;}
const wbar=document.createElement('div');wbar.id='wbar';$('#mapwrap').appendChild(wbar);
const wst=document.createElement('style');wst.textContent=`#wbar{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:none;gap:4px;padding:6px;background:rgba(17,24,31,.94);border:1px solid var(--line2);border-radius:14px;box-shadow:var(--shadow);max-width:calc(100% - 360px);overflow-x:auto;z-index:4}
#wbar button{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:66px;padding:6px 8px;border-radius:10px;border:1px solid transparent;background:var(--soft);color:var(--text);cursor:pointer;font-size:10.5px;font-weight:600;line-height:1.15}
#wbar button:hover:not(:disabled){border-color:var(--acc)}#wbar button.on{background:var(--acc);color:var(--onAcc)}#wbar button:disabled{opacity:.35;cursor:not-allowed}
#wbar button b{font-family:var(--f-mono);font-size:11px}#wbar .sv{display:flex;flex-direction:column;justify-content:center;gap:3px;padding:0 4px 0 8px;border-left:1px solid var(--line);margin-left:2px}
#wbar .sv span{font-size:10px;color:var(--muted);text-align:center}#wbar .sv div{display:flex;gap:2px}#wbar .sv button{min-width:0;padding:4px 7px;font-family:var(--f-mono)}
@media (max-width:900px){#wbar{max-width:calc(100% - 20px);bottom:8px}#wbar button{min-width:56px}}`;document.head.appendChild(wst);
const shortName=n=>n.replace(/\s*\(.*\)/,'').replace('Баллистическая ракета','Баллистика').replace('Крылатая ракета','Крылатая').replace('Ядерная ракета','Ядерная');
function updateWbar(){if(!started||player<0||over){wbar.style.display='none';return;}const c=C[player];
  let h=wkeys(c).map(k=>{const Wp=c.cat[k],n=c.stock[k]|0;return `<button data-w="${k}" class="${ui.mode==='target'&&ui.wk===k?'on':''}" ${n||sb.infStock?'':'disabled'} title="${esc(Wp.n)} — ${esc(Wp.d)}">${wIcon(Wp,24)}<span>${esc(shortName(Wp.n))}</span><b>${sb.infStock?'∞':n}</b></button>`;}).join('');
  h+=`<div class="sv"><span>залп</span><div>${[1,5,10,25].map(v=>`<button data-s="${v}" class="${ui.salvo===v?'on':''}">${v}</button>`).join('')}</div></div>`;
  if(wbar.dataset.h!==h){wbar.innerHTML=h;wbar.dataset.h=h;}wbar.style.display='flex';}
wbar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const c=C[player];
  if(b.dataset.s)ui.salvo=+b.dataset.s;
  else{const k=b.dataset.w;if(ui.mode==='target'&&ui.wk===k)setMode(null);else{if(c.cat[k].prio)ui.prio=c.cat[k].prio;ui.wk=k;ui.pending=null;setMode('target');}}
  updateWbar();if(ui.tab==='ars')renderPanel();});
setInterval(updateWbar,300);

/* =================== ПУСК: ВЫБОР ГОРОДА И ЦЕЛИ =================== */
function launchAt(wx,wy){const err=tryLaunch(ui.wk,wx,wy);if(err==='ask')return;
  if(err){toast(err,'bad');return;}toast(`Пуск: ${C[player].cat[ui.wk].n}${launchName()}`,'ok');
  if(!(C[player].stock[ui.wk]>0)&&!sb.infStock)setMode(null);updateWbar();}

/* =================== ПОПОЛНЕНИЕ ВОЙСК =================== */
function frontNeediest(c){let best=null,bv=1e9;
  for(const p of provs){if(p.owner!==c.id||!p.nb.some(n=>atWar(c.id,provs[n].owner)))continue;const v=tot(p.armies[c.id])+(p.battle?-50:0);if(v<bv){bv=v;best=p;}}return best;}
function reinfDeliver(c,k,n,dest){if(!c.isPlayer)return false;
  if(dest!=null&&provs[dest].owner===c.id){army(provs[dest],c.id)[k]+=n;return true;}
  if(c.autoReinf){const fp=frontNeediest(c);if(fp){army(fp,c.id)[k]+=n;return true;}}return false;}
function reinfBlock(p){const c=C[player],dp=depot(c);
  let h=`<h3>Пополнить войска</h3>`;
  for(const k of Object.keys(GROUND)){const has=Math.floor(dp[k]);
    h+=`<div class="row"><div class="nm"><b>${GROUND[k].n}</b><small>на складе ${has} · заказ 5 отрядов: ${fM(c.cat[k].cost*5)}, ${hrs(c.cat[k].h)} на линии</small></div>
    ${has?`<button class="btn pri" data-act="reinf" data-k="${k}:5">+${Math.min(5,has)}</button><button class="btn pri" data-act="reinf" data-k="${k}:all">Все ${has}</button>`:''}<button class="btn" data-act="reinfOrder" data-k="${k}" ${c.money<c.cat[k].cost*5?'disabled':''}>Заказать 5</button></div>`;}
  h+=`<div class="muted" style="margin:6px 0">«Заказать 5» — отряды приедут прямо в этот город, когда заводы их выпустят.</div>
  <label class="row"><input type="checkbox" data-act="autoReinf" ${c.autoReinf?'checked':''}><div class="nm"><b>Автопополнение фронта</b><small>Новые войска сами едут в прифронтовой город, где их меньше всего</small></div></label>`;
  return h;}

/* =================== ПРЕДПРОСМОТР: ПВО НА МАРШРУТЕ И ЗОНА ПРИКРЫТИЯ =================== */
function screenLabel(g,z,x,y,lines,col){g.font=`600 ${12/z}px "Segoe UI",sans-serif`;g.textAlign='left';g.textBaseline='top';
  let w=0;for(const l of lines)w=Math.max(w,g.measureText(l).width);const pad=6/z,lh=15/z,hh=lines.length*lh+pad*2-3/z;
  g.fillStyle='rgba(17,24,31,.92)';g.fillRect(x,y,w+pad*2,hh);g.strokeStyle=col;g.lineWidth=1.2/z;g.strokeRect(x,y,w+pad*2,hh);
  lines.forEach((l,i)=>{g.fillStyle=i?'#c3ced8':'#ffffff';g.fillText(l,x+pad,y+pad+i*lh);});}
function routePreview(g,z,site,wx,wy,Wp){const c=C[player],cls=Wp.cls,L=km(site.cx,site.cy,wx,wy);if(L<1)return;
  const N=32,pts=[];for(let i=0;i<=N;i++)pts.push([site.cx+(wx-site.cx)*i/N,site.cy+(wy-site.cy)*i/N]);
  const lo=launchSiteObj(),have=lo&&lo.ship?(lo.ship.cargo[ui.wk]|0):sb.infStock?999:(c.stock[ui.wk]|0),shots0=Math.max(1,ui.wk==='nuke'?1:Math.min(ui.salvo==='all'?have:ui.salvo,have)),n=shots0*(Wp.cnt||1);
  let rem=n,hitAD=0,ewHit=0;
  for(const a of ads){if(!atWar(player,a.owner)||!adVisible(a))continue;const T=C[a.owner].cat[a.type];
    if(!T.ew&&!(T.pk[cls]>0))continue;const er=T.ew?T.range:T.range*((cls==='small'||cls==='drone'||cls==='cruise')?T.low:1);
    let inside=0;for(const [x,y] of pts)if(km(x,y,a.x,a.y)<=er)inside++;if(!inside)continue;
    const t=inside/N*L/(Wp.spd*CONFIG.SPEED);
    rangeEllipse(g,a.x,a.y,er);g.fillStyle=T.ew?'rgba(122,162,255,.18)':'rgba(229,70,60,.18)';g.fill();g.strokeStyle=T.ew?'#7aa2ff':'#e5463c';g.lineWidth=2/z;g.stroke();
    if(T.ew){if(Wp.ew>0){rem*=Math.exp(-Wp.ew*6*t);ewHit++;}continue;}
    hitAD++;const pk=T.pk[cls]*(1-(Wp.stealth||0)),shots=Math.min(a.ammo+t/T.reload,t/T.cd+1);rem-=Math.min(rem,shots*pk);}
  const reach=Math.max(0,Math.round(rem)),ok=reach>=n*.5;
  g.strokeStyle=ok?'#4cc38a':'#e5463c';g.lineWidth=2/z;g.setLineDash([7/z,5/z]);g.beginPath();g.moveTo(site.cx,site.cy);g.lineTo(wx,wy);g.stroke();g.setLineDash([]);
  const pi=provAt(wx,wy),tn=pi>=0?provs[pi].name:'море';
  screenLabel(g,z,wx+14/z,wy+14/z,[`${shortName(Wp.n)} ×${n} → ${tn} (${PRIO[ui.prio].toLowerCase()})`,`${Math.round(L)} км · в полёте ${hrs(Math.max(1,Math.round(L/(Wp.spd*CONFIG.SPEED))))}`,
    hitAD||ewHit?`На пути ПВО: ${hitAD}${ewHit?` · РЭБ: ${ewHit}`:''}`:'Известной ПВО на пути нет',`Дойдут до цели ≈ ${reach} из ${n}`],ok?'#4cc38a':'#e5463c');}
function placePreview(g,z){if(player<0||!ui.mode)return;const [wx,wy]=toWorld(ui.mx,ui.my),pi=provAt(wx,wy),own=pi>=0&&provs[pi].owner===player;
  if(ui.mode==='deploy'&&ui.adk){const T=C[player].cat[ui.adk],col=own?'76,195,138':'229,70,60';
    rangeEllipse(g,wx,wy,T.range);g.fillStyle=`rgba(${col},.12)`;g.fill();g.strokeStyle=`rgb(${col})`;g.lineWidth=2/z;g.setLineDash([8/z,5/z]);g.stroke();g.setLineDash([]);
    if(!T.ew&&T.low<1){rangeEllipse(g,wx,wy,T.range*T.low);g.strokeStyle=`rgba(${col},.85)`;g.lineWidth=1.2/z;g.setLineDash([3/z,3/z]);g.stroke();g.setLineDash([]);}
    let nf=0,nc=0;for(const f of facs)if(provs[f.prov].owner===player&&f.state!=='ruin'&&km(f.x,f.y,wx,wy)<=T.range)nf++;
    for(const p of provs)if(p.owner===player&&p.city&&km(p.cx,p.cy,wx,wy)<=T.range)nc++;
    const lines=[`${T.n}: радиус ${T.range} км`];if(!T.ew&&T.low<1)lines.push(`по дронам и крылатым ракетам — ${Math.round(T.range*T.low)} км`);
    lines.push(own?`Прикроет: заводов ${nf}, городов ${nc}`:'Сюда нельзя — не ваша территория');screenLabel(g,z,wx+14/z,wy+14/z,lines,own?'#4cc38a':'#e5463c');}
  else if(ui.mode==='placeTroops'&&ui.placeK){const dp=depot(C[player]),n=ui.placeAmt==='all'?Math.floor(dp[ui.placeK]):Math.min(+ui.placeAmt,Math.floor(dp[ui.placeK]));
    if(pi>=0){g.strokeStyle=own?'#4cc38a':'#e5463c';g.lineWidth=2.6/z;g.stroke(provPaths[pi]);}
    screenLabel(g,z,wx+14/z,wy+14/z,[`${GROUND[ui.placeK].n} ×${n}`,own?`→ ${provs[pi].name}`:'Выберите свой город'],own?'#4cc38a':'#e5463c');}}
