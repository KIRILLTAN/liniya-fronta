'use strict';
/* Отряды и управление ими, флот, авиация, отряды дронов, прочность городов, радиация, дипломатия,
   производство заводов, исправления логики и оптимизация. Подключается после features2.js. */

const mp={role:null,silent:false,applying:false};

/* =================== ДАННЫЕ: ДАЛЬНОСТЬ, ЦЕНЫ, НОВЫЕ ОБРАЗЦЫ =================== */
for(const k in WPN){const w=WPN[k];if(typeof w.range==='number'&&k!=='nuke'&&k!=='airlift'){w.range=Math.round(w.range*CONFIG.RANGE_MULT);if(BASE[k])BASE[k].range=w.range;}}
WPN.airlift.range=BASE.airlift.range=CONFIG.AIRLIFT_RANGE;
for(const o of [WPN.nuke,BASE.nuke]){o.cost=CONFIG.NUKE_COST;o.h=24*CONFIG.NUKE_DAYS;o.spd=CONFIG.NUKE_SPEED;o.d='Стирает город и оставляет радиоактивное облако. Очень дорогая';}
// урон по городу и по пехоте: дроны снова заметно бьют по солдатам
WPN.fpv.dmg.troops=.06;WPN.shahed.dmg.troops=1;
const CITY_DMG={fpv:.05,shahed:1.2,cruise:4,ballistic:6,bomber:3};for(const k in CITY_DMG)if(WPN[k])WPN[k].dmg.city=CITY_DMG[k];
WPN.bomber={n:'Бомбардировщики',cls:'uav',cost:120,h:24*10,fac:'mil',range:CONFIG.AIR_RANGE,spd:750,bombs:6,stealth:.35,ew:0,special:'sortie',
  dmg:{troops:2.5,ad:.2,industry:.25,energy:.08,city:3},d:'Авиация: бомбит цель и возвращается на базу'};
BASE.bomber={...WPN.bomber,t:'w'};
const SHIPS={
  transport:{n:'Транспорт',cost:60,h:24*8,hp:60,atk:1,d:'Перевозит войска, дроны и ракеты'},
  warship:{n:'Боевой корабль',cost:180,h:24*14,hp:160,atk:14,d:'Топит корабли в радиусе 150 км, сбивает дроны рядом'},
  carrier:{n:'Носитель дронов',cost:260,h:24*18,hp:180,atk:2,d:'Запускает дроны с моря, берёт до 200 штук'}};
for(const k in SHIPS)BASE['ship_'+k]={...SHIPS[k],t:'s',fac:'mil',ship:k};
slots=function(p){return CONFIG.FACTORY_SLOTS_BASE+p.level*CONFIG.FACTORY_SLOTS_PER_LEVEL+(p.capital?CONFIG.CAPITAL_EXTRA_SLOTS:0);};
function effRange(c,Wp){return (typeof Wp.range==='number'?Wp.range:0)*(1+CONFIG.RANGE_UP_STEP*(c.rangeUp||0));}

/* =================== СОСТОЯНИЕ НОВЫХ СИСТЕМ =================== */
let ships=[],shipId=0,wings=[],squads=[],wingId=0,zones=[],warInfo={},moveId=0;
ui.selU=new Set();ui.filt='all';ui.box=null;
const wkey=(a,b)=>a<b?a+'|'+b:b+'|'+a;

/* =================== ГОРОДА: ПРОЧНОСТЬ, РАДИАЦИЯ, ВОССТАНОВЛЕНИЕ =================== */
function cityProd(p){const integ=p.integ??100,rec=clamp((time-(p.capT??-1e9))/(24*CONFIG.CAPTURE_RECOVERY_DAYS),.2,1);
  return (.3+.7*integ/100)*(1-.7*(p.rad||0))*rec;}
provIncome=function(p){return (CITY_INCOME[p.level]+(p.capital?15:0)+p.b.civ*4)*(1-p.dmg)*(p.core===p.owner?1:.7)*cityProd(p);};
cityDef=function(p){return TERR[p.terrain].def*(1+.25*p.fort)*(1+.15*p.level)*(p.capital?1.3:1)*(.5+.5*(p.integ??100)/100);};
function militia(p){return p.level*1.5*TERR[p.terrain].def*((p.integ??100)/100)*(p.capital?1.5:1);}
function cityHit(p,D,hits,sv,o,prio){const dmg=(D.city!=null?D.city:D.troops*.5)*hits*R(.7,1.3);const b=p.integ??100;
  p.integ=Math.max(0,b-dmg);p.pop=Math.max(.01,p.pop*(1-.0004*dmg));if(sv)sv.cityDmg=(sv.cityDmg||0)+(b-p.integ);
  if(prio!=='troops'){const hostile=Object.keys(p.armies).map(Number).filter(q=>atWar(o,q)&&tot(p.armies[q])>.01);for(const q of hostile)loss(p.armies[q],D.troops*hits*.25/hostile.length);}
  baseDirty.add(p.id);}
function cityHour(){const h=Math.round(time);
  for(const p of provs){if(p.integ==null)p.integ=100;
    if(p.battle&&p.siege){const att=p.armies[p.siege.att];if(att&&att.art>0)p.integ=Math.max(0,p.integ-Math.min(2,att.art*.04));}
    else if(p.integ<100)p.integ=Math.min(100,p.integ+CONFIG.CITY_REPAIR_PER_DAY/24);
    // приказ «идти дальше»: после взятия города отряд сам продолжает путь к цели
    const a=p.armies[p.owner];if(a&&a.goal!=null&&!p.battle&&a.goal!==p.id&&tot(a)>.05&&(a.rest||0)<=time&&!moves.some(m=>m.owner===p.owner&&m.path[0]===p.id)){const g=a.goal;delete a.goal;sendArmy(p.owner,p.id,g,1);const n=moves[moves.length-1];if(n&&n.owner===p.owner)n.goal=g;}}
  for(const m of moves)if(tot(m.u)<.02)m.done=true;moves=moves.filter(m=>!m.done);
  if(h%24===5){dipDaily();for(const c of C)if(c.alive&&!c.isPlayer&&h%24===5)aiExtra(c);for(const c of C)if(c.alive)c.rep=Math.min(100,(c.rep??70)+CONFIG.REP_RECOVERY_PER_DAY);}}
function radHour(){for(const p of provs)p.rad=0;
  for(const z of zones){z.I-=1/(24*CONFIG.RAD_DAYS);if(z.I<=0)continue;
    for(const p of provs){const d=km(p.cx,p.cy,z.x,z.y);if(d>z.r)continue;const r=z.I*(1-d/z.r);p.rad=Math.max(p.rad,r);}
    for(const s of ships)if(km(s.x,s.y,z.x,z.y)<z.r)s.hp-=1.5*z.I;}
  zones=zones.filter(z=>z.I>.01);
  for(const p of provs)if(p.rad>0){for(const k in p.armies)loss(p.armies[k],hpSum(p.armies[k])*CONFIG.RAD_TROOP_LOSS*p.rad);p.pop=Math.max(.01,p.pop*(1-CONFIG.RAD_POP_LOSS*p.rad));}}

/* =================== ЗАВОДЫ: ПОСТОЯННОЕ ПРОИЗВОДСТВО =================== */
let facsBy=null,facsByT=-1;
function facsOf(o){if(facsByT!==time||!facsBy){facsBy=new Map();facsByT=time;for(const f of facs){const w=provs[f.prov].owner;let a=facsBy.get(w);if(!a)facsBy.set(w,a=[]);a.push(f);}}return facsBy.get(o)||[];}
function capOn(c){return c.isPlayer&&c.spendCap!==false;}
function freeMoney(c){return Math.max(0,c.budget-c.upk);}
production=function(c){const pm=c.isPlayer?1.25:1,pool={mil:0,drone:0};if(capOn(c))c.allow=Math.min((c.allow||0)+freeMoney(c)/24,freeMoney(c)*CONFIG.FACTORY_SPEND_DAYS);const hasQ={mil:false,drone:false};for(const q of c.queue)if(!q.imp&&c.cat[q.k])hasQ[c.cat[q.k].fac]=true;
  for(const f of facsOf(c.id)){const p=provs[f.prov];if(f.state!=='ok'||f.type==='civ'){f.rate=0;continue;}
    const cap=LINES[f.type]*f.hp/100*(1-p.dmg)*cityProd(p)*pm;f.rate=cap;
    const it=f.prod&&c.cat[f.prod];
    if(it&&it.fac===f.type){f.prog=(f.prog||0)+cap;
      if(f.prog>=it.h){const cost=it.cost*CONFIG.FACTORY_DISCOUNT;
        if(c.money<cost){f.prog=it.h;f.status='nomoney';}else if(capOn(c)&&c.allow<cost){f.prog=it.h;f.status='limit';}
        else{c.money-=cost;if(capOn(c))c.allow-=cost;f.prog-=it.h;deliver(c,f.prod,1,f.dest??null);f.made=(f.made||0)+1;f.status='ok';}}else f.status='ok';}
    else{pool[f.type]+=cap;f.status=hasQ[f.type]?'queue':'idle';}}
  c.lines=pool;const cap={...pool};
  for(const q of c.queue){if(q.imp){if(time>=q.eta){deliver(c,q.k,q.qty,q.dest);q.left=0;if(q.mob&&c.isPlayer)log(`Мобилизованные прошли подготовку: ${q.qty} отр.`,'ok');}continue;}
    const it=c.cat[q.k];if(!it){q.left=0;continue;}const f=it.fac;q.stalled=cap[f]<=0;if(cap[f]<=0)continue;const use=Math.min(cap[f],q.left);cap[f]-=use;q.prog+=use;
    while(q.prog>=it.h&&q.left>0){q.prog-=it.h;q.left--;deliver(c,q.k,1,q.dest);}}
  c.queue=c.queue.filter(q=>q.left>0);
  if(c.isPlayer){const ks=Object.keys(c.deliv);if(ks.length){log('Выпущено: '+ks.map(k=>`${nm(c,k)} ×${c.deliv[k]}`).join(', ')+'.','ok');c.deliv={};panelDirty=true;}
    if(c.queue.some(q=>q.stalled)&&!c.stallWarned){c.stallWarned=true;toast('Заказ стоит: нет заводов нужного типа. Постройте военный завод или завод дронов.','warn');}
    if(!c.queue.some(q=>q.stalled))c.stallWarned=false;}};
const _deliver=deliver;
deliver=function(c,k,n,dest){const it=c.cat[k]||BASE[k];if(it&&it.t==='s'){for(let i=0;i<n;i++)shipDeliver(c,it.ship,dest);return;}return _deliver(c,k,n,dest);};
// сколько в сутки стоит постоянный выпуск заводов (каждая единица оплачивается из казны)
function prodCostFull(c){let s=0;for(const f of facsOf(c.id)){if(f.state!=='ok'||!f.prod)continue;const it=c.cat[f.prod];if(!it||it.fac!==f.type)continue;s+=(f.rate||LINES[f.type])*24/it.h*it.cost*CONFIG.FACTORY_DISCOUNT;}return s;}
function prodCost(c){const s=prodCostFull(c);return capOn(c)?Math.min(s,freeMoney(c)):s;}
function prodName(c,k){return k?(c.cat[k]?c.cat[k].n:k):'по заказам';}
function facProdOptions(c,f){const keys=Object.keys(c.cat).filter(k=>c.cat[k].fac===f.type&&!c.cat[k].hidden&&(k!=='nuke'||canMake(c,'nuke')));
  return `<option value="">по заказам</option>`+keys.map(k=>`<option value="${k}" ${f.prod===k?'selected':''}>${esc(c.cat[k].n)}</option>`).join('');}
function setFacProd(fid,k,dest){const f=facs.find(x=>x.id===fid);if(!f)return;f.prod=k||null;f.prog=0;f.dest=dest??null;panelDirty=true;}
function facRateText(c,f){if(f.type==='civ')return f.state==='ok'?`+${fN(4*f.hp/100,1)} млн $/сут.`:'';if(f.state!=='ok')return '';
  const it=f.prod&&c.cat[f.prod];if(!it)return f.status==='queue'?'работает по заказам':'простаивает — нет заказов';
  const perDay=(f.rate||LINES[f.type])*24/it.h;return `${esc(it.n)}: ${perDay>=1?fN(perDay,1)+' шт./сут.':'1 шт. за '+fN(it.h/(f.rate||1)/24,1)+' сут.'}${f.status==='nomoney'?' · <span style="color:var(--red)">нет денег</span>':f.status==='limit'?' · <span style="color:var(--acc)">ждёт свободных денег</span>':''}`;}
pc.addEventListener('change',e=>{const t=e.target;if(t.dataset.facprod){const f=facs.find(x=>x.id===+t.dataset.facprod);if(f)cmdRun('setFacProd',[f.id,t.value||null,t.value&&BASE[t.value]&&BASE[t.value].t==='g'?f.prov:null]);}});
function drawFacProd(g,z){if(z<1.6)return;for(const f of facs){if(f.state!=='ok'||provs[f.prov].owner!==player||!inView(f.x,f.y,30))continue;const c=C[player];
  const it=f.prod&&c.cat[f.prod];if(!it)continue;const s=7.5/z,pr=clamp((f.prog||0)/it.h,0,1);
  g.strokeStyle=f.status==='nomoney'?'#e5463c':f.status==='limit'?'#e3b341':'#4cc38a';g.lineWidth=2.4/z;g.beginPath();g.arc(f.x,f.y,s*1.55,-Math.PI/2,-Math.PI/2+pr*Math.PI*2);g.stroke();
  if(z>3){g.font=`600 ${9/z}px "Segoe UI",sans-serif`;g.textAlign='center';g.textBaseline='top';halo(g,it.n.replace(/\s*\(.*\)/,''),f.x,f.y+s+7/z,z,'#1d2630');}}}
function drawCityState(g,z){if(z<1)return;for(const p of provs){if(!p.city||!inView(p.cx,p.cy,30))continue;const integ=p.integ??100;if(integ>=95||(started&&ui.fog&&!p.vis&&p.owner!==player))continue;
  const r=9/z;g.strokeStyle='rgba(20,25,30,.5)';g.lineWidth=3/z;g.beginPath();g.arc(p.cx,p.cy,r,0,7);g.stroke();
  g.strokeStyle=integ>50?'#e3b341':'#e5463c';g.lineWidth=2.4/z;g.beginPath();g.arc(p.cx,p.cy,r,-Math.PI/2,-Math.PI/2+integ/100*Math.PI*2);g.stroke();}}

/* =================== УДАРЫ ПО ОТРЯДАМ НА МАРШЕ И КОРАБЛЯМ =================== */
function movePos(m){const a=provs[m.path[m.i]],b=provs[m.path[m.i+1]];if(!b)return [a.cx,a.cy];const f=1-m.left/m.hop;return [a.cx+(b.cx-a.cx)*f,a.cy+(b.cy-a.cy)*f];}
function hitUnitsAt(o,wk,x,y,hits,sv){const D=C[o].cat[wk].dmg||{};
  for(const m of moves){if(!atWar(o,m.owner))continue;const [mx,my]=movePos(m);if(km(mx,my,x,y)>30)continue;const b=tot(m.u);loss(m.u,(D.troops||0)*hits*.8);if(sv)sv.troops=(sv.troops||0)+b-tot(m.u);}
  for(const s of ships){if(!atWar(o,s.owner)||km(s.x,s.y,x,y)>25)continue;const dmg=((D.troops||0)*6+(D.city||0)*2)*hits*R(.7,1.3);s.hp-=dmg;if(sv)sv.items[`повреждён корабль: ${SHIPS[s.type].n.toLowerCase()}`]=1;}}

/* =================== ФЛОТ =================== */
const WS=3,wW=Math.ceil(GW/WS),wH=Math.ceil(GH/WS);let wmask=null;
const STRAITS=[[[41.25,29.1],[41.0,28.98],[40.65,27.4],[40.3,26.6],[40.05,26.15]],[[56.1,12.6],[55.6,12.75],[55.3,12.9]],[[45.4,36.55],[45.15,36.5]],[[31.25,32.3],[30.6,32.33],[30.0,32.55],[29.9,32.55]],[[9.35,-79.9],[9.1,-79.7],[8.9,-79.55]],[[54.3,10.1],[54.5,10.3]],[[1.3,103.8],[1.2,103.6]]];
function carveStraits(){for(const pts of STRAITS)for(let i=0;i+1<pts.length;i++){const [a,b]=[pts[i],pts[i+1]];const n=30;for(let k=0;k<=n;k++){const la=a[0]+(b[0]-a[0])*k/n,lo=a[1]+(b[1]-a[1])*k/n;const [bx,by]=bOf(xLon(lo),yLat(la));wmask[by*wW+bx]=1;}}}
function buildWater(){wmask=new Uint8Array(wW*wH);for(let by=0;by<wH;by++)for(let bx=0;bx<wW;bx++){let n=0;
  for(let dy=0;dy<WS;dy++)for(let dx=0;dx<WS;dx++){const x=bx*WS+dx,y=by*WS+dy;if(x<GW&&y<GH&&cellProv[y*GW+x]<0)n++;}wmask[by*wW+bx]=n>=4?1:0;}carveStraits();}
const bOf=(x,y)=>[clamp((x/CELL/WS)|0,0,wW-1),clamp((y/CELL/WS)|0,0,wH-1)],bPos=(bx,by)=>[(bx+.5)*WS*CELL,(by+.5)*WS*CELL];
function nearestWater(x,y,maxR=40){if(!wmask)buildWater();const [bx,by]=bOf(x,y);if(wmask[by*wW+bx])return [bx,by];
  for(let r=1;r<=maxR;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.abs(dx)!==r&&Math.abs(dy)!==r)continue;const X=bx+dx,Y=by+dy;if(X<0||Y<0||X>=wW||Y>=wH)continue;if(wmask[Y*wW+X])return [X,Y];}return null;}
function portOf(p){if(p.port===undefined){const w=p.coastal?nearestWater(p.cx,p.cy,12):null;p.port=w?bPos(w[0],w[1]):null;}return p.port;}
function waterPath(x1,y1,x2,y2){if(!wmask)buildWater();const s=nearestWater(x1,y1),t=nearestWater(x2,y2);if(!s||!t)return null;
  const N=wW*wH,gs=new Float32Array(N).fill(1e9),prev=new Int32Array(N).fill(-1),closed=new Uint8Array(N),S0=s[1]*wW+s[0],T0=t[1]*wW+t[0];
  const heap=[],push=(i,f)=>{heap.push([f,i]);let k=heap.length-1;while(k>0){const pk=(k-1)>>1;if(heap[pk][0]<=heap[k][0])break;[heap[pk],heap[k]]=[heap[k],heap[pk]];k=pk;}},
    pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let k=0;for(;;){const l=2*k+1,r=l+1;let m=k;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===k)break;[heap[m],heap[k]]=[heap[k],heap[m]];k=m;}}return top;};
  const hcost=i=>{const x=i%wW,y=(i/wW)|0;return Math.hypot((x-t[0])*Math.cos(latY((y+.5)*WS*CELL)*RAD),y-t[1]);};
  gs[S0]=0;push(S0,hcost(S0));let it=0;
  while(heap.length&&it++<400000){const [,i]=pop();if(closed[i])continue;closed[i]=1;if(i===T0)break;const x=i%wW,y=(i/wW)|0,cl=Math.cos(latY((y+.5)*WS*CELL)*RAD);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;let X=x+dx;const Y=y+dy;if(Y<0||Y>=wH)continue;if(X<0)X=wW-1;if(X>=wW)X=0;const j=Y*wW+X;if(!wmask[j]||closed[j])continue;
      const g=gs[i]+Math.hypot(dx*cl,dy);if(g<gs[j]){gs[j]=g;prev[j]=i;push(j,g+hcost(j));}}}
  if(prev[T0]<0&&S0!==T0)return null;const pts=[];for(let i=T0;i!==-1;i=prev[i]){const [px,py]=bPos(i%wW,(i/wW)|0);pts.unshift([px,py]);if(i===S0)break;}
  const out=[];for(let i=0;i<pts.length;i+=3)out.push(pts[i]);out.push(pts[pts.length-1]);out.push([x2,y2]);return out;}
function shipSpawn(o,type,p){const port=portOf(p);if(!port)return null;const s={id:++shipId,owner:o,type,x:port[0]+R(-2,2),y:port[1]+R(-2,2),hp:SHIPS[type].hp,path:null,dest:null,cargo:{u:{inf:0,tank:0,art:0}},hd:0,cd:0};ships.push(s);return s;}
function shipDeliver(c,type,dest){if(c.isPlayer){const d=depot(c);d.ships=d.ships||{};d.ships[type]=(d.ships[type]||0)+1;}
  else{const p=myProvs(c.id).filter(q=>portOf(q)).sort((a,b)=>b.pop-a.pop)[0];if(p)shipSpawn(c.id,type,p);}}
function shipGoto(s,x,y){const pi=provAt(x,y);let gx=x,gy=y,dest=null;
  if(pi>=0){const p=provs[pi];const port=portOf(p);if(!port)return `${p.name}: нет выхода к морю.`;[gx,gy]=port;dest=p.id;}
  const path=waterPath(s.x,s.y,gx,gy);if(!path)return 'Корабль туда не дойдёт по воде.';path[path.length-1]=[gx,gy];s.path=path;s.dest=dest;s.target=null;return null;}
function shipCargoTot(s){return tot(s.cargo.u)+Object.keys(s.cargo).filter(k=>k!=='u').reduce((t,k)=>t+(s.cargo[k]|0),0);}
function shipNearOwnPort(s){for(const p of provs){if(p.owner!==s.owner)continue;const pt=portOf(p);if(pt&&km(pt[0],pt[1],s.x,s.y)<60)return p;}return null;}
function shipLoadTroops(sid,frac){const s=ships.find(q=>q.id===sid);if(!s)return 'Корабль не найден.';const cap=CONFIG.SHIP_TROOP_CAP[s.type];if(!cap)return 'Этот корабль не берёт войска.';
  const p=shipNearOwnPort(s);if(!p)return 'Подведите корабль к своему порту.';const a=p.armies[s.owner];if(!a||tot(a)<.05)return `В городе ${p.name} нет войск.`;
  const room=cap-tot(s.cargo.u),f=Math.min(frac??1,room/tot(a));if(f<=0)return 'Трюм полон.';for(const k of ['inf','tank','art']){const v=a[k]*f;a[k]-=v;s.cargo.u[k]+=v;}return null;}
function shipLoadStock(sid){const s=ships.find(q=>q.id===sid);if(!s)return 'Корабль не найден.';const cap=CONFIG.SHIP_DRONE_CAP[s.type];if(!cap)return 'Этот корабль не берёт дроны.';
  if(!shipNearOwnPort(s))return 'Подведите корабль к своему порту.';const c=C[s.owner];let room=cap-(shipCargoTot(s)-tot(s.cargo.u)),n=0;
  for(const k of ['shahed','fpv','cruise','recon']){if(room<=0)break;const v=Math.min(room,c.stock[k]|0);if(v>0){c.stock[k]-=v;s.cargo[k]=(s.cargo[k]|0)+v;room-=v;n+=v;}}
  return n?null:'На складе нет дронов и ракет для погрузки.';}
function shipUnload(sid){const s=ships.find(q=>q.id===sid);if(!s)return 'Корабль не найден.';let best=null,bd=1e9;
  for(const p of provs){if(!p.coastal)continue;const pt=portOf(p);if(!pt)continue;const d=km(pt[0],pt[1],s.x,s.y);if(d<bd){bd=d;best=p;}}
  if(!best||bd>80)return 'Рядом нет берега: подойдите ближе (до 80 км).';return shipDrop(s,best);}
function shipDrop(s,p){const c=C[s.owner],u=s.cargo.u;let msg='';
  if(tot(u)>.05){if(p.owner!==s.owner&&!atWar(s.owner,p.owner))return `С государством «${C[p.owner].name}» нет войны — высадка невозможна.`;
    const a=army(p,s.owner);a.inf+=u.inf;a.tank+=u.tank;a.art+=u.art;if(p.owner!==s.owner){a.amph=time+24;a.from=null;}msg=`высажено ${fN(tot(u))} отр.`;s.cargo.u={inf:0,tank:0,art:0};fogAll();}
  if(p.owner===s.owner)for(const k of Object.keys(s.cargo)){if(k==='u'||s.type==='carrier')continue;c.stock[k]=(c.stock[k]||0)+(s.cargo[k]|0);delete s.cargo[k];}
  if(s.owner===player&&msg)log(`${SHIPS[s.type].n}: ${msg} (${p.name}).`,'ok');return null;}
// морская переброска ИИ: настоящий транспорт, который можно потопить вместе с войсками
function aiConvoy(o,fp,tp,frac){const a=fp.armies[o];if(!a||tot(a)<.05)return 'Нет войск.';const c=C[o];if(c.money<20)return 'Нет денег на транспорт.';
  const s=shipSpawn(o,'transport',fp);if(!s)return 'Нет порта.';c.money-=20;for(const k of ['inf','tank','art']){const v=a[k]*frac;a[k]-=v;s.cargo.u[k]+=v;}
  const e=shipGoto(s,tp.cx,tp.cy);if(e){for(const k of ['inf','tank','art'])a[k]+=s.cargo.u[k];ships=ships.filter(x=>x!==s);return e;}return null;}
function shipStep(dt){if(!ships.length)return;
  for(const s of ships){const spd=CONFIG.SHIP_SPEED[s.type]*CONFIG.SPEED;
    if(s.target){const t=ships.find(q=>q.id===s.target);if(!t||t.hp<=0)s.target=null;else{const dt_=km(s.x,s.y,t.x,t.y);
      if(dt_<300){s.path=dt_>20?[[t.x,t.y]]:null;}else if(!s.path||(s.retarget||0)<=time){s.retarget=time+24;const p=waterPath(s.x,s.y,t.x,t.y);if(p)s.path=p;else s.target=null;}}}
    if(s.path&&s.path.length){let mv=spd*dt;while(mv>0&&s.path.length){const [tx,ty]=s.path[0],d=km(s.x,s.y,tx,ty);s.hd=Math.atan2(ty-s.y,tx-s.x);
        if(d<=mv){s.x=tx;s.y=ty;s.path.shift();mv-=d;}else{const f=mv/d;s.x+=(tx-s.x)*f;s.y+=(ty-s.y)*f;mv=0;}}
      if(!s.path.length){s.path=null;if(s.dest!=null){const p=provs[s.dest];s.dest=null;if(s.type==='transport')shipDrop(s,p);}}}
    // бой
    s.cd-=dt;if(s.cd<=0&&C[s.owner].wars.size){s.cd=.1;const A=SHIPS[s.type].atk;let best=null,bd=s.type==='warship'?150:40;
      for(const t of ships){if(!atWar(s.owner,t.owner)||Math.abs(t.y-s.y)>S*1.5)continue;const d=km(s.x,s.y,t.x,t.y);if(d<bd){bd=d;best=t;}}
      if(best){best.hp-=A*.1*R(.6,1.4);if(Math.random()<.3)fx.push({x:s.x,y:s.y,x2:best.x,y2:best.y,t:0,max:.25,gun:true});}
      if(s.type==='warship'&&pGrid.size){const c=C[s.owner];for(const p of projs){if(p.dead||p.delay>0||!c.wars.has(p.owner))continue;const cls=C[p.owner].cat[p.w].cls;if(cls==='ballistic')continue;
          if(Math.abs(p.y-s.y)>S*.5||km(p.x,p.y,s.x,s.y)>40)continue;if(Math.random()<.35*(1-(C[p.owner].cat[p.w].stealth||0))){c.st.intercepted++;killOne(p,'ad');}break;}}}}
  const sunk=ships.filter(s=>s.hp<=0||!C[s.owner].alive);
  for(const s of sunk){boom(s.x,s.y,16,'#ff7a3d');fx.push({kind:'text',x:s.x,y:s.y,t:0,max:2,txt:'Корабль потоплен',col:'#ffd27a'});
    const cargo=tot(s.cargo.u)>.05?` вместе с ${fN(tot(s.cargo.u))} отр. войск`:'';
    if(s.owner===player){log(`Потоплен ваш ${SHIPS[s.type].n.toLowerCase()}${cargo}.`,'bad');toast(`Потоплен ${SHIPS[s.type].n.toLowerCase()}${cargo}`,'bad');}
    else if(atWar(player,s.owner)&&visibleToPlayer(s.x,s.y))log(`Потоплен корабль противника (${C[s.owner].name}): ${SHIPS[s.type].n.toLowerCase()}${cargo}.`,'ok');}
  if(sunk.length)ships=ships.filter(s=>s.hp>0&&C[s.owner].alive);}
function drawShip(g,s,z,sel){const col=C[s.owner].color,sz=11/z;g.save();g.translate(s.x,s.y);g.rotate(s.hd||0);g.fillStyle=col;g.strokeStyle='#fff';g.lineWidth=1.1/z;
  g.beginPath();g.moveTo(1.3*sz,0);g.lineTo(.6*sz,-.45*sz);g.lineTo(-1.1*sz,-.45*sz);g.lineTo(-1.1*sz,.45*sz);g.lineTo(.6*sz,.45*sz);g.closePath();g.fill();g.stroke();
  g.fillStyle='#fff';
  if(s.type==='warship'){g.fillRect(-.3*sz,-.22*sz,.5*sz,.44*sz);g.fillRect(.15*sz,-.06*sz,.6*sz,.12*sz);}
  else if(s.type==='carrier'){g.fillRect(-.9*sz,-.32*sz,1.7*sz,.64*sz);g.fillStyle=col;g.fillRect(-.7*sz,-.05*sz,1.3*sz,.1*sz);}
  else{for(let i=0;i<3;i++)g.fillRect((-.85+i*.55)*sz,-.25*sz,.4*sz,.5*sz);}
  g.restore();
  const hp=s.hp/SHIPS[s.type].hp;if(hp<.99){g.fillStyle='rgba(20,25,30,.75)';g.fillRect(s.x-sz,s.y+sz*.8,2*sz,3/z);g.fillStyle=hp>.5?'#4cc38a':'#e5463c';g.fillRect(s.x-sz,s.y+sz*.8,2*sz*hp,3/z);}
  const ct=shipCargoTot(s);if(ct>0&&z>1.2&&s.owner===player){g.font=`600 ${9/z}px Consolas,monospace`;g.textAlign='left';g.textBaseline='middle';halo(g,(tot(s.cargo.u)>.05?fN(tot(s.cargo.u))+' отр.':'')+(ct-tot(s.cargo.u)>0?' ✈'+Math.round(ct-tot(s.cargo.u)):''),s.x+sz*1.4,s.y,z,'#1d2630');}
  if(sel){g.strokeStyle='#e3a51a';g.lineWidth=2.2/z;g.beginPath();g.arc(s.x,s.y,sz*1.7,0,7);g.stroke();
    if(s.path){g.strokeStyle='rgba(227,165,26,.7)';g.setLineDash([5/z,4/z]);g.beginPath();g.moveTo(s.x,s.y);for(const [x,y] of s.path)g.lineTo(x,y);g.stroke();g.setLineDash([]);}}}
function carrierAt(wx,wy){let best=null,bd=14/cam.z;for(const s of ships){if(s.owner!==player||!(CONFIG.SHIP_DRONE_CAP[s.type]>0))continue;const d=Math.hypot(s.x-wx,s.y-wy);if(d<bd){bd=d;best=s;}}return best;}

/* =================== АВИАЦИЯ И ОТРЯДЫ ДРОНОВ =================== */
function placeWing(pi,n){const c=C[player],p=provs[pi];if(pi<0||p.owner!==player)return 'Аэродром можно поставить только в своём городе.';
  n=Math.min(n,c.stock.bomber|0);if(n<1)return 'Нет бомбардировщиков на складе.';c.stock.bomber-=n;
  let w=wings.find(x=>x.owner===player&&x.base===pi);if(!w)wings.push(w={id:++wingId,owner:player,base:pi,n:0,out:0});w.n+=n;return null;}
function placeSquad(pi,k,n){const c=C[player],p=provs[pi];if(pi<0||p.owner!==player)return 'Отряд дронов можно поставить только в своём городе.';
  n=Math.min(n,c.stock[k]|0);if(n<1)return 'На складе пусто.';c.stock[k]-=n;
  let q=squads.find(x=>x.owner===player&&x.base===pi&&x.k===k);if(!q)squads.push(q={id:++wingId,owner:player,base:pi,k,n:0});q.n+=n;return null;}
function wingStrike(w,x,y){const c=C[w.owner],b=provs[w.base],Wp=c.cat.bomber;if(w.n<1)return 'Все самолёты эскадрильи в воздухе.';
  const pi=provAt(x,y);if(pi<0)return 'Цель в море.';if(!atWar(w.owner,provs[pi].owner)&&!Object.keys(provs[pi].armies).some(o=>atWar(w.owner,+o)))return `С государством «${C[provs[pi].owner].name}» нет войны.`;
  const d=km(b.cx,b.cy,x,y);if(d>effRange(c,Wp))return `Цель дальше радиуса авиации (${Math.round(effRange(c,Wp))} км от ${b.name}).`;
  const n=w.n,sv=fireSalvo(w.owner,'bomber',b,x,y,n,ui.prio);for(const p of projs)if(p.sv===sv.id)p.wing=w.id;w.n=0;w.out+=n;return null;}
function squadStrike(q,x,y){const c=C[q.owner],b=provs[q.base],Wp=c.cat[q.k];if(q.n<1)return 'Отряд пуст.';const pi=provAt(x,y);if(pi<0)return 'Цель в море.';
  if(!atWar(q.owner,provs[pi].owner)&&!Object.keys(provs[pi].armies).some(o=>atWar(q.owner,+o)))return `С государством «${C[provs[pi].owner].name}» нет войны.`;
  const d=km(b.cx,b.cy,x,y);if(Wp.range==='front'?d>CONFIG.FRONT_RANGE:d>effRange(c,Wp))return `Цель вне досягаемости от ${b.name} (${Math.round(d)} км).`;
  const n=Math.min(q.n,ui.salvo==='all'?q.n:ui.salvo);q.n-=n;fireSalvo(q.owner,q.k,b,x,y,n,ui.prio);if(q.n<1)squads=squads.filter(z=>z!==q);return null;}
const _specialArrive=specialArrive;
specialArrive=function(p,Wp){if(Wp.special!=='sortie')return _specialArrive(p,Wp);
  strike(p.owner,p.w,p.tx,p.ty,Wp.bombs,p.prio,salvos[p.sv]);for(let i=0;i<3;i++)boom(p.tx+R(-1,1),p.ty+R(-1,1),8,'#ff9d3d');resolveProj(p);p.state='return';};
function returnHome(p){if(p.wing){const w=wings.find(x=>x.id===p.wing);if(w){w.n++;w.out=Math.max(0,w.out-1);return;}}C[p.owner].stock[p.w]=(C[p.owner].stock[p.w]||0)+1;}

/* =================== ВЫДЕЛЕНИЕ И ПРИКАЗЫ =================== */
const KIND_NAMES={all:'Все',inf:'Пехота',tank:'Танки',air:'Авиация',drone:'Дроны',fleet:'Флот'};
function tokens(){const T=[];if(player<0)return T;const z=cam.z;
  for(const p of provs){const a=p.armies[player];if(!a||tot(a)<.05)continue;T.push({id:'a'+p.id,type:'army',kind:a.tank>a.inf*.5?'tank':'inf',x:p.cx,y:p.cy+18/z,ref:p,a});}
  for(const m of moves){if(m.owner!==player)continue;const [x,y]=movePos(m);T.push({id:'m'+m.id,type:'move',kind:m.u.tank>m.u.inf*.5?'tank':'inf',x,y,ref:m,a:m.u});}
  for(const s of ships)if(s.owner===player)T.push({id:'s'+s.id,type:'ship',kind:'fleet',x:s.x,y:s.y,ref:s});
  for(const w of wings)if(w.owner===player){const p=provs[w.base];T.push({id:'w'+w.id,type:'wing',kind:'air',x:p.cx-26/z,y:p.cy-2/z,ref:w});}
  let i=0;for(const q of squads)if(q.owner===player){const p=provs[q.base];T.push({id:'d'+q.id,type:'squad',kind:'drone',x:p.cx+26/z,y:p.cy-2/z+(i++%2)*14/z,ref:q});}
  return T;}
function tokenOk(t){return ui.filt==='all'||t.kind===ui.filt;}
function tokenAt(wx,wy){let best=null,bd=14/cam.z;for(const t of tokens()){if(!tokenOk(t))continue;const d=Math.hypot(t.x-wx,t.y-wy);if(d<bd){bd=d;best=t;}}return best;}
function selCount(){return ui.selU.size;}
function selTokens(){const T=tokens();return T.filter(t=>ui.selU.has(t.id));}
function boxSelect(x1,y1,x2,y2,add){if(!add)ui.selU.clear();const [ax,ay]=toWorld(Math.min(x1,x2),Math.min(y1,y2)),[bx,by]=toWorld(Math.max(x1,x2),Math.max(y1,y2));
  for(const t of tokens())if(tokenOk(t)&&t.x>=ax&&t.x<=bx&&t.y>=ay&&t.y<=by)ui.selU.add(t.id);updateSelBox();}
function redirectMove(m,pi){const next=m.path[m.i+1];if(next===pi){m.path=m.path.slice(0,m.i+2);return null;}const np=findPath(m.owner,next,pi);if(!np)return 'Нет сухопутного пути к цели.';
  m.path=m.path.slice(0,m.i+2).concat(np.slice(1));m.goal=pi;return null;}
function sendSelectionTo(wx,wy){const T=selTokens();if(!T.length)return;const pi=provAt(wx,wy);let ok=0;const errs=new Set();
  for(const t of T){let e=null;
    if(t.type==='army'){if(pi<0)e='Войска не ходят по воде — погрузите их на транспорт.';else if(pi===t.ref.id)e=null;else{e=cmdRun('sendArmyGoal',[player,t.ref.id,pi]);}}
    else if(t.type==='move')e=pi<0?'Войска не ходят по воде.':cmdRun('redirectMoveId',[t.ref.id,pi]);
    else if(t.type==='ship'){const tgt=ships.find(s=>atWar(player,s.owner)&&Math.hypot(s.x-wx,s.y-wy)<14/cam.z);e=tgt?cmdRun('shipAttack',[t.ref.id,tgt.id]):cmdRun('shipGotoId',[t.ref.id,wx,wy]);}
    else if(t.type==='wing')e=cmdRun('wingStrikeId',[t.ref.id,wx,wy,ui.prio]);
    else if(t.type==='squad')e=cmdRun('squadStrikeId',[t.ref.id,wx,wy,ui.prio,ui.salvo]);
    if(e)errs.add(e);else ok++;}
  if(ok)toast(`Приказ отдан: ${ok} ${ok===1?'отряд':'отрядов'}${pi>=0?' → '+provs[pi].name:''}`,'ok');for(const e of errs)toast(e,'bad');updateSelBox();}
function sendArmyGoal(o,from,to){const e=sendArmy(o,from,to,1);if(e)return e;const m=moves[moves.length-1];if(m&&m.owner===o){m.goal=to;}return null;}
function redirectMoveId(id,pi){const m=moves.find(x=>x.id===id);return m?redirectMove(m,pi):'Отряд не найден.';}
function shipGotoId(id,x,y){const s=ships.find(q=>q.id===id);return s?shipGoto(s,x,y):'Корабль не найден.';}
function shipAttack(id,tid){const s=ships.find(q=>q.id===id);if(!s)return 'Корабль не найден.';s.target=tid;s.dest=null;s.path=null;s.retarget=0;return null;}
function wingStrikeId(id,x,y,prio){const w=wings.find(q=>q.id===id);if(!w)return 'Эскадрилья не найдена.';const op=ui.prio;ui.prio=prio;const e=wingStrike(w,x,y);ui.prio=op;return e;}
function squadStrikeId(id,x,y,prio,salvo){const q=squads.find(z=>z.id===id);if(!q)return 'Отряд не найден.';const op=ui.prio,os=ui.salvo;ui.prio=prio;ui.salvo=salvo;const e=squadStrike(q,x,y);ui.prio=op;ui.salvo=os;return e;}
// панель выделения на карте
const selbox=document.createElement('div');selbox.id='selbox';$('#mapwrap').appendChild(selbox);
const sst=document.createElement('style');sst.textContent=`#selbox{position:absolute;left:14px;bottom:14px;width:min(330px,calc(100% - 28px));background:rgba(17,24,31,.95);border:1px solid var(--line2);border-radius:12px;padding:9px 10px;box-shadow:var(--shadow);z-index:4;font-size:12px;display:none}
#selbox .chips{margin-bottom:6px}#selbox .chip{padding:3px 8px;font-size:11px}#selbox .row{padding:5px 0}#selbox .acts{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}#selbox .btn{padding:4px 8px;font-size:11.5px}
#selbox select{background:var(--bg);border:1px solid var(--line2);border-radius:7px;padding:4px;max-width:150px}#legend{display:none}
@media (max-width:900px){#selbox{bottom:auto;top:44px}}`;document.head.appendChild(sst);
function updateSelBox(){if(!started||player<0){selbox.style.display='none';return;}
  const T=selTokens();let h=`<div class="chips">${Object.keys(KIND_NAMES).map(k=>`<span class="chip ${ui.filt===k?'on':''}" data-f="${k}">${KIND_NAMES[k]}</span>`).join('')}</div>`;
  if(!T.length)h+=`<div class="muted">Щёлкните по своему отряду или обведите рамкой (левая кнопка). Shift — добавить. Правая кнопка — отправить выбранных. Двигать карту — правой кнопкой или стрелками.</div>`;
  else{const by={};let bat=0;for(const t of T){by[t.kind]=(by[t.kind]||0)+1;if(t.a)bat+=tot(t.a);}
    h+=`<b>Выбрано: ${T.length}</b> <span class="muted">${Object.keys(by).map(k=>KIND_NAMES[k]+' '+by[k]).join(' · ')}${bat?` · ${fN(bat)} отр. войск`:''}</span>`;
    const sh=T.filter(t=>t.type==='ship');for(const t of sh.slice(0,4)){const s=t.ref;h+=`<div class="row"><div class="nm"><b>${SHIPS[s.type].n}</b><small>прочность ${Math.round(s.hp/SHIPS[s.type].hp*100)}%${tot(s.cargo.u)>.05?` · войск ${fN(tot(s.cargo.u))}`:''}${shipCargoTot(s)-tot(s.cargo.u)>0?` · дронов/ракет ${Math.round(shipCargoTot(s)-tot(s.cargo.u))}`:''}</small></div></div>`;}
    const wg=T.filter(t=>t.type==='wing'||t.type==='squad');for(const t of wg.slice(0,4))h+=`<div class="row"><div class="nm"><b>${t.type==='wing'?'Эскадрилья':esc(C[player].cat[t.ref.k].n)} · ${esc(provs[t.ref.base].name)}</b><small>${t.type==='wing'?`готовы ${t.ref.n}, в воздухе ${t.ref.out}`:`в отряде ${t.ref.n}`}</small></div></div>`;
    h+=`<div class="acts"><button class="btn pri" data-sa="send">Отправить</button><select id="selCountry"><option value="">в страну…</option>${C.filter(c=>c.alive&&c.id!==player).sort((a,b)=>a.name.localeCompare(b.name,'ru')).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>`;
    if(sh.some(t=>CONFIG.SHIP_TROOP_CAP[t.ref.type]>0))h+=`<button class="btn" data-sa="load">Погрузить войска</button><button class="btn" data-sa="unload">Высадить</button>`;
    if(sh.some(t=>CONFIG.SHIP_DRONE_CAP[t.ref.type]>0))h+=`<button class="btn" data-sa="loadd">Погрузить дроны</button>`;
    h+=`<button class="btn" data-sa="clear">Снять выделение</button></div>`;}
  if(selbox.dataset.h!==h&&document.activeElement?.id!=='selCountry'){selbox.innerHTML=h;selbox.dataset.h=h;}selbox.style.display='block';}
selbox.addEventListener('click',e=>{const f=e.target.closest('[data-f]');if(f){ui.filt=f.dataset.f;for(const id of [...ui.selU]){const t=tokens().find(x=>x.id===id);if(t&&!tokenOk(t))ui.selU.delete(id);}updateSelBox();return;}
  const b=e.target.closest('[data-sa]');if(!b)return;const a=b.dataset.sa,T=selTokens();
  if(a==='send'){setMode('sendSel');return;}if(a==='clear'){ui.selU.clear();updateSelBox();return;}
  for(const t of T){if(t.type!=='ship')continue;const e2=a==='load'?cmdRun('shipLoadTroops',[t.ref.id,ui.frac]):a==='unload'?cmdRun('shipUnload',[t.ref.id]):a==='loadd'?cmdRun('shipLoadStock',[t.ref.id]):null;
    if(e2)toast(e2,'bad');else toast(a==='load'?'Войска погружены':a==='unload'?'Высадка':'Дроны погружены','ok');}updateSelBox();});
selbox.addEventListener('change',e=>{if(e.target.id==='selCountry'&&e.target.value){const c=C[+e.target.value],p=provs[c.capital];e.target.blur();if(p)sendSelectionTo(p.cx,p.cy);}});
setInterval(updateSelBox,400);
window.addEventListener('keydown',e=>{if(!started||e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;const st=60/cam.z;
  if(e.key==='ArrowLeft'||e.code==='KeyA')cam.x-=st;else if(e.key==='ArrowRight'||e.code==='KeyD')cam.x+=st;else if(e.key==='ArrowUp'||e.code==='KeyW')cam.y-=st;else if(e.key==='ArrowDown'||e.code==='KeyS')cam.y+=st;else return;clampCam();});
function drawUnitsLayer(g,z){
  for(const zn of zones){const r=zn.r/111.32*S;if(!inView(zn.x,zn.y,r))continue;const gr=g.createRadialGradient(zn.x,zn.y,0,zn.x,zn.y,r);gr.addColorStop(0,`rgba(150,200,40,${.35*zn.I})`);gr.addColorStop(1,'rgba(150,200,40,0)');
    g.fillStyle=gr;g.beginPath();g.arc(zn.x,zn.y,r,0,7);g.fill();g.strokeStyle=`rgba(190,220,60,${.6*zn.I})`;g.setLineDash([6/z,5/z]);g.lineWidth=1.4/z;g.stroke();g.setLineDash([]);
    if(z>.6){g.font=`700 ${12/z}px "Segoe UI",sans-serif`;g.textAlign='center';g.textBaseline='middle';halo(g,`☢ ${Math.round(zn.I*100)}%`,zn.x,zn.y-r*.6,z,'#5c6b00');}}
  drawCityState(g,z);drawFacProd(g,z);
  const T=tokens();
  for(const t of T){if(!inView(t.x,t.y,40))continue;const sel=ui.selU.has(t.id),dim=!tokenOk(t);g.globalAlpha=dim?.4:1;
    if(t.type==='army')drawUnitIcon(t.x,t.y,t.a,C[player].color,z);
    else if(t.type==='ship')drawShip(g,t.ref,z,sel);
    else if(t.type==='wing'||t.type==='squad'){const s=11/z;g.fillStyle='rgba(17,24,31,.85)';g.strokeStyle=C[player].color;g.lineWidth=1.8/z;g.beginPath();g.rect(t.x-s,t.y-s,2*s,2*s);g.fill();g.stroke();
      g.save();g.translate(t.x,t.y);const W_=t.type==='wing'?C[player].cat.bomber:C[player].cat[t.ref.k];g.fillStyle='#fff';g.scale(.85,.85);
      drawProj(g,{owner:player,w:t.type==='wing'?'bomber':t.ref.k,x:0,y:0,hd:-Math.PI/2,n:1,id:0},z*1.4);g.restore();
      g.font=`700 ${9/z}px Consolas,monospace`;g.textAlign='center';g.textBaseline='top';halo(g,String(t.type==='wing'?t.ref.n+'+'+t.ref.out:t.ref.n),t.x,t.y+s+1/z,z,'#1d2630');}
    if(sel&&t.type!=='ship'){g.strokeStyle='#e3a51a';g.lineWidth=2.2/z;g.beginPath();g.arc(t.x,t.y,16/z,0,7);g.stroke();}
    g.globalAlpha=1;}
  for(const s of ships){if(s.owner===player||!inView(s.x,s.y,30))continue;if(ui.fog&&started&&!visibleToPlayer(s.x,s.y))continue;drawShip(g,s,z,false);}
  if(ui.box){const [ax,ay]=toWorld(ui.box.sx,ui.box.sy),[bx,by]=toWorld(ui.box.x2,ui.box.y2);g.fillStyle='rgba(227,165,26,.12)';g.strokeStyle='#e3a51a';g.lineWidth=1.4/z;
    g.fillRect(Math.min(ax,bx),Math.min(ay,by),Math.abs(bx-ax),Math.abs(by-ay));g.strokeRect(Math.min(ax,bx),Math.min(ay,by),Math.abs(bx-ax),Math.abs(by-ay));}}
const _visibleToPlayer=visibleToPlayer;
visibleToPlayer=function(x,y){if(_visibleToPlayer(x,y))return true;for(const s of ships)if(s.owner===player&&Math.abs(s.y-y)<20&&km(s.x,s.y,x,y)<120)return true;return false;};

/* =================== ДИПЛОМАТИЯ: РЕПУТАЦИЯ, ВНЕЗАПНЫЕ АТАКИ, ПОМОЩЬ =================== */
function rel(a,b){const A=C[a],B=C[b];let r=0;if(A.pacts.some(p=>p.m.includes(B.key)))r+=60;if(A.bloc===B.bloc)r+=20;
  if(RIVALS.some(([x,y])=>(x===A.key&&y===B.key)||(x===B.key&&y===A.key)))r-=60;if(A.wars.has(b))r-=100;return r+((B.rep??70)-60)*.5;}
const _declareWar=declareWar;
declareWar=function(a,b,chain=true,why=''){const was=atWar(a,b);_declareWar(a,b,chain,why);
  if(!was&&atWar(a,b)){const k=wkey(a,b);if(!warInfo[k])warInfo[k]={att:a,surprise:/внезапн/.test(why),t:time};if(chain!==false&&!/внезапн/.test(why))C[a].rep=Math.max(0,(C[a].rep??70)-CONFIG.DECLARE_REP);}};
function surpriseAttack(a,b){if(a===b||atWar(a,b)||!C[b].alive)return 'Уже идёт война.';C[a].rep=Math.max(0,(C[a].rep??70)-CONFIG.SURPRISE_REP);
  warInfo[wkey(a,b)]={att:a,surprise:true,t:time};declareWar(a,b,true,'внезапное нападение без объявления войны');
  for(const ad of ads)if(ad.owner===b)ad.ready=Math.max(ad.ready,12);
  log(`${C[a].name} внезапно нападает на ${C[b].name}! Репутация агрессора падает, другие страны охотнее помогают жертве.`,a===player||b===player?'bad':'warn');
  if(b===player)toast(`Внезапное нападение: ${C[a].name}! ПВО приводится в готовность (12 ч)`,'bad');return null;}
function aiAttack(c,e){if(Math.random()<.35+((c.rep??70)<50?.2:0))surpriseAttack(c.id,e.id);else declareWar(c.id,e.id);}
function sendAid(from,to,kind,amount){const F=C[from],T=C[to];let txt='';
  if(kind==='money'){const v=Math.min(F.money,amount??Math.max(30,F.budget*2));if(v<5)return 'Недостаточно средств.';F.money-=v;T.money+=v;txt=fM(v);}
  else if(kind==='drones'){const v=Math.min(F.stock.shahed|0,amount??Math.max(10,Math.round((F.stock.shahed|0)*.2)));if(v<1)return 'Нет ударных дронов на складе.';F.stock.shahed-=v;T.stock.shahed=(T.stock.shahed|0)+v;txt=`${v} ударных дронов`;}
  else if(kind==='troops'){let v=amount??3;const src=F.isPlayer?depot(F):army(provs[F.capital],from);v=Math.min(v,Math.floor(src.inf||0));if(v<1)return F.isPlayer?'На складе нет пехоты.':'Нет свободных войск.';src.inf-=v;
    if(T.isPlayer)depot(T).inf+=v;else army(provs[T.capital],to).inf+=v;txt=`${v} отрядов пехоты`;}
  else if(kind==='tanks'){let v=amount??2;const src=F.isPlayer?depot(F):army(provs[F.capital],from);v=Math.min(v,Math.floor(src.tank||0));if(v<1)return 'Нет танков.';src.tank-=v;if(T.isPlayer)depot(T).tank+=v;else army(provs[T.capital],to).tank+=v;txt=`${v} танк. отрядов`;}
  if(to===player){log(`${F.name} прислала помощь: ${txt}.`,'ok');toast(`Помощь от ${F.name}: ${txt}`,'ok');}
  else if(from===player)log(`Вы отправили помощь государству «${T.name}»: ${txt}.`,'ok');
  else if(atWar(player,to)||atWar(player,from))log(`${F.name} помогает государству «${T.name}»: ${txt}.`,'warn');
  T.rep=T.rep??70;F.rep=Math.min(100,(F.rep??70)+.5);return null;}
function dipDaily(){if(mp.role==='client')return;const done=new Set();
  for(const a of C){if(!a.alive)continue;for(const b of a.wars){const k=wkey(a.id,b);if(done.has(k))continue;done.add(k);
    const info=warInfo[k]||{att:a.id,surprise:false},att=info.att,vic=att===a.id?b:a.id;if(!C[att]||!C[vic]||!C[vic].alive)continue;
    for(const t of C){if(!t.alive||t.isPlayer||t.id===att||t.id===vic||t.wars.has(att)||t.wars.has(vic)||t.money<50)continue;
      const pro=rel(t.id,vic)-rel(t.id,att)+(info.surprise?40:0)+(60-(C[att].rep??70))*.6;
      if(pro>=40&&Math.random()<Math.min(.25,(pro-40)/250)){
        if(pro>130&&Math.random()<.12&&strength(t)>strength(C[att])*.15)declareWar(t.id,att,false,'в поддержку государства «'+C[vic].name+'»');
        else sendAid(t.id,vic,pick(['money','money','drones','troops']));}
      else if(pro<=-60&&Math.random()<.05)sendAid(t.id,att,pick(['money','drones']));}}}}
function aiExtra(c){if(mp.role==='client')return;const my=myProvs(c.id);if(!my.length)return;const war=c.wars.size>0;
  // флот: прибрежные страны держат корабли
  const mine=ships.filter(s=>s.owner===c.id),want=c.def0>=10?Math.min(5,1+Math.floor(c.def0/40)):0;
  if(mine.length<want&&c.money>c.budget*6+200&&my.some(p=>portOf(p))){const type=c.def0>40&&!mine.some(s=>s.type==='carrier')?'carrier':'warship';const cost=SHIPS[type].cost;c.money-=cost;shipDeliver(c,type);}
  if(war)for(const s of mine){if(s.type!=='warship'||s.target||s.path)continue;let best=null,bd=2000;for(const t of ships){if(!atWar(c.id,t.owner))continue;const d=km(s.x,s.y,t.x,t.y);if(d<bd){bd=d;best=t;}}if(best){s.target=best.id;s.retarget=0;}}
  // авиация
  if(c.def0>=10&&(c.stock.bomber|0)<Math.round(c.def0/20)&&c.money>c.budget*5+200&&!c.queue.some(q=>q.k==='bomber'))order(c,'bomber',1);
  // внезапное нападение на слабого соседа (редко, только агрессивные и при большом перевесе)
  if(!war&&!sb.noAI&&time/24>120&&Math.random()<.0008*(c.aggr||1)){const nbs=new Set();for(const p of my)for(const n of p.nb){const o=provs[n].owner;if(o!==c.id&&C[o].alive)nbs.add(o);}
    const s=strength(c),tg=[...nbs].filter(o=>s>strength(C[o])*2.5&&rel(c.id,o)<0&&C[o].wars.size<=1&&(o!==player||time/24>150));if(tg.length)aiAttack(c,C[pick(tg)]);}}
// внезапные атаки ИИ при войне с соперником
const _aiDaily=aiDaily;aiDaily=function(c){if(mp.role==='client')return;return _aiDaily(c);};
const _aiGround=aiGround;aiGround=function(c){if(mp.role==='client')return;return _aiGround(c);};
const _aiStrike=aiStrike;aiStrike=function(c){if(mp.role==='client')return;_aiStrike(c);
  // ИИ бьёт и по кораблям, и использует авиацию
  for(const e of c.wars){const ec=C[e];if(!ec.alive)continue;
    if((c.stock.bomber|0)>0&&Math.random()<.3){const tg=facs.filter(f=>provs[f.prov].owner===e&&f.state==='ok');const t=tg[Math.floor(Math.random()*tg.length)];
      if(t){const site=nearestOwn(c.id,t.x,t.y);if(site&&km(site.cx,site.cy,t.x,t.y)<=Math.min(CONFIG.AI_INTEL_KM,effRange(c,c.cat.bomber))){const n=Math.min(c.stock.bomber,RI(1,3));c.stock.bomber-=n;fireSalvo(c.id,'bomber',site,t.x,t.y,n,'industry');}}}
    const sh=ships.filter(s=>s.owner===e);if(sh.length&&(c.stock.cruise|0)>0&&Math.random()<.25){const s=pick(sh),site=nearestOwn(c.id,s.x,s.y);
      if(site&&km(site.cx,site.cy,s.x,s.y)<=Math.min(effRange(c,c.cat.cruise),CONFIG.AI_INTEL_KM)){const n=Math.min(c.stock.cruise,RI(1,3));c.stock.cruise-=n;fireSalvo(c.id,'cruise',site,s.x,s.y,n,'troops');}}}};

/* =================== ЯДЕРНЫЙ УДАР: ЛЮБАЯ ТОЧКА, ТРАЕКТОРИЯ, РАДИАЦИЯ =================== */
askNuke=function(x,y){const pi=provAt(x,y),p=pi>=0?provs[pi]:null;
  if(!((C[player].stock.nuke|0)>0)&&!sb.infStock)return 'Нет ядерных ракет на складе.';
  const site=nearestOwn(player,x,y),dist=site?km(site.cx,site.cy,x,y):0,eta=dist/(CONFIG.NUKE_SPEED*CONFIG.SPEED);
  nukePending={x,y};running=false;setSpeedUI();const surprise=p&&p.owner!==player&&!atWar(player,p.owner);
  showOver(`<h2>☢ Ядерный удар</h2><p>Цель: <b>${p?esc(p.name)+' ('+esc(C[p.owner].name)+')':'море'}</b> · ${Math.round(dist)} км · время полёта ≈ ${fN(eta,1)} ч.</p>
  <p>Ракету может сбить дальняя ПВО на пути. После взрыва останется радиоактивное облако на ${CONFIG.RAD_DAYS} суток: оно убивает войска и население и снижает производство в радиусе ${CONFIG.RAD_RADIUS} км. Против вас введут санкции, союзники цели вступят в войну.</p>
  ${surprise?`<p style="color:var(--red)"><b>С этой страной нет войны.</b> Удар станет внезапным нападением: репутация −${CONFIG.SURPRISE_REP}.</p>`:''}
  <div style="display:flex;gap:8px"><button class="btn dng" data-act="nukeYes">Подтвердить пуск</button><button class="btn" data-act="nukeNo">Отмена</button></div>`);return 'ask';};
fireNukeConfirmed=function(){$('#over').style.display='none';if(!nukePending)return;const {x,y}=nukePending;nukePending=null;
  const err=cmdRun('nukeLaunch',[x,y]);if(err)toast(err,'bad');else toast('☢ Ядерная ракета запущена','warn');setMode(null);running=true;setSpeedUI();};
function nukeLaunch(x,y){const pi=provAt(x,y);if(pi>=0){const o=provs[pi].owner;if(o!==player&&!atWar(player,o))surpriseAttack(player,o);}
  const c=C[player];if(!((c.stock.nuke|0)>0)&&!sb.infStock)return 'Нет ядерных ракет.';const site=nearestOwn(player,x,y);if(!site)return 'Нет своей территории для пуска.';
  if(!sb.infStock)c.stock.nuke--;fireSalvo(player,'nuke',site,x,y,1,'troops');log(`☢ Вы запустили ядерную ракету${pi>=0?' по городу '+provs[pi].name:' в море'}.`,'bad');return null;}
const _nukeHit=nukeHit;
nukeHit=function(o,x,y,sv){zones.push({x,y,r:CONFIG.RAD_RADIUS,I:1});for(const s of ships)if(km(s.x,s.y,x,y)<150)s.hp=-1;
  for(const m of moves)if(km(...movePos(m),x,y)<150)loss(m.u,hpSum(m.u)*.9);const pi=provAt(x,y);if(pi>=0)provs[pi].integ=Math.min(provs[pi].integ??100,5);_nukeHit(o,x,y,sv);};
const _drawProj=drawProj;
drawProj=function(g,p,z){const W_=C[p.owner].cat[p.w];
  if(W_.special==='nuke'&&p.state!=='return'){g.strokeStyle='rgba(245,197,24,.75)';g.lineWidth=1.6/z;g.setLineDash([8/z,6/z]);g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.tx,p.ty);g.stroke();g.setLineDash([]);
    g.strokeStyle='#f5c518';g.lineWidth=2/z;g.beginPath();g.arc(p.tx,p.ty,14/z,0,7);g.stroke();
    const left=km(p.x,p.y,p.tx,p.ty)/(W_.spd*CONFIG.SPEED);g.font=`700 ${11/z}px "Segoe UI",sans-serif`;g.textAlign='center';g.textBaseline='bottom';halo(g,`☢ ${fN(left,1)} ч`,p.tx,p.ty-16/z,z,'#8a6d00');}
  _drawProj(g,p,z);};

/* =================== ПУСК С КОРАБЛЯ-НОСИТЕЛЯ И ДАЛЬНОСТЬ =================== */
function launchSiteObj(){if(ui.launchShip!=null){const s=ships.find(q=>q.id===ui.launchShip&&q.owner===player);if(s)return {id:-1,cx:s.x,cy:s.y,name:SHIPS[s.type].n,nb:[],ship:s};}
  return ui.launchFrom!=null&&provs[ui.launchFrom].owner===player?provs[ui.launchFrom]:null;}
function launchName(){const s=launchSiteObj();return s?(s.ship?' с корабля':' из города '+s.name):'';}
const _tryLaunch=tryLaunch;
tryLaunch=function(wk,x,y,confirmed){const lo=launchSiteObj();
  if(!lo||!lo.ship)return _tryLaunch(wk,x,y,confirmed);
  const s=lo.ship,c=C[player],Wp=c.cat[wk],have=s.cargo[wk]|0;if(wk==='nuke')return 'Ядерные ракеты с корабля не запускаются.';
  if(!have)return `На корабле нет: ${Wp.n}. Погрузите дроны в порту.`;const pi=provAt(x,y);if(pi<0)return 'Цель в море.';const p=provs[pi];
  if(!atWar(player,p.owner)&&!Object.keys(p.armies).some(o=>atWar(player,+o)))return `С государством «${C[p.owner].name}» нет войны.`;
  const d=km(s.x,s.y,x,y);if(Wp.range==='front'?d>CONFIG.FRONT_RANGE:d>effRange(c,Wp))return `Цель вне досягаемости с корабля (${Math.round(d)} км).`;
  const n=Math.min(ui.salvo==='all'?have:ui.salvo,have);s.cargo[wk]-=n;fireSalvo(player,wk,{cx:s.x,cy:s.y},x,y,n,ui.prio);panelDirty=true;return null;};
function buyRangeUp(){const c=C[player];if((c.rangeUp||0)>=CONFIG.RANGE_UP_MAX)return 'Достигнут предел.';if(c.money<CONFIG.RANGE_UP_COST&&!sb.money)return `Нужно ${fM(CONFIG.RANGE_UP_COST)}.`;
  c.money-=CONFIG.RANGE_UP_COST;c.rangeUp=(c.rangeUp||0)+1;toast(`Снабжение и базы: дальность +${Math.round(c.rangeUp*CONFIG.RANGE_UP_STEP*100)}%`,'ok');return null;}

/* =================== ДЕНЬГИ НЕ УХОДЯТ В МИНУС =================== */
economyHour=function(){economyPass();
  for(const c of C){if(!c.alive)continue;c.money+=(c.budget-c.upk)/24;
    if(c.money<0){c.money=0;if(!c.broke&&c.isPlayer){toast('Казна пуста: солдатам не платят, начинается дезертирство. Сократите армию или стройте гражданские заводы.','bad');log('Казна пуста: начинается дезертирство.','bad');}c.broke=true;}
    else if(c.money>c.budget)c.broke=false;
    if(c.broke)for(const p of provs){const a=p.armies[c.id];if(a)loss(a,hpSum(a)*.0008);}}};

/* =================== ОПТИМИЗАЦИЯ: ПРОСТРАНСТВЕННАЯ СЕТКА ДЛЯ ПВО =================== */
const GC=20,pGrid=new Map();
function buildPGrid(){pGrid.clear();for(const p of projs){if(p.dead||p.delay>0)continue;const k=((p.x/GC)|0)*1000+((p.y/GC)|0);let a=pGrid.get(k);if(!a)pGrid.set(k,a=[]);a.push(p);}}
let adCnt=null,adCntT=-1,adIdle=0,adPC=null,adPCT=-1;
function adProvCount(pid,t){if(adPCT!==time||!adPC){adPC=new Map();adPCT=time;for(const a of ads){const k=a.prov+'|'+a.type;adPC.set(k,(adPC.get(k)||0)+1);}}const k=pid+'|'+t;const v=adPC.get(k)||0;adPC.set(k,v+1);return v;}
function adCount(o,t){if(adCntT!==time||!adCnt){adCnt=new Map();adCntT=time;for(const a of ads){const k=a.owner*16+(a.type==='lrsam'?1:a.type==='shorad'?2:a.type==='ew'?3:4);adCnt.set(k,(adCnt.get(k)||0)+1);}}
  return adCnt.get(o*16+(t==='lrsam'?1:t==='shorad'?2:t==='ew'?3:4))||0;}
adStep=function(dt){buildPGrid();
  // пока в воздухе никого нет, ПВО только перезаряжается — раз в игровой час, а не каждый шаг
  if(!pGrid.size){adIdle+=dt;if(adIdle<1)return;dt=adIdle;adIdle=0;for(const a of ads){if(a.ready>0){a.ready-=dt;continue;}const T=C[a.owner].cat[a.type];if(T.ew||a.ammo>=T.mag)continue;a.rl+=dt;while(a.rl>=T.reload&&a.ammo<T.mag){a.rl-=T.reload;a.ammo++;}a.cd=0;}return;}
  if(adIdle>0){dt+=adIdle;adIdle=0;}
  for(const a of ads){const c=C[a.owner];if(!c.wars.size)continue;const T=c.cat[a.type];if(a.ready>0){a.ready-=dt;continue;}if(T.ew)continue;
    if(a.ammo<T.mag){a.rl+=dt;if(a.rl>=T.reload){a.rl=0;a.ammo++;}}a.cd-=dt;if(a.cd>0||!pGrid.size)continue;
    const ry=T.range/111*S,rx=T.range/(111*Math.max(.1,Math.cos(latY(a.y)*RAD)))*S;let best=null,bd=1e9,bc=null;
    for(let gx=Math.floor((a.x-rx)/GC);gx<=Math.floor((a.x+rx)/GC);gx++)for(let gy=Math.floor((a.y-ry)/GC);gy<=Math.floor((a.y+ry)/GC);gy++){const L=pGrid.get(gx*1000+gy);if(!L)continue;
      for(const p of L){if(p.dead||!c.wars.has(p.owner))continue;const W_=C[p.owner].cat[p.w],cls=W_.cls;if(!(T.pk[cls]>0))continue;
        const er=T.range*((cls==='small'||cls==='drone'||cls==='cruise')?T.low:1),d=km(p.x,p.y,a.x,a.y);if(d>er||d>=bd)continue;if(p.eng>=(cls==='ballistic'?2:1)*Math.min(3,p.n))continue;best=p;bd=d;bc=cls;}}
    if(!best||a.ammo<=0)continue;a.ammo--;a.cd=T.cd;best.eng++;c.st.shots++;a.spot[best.owner]=time+24;const BW=C[best.owner].cat[best.w];
    ints.push({x:a.x,y:a.y,t:best,spd:T.drone?T.spd:Math.max(T.spd,BW.spd*1.4),pk:Math.min(.97,T.pk[bc]*(1-(BW.stealth||0))*(c.isPlayer?1.15:1)),life:(T.drone?.7:.25)/CONFIG.SPEED,owner:a.owner,tr:[],dr:!!T.drone});}};
const _capitulate=capitulate;
capitulate=function(ci,to){_capitulate(ci,to);if(!C[ci].alive){projs=projs.filter(p=>p.owner!==ci);ints=ints.filter(i=>i.owner!==ci);wings=wings.filter(w=>w.owner!==ci);squads=squads.filter(q=>q.owner!==ci);
  for(const s of ships)if(s.owner===ci)s.owner=to;}};

/* =================== СОХРАНЕНИЕ НОВЫХ СИСТЕМ =================== */
function saveExt(){return {ships,shipId,wings,squads,wingId,zones,warInfo,moveId,rep:C.map(c=>Math.round((c.rep??70)*10)/10),rangeUp:C.map(c=>c.rangeUp||0),cap:C.map(c=>c.spendCap===false?0:1),
  city:provs.map(p=>[Math.round((p.integ??100)*10)/10,Math.round((p.rad||0)*1000)/1000,p.capT??-1e9,Math.round(p.pop*1000)/1000])};}
function loadExt(e){ships=[];wings=[];squads=[];zones=[];warInfo={};for(const p of provs){p.integ=100;p.rad=0;p.capT=-1e9;}if(!e)return;
  ships=e.ships||[];shipId=e.shipId||0;wings=e.wings||[];squads=e.squads||[];wingId=e.wingId||0;zones=e.zones||[];warInfo=e.warInfo||{};moveId=e.moveId||0;
  (e.rep||[]).forEach((v,i)=>{if(C[i])C[i].rep=v;});(e.rangeUp||[]).forEach((v,i)=>{if(C[i])C[i].rangeUp=v;});(e.cap||[]).forEach((v,i)=>{if(C[i])C[i].spendCap=!!v;});
  (e.city||[]).forEach((a,i)=>{const p=provs[i];if(!p)return;[p.integ,p.rad,p.capT,p.pop]=a;});}

/* =================== ДЕЙСТВИЯ ПАНЕЛЕЙ =================== */
const _act=act;
act=function(a,k,el){const c=C[player];let err=null;
  switch(a){
  case 'surprise':err=cmdRun('surpriseAttack',[player,+k]);break;
  case 'aid':{const [to,kind]=k.split(':');err=cmdRun('sendAid',[player,+to,kind,kind==='money'?100:kind==='drones'?20:kind==='troops'?5:2]);break;}
  case 'rangeUp':err=cmdRun('buyRangeUp',[]);break;
  case 'spendCap':c.spendCap=!!(el&&el.checked);toast(c.spendCap?'Заводы тратят только свободные деньги':'Заводы могут тратить накопления','ok');break;
  case 'shipLaunch':ui.shipType=k;setMode('shipLaunch');return;
  case 'placeWing':setMode('placeWing');return;
  case 'placeSquad':ui.squadK=k;setMode('placeSquad');return;
  case 'exportSave':if(mp.silent)return;(async()=>{try{const p=await window.pywebview.api.export_save(k);if(p)toast('Сохранение экспортировано: '+p,'ok');}catch(e){toast('Не удалось экспортировать: '+e,'bad');}})();return;
  case 'importSave':if(mp.silent)return;(async()=>{try{const s=await window.pywebview.api.import_save();if(s){toast('Сохранение импортировано','ok');openSaves(false);}}catch(e){toast('Не удалось импортировать: файл повреждён или не является сохранением.','bad');}})();return;
  default:return _act(a,k,el);}
  if(err)toast(err,'bad');renderPanel();};
const _tabArs=tabArs;
tabArs=function(){const c=C[player],dp=depot(c);let h=_tabArs();
  const sh=dp.ships||{},sk=Object.keys(sh).filter(k=>sh[k]>0);
  h+=`<h3>Флот на верфи</h3>`;if(!sk.length)h+=`<div class="muted">Пусто. Корабли заказываются во вкладке «Заводы» → «Флот».</div>`;
  for(const k of sk)h+=`<div class="row"><div class="nm"><b>${SHIPS[k].n}</b><small>${esc(SHIPS[k].d)}</small></div><span class="num">${sh[k]}</span><button class="btn pri" data-act="shipLaunch" data-k="${k}">Спустить на воду</button></div>`;
  h+=`<h3>Авиация и отряды дронов</h3><div class="muted" style="margin-bottom:6px">Поставьте самолёты или дроны в город — появится отряд, его можно выделить и отправить в любую точку в пределах дальности.</div>`;
  h+=`<div class="row"><div class="nm"><b>Бомбардировщики</b><small>на складе ${c.stock.bomber|0} · радиус ${Math.round(effRange(c,c.cat.bomber))} км</small></div><button class="btn pri" data-act="placeWing" ${(c.stock.bomber|0)?'':'disabled'}>На аэродром</button></div>`;
  for(const k of ['shahed','fpv','cruise','ballistic','recon'].concat(Object.keys(c.cat).filter(x=>c.cat[x].custom)))h+=`<div class="row"><div class="nm"><b>${esc(c.cat[k].n)}</b><small>на складе ${c.stock[k]|0}</small></div><button class="btn" data-act="placeSquad" data-k="${k}" ${(c.stock[k]|0)?'':'disabled'}>Создать отряд</button></div>`;
  return h;};
const _tabProd=tabProd;
tabProd=function(){const c=C[player];let rows='';const per={};
  for(const f of facs){if(provs[f.prov].owner!==player||f.state!=='ok')continue;if(f.type==='civ'){per['Деньги, млн $']=(per['Деньги, млн $']||0)+4*f.hp/100;continue;}const it=f.prod&&c.cat[f.prod];if(it)per[it.n]=(per[it.n]||0)+(f.rate||0)*24/it.h;}
  for(const k in per)rows+=`<span>${esc(k)}</span><b>${fN(per[k],1)} / сут.</b>`;
  const pcost=prodCost(c),net=c.budget-c.upk-pcost;
  let h=`<h3>Производство сейчас</h3>${rows?`<div class="kv">${rows}</div>`:'<div class="muted">Заводы работают только по заказам. Назначьте заводу постоянный выпуск в панели города.</div>'}
  <h3>Бюджет в сутки</h3><div class="kv"><span>Доход</span><b>+${fM(c.budget)}</b><span>Содержание армии и ПВО</span><b>−${fM(c.upk)}</b><span>Постоянный выпуск заводов</span><b>−${fM(pcost)}${capOn(c)&&prodCostFull(c)>pcost+.5?` <span class="muted">(хотели бы ${fM(prodCostFull(c))})</span>`:''}</b><span>Итого</span><b style="color:${net>=0?'var(--grn)':'var(--red)'}">${net>=0?'+':''}${fM(net)}</b></div>
  <label class="row"><input type="checkbox" data-act="spendCap" ${capOn(c)?'checked':''}><div class="nm"><b>Заводы тратят только свободные деньги</b><small>Выпуск оплачивается из того, что остаётся от дохода после содержания армии, — казна не тает. Выключите, чтобы тратить накопления. Серийный выпуск стоит ${Math.round(CONFIG.FACTORY_DISCOUNT*100)}% обычной цены.</small></div></label>
  ${net<0?'<div class="hint" style="border-color:var(--red);color:#ffb4ae">Расходы больше дохода: казна тает. Включите «только свободные деньги», переключите часть заводов на «по заказам» или постройте гражданские заводы.</div>':''}`;
  const stalled=c.queue.filter(q=>q.stalled);if(stalled.length)h+=`<div class="hint" style="border-color:var(--red);color:#ffb4ae">Стоят заказы: ${stalled.map(q=>esc(c.cat[q.k].n)).join(', ')} — нет заводов нужного типа.</div>`;
  h+=_tabProd();
  const shipSect=Object.keys(SHIPS).map(k=>{const it=c.cat['ship_'+k];return `<div class="row"><div class="nm"><b>${it.n}</b><small>${esc(it.d)} · ${hrs(it.h)} на линии</small></div><button class="btn" data-act="order" data-k="ship_${k}" ${c.money<it.cost*ui.qty?'disabled':''}>${fM(it.cost*ui.qty)}</button></div>`;}).join('');
  h+=`<h3>Флот</h3>${shipSect}<h3>Авиация</h3><div class="row"><div class="nm"><b>${c.cat.bomber.n}</b><small>${esc(c.cat.bomber.d)} · ${hrs(c.cat.bomber.h)} на линии</small></div><button class="btn" data-act="order" data-k="bomber" ${c.money<c.cat.bomber.cost*ui.qty?'disabled':''}>${fM(c.cat.bomber.cost*ui.qty)}</button></div>`;
  h+=`<h3>Снабжение и базы</h3><div class="row"><div class="nm"><b>Дальность дронов, ракет и авиации +${Math.round(CONFIG.RANGE_UP_STEP*100)}%</b><small>уровень ${c.rangeUp||0} из ${CONFIG.RANGE_UP_MAX} · дальше бить можно и с кораблей-носителей</small></div><button class="btn" data-act="rangeUp" ${(c.rangeUp||0)>=CONFIG.RANGE_UP_MAX?'disabled':''}>${fM(CONFIG.RANGE_UP_COST)}</button></div>`;
  return h;};
const _tabDip=tabDip;
tabDip=function(){const c=C[player];let h=`<h3>Репутация</h3><div class="kv"><span>Ваша репутация</span><b style="color:${(c.rep??70)<40?'var(--red)':'inherit'}">${Math.round(c.rep??70)} / 100</b></div>
  <div class="hint">Объявление войны −${CONFIG.DECLARE_REP}, внезапное нападение −${CONFIG.SURPRISE_REP}. Чем ниже репутация агрессора, тем охотнее другие страны помогают жертве деньгами, оружием, войсками или вступают в войну.</div>`;
  h+=_tabDip();
  const wars=[...c.wars].map(i=>C[i]).filter(x=>x.alive),others=C.filter(x=>x.alive&&x.id!==player&&x.wars.size&&!c.wars.has(x.id)).slice(0,8);
  if(others.length){h+=`<h3>Помочь стране в войне</h3>`;for(const x of others)h+=`<div class="row"><div class="nm"><b>${esc(x.name)}</b><small>воюет с: ${[...x.wars].slice(0,3).map(i=>esc(C[i].name)).join(', ')}</small></div><div class="chips"><span class="chip" data-act="aid" data-k="${x.id}:money">100 млн $</span><span class="chip" data-act="aid" data-k="${x.id}:drones">20 дронов</span><span class="chip" data-act="aid" data-k="${x.id}:troops">5 пехоты</span><span class="chip" data-act="aid" data-k="${x.id}:tanks">2 танка</span></div></div>`;}
  return h;};
