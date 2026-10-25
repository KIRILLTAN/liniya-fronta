'use strict';
/* Расширения игры: заводы на карте, реалистичные иконки БПЛА, сбития, дроны-перехватчики,
   воздушный десант, ядерный удар, конструктор вооружений и прицельные удары ИИ.
   Подключается после game.js и дополняет его функции. */

/* =================== НОВЫЕ ОБРАЗЦЫ =================== */
ADT.idrone={n:'Дроны-перехватчики',cost:20,h:24*3,range:60,mag:8,cd:.12,reload:1,spd:320,low:1,drone:true,pk:{small:.4,drone:.65,uav:.6,cruise:.1,ballistic:0},up:.2,fac:'drone',d:'Выпускает дроны-охотники на вражеские БПЛА, 60 км'};
WPN.nuke={n:'Ядерная ракета',cls:'ballistic',cost:400,h:24*15,fac:'mil',range:12000,spd:9000,ew:0,stealth:.5,special:'nuke',dmg:{troops:0,ad:0,industry:0,energy:0},d:'Стирает город. Только у ядерных держав'};
WPN.airlift={n:'Транспортный самолёт с десантом',cls:'uav',cost:0,h:1,fac:'mil',range:1500,spd:600,ew:0,stealth:.3,special:'airlift',hidden:true,dmg:{troops:0,ad:0,industry:0,energy:0},d:''};
for(const k of ['idrone'])BASE[k]={...ADT[k],t:'a'};
for(const k of ['nuke','airlift'])BASE[k]={...WPN[k],t:'w'};
const NUKES={'Russia':30,'United States of America':30,'China':12,'France':6,'United Kingdom':6,'India':4,'Pakistan':4,'North Korea':3,'Israel':3};

const _setupCountry=setupCountry;
setupCountry=function(c){_setupCountry(c);c.custom=c.custom||[];c.nuclear=!!NUKES[c.key];c.stock.nuke=NUKES[c.key]||0;};
canMake=function(c,k){return k!=='nuke'||c.nuclear||(c.isPlayer&&ui.gmode==='free');};
function wkeys(c){return Object.keys(c.cat).filter(k=>c.cat[k].t==='w'&&!c.cat[k].hidden&&(k!=='nuke'||canMake(c,'nuke')||(c.stock.nuke|0)>0));}

/* =================== ЗАВОДЫ НА КАРТЕ =================== */
let facs=[],facId=0;
function facsIn(p){return facs.filter(f=>f.prov===p.id);}
function facCount(p,t){let n=0;for(const f of facs)if(f.prov===p.id&&f.type===t&&f.state==='ok')n++;return n;}
function addFac(p,t,state='ok',x,y){let fx_=x,fy_=y;
  if(fx_==null){const r=(.12+p.level*.07)*S;
    for(let i=0;i<30&&fx_==null;i++){const a=Math.random()*7,d=R(.25,1)*r,tx=p.cx+Math.cos(a)*d,ty=p.cy+Math.sin(a)*d;
      if(provAt(tx,ty)===p.id&&!facs.some(f=>Math.hypot(f.x-tx,f.y-ty)<S*.07)){fx_=tx;fy_=ty;}}
    if(fx_==null){fx_=p.cx+R(-.1,.1)*S;fy_=p.cy+R(-.1,.1)*S;}}
  const f={id:++facId,type:t,prov:p.id,x:fx_,y:fy_,hp:state==='ok'?100:0,state,left:state==='build'?BUILD[t].h:0,total:BUILD[t].h};facs.push(f);return f;}
function syncFac(){for(const p of provs)p.b={civ:0,mil:0,drone:0};for(const f of facs)if(f.state==='ok')provs[f.prov].b[f.type]+=f.hp/100;}
function startBuild(c,p,t,x,y){const B=BUILD[t];
  if(p.owner!==c.id)return 'Строить можно только на своей территории.';
  if(c.money<B.cost&&!(c.isPlayer&&sb.money))return `Недостаточно средств: нужно ${fM(B.cost)}.`;
  if(t==='fort'){if(p.build)return 'Укрепления уже строятся.';if(p.fort>=3)return 'Укрепления уже максимальные.';
    c.money-=B.cost;if(c.isPlayer&&sb.instant){p.fort++;return null;}p.build={t,left:B.h,total:B.h};return null;}
  if(usedSlots(p)>=slots(p))return `В городе ${p.name} нет свободных площадок (${slots(p)}). Снесите старый завод или стройте в другом городе.`;
  c.money-=B.cost;const f=addFac(p,t,'build',x,y);if(c.isPlayer&&sb.instant){f.state='ok';f.hp=100;}syncFac();return null;}
function facHour(){for(const f of facs){const p=provs[f.prov];
  if(f.state==='build'){f.left-=1-p.dmg*.5;if(f.left<=0){f.state='ok';f.hp=100;if(p.owner===player){log(`Построен ${BUILD[f.type].n.toLowerCase()} (${p.name}).`,'ok');panelDirty=true;}}}
  else if(f.state==='ok'&&f.hp<100)f.hp=Math.min(100,f.hp+2/24);}}
function rebuildFac(c,f){const B=BUILD[f.type],cost=Math.round(B.cost*.4);if(c.money<cost&&!sb.money)return `Нужно ${fM(cost)}.`;
  c.money-=cost;f.state='build';f.left=f.total=B.h*.5;if(c.isPlayer&&sb.instant){f.state='ok';f.hp=100;}syncFac();return null;}
function demolishFac(f){facs=facs.filter(x=>x!==f);syncFac();}
function hitFactories(o,p,x,y,hits,D,sv,add){const cand=facs.filter(f=>f.prov===p.id&&f.state!=='ruin');
  for(let h=0;h<hits;h++){let best=null,bd=1e9;for(const f of cand){const d=km(f.x,f.y,x,y);if(d<bd){bd=d;best=f;}}
    if(best&&bd<35){best.hp-=D.industry*120*R(.7,1.3)*(bd<12?1:.5);boom(best.x,best.y,7,'#ff7a3d');
      if(best.hp<=0){best.hp=0;best.state='ruin';add('разрушен: '+BUILD[best.type].n.toLowerCase());cand.splice(cand.indexOf(best),1);}else add('повреждён: '+BUILD[best.type].n.toLowerCase());}
    else{const e=D.energy*.5;p.dmg=Math.min(.9,p.dmg+e);if(sv)sv.energy+=e;}}
  syncFac();}
function facVisible(f){const p=provs[f.prov];return !started||!ui.fog||p.owner===player||p.vis;}
function facAt(wx,wy){if(cam.z<.9)return null;let best=null,bd=11/cam.z;for(const f of facs){if(!facVisible(f))continue;const d=Math.hypot(f.x-wx,f.y-wy);if(d<bd){bd=d;best=f;}}return best;}
function drawFacGlyph(g,t,s,z){g.beginPath();
  if(t==='civ'){g.moveTo(-s,s);g.lineTo(-s,-.05*s);g.lineTo(-.45*s,-.6*s);g.lineTo(-.45*s,-.05*s);g.lineTo(.1*s,-.6*s);g.lineTo(.1*s,-.05*s);g.lineTo(.45*s,-.05*s);g.lineTo(.45*s,-s);g.lineTo(.8*s,-s);g.lineTo(.8*s,s);g.closePath();g.fill();}
  else if(t==='mil'){g.moveTo(0,-s);g.quadraticCurveTo(.5*s,-.45*s,.42*s,0);g.lineTo(.42*s,.7*s);g.lineTo(-.42*s,.7*s);g.lineTo(-.42*s,0);g.quadraticCurveTo(-.5*s,-.45*s,0,-s);g.fill();g.fillRect(-.55*s,.72*s,1.1*s,.28*s);}
  else{g.lineWidth=1.5/z;g.moveTo(-.65*s,-.65*s);g.lineTo(.65*s,.65*s);g.moveTo(.65*s,-.65*s);g.lineTo(-.65*s,.65*s);g.stroke();
    for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){g.beginPath();g.arc(a*.65*s,b*.65*s,.32*s,0,7);g.stroke();}g.beginPath();g.arc(0,0,.25*s,0,7);g.fill();}}
function drawFacIcon(g,f,z,ghost){const p=provs[f.prov];const col=ghost?ghost:C[p.owner].color,s=7.5/z;
  g.save();g.translate(f.x,f.y);g.globalAlpha=ghost?.7:1;
  g.fillStyle=f.state==='ruin'?'#5b6470':'#ffffff';g.strokeStyle=col;g.lineWidth=2.2/z;if(f.state==='build')g.setLineDash([2.5/z,2/z]);
  g.beginPath();g.rect(-s,-s,2*s,2*s);g.fill();g.stroke();g.setLineDash([]);
  g.fillStyle=g.strokeStyle=f.state==='ruin'?'#c9ced4':'#1d2630';drawFacGlyph(g,f.type,s*.72,z);
  if(f.state==='ruin'){g.strokeStyle='#e5463c';g.lineWidth=2/z;g.beginPath();g.moveTo(-s,-s);g.lineTo(s,s);g.moveTo(s,-s);g.lineTo(-s,s);g.stroke();}
  const bar=(v,c)=>{g.fillStyle='rgba(20,25,30,.75)';g.fillRect(-s,s+2/z,2*s,3.2/z);g.fillStyle=c;g.fillRect(-s,s+2/z,2*s*clamp(v,0,1),3.2/z);};
  if(f.state==='build'&&!ghost)bar(1-f.left/f.total,'#e3b341');else if(f.state==='ok'&&f.hp<99.5)bar(f.hp/100,f.hp>50?'#4cc38a':'#e5463c');
  if(ui.selFac===f.id){g.strokeStyle='#e3a51a';g.lineWidth=2.6/z;g.strokeRect(-s-3.5/z,-s-3.5/z,2*s+7/z,2*s+7/z);}
  g.restore();}
function drawFacs(g,z){if(z>=.9)for(const f of facs){if(!inView(f.x,f.y,30)||!facVisible(f))continue;if(provs[f.prov].owner!==player&&z<2.5)continue;drawFacIcon(g,f,z);}
  if(ui.mode==='placeFac'&&player>=0){const [wx,wy]=toWorld(ui.mx,ui.my),pi=provAt(wx,wy),ok=pi>=0&&provs[pi].owner===player&&usedSlots(provs[pi])<slots(provs[pi]);
    drawFacIcon(g,{type:ui.facType,prov:pi>=0?pi:0,x:wx,y:wy,state:'build',hp:0,left:1,total:1},Math.max(z,.9),ok?'#4cc38a':'#e5463c');}}

/* =================== ВОЗДУШНЫЙ ДЕСАНТ =================== */
function doAirlift(o,src,t,frac){const c=C[o],a=src.armies[o];if(!a)return 'Нет войск.';
  const u={inf:a.inf*frac,tank:a.tank*frac*.5,art:a.art*frac*.5},n=tot(u);if(n<.3)return 'Слишком мало войск для десанта.';
  const cost=Math.round(n*3);if(c.money<cost&&!(c.isPlayer&&sb.money))return `Нужно ${fM(cost)} на транспортную авиацию.`;c.money-=cost;
  a.inf-=u.inf;a.tank-=u.tank;a.art-=u.art;
  const planes=clamp(Math.ceil(n),1,24),sv=fireSalvo(o,'airlift',src,t.cx,t.cy,planes,'troops');
  for(const p of projs)if(p.sv===sv.id)p.u={inf:u.inf/planes,tank:u.tank/planes,art:u.art/planes};
  if(t.owner===player&&o!==player)toast(`Обнаружен вражеский воздушный десант: ${t.name}!`,'bad');return null;}
function startAirlift(pi){const t=provs[pi];if(!atWar(player,t.owner))return 'Десант возможен только на территорию противника, с которым идёт война.';
  let src=null,bt=0;for(const p of provs){if(p.owner!==player||p.battle)continue;const a=p.armies[player];if(!a||tot(a)<.5)continue;
    if(km(p.cx,p.cy,t.cx,t.cy)>CONFIG.AIRLIFT_RANGE)continue;if(tot(a)>bt){bt=tot(a);src=p;}}
  if(!src)return `Нет ваших войск в пределах ${CONFIG.AIRLIFT_RANGE} км от цели.`;
  const err=doAirlift(player,src,t,ui.frac);if(!err)toast(`Десант вылетел из ${src.name} на ${t.name}`,'ok');return err;}
function specialArrive(p,Wp){const sv=salvos[p.sv];
  if(Wp.special==='airlift'){const pi=provAt(p.tx,p.ty);
    if(pi>=0&&p.u){const P=provs[pi];if(P.owner===p.owner||atWar(p.owner,P.owner)){const a=army(P,p.owner);a.inf+=p.u.inf;a.tank+=p.u.tank;a.art+=p.u.art;
      a.from=provAt(p.sx,p.sy);a.amph=time+24;if(sv)sv.hit++;fx.push({kind:'text',x:p.tx,y:p.ty,t:0,max:1.8,txt:'Десант высадился',col:'#ffd27a'});fogAll();}}}
  else if(Wp.special==='nuke')nukeHit(p.owner,p.tx,p.ty,sv);
  p.dead=true;resolveProj(p);}

/* =================== ЯДЕРНЫЙ УДАР =================== */
let nukePending=null;
function askNuke(x,y){const pi=provAt(x,y);if(pi<0)return 'Цель в море. Выберите город.';const p=provs[pi];
  if(!atWar(player,p.owner))return `С государством «${C[p.owner].name}» нет войны.`;
  if(!((C[player].stock.nuke|0)>0)&&!sb.infStock)return 'Нет ядерных ракет на складе.';
  nukePending={x,y};running=false;setSpeedUI();
  showOver(`<h2>☢ Ядерный удар</h2><p>Цель: <b>${esc(p.name)}</b> (${esc(C[p.owner].name)}).</p>
  <p>Город будет почти уничтожен: 90% войск, все заводы и ПВО в радиусе 150 км. Соседние города тоже пострадают. Союзники цели вступят в войну, а против вас введут санкции: доход −30% на 90 суток. Противник с ядерным оружием может ответить тем же.</p>
  <div style="display:flex;gap:8px"><button class="btn dng" data-act="nukeYes">Подтвердить пуск</button><button class="btn" data-act="nukeNo">Отмена</button></div>`);return 'ask';}
function fireNukeConfirmed(){$('#over').style.display='none';if(!nukePending)return;const {x,y}=nukePending;nukePending=null;
  const err=tryLaunch('nuke',x,y,true);if(err)toast(err,'bad');else{toast('☢ Ядерная ракета запущена','warn');log(`☢ Вы запустили ядерную ракету по городу ${provs[provAt(x,y)].name}.`,'bad');}setMode(null);running=true;setSpeedUI();}
function launchNukeAI(o,tg){const site=nearestOwn(o,tg.cx,tg.cy);if(!site||!((C[o].stock.nuke|0)>0))return;C[o].stock.nuke--;
  fireSalvo(o,'nuke',site,tg.cx,tg.cy,1,'troops');log(`☢ ${C[o].name} запускает ядерную ракету по городу ${tg.name}!`,'bad');
  if(tg.owner===player){toast(`☢ Пуск ядерной ракеты по городу ${tg.name}! Нужна дальняя ПВО.`,'bad');$('#alert').classList.add('on');}}
function nukeHit(o,x,y,sv){const pi=provAt(x,y);fx.push({kind:'nuke',x,y,t:0,max:7});if(pi<0)return;const p=provs[pi],v=p.owner;
  for(const q of [p,...p.nb.map(n=>provs[n])]){const main=q===p,f=main?.9:.35;
    for(const k in q.armies){const a=q.armies[k];a.inf*=1-f;a.tank*=1-f;a.art*=1-f;}
    q.dmg=Math.min(.95,q.dmg+(main?.95:.35));baseDirty.add(q.id);
    for(const fc of facs)if(fc.prov===q.id&&fc.state!=='ruin'){fc.hp-=main?300:40;if(fc.hp<=0){fc.hp=0;fc.state='ruin';}}}
  ads=ads.filter(a=>a.owner===o||km(a.x,a.y,x,y)>150);syncFac();if(sv){sv.hit++;sv.items['город уничтожен ядерным ударом']=1;}
  log(`☢ ЯДЕРНЫЙ УДАР: ${C[o].name} по городу ${p.name} (${C[v].name}).`,'bad');toast(`☢ Ядерный взрыв: ${p.name}`,'bad');
  C[o].sanction=time+24*90;if(o===player)log('Против вас введены санкции: доход −30% на 90 суток.','bad');
  for(const pc of C[v].pacts)for(const mk of pc.m){const x2=CK[mk];if(x2&&x2.alive&&x2.id!==o&&x2.id!==v&&!x2.wars.has(o)&&x2.id!==player&&Math.random()<.9)declareWar(x2.id,o,false,'ответ на ядерный удар');}
  const vc=C[v];if(!vc.isPlayer&&vc.alive&&(vc.stock.nuke|0)>0&&atWar(v,o)){const tg=provs[C[o].capital];if(tg)launchNukeAI(v,tg);}
  panelDirty=true;}
function aiNuke(c){if(c.isPlayer||!c.wars.size||!((c.stock.nuke|0)>0))return;
  const desperate=myProvs(c.id).length<c.initProvs*.5||provs[c.capital].core!==c.id;if(!desperate||Math.random()>.03)return;
  let best=null;for(const e of c.wars)for(const p of provs)if(p.owner===e&&(!best||p.pop>best.pop))best=p;if(best)launchNukeAI(c.id,best);}

/* =================== КОНСТРУКТОР ВООРУЖЕНИЙ =================== */
const DESIGN_BASE={shahed:'Ударный дрон',fpv:'FPV-дроны',cruise:'Крылатая ракета',ballistic:'Баллистическая ракета'};
let dz=null;
function designStats(s){const B=BASE[s.base],rr=typeof B.range==='number'?s.range/B.range:1;
  const cost=B.cost*Math.pow(s.dmg,1.3)*Math.pow(rr,.6)*Math.pow(s.spd/B.spd,.8)*(1+s.stealth*3)*(1+s.ewRes*.6);
  const h=B.h*Math.pow(s.dmg,.7)*(1+s.stealth)*(1+Math.max(0,rr-1)*.2);
  return {cost:Math.max(.5,Math.round(cost*10)/10),h:Math.max(1,Math.round(h)),rnd:Math.round(cost*30+60)};}
function buildCustom(c,s){const B=BASE[s.base],st=designStats(s);
  c.cat[s.key]={...B,t:'w',base:s.base,n:s.name,model:'Своя разработка',cost:st.cost,h:st.h,range:B.range==='front'?'front':Math.round(s.range),spd:Math.round(s.spd),
    stealth:s.stealth,ew:(B.ew||0)*(1-s.ewRes),prio:s.prio,custom:true,dmg:Object.fromEntries(Object.entries(B.dmg||{}).map(([k,v])=>[k,v*s.dmg])),
    d:`${DESIGN_BASE[s.base]} · урон ×${s.dmg}${s.stealth?` · незаметность ${Math.round(s.stealth*100)}%`:''}`};}
function openDesigner(){dz={base:'shahed',name:'',dmg:1,range:BASE.shahed.range,spd:BASE.shahed.spd,stealth:0,ewRes:0,prio:'industry'};running=false;setSpeedUI();renderDesigner();}
function dzSlider(k,label,v,min,max,step,unit){return `<div class="row"><div class="nm"><b>${label}: <span id="dzv_${k}">${dzFmt(k,v,unit)}</span></b><input type="range" data-dz="${k}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${v}" style="width:100%;accent-color:var(--acc)"></div></div>`;}
function dzFmt(k,v,unit){return unit==='%'?Math.round(v*100)+'%':unit==='×'?'×'+v:Math.round(v)+unit;}
function dzSummary(){const st=designStats(dz),B=BASE[dz.base];
  return `<div class="kv"><span>Цена за единицу</span><b>${fM(st.cost)}</b><span>Время производства</span><b>${hrs(st.h)} на линии</b><span>Разработка (разово)</span><b>${fM(st.rnd)}</b>
  <span>Урон по войскам</span><b>${fN(((B.dmg||{}).troops||0)*dz.dmg,2)} × попадание</b><span>Вероятность перехвата</span><b>−${Math.round(dz.stealth*100)}%</b></div>`;}
function renderDesigner(){const B=BASE[dz.base];
  showOver(`<h2>Конструктор вооружений</h2>
  <div class="opt" style="margin-bottom:8px"><span>Основа</span><div class="chips">${Object.keys(DESIGN_BASE).map(k=>`<span class="chip ${dz.base===k?'on':''}" data-act="dzBase" data-k="${k}">${DESIGN_BASE[k]}</span>`).join('')}</div></div>
  <input class="search" id="dzName" maxlength="40" value="${esc(dz.name)}" placeholder="Название, например «Гроза-1»">
  ${dzSlider('dmg','Урон',dz.dmg,.5,5,.25,'×')}
  ${B.range==='front'?'':dzSlider('range','Дальность',dz.range,Math.round(B.range*.5),Math.round(B.range*3),10,' км')}
  ${dzSlider('spd','Скорость',dz.spd,Math.round(B.spd*.5),Math.round(B.spd*2),5,' км/ч')}
  ${dzSlider('stealth','Незаметность (ПВО сбивает реже)',dz.stealth,0,.6,.05,'%')}
  ${B.ew>0?dzSlider('ewRes','Защита от РЭБ',dz.ewRes,0,1,.1,'%'):''}
  <div class="opt" style="margin:10px 0"><span>Назначение</span><div class="chips">${Object.keys(PRIO).map(k=>`<span class="chip ${dz.prio===k?'on':''}" data-act="dzPrio" data-k="${k}">${PRIO[k]}</span>`).join('')}</div></div>
  <div class="card" id="dzSum">${dzSummary()}</div>
  <div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri" data-act="cwSave">Разработать</button><button class="btn" data-act="closeOver">Отмена</button></div>`);}
$('#over').addEventListener('input',e=>{if(!dz)return;const t=e.target;
  if(t.id==='dzName'){dz.name=t.value;return;}
  if(t.dataset.dz){dz[t.dataset.dz]=+t.value;$('#dzv_'+t.dataset.dz).textContent=dzFmt(t.dataset.dz,+t.value,t.dataset.unit);$('#dzSum').innerHTML=dzSummary();}});
function saveDesign(){const c=C[player],name=(dz.name||'').trim();if(!name)return 'Введите название.';
  const st=designStats(dz);if(c.money<st.rnd&&!sb.money)return `На разработку нужно ${fM(st.rnd)}.`;c.money-=st.rnd;
  const s={...dz,name,key:'cw'+(Date.now()%1e8)};c.custom.push(s);buildCustom(c,s);
  $('#over').style.display='none';dz=null;log(`Разработан новый образец: ${name}.`,'ok');toast(`Новый образец: ${name}. Заказывайте его во вкладке «Заводы».`,'ok');renderPanel();return null;}
function customSect(c){let s=`<h3>Свои разработки <button class="btn pri" data-act="designer">Конструктор</button></h3>`;
  const ks=Object.keys(c.cat).filter(k=>c.cat[k].custom);if(!ks.length)s+=`<div class="muted">Создайте своё оружие: задайте урон, дальность, скорость, незаметность и назначение.</div>`;
  for(const k of ks){const it=c.cat[k];s+=`<div class="row"><div class="nm"><b>${esc(it.n)}</b><small>${esc(it.d)} · ${hrs(it.h)} на линии · на складе ${c.stock[k]|0}</small></div><button class="btn" data-act="order" data-k="${k}" ${c.money<it.cost*ui.qty?'disabled':''}>${fM(it.cost*ui.qty)}</button></div>`;}
  return s;}

/* =================== ВИД БПЛА, РАКЕТ И СБИТИЙ =================== */
function projKind(W_){return W_.special==='airlift'?'transport':W_.special==='nuke'?'nuke':W_.reveal?'recon':W_.cls;}
function drawProj(g,p,z){const W_=C[p.owner].cat[p.w],kind=projKind(W_),col=p.owner===player?COL.own:atWar(player,p.owner)?COL.enemy:COL.neutral;
  if(p.tr&&p.tr.length>=4&&!drawProj.lite){const hot=kind==='cruise'||kind==='ballistic'||kind==='nuke',n=kind==='small'?5:kind==='transport'?14:hot?34:10,st=Math.max(0,p.tr.length-n*2);
    g.strokeStyle=hot?'rgba(235,235,235,.4)':p.owner===player?'rgba(31,111,209,.35)':'rgba(217,58,47,.35)';g.lineWidth=(hot?2:1.1)/z;
    g.beginPath();g.moveTo(p.tr[st],p.tr[st+1]);for(let i=st+2;i<p.tr.length;i+=2)g.lineTo(p.tr[i],p.tr[i+1]);g.lineTo(p.x,p.y);g.stroke();}
  if(drawProj.lite){const col2=p.owner===player?COL.own:atWar(player,p.owner)?COL.enemy:COL.neutral,r=3/z;g.fillStyle=col2;g.beginPath();g.moveTo(p.x+Math.cos(p.hd)*r*1.8,p.y+Math.sin(p.hd)*r*1.8);g.lineTo(p.x+Math.cos(p.hd+2.5)*r,p.y+Math.sin(p.hd+2.5)*r);g.lineTo(p.x+Math.cos(p.hd-2.5)*r,p.y+Math.sin(p.hd-2.5)*r);g.fill();return;}
  const s=({small:6,drone:11,recon:12,uav:12,cruise:10,ballistic:10,nuke:12,transport:16}[kind]||9)/z,fl=.7+.3*Math.sin(performance.now()/40+p.id);
  g.save();g.translate(p.x,p.y);g.rotate(p.hd);g.fillStyle=col;g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=1/z;g.lineJoin='round';
  const flame=(x,len,w)=>{g.fillStyle=`rgba(255,${150+Math.round(80*fl)},40,.95)`;g.beginPath();g.moveTo(x,-w);g.lineTo(x-len*fl,0);g.lineTo(x,w);g.closePath();g.fill();g.fillStyle=col;};
  if(kind==='small'){const quad=(dx,dy,r)=>{g.save();g.translate(dx,dy);g.strokeStyle=col;g.lineWidth=1.6/z;g.beginPath();g.moveTo(-r,-r);g.lineTo(r,r);g.moveTo(r,-r);g.lineTo(-r,r);g.stroke();
      g.fillStyle='rgba(255,255,255,.75)';g.strokeStyle=col;g.lineWidth=.9/z;for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){g.beginPath();g.arc(a*r,b*r,r*.55,0,7);g.fill();g.stroke();}g.fillStyle=col;g.fillRect(-r*.35,-r*.35,r*.7,r*.7);g.restore();};
    quad(0,0,s*.7);if(p.n>1){quad(-s*1.4,s*1.1,s*.55);quad(-s*1.4,-s*1.1,s*.55);}}
  else if(kind==='drone'){g.beginPath();g.moveTo(s,0);g.lineTo(-.5*s,1.1*s);g.lineTo(-.78*s,1.1*s);g.lineTo(-.45*s,0);g.lineTo(-.78*s,-1.1*s);g.lineTo(-.5*s,-1.1*s);g.closePath();g.fill();g.stroke();
    g.strokeStyle=col;g.lineWidth=1.8/z;g.beginPath();g.moveTo(-.85*s,1.1*s);g.lineTo(-.45*s,1.1*s);g.moveTo(-.85*s,-1.1*s);g.lineTo(-.45*s,-1.1*s);g.stroke();
    g.fillStyle='rgba(255,255,255,.6)';g.beginPath();g.ellipse(-.6*s,0,.08*s,.3*s,0,0,7);g.fill();}
  else if(kind==='recon'||kind==='uav'){g.fillRect(-s,-.12*s,1.9*s,.24*s);g.fillRect(-.05*s,-1.5*s,.32*s,3*s);g.strokeRect(-.05*s,-1.5*s,.32*s,3*s);
    g.strokeStyle=col;g.lineWidth=1.6/z;g.beginPath();g.moveTo(-.85*s,0);g.lineTo(-1.15*s,.5*s);g.moveTo(-.85*s,0);g.lineTo(-1.15*s,-.5*s);g.stroke();}
  else if(kind==='cruise'){flame(-s,.6*s,.12*s);g.beginPath();g.moveTo(1.05*s,0);g.lineTo(.8*s,-.14*s);g.lineTo(-s,-.14*s);g.lineTo(-s,.14*s);g.lineTo(.8*s,.14*s);g.closePath();g.fill();g.stroke();
    g.beginPath();g.moveTo(.05*s,-.14*s);g.lineTo(-.2*s,-.75*s);g.lineTo(-.35*s,-.75*s);g.lineTo(-.25*s,-.14*s);g.moveTo(.05*s,.14*s);g.lineTo(-.2*s,.75*s);g.lineTo(-.35*s,.75*s);g.lineTo(-.25*s,.14*s);g.fill();
    g.beginPath();g.moveTo(-.75*s,-.14*s);g.lineTo(-1*s,-.4*s);g.lineTo(-1*s,.4*s);g.lineTo(-.75*s,.14*s);g.fill();}
  else if(kind==='ballistic'||kind==='nuke'){flame(-.9*s,1.1*s,.2*s);if(kind==='nuke')g.fillStyle='#f5c518';
    g.beginPath();g.moveTo(1.15*s,0);g.lineTo(.6*s,-.2*s);g.lineTo(-.9*s,-.2*s);g.lineTo(-.9*s,.2*s);g.lineTo(.6*s,.2*s);g.closePath();g.fill();g.stroke();
    g.beginPath();g.moveTo(-.55*s,-.2*s);g.lineTo(-.95*s,-.55*s);g.lineTo(-.95*s,.55*s);g.lineTo(-.55*s,.2*s);g.fill();
    if(kind==='nuke'){g.fillStyle='#111';g.fillRect(.1*s,-.2*s,.18*s,.4*s);}}
  else if(kind==='transport'){g.fillRect(-s,-.17*s,2.05*s,.34*s);g.beginPath();g.moveTo(.25*s,-.15*s);g.lineTo(-.25*s,-1.35*s);g.lineTo(-.48*s,-1.35*s);g.lineTo(-.18*s,-.15*s);
    g.moveTo(.25*s,.15*s);g.lineTo(-.25*s,1.35*s);g.lineTo(-.48*s,1.35*s);g.lineTo(-.18*s,.15*s);g.fill();g.beginPath();g.moveTo(-.75*s,-.1*s);g.lineTo(-1*s,-.55*s);g.lineTo(-1.08*s,-.55*s);g.lineTo(-.95*s,0);g.lineTo(-1.08*s,.55*s);g.lineTo(-1*s,.55*s);g.lineTo(-.75*s,.1*s);g.fill();
    g.fillStyle='rgba(255,255,255,.8)';for(const y of [-.75,-.45,.45,.75]){g.beginPath();g.arc(-.1*s+Math.abs(y)*-.3*s,y*s,.08*s,0,7);g.fill();}}
  else{g.beginPath();g.arc(0,0,s*.6,0,7);g.fill();}
  g.restore();
  if(p.n>1&&z>1.2){g.font=`600 ${9/z}px Consolas,monospace`;g.textAlign='left';g.textBaseline='bottom';halo(g,'×'+p.n,p.x+7/z,p.y-5/z,z,col);}}
function drawInt(g,it,z){
  if(it.dr){if(it.tr.length>=4){g.strokeStyle='rgba(227,165,26,.5)';g.lineWidth=1/z;g.beginPath();g.moveTo(it.tr[0],it.tr[1]);for(let j=2;j<it.tr.length;j+=2)g.lineTo(it.tr[j],it.tr[j+1]);g.lineTo(it.x,it.y);g.stroke();}
    const r=3.4/z;g.save();g.translate(it.x,it.y);g.strokeStyle='#e3a51a';g.lineWidth=1.4/z;g.beginPath();g.moveTo(-r,-r);g.lineTo(r,r);g.moveTo(r,-r);g.lineTo(-r,r);g.stroke();
    g.fillStyle='#fff3c4';for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){g.beginPath();g.arc(a*r,b*r,r*.5,0,7);g.fill();}g.restore();return;}
  g.strokeStyle='rgba(180,120,10,.85)';g.lineWidth=1.2/z;g.beginPath();
  if(it.tr.length>=2){g.moveTo(it.tr[0],it.tr[1]);for(let j=2;j<it.tr.length;j+=2)g.lineTo(it.tr[j],it.tr[j+1]);}else g.moveTo(it.x,it.y);g.lineTo(it.x,it.y);g.stroke();
  g.fillStyle='#fff8d6';g.beginPath();g.arc(it.x,it.y,2/z,0,7);g.fill();}
function shotFx(p,how,final){const W_=C[p.owner].cat[p.w],big=final?({small:3,drone:7,uav:8,cruise:9,ballistic:11}[W_.cls]||6):2;
  boom(p.x,p.y,big,how==='ew'?'#7aa2ff':'#ff8a2b');
  if(final){const fr=[];for(let i=0;i<8;i++)fr.push({a:Math.random()*7,v:R(.4,1.4),rot:R(-8,8)});
    fx.push({kind:'debris',x:p.x,y:p.y,t:0,max:1.8,fr});
    if(fx.filter(q=>q.kind==='text').length<8&&fx.filter(q=>q.kind==='text'&&Math.hypot(q.x-p.x,q.y-p.y)<S*.25).length<1)fx.push({kind:'text',x:p.x,y:p.y,t:0,max:1.6,txt:how==='ew'?'Подавлен РЭБ':W_.special==='airlift'?'Самолёт сбит':'Сбит',col:how==='ew'?'#7aa2ff':'#ffd27a'});}}
function drawFx(g,f,k,z){if(f.kind!=='nuke'&&(!inView(f.x,f.y,80)||!visibleToPlayer(f.x,f.y)))return;
  if(f.kind==='debris'){const d=(8+30*k)/z;g.save();g.translate(f.x,f.y);
    g.fillStyle=`rgba(60,60,60,${.4*(1-k)})`;g.beginPath();g.arc(0,-6*k/z,(4+12*k)/z,0,7);g.fill();
    for(const q of f.fr){g.save();g.translate(Math.cos(q.a)*d*q.v,Math.sin(q.a)*d*q.v+k*k*16/z);g.rotate(q.rot*k);g.globalAlpha=1-k;g.fillStyle=k<.25?'#ffb347':'#2d3238';g.fillRect(-2.2/z,-1/z,4.4/z,2/z);g.restore();}
    g.restore();g.globalAlpha=1;}
  else if(f.kind==='text'){if(z<2.2)return;g.font=`700 ${11/z}px "Segoe UI",sans-serif`;g.textAlign='center';g.textBaseline='bottom';g.globalAlpha=1-k*k;
    halo(g,f.txt,f.x,f.y-(10+20*k)/z,z,f.col==='#7aa2ff'?'#1f4fb0':'#a14a05');g.globalAlpha=1;}
  else if(f.kind==='nuke'){const pk=v=>v/111.32*S,t=f.t;if(!inView(f.x,f.y,pk(400)))return;
    if(t<.7){g.fillStyle=`rgba(255,255,240,${.95*(1-t/.7)})`;g.beginPath();g.arc(f.x,f.y,pk(140),0,7);g.fill();}
    const wr=pk(30+320*Math.min(1,t/2.5));g.strokeStyle=`rgba(255,235,190,${Math.max(0,.85-t/3)})`;g.lineWidth=Math.max(2/z,pk(5));g.beginPath();g.arc(f.x,f.y,wr,0,7);g.stroke();
    const fr=pk(22+22*Math.min(1,t/1.5)),gr=g.createRadialGradient(f.x,f.y,0,f.x,f.y,fr);
    gr.addColorStop(0,`rgba(255,250,210,${Math.max(0,1-t/4)})`);gr.addColorStop(.5,`rgba(255,130,30,${Math.max(0,.9-t/5)})`);gr.addColorStop(1,'rgba(120,40,20,0)');g.fillStyle=gr;g.beginPath();g.arc(f.x,f.y,fr,0,7);g.fill();
    const cr=pk(30+45*Math.min(1,t/3)),ca=Math.max(0,.6-t/(f.max*1.3));g.fillStyle=`rgba(95,85,80,${ca})`;
    for(let i=0;i<9;i++){const a=i/9*Math.PI*2+t*.25;g.beginPath();g.arc(f.x+Math.cos(a)*cr*.6,f.y+Math.sin(a)*cr*.6-pk(12)*Math.min(1,t),cr*.45,0,7);g.fill();}
    g.font=`800 ${20/z}px "Segoe UI",sans-serif`;g.textAlign='center';g.textBaseline='bottom';g.fillStyle=`rgba(255,215,60,${Math.max(0,1-t/f.max)})`;g.fillText('☢',f.x,f.y-cr-6/z);}}

/* =================== ИИ: ПРИЦЕЛЬНЫЕ УДАРЫ ПО ВАЖНЫМ ЦЕЛЯМ =================== */
aiStrike=function(c){const my=myProvs(c.id);if(!my.length)return;const st=c.stock;
  for(const e of c.wars){const ec=C[e];if(!ec.alive)continue;
    if(Math.random()<(e===player?.5:.65)){const T=[];
      for(const f of facs){if(provs[f.prov].owner!==e||f.state==='ruin')continue;T.push({x:f.x,y:f.y,w:f.type==='drone'?9:f.type==='mil'?8:4,prio:'industry'});}
      for(const a of ads){if(a.owner!==e||a.type==='ew')continue;T.push({x:a.x,y:a.y,w:a.type==='lrsam'?7:3,prio:'ad'});}
      const cap=provs[ec.capital];if(cap&&cap.owner===e)T.push({x:cap.cx,y:cap.cy,w:6,prio:'energy'});
      for(const p of provs)if(p.owner===e&&p.level>=2)T.push({x:p.cx,y:p.cy,w:1+p.level,prio:'energy'});
      for(const t of T){t.s=t.w*R(.5,1.5);}T.sort((a,b)=>b.s-a.s);
      let done=0;for(const t of T){if(done>=2)break;const site=nearestOwn(c.id,t.x,t.y);if(!site)continue;const d=km(site.cx,site.cy,t.x,t.y);if(d>CONFIG.AI_INTEL_KM&&t.w<6)continue;let used=false;
        const ns=Math.min(st.shahed|0,Math.max(4,Math.round((st.shahed|0)*R(.06,.15))));
        if(ns>0&&d<=c.cat.shahed.range){st.shahed-=ns;fireSalvo(c.id,'shahed',site,t.x,t.y,ns,t.prio);used=true;}
        if((st.cruise|0)>1&&Math.random()<.5&&d<=c.cat.cruise.range&&t.w>=6){const n=Math.min(st.cruise,RI(2,6));st.cruise-=n;fireSalvo(c.id,'cruise',site,t.x,t.y,n,t.prio);used=true;}
        if((st.ballistic|0)>0&&Math.random()<.35&&d<=c.cat.ballistic.range&&t.w>=7){const n=Math.min(st.ballistic,RI(1,3));st.ballistic-=n;fireSalvo(c.id,'ballistic',site,t.x,t.y,n,t.prio);used=true;}
        if(used)done++;}}
    if(Math.random()<.04){let best=null,src=null;
      for(const p of provs){if(p.owner!==c.id||p.battle)continue;const a=p.armies[c.id];if(!a||tot(a)<15)continue;
        for(const q of provs){if(q.owner!==e)continue;const D=pw(q.armies[e],'def');if(D>3||km(p.cx,p.cy,q.cx,q.cy)>Math.min(CONFIG.AIRLIFT_RANGE,CONFIG.AI_INTEL_KM))continue;if(!best||q.level>best.level){best=q;src=p;}}}
      if(best)doAirlift(c.id,src,best,.3);}
    for(const p of provs){if(!(p.armies[c.id]&&tot(p.armies[c.id])>.3))continue;
      for(const n of p.nb){const q=provs[n];const ea=q.armies[e];if(!ea||tot(ea)<.1)continue;
        if((st.fpv|0)>0&&Math.random()<.4){const k=Math.min(st.fpv,RI(1,3));st.fpv-=k;fireSalvo(c.id,'fpv',p,q.cx,q.cy,k,'troops');}
        break;}}}};
