'use strict';
/* =================== УТИЛИТЫ =================== */
const $=s=>document.querySelector(s);
const R=(a,b)=>a+Math.random()*(b-a), RI=(a,b)=>Math.floor(R(a,b+1)), pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function fM(v){const a=Math.abs(v);if(a>=1000)return (v/1000).toFixed(2)+' млрд $';if(a<.1&&a>0)return Math.round(v*1000)+' тыс. $';return (a<10?String(Math.round(v*10)/10):String(Math.round(v)))+' млн $';}
function fB(v){return v>=1000?(v/1000).toFixed(2)+' трлн $':v.toFixed(v<10?1:0)+' млрд $';}
function fN(v,d=1){return (Math.round(v*10**d)/10**d).toString();}

/* =================== ГЕОГРАФИЯ =================== */
// Равнопромежуточная проекция: 10 px на градус. Расстояния считаются в километрах по сфере.
const S=10,LAT0=85,LATMIN=-60,W=360*S,H=(LAT0-LATMIN)*S,CELL=2,GW=W/CELL,GH=H/CELL,RAD=Math.PI/180;
const lonX=x=>x/S-180, latY=y=>LAT0-y/S, xLon=l=>(l+180)*S, yLat=l=>(LAT0-l)*S;
function km(x1,y1,x2,y2){const c=Math.cos(latY((y1+y2)/2)*RAD);const dx=(x2-x1)/S*111.32*c,dy=(y2-y1)/S*111.32;return Math.sqrt(dx*dx+dy*dy);}
// смещение точки на d км в сторону (tx,ty)
function towards(x,y,tx,ty,d){const L=km(x,y,tx,ty);if(L<=d||L===0)return [tx,ty];const f=d/L;return [x+(tx-x)*f,y+(ty-y)*f];}
function inBoxes(lat,lon,boxes){for(const b of boxes)if(lat>=b[0]&&lat<=b[1]&&lon>=b[2]&&lon<=b[3])return true;return false;}
function hash2(x,y){let h=(x*374761393+y*668265263)|0;h=(h^(h>>>13))*1274126177|0;return ((h^(h>>>16))>>>0)/4294967295;}

/* =================== ОБРАЗЦЫ ВООРУЖЕНИЙ =================== */
// Игровая модель: круглые цены (млн $), короткие сроки, у каждого образца одна понятная роль.
const GROUND={
 inf:{n:'Пехота',cost:20,h:24*3,hp:10,atk:1,def:1.5,up:.2,fac:'mil',d:'Дешёвая, хороша в обороне'},
 tank:{n:'Танки',cost:45,h:24*6,hp:14,atk:3,def:2,up:.4,fac:'mil',d:'Главная ударная сила'},
 art:{n:'Артиллерия',cost:30,h:24*5,hp:8,atk:2,def:.8,up:.3,fac:'mil',d:'Усиливает наступление'},
};
const ADT={
 shorad:{n:'ПВО ближняя',cost:25,h:24*4,range:40,mag:12,cd:.05,reload:.5,spd:3000,low:1,pk:{small:.5,drone:.7,uav:.7,cruise:.5,ballistic:0},up:.3,fac:'mil',d:'Сбивает дроны и крылатые ракеты, 40 км'},
 lrsam:{n:'ПВО дальняя',cost:120,h:24*10,range:200,mag:12,cd:.1,reload:2,spd:5000,low:.4,pk:{small:.15,drone:.5,uav:.9,cruise:.75,ballistic:.65},up:1,fac:'mil',d:'200 км, единственная защита от баллистики'},
 ew:{n:'РЭБ',cost:15,h:24*3,range:40,ew:true,up:.2,fac:'mil',d:'Глушит FPV и ударные дроны в радиусе 40 км'},
};
const WPN={
 recon:{n:'Разведдрон',cls:'uav',cost:2,h:12,fac:'drone',range:300,spd:110,reveal:60,loiter:12,ew:.2,d:'Снимает туман войны и возвращается'},
 fpv:{n:'FPV-дроны (10 шт.)',cls:'small',cost:1,h:2,fac:'drone',range:'front',spd:90,cnt:10,ew:.5,dmg:{troops:.025,ad:.02,industry:0,energy:.002},d:'Бьют войска на линии фронта'},
 shahed:{n:'Ударный дрон',cls:'drone',cost:2,h:6,fac:'drone',range:1500,spd:185,ew:.15,dmg:{troops:1.5,ad:.1,industry:.1,energy:.03},d:'Дешёвый, запускайте стаей'},
 cruise:{n:'Крылатая ракета',cls:'cruise',cost:15,h:24,fac:'mil',range:1500,spd:800,ew:.03,dmg:{troops:6,ad:.35,industry:.35,energy:.1},d:'Летит низко, сбить трудно'},
 ballistic:{n:'Баллистическая ракета',cls:'ballistic',cost:25,h:48,fac:'mil',range:800,spd:6000,ew:0,dmg:{troops:10,ad:.5,industry:.5,energy:.12},d:'Сбивает только дальняя ПВО'},
};
const BUILD={
 civ:{n:'Гражданский завод',cost:60,h:24*8,d:'+4 млн $ в сутки'},
 mil:{n:'Военный завод',cost:120,h:24*12,d:'+2 линии: войска, ПВО, ракеты'},
 drone:{n:'Завод дронов',cost:80,h:24*8,d:'+3 линии производства дронов'},
 fort:{n:'Укрепления',cost:30,h:24*5,d:'+25% к обороне города (до 3)'},
};
const LINES={mil:2,drone:3};
const BASE={};for(const k in GROUND)BASE[k]={...GROUND[k],t:'g'};for(const k in ADT)BASE[k]={...ADT[k],t:'a'};for(const k in WPN)BASE[k]={...WPN[k],t:'w'};
const PRIO={troops:'Войска',ad:'ПВО',industry:'Заводы',energy:'Энергетика'};
const TERR={1:{n:'Равнина',def:1},2:{n:'Лес',def:1.25},3:{n:'Горы',def:1.6}};
const CITY_INCOME={1:3,2:6,3:10}; // доход города в сутки по размеру; столица +15, гражданский завод +4
const START=Date.UTC(2026,9,21);
const FIXED_COLORS={'Russia':'#a8453f','Ukraine':'#cfae3c','United States of America':'#3568b0','China':'#c9703a','United Kingdom':'#7d4f9a','France':'#4c78c8','Germany':'#6f7a82','Poland':'#c25070','Belarus':'#8a5a45','Turkey':'#b85a48','Iran':'#3d8a5f','Israel':'#3f9fc4','India':'#d99a3a','Pakistan':'#2f7d4a','Japan':'#b9b9c4','South Korea':'#5a8fd0','North Korea':'#734d93','Saudi Arabia':'#4f8a45','Kazakhstan':'#3f9aad','Taiwan':'#5aa0a8','Egypt':'#b39a5a','Italy':'#4f9a72','Spain':'#c08a3a','Canada':'#9c5b8f','Brazil':'#4f9a50','Australia':'#c27a3f'};

/* =================== СОСТОЯНИЕ =================== */
let provs=[],C=[],CK={},ads=[],projs=[],ints=[],moves=[],fx=[],salvos={},logs=[];
let cellProv,cellTerr,cellNoise,cellCountry,provCells=[];
let time=0,hourAcc=0,visAcc=0,player=-1,speed=6,running=false,started=false,over=false,aiMul=1,scen='2026';
let segs=[],pathProv,pathCoast,pathBorder,pathCtrl,provPaths=[],labelPos=[],grat;
let adId=0,pid=0,svId=0,panelDirty=true,ctrlDirty=true;
const baseCv=document.createElement('canvas'),fogCv=document.createElement('canvas');
baseCv.width=fogCv.width=GW;baseCv.height=fogCv.height=GH;
let baseImg,fogImg,baseDirty=new Set(),fogDirty=new Set(),lastPut=0;
const sb={allTech:false,money:false,instant:false,infStock:false,range:false,immortal:false,noAI:false};
let fpsCap=144,fpsShown=0;try{const v=localStorage.getItem('lf_fps');if(v!==null)fpsCap=+v;}catch(e){}
const ui={gmode:'campaign',tab:'prov',sel:null,mode:null,wk:null,adk:null,salvo:10,prio:'troops',frac:1,qty:1,showAD:true,fog:true,mouseDown:false,hover:null,mx:0,my:0,menuSel:null,diff:1,pending:null,search:''};

/* =================== ПОСТРОЕНИЕ МИРА =================== */
function decodeTopo(t){const [sx,sy]=t.transform.scale,[tx,ty]=t.transform.translate;
  const arcs=t.arcs.map(a=>{let x=0,y=0;return a.map(p=>{x+=p[0];y+=p[1];return [x*sx+tx,y*sy+ty];});});
  return arcs;}
function buildWorld(){
  const T=window.TOPO,arcs=decodeTopo(T),geoms=T.objects.countries.geometries;
  const arcPts=i=>i>=0?arcs[i]:arcs[~i].slice().reverse();
  const keyOf=n=>MERGE[n]||n;
  // государства
  const keys=[];for(const g of geoms){const n=g.properties.name;if(SKIP_COUNTRIES.includes(n))continue;const k=keyOf(n);if(!keys.includes(k))keys.push(k);}
  // растр стран
  const cv=document.createElement('canvas');cv.width=GW;cv.height=GH;const cx=cv.getContext('2d');
  const col=k=>[k+1,((k+1)*7)&255,((k+1)*13+50)&255];
  const arcUse=arcs.map(()=>new Set());landRings=[];arcLines=[];LODS={};
  for(const g of geoms){const n=g.properties.name;if(SKIP_COUNTRIES.includes(n))continue;const k=keys.indexOf(keyOf(n));
    const polys=g.type==='Polygon'?[g.arcs]:g.type==='MultiPolygon'?g.arcs:[];
    const [r,gg,b]=col(k);cx.fillStyle=`rgb(${r},${gg},${b})`;cx.beginPath();
    for(const poly of polys)for(const ring of poly){const pts=[];let off=0,prev=null,mn=1e9,mx=-1e9;
      for(const ai of ring){arcUse[ai<0?~ai:ai].add(k);for(const [lo,la] of arcPts(ai)){if(prev!==null){if(lo+off-prev>180)off-=360;else if(lo+off-prev<-180)off+=360;}const L=lo+off;prev=L;mn=Math.min(mn,L);mx=Math.max(mx,L);pts.push(L,la);}}
      for(const sh of [0,mx>180?-360:null,mn<-180?360:null]){if(sh===null)continue;for(let j=0;j<pts.length;j+=2){const X=(pts[j]+sh+180)*S/CELL,Y=(LAT0-pts[j+1])*S/CELL;if(j)cx.lineTo(X,Y);else cx.moveTo(X,Y);}cx.closePath();const rr=new Float32Array(pts.length);for(let j=0;j<pts.length;j+=2){rr[j]=(pts[j]+sh+180)*S;rr[j+1]=(LAT0-pts[j+1])*S;}landRings.push(rr);}}
    cx.fill('evenodd');}
  const img=cx.getImageData(0,0,GW,GH).data,N=GW*GH;
  const lut=new Map();keys.forEach((k,i)=>{const [r,g,b]=col(i);lut.set((r<<16)|(g<<8)|b,i);});
  cellCountry=new Int16Array(N);
  for(let i=0;i<N;i++){const o=i*4;if(img[o+3]<110){cellCountry[i]=-1;continue;}const v=lut.get((img[o]<<16)|(img[o+1]<<8)|img[o+2]);cellCountry[i]=v===undefined?-2:v;}
  for(let pass=0;pass<4;pass++)for(let i=0;i<N;i++)if(cellCountry[i]===-2){const x=i%GW;
    const nb=[x>0?cellCountry[i-1]:-2,x<GW-1?cellCountry[i+1]:-2,i>=GW?cellCountry[i-GW]:-2,i<N-GW?cellCountry[i+GW]:-2].filter(v=>v>=0);if(nb.length)cellCountry[i]=nb[0];}
  for(let i=0;i<N;i++)if(cellCountry[i]===-2)cellCountry[i]=-1;
  // Крым: международно признанная территория Украины
  const ua=keys.indexOf('Ukraine');
  for(let y=0;y<GH;y++){const la=latY(y*CELL+1);if(la<44.35||la>46.1)continue;for(let x=0;x<GW;x++){const lo=lonX(x*CELL+1);if(lo<32.4||lo>36.62)continue;const i=y*GW+x;if(cellCountry[i]>=0)cellCountry[i]=ua;}}
  // города → провинции
  const cityList=[];const byCountry=keys.map(()=>[]);
  keys.forEach((k,ki)=>{const s=CITIES[k];if(!s)return;s.split(';').forEach((e,j)=>{const [n,la,lo,pp]=e.split(',');const c={name:n,lat:+la,lon:+lo,pop:+pp,k:ki,cap:j===0,x:xLon(+lo),y:yLat(+la)};cityList.push(c);byCountry[ki].push(c);});});
  const assign=new Int32Array(N).fill(-1);
  const single=keys.map(()=>null);
  for(let y=0;y<GH;y++){const wy=y*CELL+1,cosl=Math.cos(latY(wy)*RAD);for(let x=0;x<GW;x++){const i=y*GW+x,k=cellCountry[i];if(k<0)continue;
    const list=byCountry[k];if(!list.length){assign[i]=-2-k;continue;}const wx=x*CELL+1;let b=null,bd=1e18;
    for(const c of list){const dx=(c.x-wx)*cosl,dy=c.y-wy,d=dx*dx+dy*dy;if(d<bd){bd=d;b=c;}}assign[i]=cityList.indexOf(b);}}
  // формирование провинций
  const idOfCity=new Map(),idOfCountry=new Map();provs=[];
  const mk=(name,k,city)=>{const p={id:provs.length,name,ck:keys[k],ki:k,city,n:0,mx:0,my:0,nbS:new Set(),coastal:false,armies:{},b:{civ:0,mil:0,drone:0},fort:0,dmg:0,build:null,owner:k,core:k,capital:false,vis:false,battle:false};provs.push(p);return p;};
  cellProv=new Int16Array(N).fill(-1);
  for(let i=0;i<N;i++){const a=assign[i];if(a===-1)continue;let p;
    if(a>=0){p=idOfCity.get(a);if(!p){const c=cityList[a];p=mk(c.name,c.k,c);idOfCity.set(a,p);}}
    else{const k=-2-a;p=idOfCountry.get(k);if(!p){p=mk(COUNTRY_DATA[keys[k]]?COUNTRY_DATA[keys[k]][0]:keys[k],k,null);idOfCountry.set(k,p);}}
    cellProv[i]=p.id;p.n++;p.mx+=i%GW;p.my+=(i/GW)|0;}
  for(const p of provs){p.mx/=p.n;p.my/=p.n;}
  if(true){const best=provs.map(()=>1e18);for(let i=0;i<N;i++){const k=cellProv[i];if(k<0)continue;const p=provs[k];if(p.city)continue;const x=i%GW,y=(i/GW)|0,d=(x-p.mx)**2+(y-p.my)**2;if(d<best[k]){best[k]=d;p.cx=x*CELL+1;p.cy=y*CELL+1;}}}
  for(const p of provs){if(p.city){p.cx=p.city.x;p.cy=p.city.y;}p.lat=latY(p.cy);p.lon=lonX(p.cx);}
  // клетки, соседство, побережье, границы
  const cnt=new Int32Array(provs.length);for(let i=0;i<N;i++)if(cellProv[i]>=0)cnt[cellProv[i]]++;
  provCells=provs.map(p=>new Int32Array(cnt[p.id]));const fill=new Int32Array(provs.length);
  for(let i=0;i<N;i++){const k=cellProv[i];if(k>=0)provCells[k][fill[k]++]=i;}
  segs=[];
  for(let x=1;x<GW;x++){let y0=-1,pa=0,pb=0;for(let y=0;y<=GH;y++){let a=-9,b=-9;if(y<GH){a=cellProv[y*GW+x-1];b=cellProv[y*GW+x];}
      const diff=y<GH&&a!==b;if(y0>=0&&(!diff||a!==pa||b!==pb)){segs.push(x*CELL,y0*CELL,x*CELL,y*CELL,pa,pb);y0=-1;}
      if(diff&&y0<0){y0=y;pa=a;pb=b;}
      if(diff){if(a>=0&&b>=0){provs[a].nbS.add(b);provs[b].nbS.add(a);}else if(a>=0)provs[a].coastal=true;else if(b>=0)provs[b].coastal=true;}}}
  for(let y=1;y<GH;y++){let x0=-1,pa=0,pb=0;for(let x=0;x<=GW;x++){let a=-9,b=-9;if(x<GW){a=cellProv[(y-1)*GW+x];b=cellProv[y*GW+x];}
      const diff=x<GW&&a!==b;if(x0>=0&&(!diff||a!==pa||b!==pb)){segs.push(x0*CELL,y*CELL,x*CELL,y*CELL,pa,pb);x0=-1;}
      if(diff&&x0<0){x0=x;pa=a;pb=b;}
      if(diff){if(a>=0&&b>=0){provs[a].nbS.add(b);provs[b].nbS.add(a);}else if(a>=0)provs[a].coastal=true;else if(b>=0)provs[b].coastal=true;}}}
  for(const p of provs){p.nb=[...p.nbS];delete p.nbS;}
  // рельеф и шум для подложки
  cellTerr=new Uint8Array(N);cellNoise=new Uint8Array(N);
  for(let y=0;y<GH;y++){const la=latY(y*CELL+1);for(let x=0;x<GW;x++){const i=y*GW+x;if(cellProv[i]<0)continue;const lo=lonX(x*CELL+1);
    cellTerr[i]=inBoxes(la,lo,MOUNTAINS)?3:inBoxes(la,lo,FORESTS)?2:1;cellNoise[i]=hash2(x>>1,y>>1)*40+hash2(x,y)*20;}}
  // векторные контуры
  arcs.forEach((a,i)=>{const u=arcUse[i];if(!u.size)return;let line=[],prev=null;
    const push=()=>{if(line.length>=4)arcLines.push({b:u.size>1,p:Float32Array.from(line)});line=[];};
    a.forEach(([lo,la],j)=>{if(j&&Math.abs(prev-lo)>180)push();line.push(xLon(lo),yLat(la));prev=lo;});push();});
  pathProv=new Path2D();provPaths=provs.map(()=>new Path2D());
  for(let i=0;i<segs.length;i+=6){const a=segs[i+4],b=segs[i+5];if(a>=0&&b>=0&&provs[a].ki===provs[b].ki){pathProv.moveTo(segs[i],segs[i+1]);pathProv.lineTo(segs[i+2],segs[i+3]);}
    if(a>=0){provPaths[a].moveTo(segs[i],segs[i+1]);provPaths[a].lineTo(segs[i+2],segs[i+3]);}if(b>=0){provPaths[b].moveTo(segs[i],segs[i+1]);provPaths[b].lineTo(segs[i+2],segs[i+3]);}}
  grat=new Path2D();for(let lo=-180;lo<=180;lo+=10){grat.moveTo(xLon(lo),0);grat.lineTo(xLon(lo),H);}for(let la=80;la>=LATMIN;la-=10){grat.moveTo(0,yLat(la));grat.lineTo(W,yLat(la));}
  // статические параметры провинций
  for(const p of provs){const k=p.ck,d=COUNTRY_DATA[k]||[k,1,5,0,'GEN'];
    const mates=provs.filter(q=>q.ki===p.ki),wsum=mates.reduce((s,q)=>s+Math.pow(q.city?q.city.pop:1,.6),0);
    const w=Math.pow(p.city?p.city.pop:1,.6)/wsum;p.pop=d[1]*w;p.gdp=d[2]*w;
    const cp=p.city?p.city.pop:p.pop;p.level=cp>=3?3:cp>=.8?2:1;
    const la=p.lat,lo=p.lon;p.terrain=inBoxes(la,lo,MOUNTAINS)?3:inBoxes(la,lo,FORESTS)?2:1;}
  baseImg=baseCv.getContext('2d').createImageData(GW,GH);fogImg=fogCv.getContext('2d').createImageData(GW,GH);
  WORLD_KEYS=keys;
}
let WORLD_KEYS=[],landRings=[],arcLines=[],LODS={};
// Упрощённые контуры для разных масштабов: точки ближе tol (px карты) пропускаются
function addPoly(P,a,tol,close){let lx=a[0],ly=a[1];P.moveTo(lx,ly);const n=a.length;
  for(let j=2;j<n;j+=2){const x=a[j],y=a[j+1];if(j<n-2&&Math.abs(x-lx)+Math.abs(y-ly)<tol)continue;P.lineTo(x,y);lx=x;ly=y;}if(close)P.closePath();}
function lod(z){const tols=[.25,.8,2.5,7];let t=tols[0];for(const v of tols)if(v<=.9/z)t=v;
  if(!LODS[t]){const L={land:new Path2D(),coast:new Path2D(),border:new Path2D()};for(const r of landRings)addPoly(L.land,r,t,true);for(const a of arcLines)addPoly(a.b?L.border:L.coast,a.p,t,false);LODS[t]=L;}return LODS[t];}

/* =================== ГОСУДАРСТВА =================== */
function colorFor(k,i){if(FIXED_COLORS[k])return FIXED_COLORS[k];const h=(i*137.508)%360,s=30+(i*7)%18,l=40+(i*11)%16;return hslHex(h,s,l);}
function hslHex(h,s,l){s/=100;l/=100;const f=n=>{const k=(n+h/30)%12,a=s*Math.min(l,1-l);const c=l-a*Math.max(-1,Math.min(k-3,9-k,1));return Math.round(255*c).toString(16).padStart(2,'0');};return '#'+f(0)+f(8)+f(4);}
function deepMerge(a,b){const r={...a};for(const k in b){r[k]=(typeof b[k]==='object'&&!Array.isArray(b[k]))?{...(a[k]||{}),...b[k]}:b[k];}return r;}
function initCountries(){
  ads=[];projs=[];ints=[];moves=[];fx=[];salvos={};logs=[];time=0;hourAcc=0;adId=0;facs=[];facId=0;
  for(const p of provs){p.owner=p.core=p.ki;p.armies={};p.b={civ:0,mil:0,drone:0};p.fort=0;p.dmg=0;p.build=null;p.capital=false;p.vis=false;p.battle=false;p.integ=100;p.rad=0;p.capT=-1e9;}
  CK={};
  C=WORLD_KEYS.map((k,i)=>{const d=COUNTRY_DATA[k]||[k,1,5,0,'GEN'];const bloc=d[4];
    const cat={};for(const key in BASE)cat[key]={...BASE[key],model:(BLOC_NAMES[bloc]||BLOC_NAMES.GEN)[key]};
    const c={id:i,key:k,name:d[0],pop0:d[1],gdp0:d[2],def0:d[3],bloc,color:colorFor(k,i),cat,
      share:clamp(d[2]?d[3]/d[2]:.002,.002,.4),baseShare:clamp(d[2]?d[3]/d[2]:.002,.002,.4),gdpMul:1,money:0,alive:true,wars:new Set(),warStart:{},
      stock:{},adRes:{},queue:[],doct:{lrNoDrones:true,mrNoSmall:true},capital:-1,rally:null,initProvs:0,aiHour:RI(0,23),isPlayer:false,
      lines:{mil:0,drone:0},peaceOffer:false,mobCd:0,st:{launched:0,lost:0,intercepted:0,shots:0},deliv:{},gdpCur:0,budget:0,upk:0,aid:0,aidFrom:'',
      pacts:PACTS.filter(pc=>pc.m.includes(k)),heavy:HEAVY_MAKERS.includes(bloc)&&d[3]>=3,canImport:!NO_IMPORT.includes(k)};
    CK[k]=c;return c;});
  for(const c of C){const my=provs.filter(p=>p.ki===c.id);c.initProvs=my.length;if(!my.length){c.alive=false;continue;}
    const cap=my.find(p=>p.city&&p.city.cap)||my.sort((a,b)=>b.pop-a.pop)[0];cap.capital=true;c.capital=cap.id;}
  for(const c of C)if(c.alive)setupCountry(c);
  if(typeof loadExt==='function')loadExt(null);economyPass();for(const c of C)c.money=c.budget*20;
}
function slots(p){return 1+p.level+(p.capital?2:0);}
function usedSlots(p){return facsIn(p).length;}
function army(p,o){return p.armies[o]||(p.armies[o]={inf:0,tank:0,art:0,from:null});}
function setupCountry(c){
  const my=provs.filter(p=>p.owner===c.id),cap=provs[c.capital],def=c.def0;
  const border=my.filter(p=>p.nb.some(n=>provs[n].owner!==c.id));
  // сухопутные силы
  let f=FORCES[c.key];if(!f){const t=clamp(Math.round(def*1.4+c.pop0*.08),2,150);f=[Math.ceil(t*.7),Math.round(t*.15),Math.round(t*.15)];}
  const wt=my.map(p=>(p.capital?4:1)+(border.includes(p)?2:0)+p.level*.5),ws=wt.reduce((a,b)=>a+b,0);
  my.forEach((p,i)=>{const a=army(p,c.id),s=wt[i]/ws;a.inf=f[0]*s;a.tank=f[1]*s;a.art=f[2]*s;if(border.includes(p))p.fort=1;});
  // заводы
  const sorted=[...my].sort((a,b)=>b.pop-a.pop);
  const place=(t,n)=>{for(let k=0;k<n;k++){const cand=sorted.filter(p=>usedSlots(p)<slots(p));if(!cand.length)return;addFac(cand[Math.min(cand.length-1,k%Math.min(4,cand.length))],t,'ok');}};
  const dOver={'Russia':9,'Ukraine':8,'Iran':6,'China':14,'United States of America':8,'Turkey':5,'Israel':4};
  place('mil',clamp(Math.round(def/12)+1,1,15));place('drone',dOver[c.key]??clamp(Math.round(def/25)+1,1,8));place('civ',clamp(Math.round(c.gdp0/400),0,30));
  // ПВО
  const A={'Russia':[14,20,30,40,12],'Ukraine':[6,10,18,40,12],'Israel':[3,4,10,10,4],'United States of America':[15,30,40,50,15]}[c.key]||
    [Math.round(def/60),clamp(Math.round(def/20),0,30),clamp(Math.round(def/6),0,40),clamp(Math.round(def/2)+1,1,50),clamp(Math.round(def/10),0,15)];
  const nA={lrsam:Math.min(12,A[0]+Math.round(A[1]/2)),shorad:clamp(A[2]+Math.round(A[3]/3),1,40),ew:Math.min(15,A[4])};
  for(const t in nA)for(let k=0;k<nA[t];k++){let p;
      if(t==='lrsam')p=k===0?cap:sorted[k%Math.min(sorted.length,8)];
      else if(t==='ew')p=border.length?border[k%border.length]:sorted[k%sorted.length];
      else p=sorted[k%Math.min(sorted.length,12)];addAD(c.id,t,p);}
  // склады
  const sk=STOCKS[c.key];
  c.stock=sk?{...sk}:{recon:Math.round(def*.3)+3,fpv:Math.round(def*2)+10,shahed:Math.round(def)+10,cruise:Math.round(def*.3)+2,ballistic:Math.round(def*.15)+1};
}
function addAD(o,t,p,ready=0,x,y){const r=Math.min(30,C[o].cat[t].range*.4+5);
  const a={id:++adId,owner:o,type:t,x:x??p.cx+R(-1,1)*r/111*S,y:y??p.cy+R(-1,1)*r/111*S,prov:p.id,ammo:C[o].cat[t].mag||0,cd:0,rl:0,ready,spot:{}};ads.push(a);return a;}
function applyScenario(){
  if(scen!=='2026')return;
  const ru=CK['Russia'],ua=CK['Ukraine'];if(!ru||!ua)return;
  for(const p of provs)if(p.city&&OCCUPIED_2026[p.name]&&p.core===ua.id){const occ=CK[OCCUPIED_2026[p.name]];
    const a=p.armies[ua.id];delete p.armies[ua.id];ads=ads.filter(x=>!(x.prov===p.id&&x.owner===ua.id));p.owner=occ.id;p.fort=2;facs=facs.filter(f=>f.prov!==p.id);p.dmg=.3;
    const ra=army(p,occ.id);ra.inf=14;ra.tank=3;ra.art=5;if(a){const h=army(provs[ua.capital],ua.id);h.inf+=a.inf*.5;}}
  ru.wars.add(ua.id);ua.wars.add(ru.id);ru.warStart[ua.id]=ua.warStart[ru.id]=0;
  // фронт: основные силы обеих сторон у линии соприкосновения
  const front=(c,e)=>provs.filter(p=>p.owner===c.id&&p.nb.some(n=>provs[n].owner===e.id));
  for(const [c,e,share] of [[ru,ua,.55],[ua,ru,.6]]){const fr=front(c,e);if(!fr.length)continue;let pool={inf:0,tank:0,art:0};
    for(const p of provs){if(p.owner!==c.id||fr.includes(p))continue;const a=p.armies[c.id];if(!a)continue;for(const t in pool){const m=a[t]*share;a[t]-=m;pool[t]+=m;}}
    fr.forEach(p=>{const a=army(p,c.id);for(const t in pool)a[t]+=pool[t]/fr.length;p.fort=Math.max(p.fort,2);});}
  // ПВО Украины прикрывает крупные города, Россия — приграничные регионы
  log('Обстановка на 21 октября 2026 года: продолжается война России и Украины. Линия соприкосновения проходит по Донбассу, Запорожью и Херсонщине.','warn');
}

/* =================== ПОМОЩНИКИ =================== */
function cellAt(x,y){if(x<0||y<0||x>=W||y>=H)return -1;return ((y/CELL)|0)*GW+((x/CELL)|0);}
function provAt(x,y){const i=cellAt(x,y);return i<0?-1:cellProv[i];}
function atWar(a,b){return a!==b&&a>=0&&b>=0&&C[a].wars.has(b);}
function tot(a){return a?a.inf+a.tank+a.art:0;}
function pw(a,m){return a?a.inf*GROUND.inf[m]+a.tank*GROUND.tank[m]+a.art*GROUND.art[m]:0;}
function hpSum(a){return a.inf*10+a.tank*14+a.art*8;}
function loss(a,pts){const s=hpSum(a);if(s<=0)return;const f=Math.max(0,1-pts/s);a.inf*=f;a.tank*=f;a.art*=f;}
function myProvs(o){return provs.filter(p=>p.owner===o);}
function nearestOwn(o,x,y){let b=null,bd=1e9;for(const p of provs)if(p.owner===o){const d=km(p.cx,p.cy,x,y);if(d<bd){bd=d;b=p;}}return b;}
function nm(c,k){return c.cat[k].n;}
function costOf(c,k){return c.cat[k].cost;}
function canMake(c,k){return true;}
function canImport(c,k){return false;}
function frontSite(o,pi){const p=provs[pi];const has=q=>q.armies[o]&&tot(q.armies[o])>.05;if(has(p))return p;let best=null;for(const n of p.nb){const q=provs[n];if(has(q)&&(q.owner===o||!best))best=q;}return best;}
function nearSite(o,pi){const p=provs[pi];if(p.owner===o)return p;for(const n of p.nb)if(provs[n].owner===o)return provs[n];return frontSite(o,pi);}
function strength(c){let s=0;for(const p of provs){const a=p.armies[c.id];if(a)s+=pw(a,'atk')+pw(a,'def');}for(const m of moves)if(m.owner===c.id)s+=pw(m.u,'atk')+pw(m.u,'def');
  for(const a of ads)if(a.owner===c.id)s+=c.cat[a.type].cost/150;return s+c.budget/10;}
function dateStr(h){const d=new Date(START+h*3600e3);const p=n=>String(n).padStart(2,'0');return `${p(d.getUTCDate())}.${p(d.getUTCMonth()+1)}.${d.getUTCFullYear()} ${p(d.getUTCHours())}:00`;}
function log(txt,cls=''){logs.unshift({t:time,txt,cls});if(logs.length>400)logs.pop();if(ui.tab==='log')panelDirty=true;}
function toast(txt,cls=''){const el=document.createElement('div');el.className='toast '+cls;el.textContent=txt;$('#toasts').appendChild(el);setTimeout(()=>el.remove(),5200);const all=$('#toasts').children;if(all.length>5)all[0].remove();}
function boom(x,y,r,col){fx.push({x,y,r,t:0,max:.7+r/40,col});}
function markOwner(p){baseDirty.add(p.id);ctrlDirty=true;}

/* =================== ЭКОНОМИКА =================== */
function provIncome(p){return (CITY_INCOME[p.level]+(p.capital?15:0)+p.b.civ*4)*(1-p.dmg)*(p.core===p.owner?1:.7);}
function economyPass(){
  syncFac();for(const c of C){c.inc=0;c.upk=0;c.ncity=0;}
  for(const p of provs){const c=C[p.owner];c.inc+=provIncome(p);c.ncity++;
    for(const o in p.armies){const a=p.armies[o];C[o].upk+=a.inf*GROUND.inf.up+a.tank*GROUND.tank.up+a.art*GROUND.art.up;}}
  for(const m of moves)C[m.owner].upk+=m.u.inf*GROUND.inf.up+m.u.tank*GROUND.tank.up+m.u.art*GROUND.art.up;
  for(const a of ads)C[a.owner].upk+=C[a.owner].cat[a.type].up;
  for(const c of C){if(!c.alive)continue;c.gdpCur=c.inc;c.aid=0;c.aidFrom='';
    for(const A of AID)if(A.to===c.key&&(!A.vs||(CK[A.vs]&&c.wars.has(CK[A.vs].id)))){c.aid+=A.day;c.aidFrom=A.from;}
    c.budget=c.inc*(c.isPlayer?1.3:aiMul)*((c.sanction||0)>time?.7:1)+c.aid;}
  if(sb.money&&player>=0)C[player].money=Math.max(C[player].money,1e6);}
function economyHour(){economyPass();
  for(const c of C){if(!c.alive)continue;c.money+=(c.budget-c.upk)/24;}}

/* =================== ДИПЛОМАТИЯ И СОЮЗЫ =================== */
let pendingPrompt=[];
function declareWar(a,b,chain=true,why=''){if(a===b||!C[a].alive||!C[b].alive||C[a].wars.has(b))return;
  C[a].wars.add(b);C[b].wars.add(a);C[a].warStart[b]=C[b].warStart[a]=time;
  C[a].peaceOffer=false;
  const msg=`${C[a].name} объявляет войну: ${C[b].name}${why?` (${why})`:''}.`;
  log(msg,a===player||b===player?'bad':'warn');if(b===player)toast(`${C[a].name} объявила вам войну!`,'bad');else if(a===player||(!why&&(C[a].def0>20||C[b].def0>20)))toast(msg,'warn');
  panelDirty=true;fogAll();repaintAll();
  if(chain)for(const pc of C[b].pacts){if(pc.m.includes(C[a].key))continue;
    for(const mk of pc.m){const x=CK[mk];if(!x||!x.alive||x.id===b||x.id===a||x.wars.has(a))continue;
      if(x.id===player){pendingPrompt.push({ally:b,enemy:a,pact:pc.name});continue;}
      if(Math.random()<pc.prob)declareWar(x.id,a,false,`по обязательствам: ${pc.name}`);}}
  if(pendingPrompt.length)showPrompt();}
function showPrompt(){if(!pendingPrompt.length||$('#over').style.display==='flex')return;const q=pendingPrompt[0];running=false;setSpeedUI();
  showOver(`<h2>Союзник атакован</h2><p>${esc(C[q.enemy].name)} напала на ${esc(C[q.ally].name)}. Договор «${esc(q.pact)}» обязывает вас вступиться.</p><p class="muted">Отказ не нарушает игру, но союзники это запомнят.</p>
  <div style="display:flex;gap:8px"><button class="btn dng" data-act="joinWar">Вступить в войну</button><button class="btn" data-act="skipWar">Воздержаться</button></div>`);}
function makePeace(a,b){C[a].wars.delete(b);C[b].wars.delete(a);
  for(const p of provs)for(const [x,y] of [[a,b],[b,a]]){if(p.owner===y&&p.armies[x]&&tot(p.armies[x])>0){const home=provs[C[x].capital];const h=army(home,x),u=p.armies[x];h.inf+=u.inf;h.tank+=u.tank;h.art+=u.art;delete p.armies[x];}}
  log(`Перемирие: ${C[a].name} и ${C[b].name}. Линия соприкосновения закреплена.`,'ok');
  if(a===player||b===player)toast(`Перемирие с государством «${C[a===player?b:a].name}»`,'ok');
  C[a].peaceOffer=C[b].peaceOffer=false;panelDirty=true;fogAll();repaintAll();}
function aiPeaceAnswer(ai,other){
  const lost=provs.filter(p=>p.core===ai.id&&p.owner===other.id).length,gained=provs.filter(p=>p.core===other.id&&p.owner===ai.id).length;
  const days=(time-(ai.warStart[other.id]||0))/24,sA=strength(ai),sO=strength(other);
  if(days<14)return [false,'Война идёт меньше двух недель — переговоры отклонены.'];
  if(gained>lost&&sA>sO*.7)return [false,'Противник считает, что выигрывает, и продолжает боевые действия.'];
  if(lost>=Math.max(2,ai.initProvs*.2)||sO>sA*1.6||(days>120&&Math.random()<.4))return [true,''];
  return [false,'Отказ. Нужно военное преимущество или занятые территории противника.'];}
function captureProvince(p,o){
  const old=p.owner;p.owner=o;delete p.armies[old];if(p.armies[o])p.armies[o].rest=time+72;
  ads=ads.filter(a=>!(a.prov===p.id&&a.owner===old));
  let lostF=0;for(const f of facsIn(p)){if(f.state==='build'){f.state='ruin';f.hp=0;continue;}if(f.state==='ok'&&Math.random()<.5){f.hp-=60;if(f.hp<=0){f.hp=0;f.state='ruin';lostF++;}}}syncFac();
  p.build=null;p.capT=time;p.fort=Math.floor(p.fort/2);p.dmg=Math.min(.9,p.dmg+.2);markOwner(p);
  if(o===player)log(`Взят под контроль регион ${p.name}${lostF?`, разрушено предприятий: ${lostF}`:''}.`,'ok');
  else if(old===player)log(`Потерян регион ${p.name} (${C[o].name}).`,'bad');
  if(old===player||o===player)toast(o===player?`Взят регион ${p.name}`:`Потерян регион ${p.name}`,o===player?'ok':'bad');
  fogAll();panelDirty=true;
  const oc=C[old],rem=myProvs(old);
  if(p.capital){p.capital=false;
    if(!rem.length||(rem.length<oc.initProvs*.35&&!(old===player&&sb.immortal))){capitulate(old,o);return;}
    const nc=rem.sort((a,b)=>b.pop-a.pop)[0];nc.capital=true;oc.capital=nc.id;oc.money*=.7;
    log(`${oc.name} теряет столицу! Правительство переезжает в ${nc.name}.`,'warn');toast(`${oc.name} теряет столицу`,'warn');}
  else if(!rem.length||rem.length<oc.initProvs*.2)capitulate(old,o);}
function capitulate(ci,to){const c=C[ci];if(!c.alive)return;if(ci===player&&sb.immortal&&myProvs(ci).length)return;c.alive=false;
  for(const p of provs){if(p.owner===ci){p.owner=to;p.capital=false;markOwner(p);}delete p.armies[ci];}
  ads=ads.filter(a=>a.owner!==ci);moves=moves.filter(m=>m.owner!==ci);
  for(const x of C)x.wars.delete(ci);c.wars.clear();c.queue=[];
  log(`${c.name} капитулирует. Территория переходит под контроль: ${C[to].name}.`,to===player?'ok':'warn');toast(`${c.name} капитулировала`,'warn');fogAll();repaintAll();
  if(ci===player)endGame();}

/* =================== ПРОИЗВОДСТВО =================== */
function order(c,k,qty,dest){const it=c.cat[k];if(!it)return 'Неизвестный образец.';
  const cost=it.cost*qty;if(c.money<cost)return `Недостаточно средств: нужно ${fM(cost)}.`;
  c.money-=cost;if(c.isPlayer&&sb.instant){deliver(c,k,qty,dest);return null;}c.queue.push({k,qty,left:qty,prog:0,paid:cost,dest});return null;}
function deliver(c,k,n,dest){
  const tk=(c.cat[k]||BASE[k]).t;if(tk==='g'){if(reinfDeliver(c,k,n,dest)){}else if(c.isPlayer){depot(c)[k]+=n;}else{const p=c.rally!=null&&provs[c.rally].owner===c.id?provs[c.rally]:provs[c.capital];army(p,c.id)[k]+=n;}}
  else if(tk==='a')c.adRes[k]=(c.adRes[k]||0)+n;else c.stock[k]=(c.stock[k]||0)+n;
  if(c.isPlayer)c.deliv[k]=(c.deliv[k]||0)+n;}
function production(c){
  const lines={mil:0,drone:0};for(const p of provs)if(p.owner===c.id){lines.mil+=p.b.mil*LINES.mil*(1-p.dmg);lines.drone+=p.b.drone*LINES.drone*(1-p.dmg);}
  c.lines=lines;const pm=c.isPlayer?1.25:1,cap={mil:lines.mil*pm,drone:lines.drone*pm};
  for(const q of c.queue){if(q.imp){if(time>=q.eta){deliver(c,q.k,q.qty);q.left=0;if(q.mob&&c.isPlayer)log(`Мобилизованные прошли подготовку: ${q.qty} бат.`,'ok');}continue;}
    const f=c.cat[q.k].fac;if(cap[f]<=0)continue;const use=Math.min(cap[f],q.left);cap[f]-=use;q.prog+=use;
    const h=c.cat[q.k].h;while(q.prog>=h&&q.left>0){q.prog-=h;q.left--;deliver(c,q.k,1,q.dest);}}
  c.queue=c.queue.filter(q=>q.left>0);
  if(c.isPlayer){const ks=Object.keys(c.deliv);if(ks.length){log('Поставка: '+ks.map(k=>`${nm(c,k)} ×${c.deliv[k]}`).join(', ')+'.','ok');c.deliv={};panelDirty=true;}}}
function startBuild(c,p,t){const B=BUILD[t];
  if(p.owner!==c.id)return 'Строить можно только на своей территории.';if(p.build)return 'В регионе уже идёт строительство.';
  if(t==='fort'){if(p.fort>=3)return 'Рубежи уже максимальные.';}else if(usedSlots(p)>=slots(p))return 'Нет свободных площадок.';
  if(c.money<B.cost)return `Недостаточно средств: нужно ${fM(B.cost)}.`;c.money-=B.cost;if(c.isPlayer&&sb.instant){if(t==='fort')p.fort++;else p.b[t]++;return null;}p.build={t,left:B.h,total:B.h};return null;}
function mobilize(c){if(c.mobCd>time)return `Следующая волна мобилизации возможна через ${Math.ceil((c.mobCd-time)/24)} сут.`;
  const n=mobSize(c),cost=n*10;if(c.money<cost)return `Недостаточно средств: нужно ${fM(cost)}.`;
  c.money-=cost;c.mobCd=time+24*60;c.queue.push({k:'inf',qty:n,left:n,imp:true,mob:true,eta:time+24*10,paid:cost});
  if(c.isPlayer)log(`Объявлена мобилизация: ${n} отрядов пехоты будут готовы через 10 суток.`,'warn');return null;}
function mobSize(c){return Math.max(2,Math.round(c.pop0*.05));}

/* =================== УДАРЫ, ПВО, РЭБ =================== */
function fireSalvo(o,wk,site,x,y,n,prio){
  const c=C[o],Wp=c.cat[wk],pi=provAt(x,y);
  const sv={id:++svId,owner:o,w:wk,prov:pi,tgt:pi>=0?provs[pi].owner:-1,launched:n*(Wp.cnt||1),down:0,ew:0,hit:0,pending:n,troops:0,energy:0,items:{},prio,noAD:false,noTroops:false};
  salvos[sv.id]=sv;c.st.launched+=sv.launched;
  let sx0=site.cx,sy0=site.cy;
  if(Wp.range==='front'||Wp.range==='near'){[sx0,sy0]=towards(x,y,site.cx,site.cy,Wp.range==='front'?12:45);}
  const detour=(Wp.cls==='drone'&&n>=4);
  for(let i=0;i<n;i++){const j=S*.15,sx=sx0+R(-j,j),sy=sy0+R(-j,j),tx=x+(n>1?R(-j,j)*.5:0),ty=y+(n>1?R(-j,j)*.5:0);
    const p={id:++pid,sv:sv.id,owner:o,w:wk,x:sx,y:sy,sx,sy,tx,ty,prio,delay:i*(Wp.cls==='small'?.02:Wp.cls==='drone'?.04:.08)+R(0,.03),n:Wp.cnt||1,eng:0,state:'fly',ang:0,t:0,hd:0,resolved:false};
    if(detour&&Math.random()<.7){const dx=tx-sx,dy=ty-sy,L=Math.hypot(dx,dy)||1,off=R(-.3,.3)*L;p.wx=sx+dx*R(.35,.6)-dy/L*off;p.wy=sy+dy*R(.35,.6)+dx/L*off;}
    projs.push(p);}
  return sv;}
function resolveProj(p){if(p.resolved)return;p.resolved=true;const sv=salvos[p.sv];if(!sv)return;sv.pending--;if(sv.pending<=0){reportSalvo(sv);delete salvos[sv.id];}}
function killOne(p,how){p.n--;const sv=salvos[p.sv];if(sv){if(how==='ew')sv.ew++;else sv.down++;}C[p.owner].st.lost++;
  shotFx(p,how,p.n<=0);if(p.n<=0){p.dead=true;resolveProj(p);}}
function strike(o,wk,x,y,hits,prio,sv){
  const pi=provAt(x,y);if(hits>0)hitUnitsAt(o,wk,x,y,hits,sv);if(pi<0||hits<=0)return;const p=provs[pi],D=C[o].cat[wk].dmg;if(sv)sv.hit+=hits;if(atWar(o,p.owner))cityHit(p,D,hits,sv,o,prio);
  const add=(s,n=1)=>{if(sv)sv.items[s]=(sv.items[s]||0)+n;};
  const hostile=Object.keys(p.armies).map(Number).filter(q=>atWar(o,q)&&tot(p.armies[q])>.01);const ownerHostile=atWar(o,p.owner);
  if(prio==='troops'){if(!hostile.length){if(sv)sv.noTroops=true;}else{const pts=D.troops*hits*R(.7,1.3);for(const q of hostile){const a=p.armies[q],b=tot(a);loss(a,pts/hostile.length);if(sv)sv.troops+=b-tot(a);}}}
  else if(prio==='ad'){const cand=ads.filter(a=>a.prov===pi&&atWar(o,a.owner)&&km(a.x,a.y,x,y)<80);if(!cand.length&&sv)sv.noAD=true;
    for(let h=0;h<hits&&cand.length;h++)if(Math.random()<D.ad){const a=cand.splice(Math.floor(Math.random()*cand.length),1)[0];ads=ads.filter(z=>z!==a);add('уничтожен '+nm(C[a.owner],a.type));boom(a.x,a.y,10,'#ff7a3d');}}
  else if(prio==='industry'&&ownerHostile){hitFactories(o,p,x,y,hits,D,sv,add);baseDirty.add(p.id);}
  else if(prio==='energy'&&ownerHostile){const e=D.energy*hits*R(.8,1.2),b=p.dmg;p.dmg=Math.min(.9,p.dmg+e);if(sv)sv.energy+=p.dmg-b;baseDirty.add(p.id);}
  if(p.owner===player||p.armies[player])panelDirty=true;}
function effText(sv){const r=[];
  if(sv.troops>.005)r.push(`выведено из строя ≈${sv.troops.toFixed(2)} батальона`);
  if(sv.cityDmg>.5)r.push(`прочность города −${Math.round(sv.cityDmg)}%`);
  if(sv.energy>.001)r.push(`мощность энергосистемы −${Math.round(sv.energy*100)}%`);
  for(const k in sv.items)r.push(k+(sv.items[k]>1?` ×${sv.items[k]}`:''));
  if(!r.length){if(sv.prio==='ad'&&sv.noAD)r.push('ПВО в районе цели не обнаружено');else if(sv.prio==='troops'&&sv.noTroops)r.push('войск противника в районе нет');else r.push('значимого ущерба нет');}
  return r.join('; ');}
function reportSalvo(sv){const w=nm(C[sv.owner],sv.w),pn=sv.prov>=0?provs[sv.prov].name:'море';
  if(sv.w==='recon'){if(sv.owner===player&&sv.down+sv.ew>0)log(`Разведывательный БПЛА потерян над районом ${pn}.`,'bad');return;}
  if(sv.w==='airlift'){if(sv.owner===player)log(`Воздушный десант на ${pn}: самолётов ${sv.launched}, сбито ${sv.down}, высадились ${sv.hit}.`,sv.hit?'ok':'bad');else if(sv.tgt===player)log(`${C[sv.owner].name} высадила воздушный десант в ${pn}: самолётов ${sv.launched}, сбито ${sv.down}.`,'bad');return;}
  if(sv.owner===player){const vis=sv.prov>=0&&provs[sv.prov].vis;
    let t=`Удар (${w}) по району ${pn}: запущено ${sv.launched}, сбито ${sv.down}${sv.ew?`, подавлено РЭБ ${sv.ew}`:''}, достигли цели ${sv.hit}.`;
    if(sv.hit)t+=vis?' Итог: '+effText(sv)+'.':' Результат не подтверждён: нет разведданных над целью.';log(t,sv.hit?'ok':'bad');}
  else if(sv.tgt===player){log(`Атака: ${C[sv.owner].name} — ${w} ×${sv.launched} по району ${pn}. Сбито ${sv.down}${sv.ew?`, РЭБ ${sv.ew}`:''}, попаданий ${sv.hit}.${sv.hit?' Последствия: '+effText(sv)+'.':''}`,sv.hit?'bad':'ok');}}
function adStep(dt){
  for(const a of ads){const c=C[a.owner];if(!c.wars.size)continue;const T=c.cat[a.type];
    if(a.ready>0){a.ready-=dt;continue;}if(T.ew)continue;
    if(a.ammo<T.mag){a.rl+=dt;if(a.rl>=T.reload){a.rl=0;a.ammo++;}}
    a.cd-=dt;if(a.cd>0)continue;
    let best=null,bd=1e9,bc=null;
    for(const p of projs){if(p.dead||p.delay>0||!c.wars.has(p.owner))continue;const cls=C[p.owner].cat[p.w].cls;
      if(!(T.pk[cls]>0))continue;
      const dxk=Math.abs(p.x-a.x)/S*111*Math.cos(p.lat0||0),dyk=Math.abs(p.y-a.y)/S*111;const er=T.range*((cls==='small'||cls==='drone'||cls==='cruise')?T.low:1);
      if(dyk>er||dxk>er*1.2)continue;
      const d=km(p.x,p.y,a.x,a.y);if(d>er||d>=bd)continue;
      if(p.eng>=(cls==='ballistic'?2:1)*Math.min(3,p.n))continue;
      best=p;bd=d;bc=cls;}
    if(!best)continue;
    if(a.ammo>0){a.ammo--;a.cd=T.cd;best.eng++;c.st.shots++;a.spot[best.owner]=time+24;
      ints.push({x:a.x,y:a.y,t:best,spd:T.drone?T.spd:Math.max(T.spd,C[best.owner].cat[best.w].spd*1.4),pk:Math.min(.97,T.pk[bc]*(1-(C[best.owner].cat[best.w].stealth||0))*(c.isPlayer?1.15:1)),life:T.drone?.7:.25,owner:a.owner,tr:[],dr:!!T.drone});}
    else if(T.gun&&bd<T.range*.45&&T.gun[bc]){a.cd=.03;a.spot[best.owner]=time+24;fx.push({x:a.x,y:a.y,x2:best.x,y2:best.y,t:0,max:.15,gun:true});
      if(Math.random()<T.gun[bc]){c.st.intercepted++;killOne(best,'ad');}}}}
function intStep(dt){
  for(const it of ints){const t=it.t;if(t.dead||t.n<=0){it.dead=true;continue;}
    const d=km(it.x,it.y,t.x,t.y),mv=it.spd*CONFIG.SPEED*dt;it.life-=dt;
    if(Math.random()<.5){it.tr.push(it.x,it.y);if(it.tr.length>16)it.tr.splice(0,2);}
    if(d<=mv+1){it.dead=true;t.eng=Math.max(0,t.eng-1);
      if(Math.random()<it.pk){C[it.owner].st.intercepted++;killOne(t,'ad');boom(t.x,t.y,6,'#fff2b0');}else boom(it.x,it.y,3,'#cccccc');continue;}
    const f=mv/d;it.x+=(t.x-it.x)*f;it.y+=(t.y-it.y)*f;
    if(it.life<=0){it.dead=true;t.eng=Math.max(0,t.eng-1);}}
  ints=ints.filter(i=>!i.dead);}
function projStep(dt){
  if(!projs.length)return;const ewList=ads.filter(a=>a.type==='ew'&&a.ready<=0&&C[a.owner].wars.size);
  for(const p of projs){if(p.dead)continue;if(p.delay>0){p.delay-=dt;continue;}
    const Wp=C[p.owner].cat[p.w];p.lat0=latY(p.y)*RAD;
    if(Wp.ew>0&&p.state!=='return')for(const e of ewList){if(!atWar(e.owner,p.owner))continue;if(Math.abs(p.y-e.y)>S*.3||km(p.x,p.y,e.x,e.y)>C[e.owner].cat.ew.range)continue;
      const pr=1-Math.exp(-Wp.ew*6*dt);const k=p.n;for(let i=0;i<k&&!p.dead;i++)if(Math.random()<pr){killOne(p,'ew');e.spot[p.owner]=time+12;}if(p.dead)break;}
    if(p.dead)continue;
    if(p.state==='loiter'){p.t-=dt;p.ang+=dt*2.2;p.x=p.tx+Math.cos(p.ang)*S*.15;p.y=p.ty+Math.sin(p.ang)*S*.12;p.hd=p.ang+Math.PI/2;if(p.t<=0)p.state='return';continue;}
    let tx=p.tx,ty=p.ty;if(p.state==='return'){tx=p.sx;ty=p.sy;}else if(p.wx!=null){tx=p.wx;ty=p.wy;}
    const d=km(p.x,p.y,tx,ty),mv=Wp.spd*CONFIG.SPEED*dt;p.hd=Math.atan2(ty-p.y,tx-p.x);
    if(d>mv){const f=mv/d;p.x+=(tx-p.x)*f;p.y+=(ty-p.y)*f;p.trT=(p.trT||0)+dt;if(p.trT>.03){p.trT=0;(p.tr||(p.tr=[])).push(p.x,p.y);if(p.tr.length>70)p.tr.splice(0,2);}continue;}
    p.x=tx;p.y=ty;
    if(p.state==='return'){p.dead=true;returnHome(p);continue;}
    if(p.wx!=null){p.wx=null;continue;}
    if(Wp.special){specialArrive(p,Wp);continue;}
    if(p.w==='recon'){p.state='loiter';p.t=Wp.loiter;resolveProj(p);visAcc=1;continue;}
    if(p.w==='male'){strike(p.owner,'male',p.tx,p.ty,Wp.bombs,p.prio,salvos[p.sv]);for(let i=0;i<4;i++)boom(p.tx+R(-1,1),p.ty+R(-1,1),8,'#ff9d3d');resolveProj(p);p.state='return';continue;}
    strike(p.owner,p.w,p.tx,p.ty,p.n,p.prio,salvos[p.sv]);
    boom(p.tx,p.ty,Wp.cls==='ballistic'?20:Wp.cls==='cruise'?14:Wp.cls==='drone'?9:5,'#ff8a2b');p.dead=true;resolveProj(p);}
  projs=projs.filter(p=>!p.dead);}

/* =================== СУХОПУТНЫЕ ОПЕРАЦИИ =================== */
function hopH(a,b){return clamp(km(provs[a].cx,provs[a].cy,provs[b].cx,provs[b].cy)/(35*CONFIG.SPEED)*24,24/CONFIG.SPEED,720/CONFIG.SPEED);}
function findPath(o,from,to){if(from===to)return null;const prev=new Int32Array(provs.length).fill(-2);prev[from]=-1;const q=[from];let h=0;
  while(h<q.length){const c=q[h++];if(c===to)break;for(const n of provs[c].nb){if(prev[n]!==-2)continue;if(n!==to&&provs[n].owner!==o&&!atWar(o,provs[n].owner))continue;prev[n]=c;q.push(n);}}
  if(prev[to]===-2)return null;const path=[];for(let c=to;c!==-1;c=prev[c])path.unshift(c);return path;}
function sendArmy(o,from,to,frac){const fp=provs[from],a=fp.armies[o];if(!a||tot(a)<.05)return 'В регионе нет ваших войск.';
  const tp=provs[to];if(tp.owner!==o&&!atWar(o,tp.owner))return `Нет войны с государством «${C[tp.owner].name}».`;
  let path=findPath(o,from,to),sea=false;
  if(!path){if(!C[o].isPlayer&&fp.coastal&&tp.coastal&&portOf(fp)&&portOf(tp)&&km(fp.cx,fp.cy,tp.cx,tp.cy)<=3000)return aiConvoy(o,fp,tp,frac);
    return 'Нет сухопутного пути. Чтобы перебросить войска морем, погрузите их на транспортный корабль в порту (вкладка «Склад» → «Флот»).';}
  const u={inf:a.inf*frac,tank:a.tank*frac,art:a.art*frac};a.inf-=u.inf;a.tank-=u.tank;a.art-=u.art;
  if(tot(a)<.02&&!Object.keys(fp.armies).some(k=>+k!==o))delete fp.armies[o];
  const h0=sea?km(fp.cx,fp.cy,tp.cx,tp.cy)/400*24+72:hopH(path[0],path[1]);
  moves.push({id:++moveId,owner:o,path,i:0,u,left:h0,hop:h0,sea});return null;}
function moveHour(){
  for(const m of moves){m.left-=1;if(m.left>0)continue;m.i++;const P=provs[m.path[m.i]];const last=m.i>=m.path.length-1;
    if(last||P.owner!==m.owner){
      if(P.owner!==m.owner&&!atWar(m.owner,P.owner)){const back=provs[m.path[m.i-1]];const a=army(back,m.owner);a.inf+=m.u.inf;a.tank+=m.u.tank;a.art+=m.u.art;}
      else{const a=army(P,m.owner);a.inf+=m.u.inf;a.tank+=m.u.tank;a.art+=m.u.art;a.from=m.path[m.i-1];if(m.goal!=null&&m.goal!==P.id)a.goal=m.goal;if(m.sea&&P.owner!==m.owner)a.amph=time+48;
        if(P.owner!==m.owner&&(m.owner===player||P.owner===player))fogAll();}
      m.done=true;}
    else{m.hop=m.left=hopH(m.path[m.i],m.path[m.i+1]);}}
  moves=moves.filter(m=>!m.done);}
// оборона города: рельеф, укрепления, размер города и столица
function cityDef(p){return TERR[p.terrain].def*(1+.25*p.fort)*(1+.15*p.level)*(p.capital?1.3:1);}
function combatHour(){
  for(const p of provs){
    let any=false;for(const k in p.armies){if(tot(p.armies[k])<.02&&+k!==p.owner)delete p.armies[k];else if(+k!==p.owner)any=true;}
    p.battle=false;p.siege=null;if(!any)continue;
    const keys=Object.keys(p.armies).map(Number),defO=p.owner,def=p.armies[defO];
    const att=keys.filter(o=>o!==defO&&atWar(o,defO)&&tot(p.armies[o])>.02);if(!att.length)continue;
    if(!def||tot(def)<.03){let w=att[0],A0=0;for(const o of att){A0+=pw(p.armies[o],'atk');if(pw(p.armies[o],'atk')>pw(p.armies[w],'atk'))w=o;}
      const M=militia(p);if(A0>M*2||M<.3){captureProvince(p,w);continue;}
      p.battle=true;p.siege={A:A0,D:M,att:w};p.integ=Math.max(0,(p.integ??100)-A0*.03);for(const o of att)loss(p.armies[o],M*.01*pw(p.armies[o],'atk')/A0);continue;}
    p.battle=true;
    let A=0;const As={};for(const o of att){const ar=p.armies[o];As[o]=pw(ar,'atk')*((ar.amph||0)>time?.5:1);A+=As[o];}
    const D=pw(def,'def')*cityDef(p)*(defO===player?1.15:1);p.siege={A,D,att:att.reduce((w,o)=>As[o]>As[w]?o:w,att[0])};
    const k=.02;loss(def,A*k*R(.7,1.3));
    for(const o of att){loss(p.armies[o],D*k*R(.7,1.3)*(As[o]/A));
      if(As[o]<D*.3&&tot(p.armies[o])>.02){const a=p.armies[o],back=a.from!=null&&provs[a.from].owner===o?a.from:null;
        if(back!=null){const b=army(provs[back],o);b.inf+=a.inf;b.tank+=a.tank;b.art+=a.art;}
        delete p.armies[o];if(o===player)log(`Наступление на ${p.name} отбито, войска отходят.`,'bad');if(defO===player)log(`Атака на ${p.name} отражена.`,'ok');}}
    if(defO===player||p.armies[player])panelDirty=true;}}

/* =================== ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ =================== */
function aiDeploy(c){const my=myProvs(c.id);if(!my.length)return;const enemies=[...c.wars];
  for(const t in c.adRes){while(c.adRes[t]>0){let best=null,bs=-1e9;
      for(const p of my){let s=(p.capital?10:0)+p.b.mil*3+p.b.drone*3+p.b.civ*1.5+p.level+Math.random()*2;
        if(p.nb.some(n=>enemies.includes(provs[n].owner)))s+=t==='ew'||t==='manpads'||t==='shorad'?6:2;
        s-=adProvCount(p.id,t)*6;if(s>bs){bs=s;best=p;}}
      addAD(c.id,t,best,12);c.adRes[t]--;}}}
function aiDaily(c){aiNuke(c);
  const my=myProvs(c.id);if(!my.length)return;const war=c.wars.size>0;
  if(c.money>c.budget*(war?12:6)+60){const t=war?(Math.random()<.5?'drone':'mil'):(Math.random()<.6?'civ':Math.random()<.5?'mil':'drone');
    const cand=my.filter(p=>!p.build&&usedSlots(p)<slots(p));if(cand.length)startBuild(c,pick(cand),t);
    else if(war){const f=my.filter(p=>!p.build&&p.fort<2&&p.nb.some(n=>c.wars.has(provs[n].owner)));if(f.length)startBuild(c,pick(f),'fort');}}
  const inQ=k=>c.queue.filter(q=>q.k===k).reduce((s,q)=>s+q.left,0);
  const have=t=>adCount(c.id,t)+(c.adRes[t]||0)+inQ(t);
  const buy=(k,n)=>{const cost=c.cat[k].cost*n;if(c.money-cost>c.budget*3)order(c,k,n);};
  const nR=my.length,sz=Math.sqrt(nR),wm=war?2:1;
  const want={lrsam:Math.max(1,Math.round(nR/8))*wm,shorad:(Math.round(nR/2.5)+1)*wm,ew:war?3:1,idrone:war?Math.round(nR/5)+1:0};
  for(const t in want)if(have(t)<want[t])buy(t,1);
  const base={recon:3+sz,fpv:(war?40:10)*sz,shahed:(war?30:10)*sz,cruise:(war?6:2)*sz,ballistic:(war?3:1)*sz};
  for(const k in base){const tgt=Math.round(base[k]),h=(c.stock[k]||0)+inQ(k);if(h<tgt)buy(k,Math.max(1,Math.min(tgt-h,Math.ceil(tgt/3))));}
  let troops=0;for(const p of provs)troops+=tot(p.armies[c.id]);const qG=inQ('inf')+inQ('tank')+inQ('art');
  if(war){let et=0;for(const e of c.wars)for(const p of provs)et+=tot(p.armies[e]);
    if(troops+qG<et*1.1&&qG<12){buy('inf',3);buy('tank',2);buy('art',1);}
    if(troops<et*.7&&c.mobCd<time&&Math.random()<.3)mobilize(c);}
  else if(troops+qG<nR*1.5&&qG<4)buy('inf',2);
  // излишки казны идут в дело: на войне — в армию, в мирное время — в экономику и оборону
  const spare=()=>c.money>c.budget*(war?8:20)+100;
  if(war){for(let g=0;g<3&&spare()&&c.queue.length<30;g++){buy('tank',2);buy('inf',4);buy('art',2);}}
  else if(spare()){const cand=my.filter(p=>!p.build&&usedSlots(p)<slots(p));if(cand.length)startBuild(c,pick(cand),Math.random()<.6?'civ':'mil');
    else{const f=my.filter(p=>!p.build&&p.fort<2);if(f.length)startBuild(c,pick(f),'fort');}if(spare()&&qG<6)buy('inf',3);}
  aiDeploy(c);
  // дипломатия: войны только с историческими соперниками
  if(time/24>90&&!war&&!sb.noAI)for(const [a,b] of RIVALS){if(a!==c.key&&b!==c.key)continue;const e=CK[a===c.key?b:a];if(!e||!e.alive||(e.id===player&&time/24<60))continue;
    const r=strength(c)/Math.max(1,strength(e));if(r>1.8&&Math.random()<.0004*(r-1))aiAttack(c,e);}
  for(const e of [...c.wars]){const days=(time-c.warStart[e])/24;
    if(e===player){if(!c.peaceOffer&&days>30){const [ok]=aiPeaceAnswer(c,C[player]);if(ok&&Math.random()<.2){c.peaceOffer=true;log(`${c.name} предлагает перемирие. Ответ — во вкладке «Политика».`,'warn');toast(`${c.name} предлагает перемирие`,'warn');panelDirty=true;}}}
    else if(!C[e].isPlayer&&days>90){const [ok]=aiPeaceAnswer(c,C[e]);if(ok&&Math.random()<.03)makePeace(c.id,e);}}}
function aiStrike(c){
  const my=myProvs(c.id);if(!my.length)return;
  for(const e of c.wars){const ec=C[e];if(!ec.alive)continue;const eprov=myProvs(e);if(!eprov.length)continue;
    if(Math.random()<.5){
      const sc=p=>p.b.mil*3+p.b.drone*4+p.b.civ*2+(p.capital?4:0)+(p.dmg<.5?2:0)+p.level+Math.random()*4;
      const cand=eprov.map(p=>{const s=nearestOwn(c.id,p.cx,p.cy);return {p,s,d:s?km(s.cx,s.cy,p.cx,p.cy):1e9};}).filter(o=>o.d<=c.cat.shahed.range||o.d<=c.cat.cruise.range);
      if(cand.length){cand.sort((a,b)=>sc(b.p)-sc(a.p));const {p:tg,s:site,d}=cand[0];const prio=pick(['industry','energy','energy','industry','ad']);
        const st=c.stock;const ns=Math.min(st.shahed|0,Math.max(4,Math.round((st.shahed|0)*R(.06,.15))));
        if(ns>0&&d<=c.cat.shahed.range){st.shahed-=ns;fireSalvo(c.id,'shahed',site,tg.cx,tg.cy,ns,prio);}
        if((st.cruise|0)>1&&Math.random()<.5&&d<=c.cat.cruise.range){const n=Math.min(st.cruise,RI(2,8));st.cruise-=n;fireSalvo(c.id,'cruise',site,tg.cx,tg.cy,n,prio==='ad'?'ad':'industry');}
        if((st.ballistic|0)>0&&Math.random()<.35&&d<=c.cat.ballistic.range){const n=Math.min(st.ballistic,RI(1,4));st.ballistic-=n;fireSalvo(c.id,'ballistic',site,tg.cx,tg.cy,n,pick(['ad','industry']));}}}
    for(const p of provs){if(!(p.armies[c.id]&&tot(p.armies[c.id])>.3))continue;
      for(const n of p.nb){const q=provs[n];const ea=q.armies[e];if(!ea||tot(ea)<.1)continue;const st=c.stock;
        if((st.fpv|0)>0&&Math.random()<.4){const k=Math.min(st.fpv,RI(1,3));st.fpv-=k;fireSalvo(c.id,'fpv',p,q.cx,q.cy,k,'troops');}
        break;}}}}
function aiGround(c){
  const enemies=[...c.wars].filter(e=>C[e].alive);if(!enemies.length)return;
  const isFront=p=>p.owner===c.id&&p.nb.some(n=>enemies.includes(provs[n].owner));
  const dist=new Int16Array(provs.length).fill(999);const q=[];for(const p of provs)if(isFront(p)){dist[p.id]=0;q.push(p.id);}
  let h=0;while(h<q.length){const x=q[h++];for(const n of provs[x].nb)if(provs[n].owner===c.id&&dist[n]>dist[x]+1){dist[n]=dist[x]+1;q.push(n);}}
  for(const p of provs){const a=p.armies[c.id];if(!a||tot(a)<.5||p.battle||p.owner!==c.id)continue;
    if(dist[p.id]>0&&dist[p.id]<999){const nx=p.nb.find(n=>provs[n].owner===c.id&&dist[n]===dist[p.id]-1);if(nx!=null)sendArmy(c.id,p.id,nx,p.capital?.5:.8);}
    else if(dist[p.id]===0){let best=null,br=0;
      for(const n of p.nb){const t=provs[n];if(!enemies.includes(t.owner))continue;const D=pw(t.armies[t.owner],'def')*cityDef(t)+.3;
        const r=pw(a,'atk')*.7/D;if(r>br){br=r;best=t;}}
      if(best&&br>(best.owner===player?2.6:1.8)&&time-(c.warStart[best.owner]||0)>96&&!((a.rest||0)>time))sendArmy(c.id,p.id,best.id,.7);}}}

/* =================== ЦИКЛ СИМУЛЯЦИИ =================== */
function fogAll(){for(const p of provs)fogDirty.add(p.id);visAcc=1;}
function updateVis(){if(player<0)return;const nv=new Uint8Array(provs.length);
  for(const p of provs){const mine=p.owner===player||(p.armies[player]&&tot(p.armies[player])>.02);if(mine){nv[p.id]=1;for(const n of p.nb)nv[n]=1;}}
  for(const q of projs)if(q.owner===player&&C[player].cat[q.w].reveal&&q.delay<=0){const r=C[player].cat[q.w].reveal+60;for(const p of provs)if(Math.abs(p.cy-q.y)<r/111*S*1.5&&km(p.cx,p.cy,q.x,q.y)<r)nv[p.id]=1;}
  for(const p of provs){const v=!!nv[p.id];if(v!==p.vis){p.vis=v;fogDirty.add(p.id);}}}
function hourTick(){facHour();
  const h=Math.round(time);economyHour();
  for(const c of C)if(c.alive)production(c);
  for(const p of provs){if(p.build){p.build.left-=1-p.dmg*.5;if(p.build.left<=0){const t=p.build.t;if(t==='fort')p.fort++;else p.b[t]++;p.build=null;
        if(p.owner===player){log(`Построено: ${BUILD[t].n} (${p.name}).`,'ok');panelDirty=true;}}}
    if(p.dmg>0){p.dmg=Math.max(0,p.dmg-.0012);if(Math.random()<.01)baseDirty.add(p.id);}}
  moveHour();combatHour();cityHour();radHour();
  for(const c of C){if(!c.alive||c.isPlayer)continue;if(h%24===c.aiHour)aiDaily(c);if(c.wars.size){if(h%6===c.aiHour%6)aiGround(c);if(h%8===c.aiHour%8)aiStrike(c);}}
  let inc=0;for(const p of projs){if(p.alerted||p.owner===player||p.delay>0)continue;const pi=provAt(p.tx,p.ty);if(pi>=0&&provs[pi].owner===player){p.alerted=true;inc+=p.n;}}
  hourTick.acc=(hourTick.acc||0)+inc;
  if(hourTick.acc&&performance.now()-(hourTick.lt??-1e9)>=8000){toast(`Воздушная тревога: к вашей территории летят ${hourTick.acc} целей`,'bad');hourTick.lt=performance.now();hourTick.acc=0;$('#alert').classList.add('on');clearTimeout(hourTick.al);hourTick.al=setTimeout(()=>$('#alert').classList.remove('on'),4000);}
  if(h%24===0&&started&&!over&&time-(hourTick.lastSave||0)>=24*7){hourTick.lastSave=time;saveGame('auto',true);}
  updateVis();panelDirty=true;}
function simStep(dt){time+=dt;projStep(dt);intStep(dt);adStep(dt);shipStep(dt);
  visAcc+=dt;if(visAcc>=.25){visAcc=0;updateVis();}
  hourAcc+=dt;while(hourAcc>=1){hourAcc-=1;hourTick();}}
function endGame(){if(over)return;over=true;running=false;setSpeedUI();const c=C[player];
  showOver(`<h2>Поражение</h2><p>${esc(c.name)} капитулировала ${dateStr(time).slice(0,10)}.</p>
  <div class="kv" style="margin:12px 0"><span>Запущено ракет и БПЛА</span><b>${c.st.launched}</b><span>Зенитных пусков</span><b>${c.st.shots}</b><span>Сбито воздушных целей</span><b>${c.st.intercepted}</b><span>Дней игры</span><b>${Math.floor(time/24)}</b></div>
  <button class="btn pri" data-act="toMenu">В главное меню</button>`);}

/* =================== ОТРИСОВКА СЛОЁВ =================== */
// Плоская белая карта: суша почти белая, ваша страна, союзники и противники подкрашены.
const LAND={1:[247,247,244],2:[241,244,238],3:[237,235,230]};
function isAlly(o){if(player<0||o===player)return false;const k=C[player].key;return C[o].pacts.some(pc=>pc.m.includes(k));}
function tintOf(o){if(player<0)return [hexRGB(C[o].color),ui.menuSel===o?.55:.16];
  if(o===player)return [hexRGB(C[o].color),.5];if(atWar(player,o))return [[214,72,64],.38];if(isAlly(o))return [hexRGB(C[o].color),.26];return [hexRGB(C[o].color),.05];}
function paintProvince(p){const d=baseImg.data,[[r,g,b],m]=tintOf(p.owner),dm=1-p.dmg*.3,cells=provCells[p.id];
  for(let j=0;j<cells.length;j++){const i=cells[j],o=i*4,t=LAND[cellTerr[i]],n=(cellNoise[i]-30)*.12;
    d[o]=((t[0]+n)*(1-m)+r*m)*dm;d[o+1]=((t[1]+n)*(1-m)+g*m)*dm;d[o+2]=((t[2]+n)*(1-m)+b*m)*dm;d[o+3]=255;}}
function paintFog(p){const d=fogImg.data,cells=provCells[p.id],a=p.vis?0:60;for(let j=0;j<cells.length;j++){const o=cells[j]*4;d[o]=96;d[o+1]=110;d[o+2]=126;d[o+3]=a;}}
function repaintAll(){for(const p of provs)baseDirty.add(p.id);ctrlDirty=true;}
let layerVer=0,frontPath=null;
function flushLayers(force){const now=performance.now();if(!force&&now-lastPut<150)return;
  if(baseDirty.size){for(const id of baseDirty)paintProvince(provs[id]);baseDirty.clear();baseCv.getContext('2d').putImageData(baseImg,0,0);lastPut=now;layerVer++;}
  if(fogDirty.size){for(const id of fogDirty)paintFog(provs[id]);fogDirty.clear();fogCv.getContext('2d').putImageData(fogImg,0,0);lastPut=now;layerVer++;}
  if(ctrlDirty){ctrlDirty=false;pathCtrl=new Path2D();frontPath=player>=0?new Path2D():null;
    for(let i=0;i<segs.length;i+=6){const a=segs[i+4],b=segs[i+5];if(a<0||b<0)continue;const A=provs[a],B=provs[b];if(A.owner===B.owner)continue;
      if(A.owner!==A.core||B.owner!==B.core){pathCtrl.moveTo(segs[i],segs[i+1]);pathCtrl.lineTo(segs[i+2],segs[i+3]);}
      if(frontPath&&((A.owner===player&&atWar(player,B.owner))||(B.owner===player&&atWar(player,A.owner)))){frontPath.moveTo(segs[i],segs[i+1]);frontPath.lineTo(segs[i+2],segs[i+3]);}}
    labelPos=C.map(c=>{if(!c.alive)return null;let sx=0,sy=0,n=0;for(const p of provs)if(p.owner===c.id){const w=provCells[p.id].length;sx+=p.cx*w;sy+=p.cy*w;n+=w;}return n?{x:sx/n,y:sy/n,n}:null;});layerVer++;}}
function hexRGB(h){return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function hexA(h,a){const [r,g,b]=hexRGB(h);return `rgba(${r},${g},${b},${a})`;}

/* =================== ОТРИСОВКА КАДРА =================== */
// Неподвижная часть карты рисуется в отдельный холст и перерисовывается только при сдвиге камеры или изменении слоёв.
const cv=$('#map'),ctx=cv.getContext('2d',{alpha:false});const cam={x:0,y:0,z:.3};let DPR=1,VW=0,VH=0;
const stCv=document.createElement('canvas'),sx=stCv.getContext('2d',{alpha:false});let stKey='',stCam={x:0,y:0},stTime=0;
const COL={sea:'#22313f',grat:'rgba(255,255,255,.045)',coast:'#3c4a58',border:'rgba(72,84,98,.75)',prov:'rgba(72,84,98,.16)',ctrl:'#b42318',front:'#e5463c',
  label:'rgba(38,48,60,.78)',halo:'rgba(255,255,255,.85)',city:'#1d2630',sel:'#e3a51a',own:'#1f6fd1',enemy:'#d93a2f',neutral:'#7b8794',int:'#e3b341'};
function resize(){const r=$('#mapwrap').getBoundingClientRect();DPR=Math.min(2,window.devicePixelRatio||1);VW=r.width;VH=r.height;
  cv.width=stCv.width=Math.max(1,Math.round(VW*DPR));cv.height=stCv.height=Math.max(1,Math.round(VH*DPR));stKey='';}
function fitCam(){cam.z=Math.max(VW/W,VH/H*.75);cam.x=xLon(20)-VW/2/cam.z;cam.y=yLat(38)-VH/2/cam.z;clampCam();}
function focus(x,y,z){cam.z=z??cam.z;cam.x=x-VW/2/cam.z;cam.y=y-VH/2/cam.z;clampCam();}
function clampCam(){cam.z=clamp(cam.z,Math.min(VW/W,VH/H)*.9,40);cam.x=clamp(cam.x,-VW/cam.z*.3,W-VW/cam.z*.7);cam.y=clamp(cam.y,-VH/cam.z*.3,H-VH/cam.z*.7);}
function toWorld(sx_,sy_){return [sx_/cam.z+cam.x,sy_/cam.z+cam.y];}
let myADs=[];
function visibleToPlayer(x,y){if(player<0||!ui.fog)return true;const pi=provAt(x,y);if(pi>=0&&provs[pi].vis)return true;
  for(const a of myADs)if(Math.abs(a.y-y)<30&&km(a.x,a.y,x,y)<C[player].cat[a.type].range)return true;return false;}
function adVisible(a){return player<0||!ui.fog||a.owner===player||provs[a.prov].vis||(a.spot[player]||0)>time;}
function halo(g,t,x,y,z,fill,w=3){g.lineWidth=w/z;g.strokeStyle=COL.halo;g.strokeText(t,x,y);g.fillStyle=fill;g.fillText(t,x,y);}
function drawUnitIcon(x,y,a,col,z){const t=tot(a);if(t<.02)return;const w=26/z,h=16/z;
  ctx.fillStyle=col;ctx.strokeStyle='#1d2630';ctx.lineWidth=1.4/z;ctx.fillRect(x-w/2,y-h/2,w,h);ctx.strokeRect(x-w/2,y-h/2,w,h);
  ctx.strokeStyle='#fff';ctx.lineWidth=1.2/z;ctx.beginPath();
  if(a.tank*2>=a.inf&&a.tank>=a.art)ctx.ellipse(x,y,w*.3,h*.25,0,0,7);else if(a.art>a.inf){ctx.arc(x,y,h*.16,0,7);ctx.fillStyle='#fff';ctx.fill();}else{ctx.moveTo(x-w/2,y-h/2);ctx.lineTo(x+w/2,y+h/2);ctx.moveTo(x+w/2,y-h/2);ctx.lineTo(x-w/2,y+h/2);}
  ctx.stroke();const s=t>=100?Math.round(t)+'':fN(t);
  ctx.font=`600 ${10.5/z}px Consolas,monospace`;ctx.textAlign='center';ctx.textBaseline='top';halo(ctx,s,x,y+h/2+1/z,z,'#1d2630');}
function inView(x,y,m){return x>cam.x-m&&x<cam.x+VW/cam.z+m&&y>cam.y-m&&y<cam.y+VH/cam.z+m;}
function rangeEllipse(g,x,y,r){const rx=r/(111.32*Math.max(.05,Math.cos(latY(y)*RAD)))*S,ry=r/111.32*S;g.beginPath();g.ellipse(x,y,rx,ry,0,0,7);}
function star(g,x,y,r){g.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.45:r*1.25;i?g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr):g.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}g.closePath();}
function drawStatic(){const g=sx,z=cam.z;
  g.setTransform(1,0,0,1,0,0);g.fillStyle=COL.sea;g.fillRect(0,0,stCv.width,stCv.height);
  g.setTransform(z*DPR,0,0,z*DPR,-cam.x*z*DPR,-cam.y*z*DPR);
  g.strokeStyle=COL.grat;g.lineWidth=1/z;g.stroke(grat);
  const L=lod(z);g.fillStyle='#f3f3ef';g.fill(L.land,'evenodd');g.save();g.clip(L.land,'evenodd');g.imageSmoothingEnabled=z<2.5;g.drawImage(baseCv,0,0,W,H);if(started&&ui.fog)g.drawImage(fogCv,0,0,W,H);g.restore();g.lineJoin='round';
  if(z>.9){g.strokeStyle=COL.prov;g.lineWidth=.8/z;g.stroke(pathProv);}
  g.strokeStyle=COL.border;g.lineWidth=1.2/z;g.stroke(L.border);
  g.strokeStyle=COL.coast;g.lineWidth=1.1/z;g.stroke(L.coast);
  if(pathCtrl){g.strokeStyle=COL.ctrl;g.lineWidth=2/z;g.stroke(pathCtrl);}
  if(frontPath&&started){g.strokeStyle=COL.front;g.lineWidth=2.6/z;g.setLineDash([6/z,4/z]);g.stroke(frontPath);g.setLineDash([]);}
  g.textAlign='center';g.textBaseline='middle';
  C.forEach((c,i)=>{const L=labelPos[i];if(!L||!c.alive)return;const fs=clamp(Math.sqrt(L.n)/4.5,6,60);if(fs*z<9||fs*z>70||!inView(L.x,L.y,300))return;
    g.font=`700 ${fs}px Bahnschrift,"Segoe UI",sans-serif`;if('letterSpacing' in g)g.letterSpacing=`${fs*.08}px`;
    g.lineWidth=fs*.16;g.strokeStyle='rgba(255,255,255,.6)';g.strokeText(c.name.toUpperCase(),L.x,L.y);g.fillStyle=COL.label;g.fillText(c.name.toUpperCase(),L.x,L.y);});
  if('letterSpacing' in g)g.letterSpacing='0px';
  for(const p of provs){if(!p.city||!inView(p.cx,p.cy,60))continue;const pop=p.city.pop,show=p.capital||(pop>=5&&z>.5)||(pop>=1&&z>1.2)||z>2.4;if(!show)continue;
    const r=(p.capital?4.5:1.8+p.level*.6)/z;g.lineWidth=1.1/z;g.strokeStyle='#1d2630';
    const occ=p.owner!==p.core;if(occ){g.lineWidth=2.4/z;g.strokeStyle=C[p.core].color;}
    if(p.capital){star(g,p.cx,p.cy,r);g.fillStyle=COL.sel;}else{g.beginPath();g.arc(p.cx,p.cy,occ?r*1.3:r,0,7);g.fillStyle=occ?C[p.owner].color:'#ffffff';}g.fill();g.stroke();
    if(z>.8){g.font=`${p.capital?'600 ':''}${(p.capital?12:10.5)/z}px "Segoe UI",sans-serif`;g.textAlign='left';g.textBaseline='middle';halo(g,p.name,p.cx+r+3/z,p.cy,z,COL.city);}}}
let scaleT=0;
function render(rdt){
  if(!provs.length){ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=COL.sea;ctx.fillRect(0,0,cv.width,cv.height);return;}
  flushLayers();
  // при сдвиге камеры кадр сначала смещается, а полная перерисовка идёт не чаще ~14 раз в секунду
  const key=`${cam.z}|${cv.width}|${cv.height}|${layerVer}|${ui.fog}|${started}|${player}`;let dx=0,dy=0;
  if(key!==stKey||cam.x!==stCam.x||cam.y!==stCam.y){const now=performance.now();
    if(key===stKey&&now-stTime<70){dx=(stCam.x-cam.x)*cam.z*DPR;dy=(stCam.y-cam.y)*cam.z*DPR;}
    else{stKey=key;stCam={x:cam.x,y:cam.y};stTime=now;drawStatic();}}
  ctx.setTransform(1,0,0,1,0,0);if(dx||dy){ctx.fillStyle=COL.sea;ctx.fillRect(0,0,cv.width,cv.height);}ctx.drawImage(stCv,dx,dy);
  const z=cam.z;ctx.setTransform(z*DPR,0,0,z*DPR,-cam.x*z*DPR,-cam.y*z*DPR);ctx.lineJoin='round';
  if(ui.hover!=null&&ui.hover!==ui.sel){ctx.strokeStyle='rgba(29,38,48,.55)';ctx.lineWidth=1.6/z;ctx.stroke(provPaths[ui.hover]);}
  if(ui.sel!=null){ctx.strokeStyle=COL.sel;ctx.lineWidth=2.8/z;ctx.stroke(provPaths[ui.sel]);}
  if(!started&&ui.menuSel!=null){ctx.strokeStyle=COL.sel;ctx.lineWidth=2/z;for(const p of provs)if(p.owner===ui.menuSel)ctx.stroke(provPaths[p.id]);}
  // заводы
  drawFacs(ctx,z);drawUnitsLayer(ctx,z);
  // ПВО
  myADs=player>=0?ads.filter(a=>a.owner===player&&a.type!=='ew'):[];
  for(const a of ads){if(!inView(a.x,a.y,300))continue;const mine=a.owner===player,hostile=atWar(player,a.owner);if(!mine&&!hostile&&z<2.5)continue;if(!adVisible(a))continue;
    const T=C[a.owner].cat[a.type],col=mine?'31,111,209':hostile?'217,58,47':'110,120,130';
    if(ui.showAD&&(mine||hostile)){rangeEllipse(ctx,a.x,a.y,T.range);ctx.fillStyle=`rgba(${col},${T.ew?.06:.045})`;ctx.fill();ctx.setLineDash(T.ew?[2/z,3/z]:[6/z,4/z]);ctx.strokeStyle=`rgba(${col},.55)`;ctx.lineWidth=1/z;ctx.stroke();ctx.setLineDash([]);}
    if(z<.9&&!mine)continue;const s=5/z;ctx.fillStyle=`rgb(${col})`;ctx.strokeStyle='#fff';ctx.lineWidth=1/z;ctx.beginPath();
    if(T.ew)ctx.rect(a.x-s*.7,a.y-s*.7,s*1.4,s*1.4);else{ctx.moveTo(a.x-s,a.y+s*.6);ctx.arc(a.x,a.y+s*.6,s,Math.PI,0);ctx.closePath();}
    ctx.globalAlpha=a.ready>0?.4:1;ctx.fill();ctx.stroke();ctx.globalAlpha=1;}
  // войска
  for(const p of provs){if(!inView(p.cx,p.cy,60))continue;let ks=null;
    for(const k in p.armies){const o=+k;if(tot(p.armies[k])>.02&&(o===player||((!ui.fog||p.vis||!started)&&z>.9)))(ks||(ks=[])).push(o);}if(!ks)continue;
    if(p.battle&&(p.vis||!ui.fog)){const t=performance.now()/200;ctx.font=`${16/z}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.globalAlpha=.6+.4*Math.sin(t);ctx.fillStyle='#b42318';ctx.fillText('⚔',p.cx,p.cy-16/z);ctx.globalAlpha=1;
      if(p.siege){const sh=p.siege.A/(p.siege.A+p.siege.D),bw=34/z,bh=4/z,bx=p.cx-bw/2,by=p.cy-28/z;ctx.fillStyle=C[p.owner].color;ctx.fillRect(bx,by,bw,bh);ctx.fillStyle=C[p.siege.att].color;ctx.fillRect(bx,by,bw*sh,bh);ctx.strokeStyle='#1d2630';ctx.lineWidth=.8/z;ctx.strokeRect(bx,by,bw,bh);}}}
  for(const m of moves){if(m.owner!==player&&ui.fog&&!provs[m.path[m.i]].vis)continue;const a=provs[m.path[m.i]],b=provs[m.path[m.i+1]];if(!b)continue;const f=1-m.left/m.hop;
    const x=a.cx+(b.cx-a.cx)*f,y=a.cy+(b.cy-a.cy)*f;ctx.strokeStyle=C[m.owner].color;ctx.lineWidth=3/z;ctx.setLineDash(m.sea?[2/z,4/z]:[6/z,4/z]);ctx.beginPath();ctx.moveTo(x,y);
    for(let j=m.i+1;j<m.path.length;j++)ctx.lineTo(provs[m.path[j]].cx,provs[m.path[j]].cy);ctx.stroke();ctx.setLineDash([]);if(z>.45&&m.owner!==player)drawUnitIcon(x,y,m.u,C[m.owner].color,z*1.15);}
  // воздушные цели
  drawProj.lite=projs.length>400&&cam.z<6;for(const p of projs){if(p.delay>0)continue;const nuke=C[p.owner].cat[p.w].special==='nuke';if(!nuke&&!inView(p.x,p.y,60))continue;if(!nuke&&p.owner!==player&&!visibleToPlayer(p.x,p.y))continue;drawProj(ctx,p,z);}
  for(const it of ints){if(!inView(it.x,it.y,60))continue;if(it.owner!==player&&!visibleToPlayer(it.x,it.y))continue;drawInt(ctx,it,z);}
  for(const f of fx){f.t+=rdt;const k=f.t/f.max;if(f.kind){drawFx(ctx,f,k,z);continue;}if(!inView(f.x,f.y,40))continue;
    if(f.gun){if(visibleToPlayer(f.x,f.y)){ctx.strokeStyle=`rgba(200,120,0,${1-k})`;ctx.lineWidth=.8/z;ctx.setLineDash([2/z,3/z]);ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.x2,f.y2);ctx.stroke();ctx.setLineDash([]);}continue;}
    if(!visibleToPlayer(f.x,f.y))continue;const r=Math.max(f.r/z*.6,f.r*.25)*(.4+k*1.2);const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,r);
    g.addColorStop(0,`rgba(255,240,170,${.95*(1-k)})`);g.addColorStop(.4,hexA(f.col,.8*(1-k)));g.addColorStop(1,hexA(f.col,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(f.x,f.y,r,0,7);ctx.fill();}
  fx=fx.filter(f=>f.t<f.max);
  if(ui.mode==='target'&&ui.wk){const [wx,wy]=toWorld(ui.mx,ui.my);const Wp=C[player].cat[ui.wk];let site=null,ok=true;
    const lf=launchSiteObj();
    if(lf){site=lf;const dd=km(lf.cx,lf.cy,wx,wy);ok=Wp.range==='front'?dd<=CONFIG.FRONT_RANGE:(sb.range||dd<=effRange(C[player],Wp));
      if(Wp.range!=='front'){rangeEllipse(ctx,lf.cx,lf.cy,effRange(C[player],Wp));ctx.strokeStyle='rgba(90,169,255,.85)';ctx.lineWidth=1.6/z;ctx.setLineDash([8/z,5/z]);ctx.stroke();ctx.setLineDash([]);}
      ctx.strokeStyle='#5aa9ff';ctx.lineWidth=3.2/z;if(lf.id>=0)ctx.stroke(provPaths[lf.id]);ctx.font=`700 ${11/z}px "Segoe UI",sans-serif`;ctx.textAlign='center';ctx.textBaseline='bottom';halo(ctx,'Пуск отсюда',lf.cx,lf.cy-12/z,z,'#1f4fb0');}
    else if(sb.range){site=nearestOwn(player,wx,wy);}
    else if(Wp.range==='front'||Wp.range==='near'){const pi=provAt(wx,wy);site=pi>=0?(Wp.range==='front'?frontSite(player,pi):nearSite(player,pi)):null;ok=!!site;}
    else{site=nearestOwn(player,wx,wy);if(site){ok=km(site.cx,site.cy,wx,wy)<=effRange(C[player],Wp);rangeEllipse(ctx,site.cx,site.cy,effRange(C[player],Wp));ctx.strokeStyle='rgba(180,120,10,.7)';ctx.lineWidth=1.4/z;ctx.setLineDash([8/z,5/z]);ctx.stroke();ctx.setLineDash([]);}}
    if(site)routePreview(ctx,z,site,wx,wy,Wp);const c=ok?'#b45309':'#d93a2f';
    if(site){ctx.strokeStyle=c;ctx.lineWidth=1.5/z;ctx.beginPath();ctx.moveTo(site.cx,site.cy);ctx.lineTo(wx,wy);ctx.stroke();}
    ctx.strokeStyle=c;ctx.lineWidth=1.8/z;ctx.beginPath();ctx.arc(wx,wy,10/z,0,7);ctx.moveTo(wx-16/z,wy);ctx.lineTo(wx+16/z,wy);ctx.moveTo(wx,wy-16/z);ctx.lineTo(wx,wy+16/z);ctx.stroke();}
  placePreview(ctx,z);
  scaleT+=rdt;if(scaleT>.25){scaleT=0;const [ax,ay]=toWorld(VW/2,VH/2);const kmpx=km(ax,ay,ax+1/z,ay);$('#scale').textContent=`100 px ≈ ${Math.round(kmpx*100)} км · ${fN(latY(ay),1)}°, ${fN(lonX(ax),1)}°`;}
}

/* =================== ПОЛНАЯ СВОБОДА (ПЕСОЧНИЦА) =================== */
function countryOptions(sel){return C.filter(c=>c.alive).sort((a,b)=>a.name.localeCompare(b.name,'ru')).map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${esc(c.name)}</option>`).join('');}
function switchCountry(id){player=id;C.forEach(c=>c.isPlayer=c.id===id);setPlayerColor();const c=C[id];
  $('#cname').textContent=c.name;$('#flag').style.background=c.color;ui.sel=c.capital;ui.pending=null;pendingPrompt=[];setMode(null);
  economyPass();repaintAll();updateVis();fogAll();log(`Вы теперь управляете государством «${c.name}».`,'ok');toast(`Теперь вы играете за: ${c.name}`,'ok');}
function giveProvince(p,to){const old=p.owner;if(old===to)return;p.owner=to;delete p.armies[old];p.battle=false;
  ads=ads.filter(a=>!(a.prov===p.id&&a.owner===old));p.build=null;
  if(p.capital){p.capital=false;const rem=myProvs(old);if(rem.length){const nc=rem.sort((a,b)=>b.pop-a.pop)[0];nc.capital=true;C[old].capital=nc.id;}}
  if(!myProvs(old).length){C[old].alive=false;for(const x of C)x.wars.delete(old);C[old].wars.clear();if(old===player){markOwner(p);endGame();return;}}
  markOwner(p);fogAll();log(`Регион ${p.name} передан государству «${C[to].name}».`,'warn');}
function tabFree(){const p=provs[ui.sel];
  const tg=(k,t,d)=>`<label class="row"><input type="checkbox" data-act="sb" data-k="${k}" ${sb[k]?'checked':''}><div class="nm"><b>${t}</b><small>${d}</small></div></label>`;
  let h=`<div class="hint">Полная свобода: меняйте правила, играйте за любую страну, перекраивайте карту и отношения. Всё действует сразу.</div><h3>Правила</h3>`+
    tg('money','Бесконечная казна','Деньги не заканчиваются')+tg('instant','Мгновенное производство','Заказы, импорт и стройка выполняются сразу')+
    tg('infStock','Бесконечный арсенал','Пуски не расходуют склад')+tg('range','Без ограничения дальности','Бить можно по любой точке карты')+
    tg('immortal','Без капитуляции','Ваше государство не сдаётся, пока у него есть хоть один регион')+tg('noAI','Мирный ИИ','Компьютер не начинает новых войн')+
    `<label class="row"><input type="checkbox" data-act="sbFog" ${!ui.fog?'checked':''}><div class="nm"><b>Без тумана войны</b><small>Видны все войска и ПВО</small></div></label>`;
  h+=`<h3>Государство</h3>`;
  if(p&&p.owner!==player)h+=`<div class="row"><div class="nm"><b>Играть за: ${esc(C[p.owner].name)}</b><small>Страна выбранного региона «${esc(p.name)}»</small></div><button class="btn pri" data-act="sbSwitch">Сменить</button></div>`;
  else h+=`<div class="hint">Щёлкните на карте по региону другой страны, чтобы перейти под её командование.</div>`;
  h+=`<div class="row"><div class="nm"><b>Пополнить казну</b><small>Сейчас ${sb.money?'бесконечно':fM(C[player].money)}</small></div><button class="btn" data-act="sbMoney">+10 млрд $</button></div>`;
  h+=`<h3>Регион${p?' «'+esc(p.name)+'»':''}</h3>`;
  if(!p)h+=`<div class="muted">Выберите регион на карте.</div>`;
  else h+=`<div class="pair"><select class="sel" id="sbGive">${countryOptions(ui.sbGive??player)}</select><button class="btn" data-act="sbGive">Передать регион</button></div>
    <div class="chips" style="margin:8px 0"><span class="chip" data-act="sbTroops" data-k="inf">+10 МСБ</span><span class="chip" data-act="sbTroops" data-k="tank">+5 ТБ</span><span class="chip" data-act="sbTroops" data-k="art">+5 АДН</span>
    <span class="chip" data-act="sbClear">Убрать чужие войска</span><span class="chip" data-act="sbFix">Восстановить энергосистему</span><span class="chip" data-act="sbFactory">+1 к каждому заводу</span><span class="chip" data-act="sbFort">Рубежи 3/3</span></div>
    <div class="muted">Войска получает владелец региона: ${esc(C[p.owner].name)}.</div>`;
  h+=`<h3>Отношения любых стран</h3><div class="pair"><select class="sel" id="sbA">${countryOptions(ui.sbA??player)}</select><select class="sel" id="sbB">${countryOptions(ui.sbB??(p&&p.owner!==player?p.owner:player))}</select></div>
    <div style="display:flex;gap:6px"><button class="btn dng" data-act="sbWar">Объявить войну</button><button class="btn" data-act="sbPeace">Заключить мир</button></div>`;
  h+=`<h3>Графика</h3><div class="row"><div class="nm"><b>Ограничение кадров в секунду</b><small>Сейчас ${fpsShown||'—'} FPS</small></div></div><div class="chips">${[[60,'60'],[144,'144'],[240,'240'],[0,'Без ограничения']].map(([v,l])=>`<span class="chip ${fpsCap===v?'on':''}" data-act="fps" data-k="${v}">${l}</span>`).join('')}</div>`;
  return h;}
function freeAct(a,k,el){const c=C[player],p=provs[ui.sel];
  switch(a){
  case 'sb':sb[k]=el.checked;if(k==='money'&&sb.money)c.money=Math.max(c.money,1e6);return true;
  case 'sbFog':ui.fog=!el.checked;$('#tgFog').classList.toggle('on',ui.fog);return true;
  case 'sbSwitch':if(p)switchCountry(p.owner);return;
  case 'sbMoney':c.money+=10000;return;
  case 'sbGive':if(p)giveProvince(p,+$('#sbGive').value);return;
  case 'sbTroops':if(p){army(p,p.owner)[k]+=k==='inf'?10:5;economyPass();}return;
  case 'sbClear':if(p){for(const o in p.armies)if(+o!==p.owner)delete p.armies[o];p.battle=false;}return;
  case 'sbFix':if(p){p.dmg=0;baseDirty.add(p.id);}return;
  case 'sbFactory':if(p){for(const t of ['civ','mil','drone'])addFac(p,t,'ok');syncFac();}return;
  case 'sbFort':if(p)p.fort=3;return;
  case 'sbWar':{const x=+$('#sbA').value,y=+$('#sbB').value;if(x===y)return 'Выберите две разные страны.';if(atWar(x,y))return 'Эти страны уже воюют.';declareWar(x,y,false,'по решению игрока');return;}
  case 'sbPeace':{const x=+$('#sbA').value,y=+$('#sbB').value;if(!atWar(x,y))return 'Эти страны не воюют.';makePeace(x,y);return;}
  case 'fps':fpsCap=+k;try{localStorage.setItem('lf_fps',k);}catch(e){}return;
  }}

/* =================== ПАНЕЛЬ =================== */
const pc=$('#pc');
function renderPanel(){if(player<0)return;const f={prov:tabProv,prod:tabProd,ars:tabArs,army:tabArmy,dip:tabDip,free:tabFree,log:tabLog}[ui.tab];const st=pc.scrollTop;pc.innerHTML=f();pc.scrollTop=st;panelDirty=false;}
function armyLine(a){return `<div class="unitbox"><span>МСБ ${fN(a.inf)}</span><span>ТБ ${fN(a.tank)}</span><span>АДН ${fN(a.art)}</span></div>`;}
function tabProv(){const p=provs[ui.sel];
  if(!p)return `<div class="hint">Выберите регион на карте: экономика, войска, ПВО. Колесо мыши — масштаб, перетаскивание — перемещение.</div>${quickStart()}`;
  const c=C[p.owner],own=p.owner===player,seen=own||p.vis||!ui.fog;
  let h=`<div class="ph"><span class="sw" style="background:${c.color}"></span><div style="min-width:0"><h2>${p.capital?'★ ':''}${esc(p.name)}</h2><div class="muted">${esc(c.name)}${p.core!==p.owner?` · под контролем; признанная принадлежность — ${esc(C[p.core].name)}`:''}${atWar(player,p.owner)?' · <span class="tag war">война</span>':''}</div></div></div>`;
  h+=`<div class="kv"><span>Координаты</span><b>${fN(p.lat,2)}°, ${fN(p.lon,2)}°</b><span>Рельеф</span><b>${TERR[p.terrain].n}, оборона ×${TERR[p.terrain].def}</b><span>Население региона</span><b>${p.pop.toFixed(2)} млн</b><span>Доход города</span><b>${fM(provIncome(p))}/сут.</b>`;
  if(seen)h+=`<span>Прочность города</span><b style="color:${(p.integ??100)<50?'var(--red)':'inherit'}">${Math.round(p.integ??100)}%</b>${(p.rad||0)>.02?`<span>Радиация</span><b style="color:var(--red)">${Math.round(p.rad*100)}%</b>`:''}<span>Производство города</span><b>${Math.round(cityProd(p)*100)}%</b><span>Энергосистема</span><b style="color:${p.dmg>.3?'var(--red)':'inherit'}">${Math.round((1-p.dmg)*100)}%</b><span>Рубежи обороны</span><b>${p.fort} / 3</b>`;
  h+='</div>';
  if(seen){const fl=facsIn(p);h+=`<h3>Заводы <span>${fl.length} / ${slots(p)} площадок</span></h3>`;if(!fl.length)h+=`<div class="muted">Заводов нет.</div>`;
    for(const fc of fl){const B=BUILD[fc.type],stt=fc.state==='ruin'?'<span class="tag war">разрушен</span>':fc.state==='build'?`строится, осталось ${Math.ceil(fc.left/24)} сут.`:`прочность ${Math.round(fc.hp)}% · ${facRateText(C[p.owner],fc)}`+(own&&fc.type!=='civ'&&fc.state==='ok'?`<br><select class="sel" style="margin-top:4px;padding:4px 6px" data-facprod="${fc.id}">${facProdOptions(C[player],fc)}</select>`:'');
      h+=`<div class="row" ${ui.selFac===fc.id?'style="background:var(--accSoft);border-radius:8px;padding-left:6px"':''}><div class="nm"><b>${B.n}</b><small>${stt}</small></div><button class="btn" data-act="facGoto" data-k="${fc.id}">Показать</button>${own?(fc.state==='ruin'?`<button class="btn pri" data-act="facRebuild" data-k="${fc.id}">Восстановить · ${fM(Math.round(B.cost*.4))}</button>`:'')+`<button class="btn dng" data-act="facDemolish" data-k="${fc.id}">${ui.delFac===fc.id?'Точно снести?':'Снести'}</button>`:''}</div>`;}}
  if(own){if(p.build){const B=BUILD[p.build.t];h+=`<div class="hint" style="border-style:solid">Строится: <b>${B.n}</b>, осталось ${Math.ceil(p.build.left/24)} сут.<div class="bar"><i style="width:${(1-p.build.left/p.build.total)*100}%"></i></div></div>`;}
    h+=`<h3>Строительство</h3><div class="hint">Выберите тип и щёлкните по карте внутри своей территории — завод встанет в этой точке. Прикройте его ПВО: враг бьёт по заводам прицельно.</div>`;
    for(const t in BUILD){const B=BUILD[t];const dis=(t==='fort'?(!!p.build||p.fort>=3):usedSlots(p)>=slots(p))||(C[player].money<B.cost&&!sb.money);
      h+=`<div class="row"><div class="nm"><b>${B.n}</b><small>${B.d} · ${B.h/24} сут.</small></div><button class="btn" data-act="build" data-k="${t}" ${dis?'disabled':''}>${fM(B.cost)}</button></div>`;}
    h+=`<div style="margin-top:8px"><button class="btn" data-act="rally">${C[player].rally===p.id?'✓ Точка сбора новых войск':'Сделать точкой сбора'}</button></div>`;}
  const ks=Object.keys(p.armies).map(Number).filter(o=>tot(p.armies[o])>.02);
  h+=`<h3>Войска${p.battle?' <span class="tag war">идёт бой</span>':''}</h3>`;
  if(!seen&&!p.armies[player])h+=`<div class="muted">Нет разведданных. Отправьте разведывательный БПЛА.</div>`;
  else if(!ks.length)h+=`<div class="muted">Войск нет.</div>`;
  else for(const o of ks)h+=`<div class="row"><span class="sw" style="height:22px;width:8px;background:${C[o].color}"></span><div class="nm"><b>${esc(C[o].name)}</b>${armyLine(p.armies[o])}</div></div>`;
  if(own)h+=reinfBlock(p);
  if(p.armies[player]&&tot(p.armies[player])>.02){h+=`<h3>Приказ войскам</h3><div class="chips" style="margin-bottom:8px">${[[1,'Все'],[.75,'75%'],[.5,'50%'],[.25,'25%']].map(([v,l])=>`<span class="chip ${ui.frac===v?'on':''}" data-act="frac" data-k="${v}">${l}</span>`).join('')}</div>
    <button class="btn pri" data-act="moveMode">Выбрать цель движения</button><div class="hint">Или щёлкните правой кнопкой по региону. Свой — передислокация, вражеский соседний — наступление. Между прибрежными регионами войска перебрасываются морем; морской десант первые 48 ч атакует вполсилы.</div>`;}
  const pa=ads.filter(a=>a.prov===p.id&&adVisible(a));
  if(pa.length||own){h+=`<h3>ПВО и РЭБ</h3>`;if(!pa.length)h+=`<div class="muted">Регион не прикрыт.</div>`;
    for(const a of pa){const T=C[a.owner].cat[a.type];h+=`<div class="row"><div class="nm"><b>${esc(T.n)}</b><small>${a.owner===player?(a.ready>0?`развёртывание: ${Math.ceil(a.ready)} ч`:T.ew?'работает':`ракет: ${a.ammo}/${T.mag} · ${T.range} км`):esc(C[a.owner].name)+((a.spot[player]||0)>time?' · засечён по излучению':'')}</small></div>${a.owner===player?`<button class="btn" data-act="undeploy" data-k="${a.id}">Свернуть</button>`:''}</div>`;}}
  if(p.siege&&(seen||p.armies[player])){const sh=p.siege.A/(p.siege.A+p.siege.D),good=(p.siege.att===player)===(sh>.5);
    h+=`<h3>Штурм города</h3><div class="card"><div class="kv"><span>Наступает</span><b>${esc(C[p.siege.att].name)}</b><span>Обороняется</span><b>${esc(C[p.owner].name)}</b><span>Сила штурма / обороны</span><b>${fN(p.siege.A)} / ${fN(p.siege.D)}</b></div>
    <div class="bar" style="height:8px"><i style="width:${sh*100}%;background:${good?'var(--grn)':'var(--red)'}"></i></div><small class="muted">Город переходит к наступающим, когда у защитников не остаётся войск. Если сила штурма падает ниже 30% обороны, наступающие отходят.</small></div>`;}
  if(atWar(player,p.owner))h+=`<div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap"><button class="btn pri" data-act="assault">${p.core===player?'Отбить город':'Штурмовать город'}</button><button class="btn" data-act="strikeHere">Нанести удар</button><button class="btn" data-act="airlift">Воздушный десант</button></div><div class="hint">Десант летит на транспортниках из вашего города в пределах 1500 км, его может сбить ПВО; тяжёлой техники берёт вдвое меньше. Штурм ведут ваши войска из всех соседних регионов. Какую долю войск отправить, задаётся в «Приказ войскам» (по умолчанию — все).</div>`;
  else if(ks.some(o=>atWar(player,o)))h+=`<div style="margin-top:12px"><button class="btn pri" data-act="strikeHere">Нанести удар по региону</button></div>`;
  return h;}
function quickStart(){return `<h3>С чего начать</h3><div class="kv" style="grid-template-columns:1fr"><span>1. «Заводы» — заказывайте технику, ПВО, ракеты и дроны. Тяжёлые образцы небольшие страны только импортируют.</span><span>2. «Арсенал» — запускайте БПЛА и ракеты, разворачивайте ПВО из резерва.</span><span>3. Выберите свой регион с войсками и щёлкните правой кнопкой по соседнему вражескому — начнётся наступление.</span><span>4. «Политика» — оборонные расходы, мобилизация, война и перемирие. Нападение на члена НАТО или ОДКБ втягивает союзников.</span></div>`;}
function qtyChips(arr,key,cur){return `<div class="chips">${arr.map(v=>`<span class="chip ${cur===v?'on':''}" data-act="${key}" data-k="${v}">${v==='all'?'Все':'×'+v}</span>`).join('')}</div>`;}
function hrs(h){return h>=24?fN(h/24)+' сут.':h+' ч';}
function tabProd(){const c=C[player];
  let h=`<div class="kv"><span>Линии военных заводов</span><b>${fN(c.lines.mil)}</b><span>Линии заводов дронов</span><b>${fN(c.lines.drone)}</b><span>Доход / расходы в сутки</span><b>${fM(c.budget)} / ${fM(c.upk)}</b></div>
  <h3>Сколько заказать</h3>${qtyChips([1,5,10,25,100],'qty',ui.qty)}
  <div class="hint">Заказ строится на ваших заводах, одна единица занимает одну линию. Больше заводов — быстрее выпуск.</div>`;
  const sect=(title,keys)=>{let s=`<h3>${title}</h3>`;for(const k of keys){const it=c.cat[k],cost=it.cost;
    s+=`<div class="row"><div class="nm"><b>${esc(it.n)}</b><small>${esc(it.d)} · ${hrs(it.h)} на линии${it.model?' · '+esc(it.model):''}</small></div>
    <button class="btn" data-act="order" data-k="${k}" ${c.money<cost*ui.qty?'disabled':''}>${fM(cost*ui.qty)}</button></div>`;}return s;};
  h+=sect('Войска',Object.keys(GROUND))+sect('ПВО',Object.keys(ADT))+sect('Дроны',['recon','fpv','shahed'])+sect('Ракеты',['cruise','ballistic'].concat(canMake(c,'nuke')?['nuke']:[]))+customSect(c);
  h+=`<h3>Очередь <span>${c.queue.length}</span></h3>`;if(!c.queue.length)h+=`<div class="muted">Пусто.</div>`;
  c.queue.forEach((q,i)=>{const it=c.cat[q.k];const tot=q.imp?(q.mob?24*30:q.eta-time+1):1;const pr=q.imp?1-(q.eta-time)/(q.mob?24*30:24*14):(q.qty-q.left+q.prog/it.h)/q.qty;
    h+=`<div class="row"><div class="nm"><b>${esc(it.n)} ×${q.qty} ${q.mob?'(мобилизация)':q.imp?'(импорт)':''}</b><small>${q.imp?`прибудет через ${Math.ceil((q.eta-time)/24)} сут.`:`готово ${q.qty-q.left} из ${q.qty}`}</small><div class="bar"><i style="width:${clamp(pr,0,1)*100}%"></i></div></div>${q.imp?'':`<button class="btn dng" data-act="cancel" data-k="${i}">Отмена</button>`}</div>`;});
  return h;}
function tabArs(){const c=C[player];
  let h=`<h3>Залп</h3>${qtyChips([1,3,5,10,25,50,'all'],'salvo',ui.salvo)}<h3>Цель удара</h3><div class="chips">${Object.keys(PRIO).map(k=>`<span class="chip ${ui.prio===k?'on':''}" data-act="prio" data-k="${k}">${PRIO[k]}</span>`).join('')}</div>
  ${ui.pending!=null?`<div class="hint" style="border-color:var(--acc)">Цель: <b>${esc(provs[ui.pending].name)}</b>. Нажмите «Пуск» у нужного средства. <button class="btn" data-act="clearPending">Сбросить</button></div>`:''}<h3>Склад ударных средств</h3>`;
  for(const k of wkeys(c)){const Wp=c.cat[k],n=c.stock[k]|0;
    h+=`<div class="row"><div class="nm"><b>${esc(Wp.n)}</b><small>${Wp.range==='front'?'линия фронта':'до '+Wp.range+' км'} · ${esc(Wp.d)}</small></div><span class="num" style="min-width:40px;text-align:right">${n}</span><button class="btn pri" data-act="launch" data-k="${k}" ${n||sb.infStock?'':'disabled'}>Пуск</button></div>`;}
  const fl=projs.filter(p=>p.owner===player);if(fl.length)h+=`<div class="hint">В воздухе: ${fl.reduce((s,p)=>s+p.n,0)} ваших ракет и БПЛА.</div>`;
  h+=`<h3>Резерв ПВО — развернуть</h3>`;const rk=Object.keys(c.adRes).filter(k=>c.adRes[k]>0);
  if(!rk.length)h+=`<div class="muted">Резерв пуст. Закажите комплексы во вкладке «Заводы».</div>`;
  for(const k of rk)h+=`<div class="row"><div class="nm"><b>${esc(c.cat[k].n)}</b><small>${c.cat[k].range} км</small></div><span class="num">${c.adRes[k]}</span><button class="btn pri" data-act="deploy" data-k="${k}">Развернуть</button></div>`;
  const by={};for(const a of ads)if(a.owner===player)by[a.type]=(by[a.type]||0)+1;
  h+=`<h3>Развёрнуто</h3><div class="kv">${Object.keys(ADT).map(k=>`<span>${esc(c.cat[k].n)}</span><b>${by[k]||0}</b>`).join('')}</div>
  <div class="kv" style="margin-top:8px"><span>Зенитных пусков</span><b>${c.st.shots}</b><span>Сбито целей</span><b>${c.st.intercepted}</b><span>Потеряно своих БПЛА и ракет</span><b>${c.st.lost}</b></div>`;
  return h;}
function citiesBlock(){const won=provs.filter(p=>p.owner===player&&p.core!==player),lost=provs.filter(p=>p.core===player&&p.owner!==player);
  let h=`<div class="kv"><span>Захвачено вами</span><b>${won.length}</b><span>Потеряно</span><b>${lost.length}</b></div>`;
  for(const p of lost)h+=`<div class="row"><span class="sw" style="height:22px;width:8px;background:${C[p.owner].color}"></span><div class="nm"><b>${esc(p.name)} ${p.battle?'<span class="tag war">штурм</span>':''}</b><small>потерян · контролирует ${esc(C[p.owner].name)}</small></div><button class="btn" data-act="goto" data-k="${p.id}">Показать</button>${atWar(player,p.owner)?`<button class="btn pri" data-act="assaultId" data-k="${p.id}">Отбить</button>`:''}</div>`;
  for(const p of won)h+=`<div class="row"><span class="sw" style="height:22px;width:8px;background:${C[p.core].color}"></span><div class="nm"><b>${esc(p.name)} ${p.battle?'<span class="tag war">под ударом</span>':''}</b><small>захвачен у: ${esc(C[p.core].name)}</small></div><button class="btn" data-act="goto" data-k="${p.id}">Показать</button></div>`;
  if(!won.length&&!lost.length)h+=`<div class="muted">Пока ни одного города не захвачено и не потеряно. Выберите вражеский город на карте и нажмите «Штурмовать город».</div>`;
  return h;}
function assault(pi){const t=provs[pi];if(!atWar(player,t.owner))return `Нет войны с государством «${C[t.owner].name}». Объявить войну можно во вкладке «Политика».`;
  const src=t.nb.map(n=>provs[n]).filter(q=>q.owner===player&&q.armies[player]&&tot(q.armies[player])>.05);
  if(!src.length)return 'Рядом нет ваших войск. Подведите армию к соседнему региону или высадите морской десант (правая кнопка мыши по городу).';
  let n=0;for(const q of src){if(q.battle)continue;if(!sendArmy(player,q.id,pi,ui.frac))n++;}
  return n?null:'Соседние войска сами ведут оборонительные бои.';}
function tabArmy(){const c=C[player];let t={inf:0,tank:0,art:0};const list=[];
  for(const p of provs){const a=p.armies[player];if(a&&tot(a)>.02){t.inf+=a.inf;t.tank+=a.tank;t.art+=a.art;list.push(p);}}
  let h=`<h3>Всего</h3>${armyLine(t)}<div class="kv" style="margin-top:8px"><span>Содержание армии и ПВО</span><b>${fM(c.upk)}/сут.</b><span>Точка сбора</span><b>${esc(provs[c.rally!=null&&provs[c.rally].owner===player?c.rally:c.capital].name)}</b></div>
  <h3>Мобилизация</h3><div class="row"><div class="nm"><b>Призвать резервистов: ${mobSize(c)} отрядов пехоты</b><small>${fM(mobSize(c)*10)} · готовы через 10 сут. · раз в 60 сут.</small></div><button class="btn" data-act="mob" ${c.mobCd>time?'disabled':''}>${c.mobCd>time?`через ${Math.ceil((c.mobCd-time)/24)} сут.`:'Объявить'}</button></div>
  <h3>Города</h3>${citiesBlock()}
  <h3>Группировки</h3>`;
  list.sort((a,b)=>(b.battle-a.battle)||tot(b.armies[player])-tot(a.armies[player]));
  for(const p of list.slice(0,80))h+=`<div class="row"><div class="nm"><b>${esc(p.name)} ${p.battle?'<span class="tag war">бой</span>':''}${p.owner!==player?' <span class="muted">(чужая территория)</span>':''}</b>${armyLine(p.armies[player])}</div><button class="btn" data-act="goto" data-k="${p.id}">Показать</button></div>`;
  const mv=moves.filter(m=>m.owner===player);if(mv.length){h+=`<h3>На марше</h3>`;for(const m of mv)h+=`<div class="row"><div class="nm"><b>→ ${esc(provs[m.path[m.path.length-1]].name)} ${m.sea?'(морем)':''}</b>${armyLine(m.u)}</div><span class="num muted">${Math.ceil(m.left)} ч</span></div>`;}
  return h;}
function tabDip(){const c=C[player];const ps=strength(c);
  let h=`<h3>Экономика</h3><div class="kv"><span>Городов под контролем</span><b>${c.ncity}</b><span>Доход городов</span><b>${fM(c.inc)}/сут.</b>${c.aid?`<span>Помощь ${esc(c.aidFrom)}</span><b>${fM(c.aid)}/сут.</b>`:''}<span>Содержание армии и ПВО</span><b>${fM(c.upk)}/сут.</b></div>
  <div class="hint">Доход дают города: малый — 3, средний — 6, крупный — 10 млн $ в сутки, столица ещё +15, каждый гражданский завод +4. Захваченный город приносит 70% дохода, удары по энергетике временно снижают его.</div>
  <h3>Союзы</h3>${c.pacts.length?c.pacts.map(p=>`<div class="muted">• ${esc(p.name)}</div>`).join(''):'<div class="muted">Нет оборонительных договоров.</div>'}
  <h3>Государства</h3><input class="search" id="dipSearch" placeholder="Поиск…" value="${esc(ui.dipQ||'')}">`;
  const q=(ui.dipQ||'').toLowerCase();
  const list=C.filter(x=>x.id!==player&&(x.alive||atWar(player,x.id))&&(!q||x.name.toLowerCase().includes(q))).sort((a,b)=>(atWar(player,b.id)-atWar(player,a.id))||b.budget-a.budget).slice(0,60);
  for(const x of list){const war=atWar(player,x.id),ally=x.pacts.some(p=>p.m.includes(c.key));
    h+=`<div class="row"><span class="sw" style="background:${x.color};height:34px;width:8px"></span><div class="nm"><b>${esc(x.name)} ${!x.alive?'<span class="tag dead">капитулировала</span>':war?'<span class="tag war">война</span>':ally?'<span class="tag ally">союзник</span>':'<span class="tag peace">мир</span>'}</b>
    <small>городов ${x.ncity} · доход ${fM(x.budget)}/сут. · сила ${(strength(x)/ps*100).toFixed(0)}% от вашей${x.pacts.length?' · '+x.pacts.map(p=>esc(p.name)).join(', '):''}${x.alive&&x.wars.size?` · воюет с: ${[...x.wars].slice(0,4).map(i=>esc(C[i].name)).join(', ')}`:''}</small></div>
    ${x.alive?(war?(x.peaceOffer?`<button class="btn pri" data-act="acceptPeace" data-k="${x.id}">Принять</button>`:`<button class="btn" data-act="peace" data-k="${x.id}">Перемирие</button>`):`<button class="btn dng" data-act="war" data-k="${x.id}">Война</button><button class="btn dng" data-act="surprise" data-k="${x.id}" title="Без объявления: ПВО противника не готова 12 ч, репутация −${CONFIG.SURPRISE_REP}">Внезапно</button>`):''}</div>`;}
  return h;}
function tabLog(){if(!logs.length)return `<div class="muted">Событий пока нет.</div>`;return logs.slice(0,200).map(l=>`<div class="log ${l.cls}"><time>${dateStr(l.t)}</time>${esc(l.txt)}</div>`).join('');}

pc.addEventListener('pointerdown',e=>{if(e.target.tagName!=='INPUT')ui.mouseDown=true;});
window.addEventListener('pointerup',()=>{ui.mouseDown=false;});
pc.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el)return;act(el.dataset.act,el.dataset.k,el);});
pc.addEventListener('change',e=>{const t=e.target;if(t.id==='sbGive')ui.sbGive=+t.value;else if(t.id==='sbA')ui.sbA=+t.value;else if(t.id==='sbB')ui.sbB=+t.value;});
pc.addEventListener('input',e=>{if(e.target.id==='dipSearch'){ui.dipQ=e.target.value;const pos=e.target.selectionStart;renderPanel();const n=$('#dipSearch');n.focus();n.setSelectionRange(pos,pos);}});
function act(a,k,el){const c=C[player];let err=null;
  if(a.startsWith('sb')||a==='fps'){const r=freeAct(a,k,el);if(r===true)return;if(r)toast(r,'bad');renderPanel();return;}
  switch(a){
  case 'build':if(k!=='fort'){ui.facType=k;setMode('placeFac');return;}err=startBuild(c,provs[ui.sel],k);if(!err)toast(`Начато строительство: ${BUILD[k].n}`,'ok');break;
  case 'facGoto':{const f=facs.find(x=>x.id===+k);if(f){ui.selFac=f.id;focus(f.x,f.y,Math.max(cam.z,4));}break;}
  case 'facRebuild':{const f=facs.find(x=>x.id===+k);if(f){err=rebuildFac(c,f);if(!err)toast('Восстановление начато','ok');}break;}
  case 'facDemolish':{const f=facs.find(x=>x.id===+k);if(f){if(ui.delFac===f.id){demolishFac(f);ui.delFac=null;ui.selFac=null;toast('Завод снесён');}else{ui.delFac=f.id;toast('Нажмите «Снести» ещё раз для подтверждения','warn');}}break;}
  case 'airlift':err=startAirlift(ui.sel);break;
  case 'placeTroops':ui.placeK=k;setMode('placeTroops');return;
  case 'reinf':{const [kk,a]=k.split(':'),dp=depot(c),p=provs[ui.sel];const n=a==='all'?Math.floor(dp[kk]):Math.min(+a,Math.floor(dp[kk]));if(p&&p.owner===player&&n>0){dp[kk]-=n;army(p,player)[kk]+=n;economyPass();toast(`${GROUND[kk].n} +${n} → ${p.name}`,'ok');}break;}
  case 'reinfOrder':{const p=provs[ui.sel];err=order(c,k,5,p?p.id:null);if(!err)toast(`Заказано: ${GROUND[k].n} ×5 → ${p.name}`,'ok');break;}
  case 'autoReinf':c.autoReinf=el.checked;toast(c.autoReinf?'Автопополнение фронта включено':'Автопополнение выключено','ok');return;
  case 'placeAmt':ui.placeAmt=k==='all'?'all':+k;break;
  case 'designer':openDesigner();return;
  case 'dzBase':{const B=BASE[k];dz.base=k;dz.range=typeof B.range==='number'?B.range:0;dz.spd=B.spd;dz.ewRes=0;renderDesigner();return;}
  case 'dzPrio':dz.prio=k;renderDesigner();return;
  case 'cwSave':{const e2=saveDesign();if(e2)toast(e2,'bad');return;}
  case 'nukeYes':fireNukeConfirmed();return;
  case 'nukeNo':nukePending=null;$('#over').style.display='none';setMode(null);return;
  case 'rally':c.rally=ui.sel;toast('Новые войска будут прибывать сюда','ok');break;
  case 'frac':ui.frac=+k;break;
  case 'moveMode':setMode('move');break;
  case 'undeploy':{const ad=ads.find(x=>x.id===+k);if(ad){ads=ads.filter(x=>x!==ad);c.adRes[ad.type]=(c.adRes[ad.type]||0)+1;toast(`${c.cat[ad.type].n}: свёрнут в резерв`);}break;}
  case 'strikeHere':ui.pending=ui.sel;setTab('ars');return;
  case 'assault':err=assault(ui.sel);if(!err)toast(`Штурм начат: ${provs[ui.sel].name}`,'ok');break;
  case 'assaultId':err=assault(+k);if(!err)toast(`Войска идут отбивать ${provs[+k].name}`,'ok');break;
  case 'saveNew':{const nm_=($('#saveName')?.value||'').trim();saveGame('s'+Date.now(),false,nm_);return;}
  case 'saveOver':{const nm_=($('#saveName')?.value||'').trim();saveGame(k,false,nm_);return;}
  case 'delSave':if(ui.delPending===k){ui.delPending=null;delSave(k);}else{ui.delPending=k;openSaves(!!$('#overBox').dataset.saving);}return;
  case 'clearPending':ui.pending=null;break;
  case 'qty':ui.qty=+k;break;
  case 'order':case 'import':err=order(c,k,ui.qty,a==='import');if(!err)toast(`${a==='import'?'Импорт':'Заказ'}: ${c.cat[k].n} ×${ui.qty}`,'ok');break;
  case 'cancel':{const q=c.queue[+k];if(q){c.money+=q.paid*(q.left/q.qty);c.queue.splice(+k,1);toast('Заказ отменён, средства за невыпущенные единицы возвращены');}break;}
  case 'salvo':ui.salvo=k==='all'?'all':+k;break;
  case 'prio':ui.prio=k;break;
  case 'launch':if(c.cat[k].prio)ui.prio=c.cat[k].prio;if(ui.pending!=null){const p=provs[ui.pending];err=tryLaunch(k,p.cx,p.cy);if(err==='ask')return;if(!err)toast(`Пуск: ${c.cat[k].n}`,'ok');}else{ui.wk=k;setMode('target');}break;
  case 'deploy':ui.adk=k;setMode('deploy');break;
  case 'doct':c.doct[k]=el.checked;return;
  case 'share':c.share=clamp(c.share+ +k,.005,.4);economyPass();break;
  case 'mob':err=mobilize(c);break;
  case 'war':declareWar(player,+k);break;
  case 'peace':{const [ok,why]=aiPeaceAnswer(C[+k],c);if(ok)makePeace(player,+k);else toast(why,'bad');break;}
  case 'acceptPeace':makePeace(player,+k);break;
  case 'goto':ui.sel=+k;focus(provs[+k].cx,provs[+k].cy,Math.max(cam.z,3));setTab('prov');return;
  case 'closeOver':$('#over').style.display='none';showPrompt();return;
  case 'toMenu':$('#over').style.display='none';openMenu();return;
  case 'joinWar':{const q=pendingPrompt.shift();$('#over').style.display='none';if(q)declareWar(player,q.enemy,false,'союзнический долг');showPrompt();break;}
  case 'skipWar':{const q=pendingPrompt.shift();$('#over').style.display='none';if(q)log(`Вы не вступили в войну на стороне государства «${C[q.ally].name}».`,'warn');showPrompt();break;}
  case 'save':saveGame(k);return;
  case 'load':loadGame(k);return;
  }
  if(err)toast(err,'bad');renderPanel();}
function setTab(t){ui.tab=t;document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));renderPanel();}
document.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
function setMode(m){ui.mode=m;if(m!=='target'){ui.launchFrom=null;ui.lfDrag=null;}const el=$('#mode');
  if(!m){el.style.display='none';cv.style.cursor='grab';return;}
  el.style.display='block';cv.style.cursor='crosshair';const c=C[player];
  el.textContent=m==='target'?`Наведение: ${c.cat[ui.wk].n}, залп ${ui.salvo==='all'?'всеми':'×'+ui.salvo}, цель — ${PRIO[ui.prio].toLowerCase()}. Нажмите на свой город и протяните к цели — или просто щёлкните по цели. Esc — отмена`
    :m==='deploy'?`Развёртывание: ${c.cat[ui.adk].n}. Щёлкните по своей территории (Esc — отмена)`:m==='sendSel'?'Укажите цель для выбранных отрядов: город, точку или вражеский корабль (Esc — отмена)':m==='shipLaunch'?`Спуск на воду: ${SHIPS[ui.shipType].n}. Щёлкните по своему прибрежному городу (Esc — отмена)`:m==='placeWing'?'Выберите свой город — там будет аэродром эскадрильи (Esc — отмена)':m==='placeSquad'?`Отряд дронов: ${c.cat[ui.squadK].n}. Щёлкните по своему городу (Esc — отмена)`:m==='placeTroops'?`Размещение со склада: ${GROUND[ui.placeK].n}. Щёлкните по своему городу (Esc — отмена)`:m==='placeFac'?`Строительство: ${BUILD[ui.facType].n}. Щёлкните по своей территории — завод встанет в этой точке (Esc — отмена)`:'Выберите регион назначения (Esc — отмена)';}
function tryLaunch(wk,x,y,confirmed){if(wk==='nuke'&&!confirmed)return askNuke(x,y);const c=C[player],Wp=c.cat[wk];const pi=provAt(x,y);
  if(wk==='nuke'){const st=nearestOwn(player,x,y);if(!st)return 'Нет своей территории для пуска.';const have=sb.infStock?1:c.stock.nuke|0;if(have<1)return 'Нет ядерных ракет.';if(!sb.infStock)c.stock.nuke--;fireSalvo(player,'nuke',st,x,y,1,'troops');panelDirty=true;return null;}
  if(pi<0)return 'Цель в море. Выберите точку на суше (корабли бейте, выбрав их как цель отряда).';
  const p=provs[pi];const hostile=atWar(player,p.owner)||Object.keys(p.armies).some(o=>atWar(player,+o)&&tot(p.armies[o])>.01);
  if(!hostile)return p.owner===player?'Это ваша территория, противника здесь нет.':`С государством «${C[p.owner].name}» нет войны.`;
  let site;
  const lf=ui.launchFrom!=null&&provs[ui.launchFrom].owner===player?provs[ui.launchFrom]:null;
  if(lf){site=lf;const dd=km(lf.cx,lf.cy,x,y);if(Wp.range==='front'){if(!(lf.id===pi||lf.nb.includes(pi)||dd<=CONFIG.FRONT_RANGE))return `FPV достают только районы рядом с пусковым городом (до 150 км, сейчас ${Math.round(dd)} км).`;}
    else if(!sb.range&&dd>effRange(c,Wp))return `Цель дальше ${Math.round(effRange(c,Wp))} км от города ${lf.name} (сейчас ${Math.round(dd)} км). Выберите город поближе.`;}
  else if(sb.range){site=nearestOwn(player,x,y);}
  else if(Wp.range==='front'){site=frontSite(player,pi);if(!site)return 'FPV применяются только на линии фронта: цель должна граничить с регионом, где стоят ваши войска.';}
  else if(Wp.range==='near'){site=nearSite(player,pi);if(!site)return 'Барражирующие боеприпасы достают только регионы, граничащие с вашей территорией.';}
  else{site=nearestOwn(player,x,y);if(!site||km(site.cx,site.cy,x,y)>effRange(c,Wp))return `Цель вне радиуса: ${Math.round(effRange(c,Wp))} км от ближайшего своего региона (сейчас ${Math.round(site?km(site.cx,site.cy,x,y):0)} км).`;}
  const have=sb.infStock?999:c.stock[wk]|0;const n=Math.min(ui.salvo==='all'?have:ui.salvo,have,CONFIG.MAX_SALVO);if(n<=0)return 'Нет на складе.';
  if(!sb.infStock)c.stock[wk]-=n;fireSalvo(player,wk,site,x,y,n,ui.prio);panelDirty=true;return null;}

/* =================== ВВОД =================== */
const ptrs=new Map();let drag=null,pinch=null;
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.offsetX,y:e.offsetY});
  if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:cam.z};drag=null;return;}
  if(ui.mode==='target'&&e.button===0){const [wx,wy]=toWorld(e.offsetX,e.offsetY),pi=provAt(wx,wy);const sh=carrierAt(wx,wy);if(sh){ui.launchShip=sh.id;ui.launchFrom=null;ui.lfDrag={sx:e.offsetX,sy:e.offsetY};drag=null;return;}if(pi>=0&&provs[pi].owner===player){ui.launchShip=null;ui.launchFrom=pi;ui.lfDrag={sx:e.offsetX,sy:e.offsetY};drag=null;return;}}
  if(started&&!ui.mode&&e.button===0){ui.box={sx:e.offsetX,sy:e.offsetY,x2:e.offsetX,y2:e.offsetY,shift:e.shiftKey};drag=null;return;}
  drag={sx:e.offsetX,sy:e.offsetY,cx:cam.x,cy:cam.y,moved:false,btn:e.button};});
cv.addEventListener('pointermove',e=>{ui.mx=e.offsetX;ui.my=e.offsetY;if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,{x:e.offsetX,y:e.offsetY});
  if(ui.box){ui.box.x2=e.offsetX;ui.box.y2=e.offsetY;return;}
  if(pinch&&ptrs.size===2){const [a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;const [wx,wy]=toWorld(mx,my);
    cam.z=pinch.z*d/pinch.d;clampCam();cam.x=wx-mx/cam.z;cam.y=wy-my/cam.z;return;}
  if(drag){const dx=e.offsetX-drag.sx,dy=e.offsetY-drag.sy;if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;if(drag.moved){cam.x=drag.cx-dx/cam.z;cam.y=drag.cy-dy/cam.z;clampCam();cv.style.cursor='grabbing';}}
  if(drag&&drag.moved){$('#tip').style.display='none';return;}const [wx,wy]=toWorld(e.offsetX,e.offsetY);const pi=provAt(wx,wy);ui.hover=pi>=0?pi:null;tip(e.offsetX,e.offsetY,pi);});
cv.addEventListener('pointerup',e=>{ptrs.delete(e.pointerId);if(pinch){if(ptrs.size<2)pinch=null;drag=null;return;}
  if(ui.lfDrag){const d=Math.hypot(e.offsetX-ui.lfDrag.sx,e.offsetY-ui.lfDrag.sy);ui.lfDrag=null;drag=null;if(d>8){const [wx,wy]=toWorld(e.offsetX,e.offsetY);launchAt(wx,wy);}else toast(`Пуск${launchName()}. Теперь щёлкните по цели или протяните к ней.`,'ok');return;}
  if(ui.box){const b=ui.box;ui.box=null;drag=null;const [wx,wy]=toWorld(e.offsetX,e.offsetY);
    if(Math.abs(b.x2-b.sx)+Math.abs(b.y2-b.sy)>6){boxSelect(b.sx,b.sy,b.x2,b.y2,b.shift);return;}
    const t=tokenAt(wx,wy);if(t){if(b.shift&&ui.selU.has(t.id))ui.selU.delete(t.id);else{if(!b.shift)ui.selU.clear();ui.selU.add(t.id);}updateSelBox();if(t.type==='army'){ui.sel=t.ref.id;renderPanel();}return;}
    if(!b.shift)ui.selU.clear();updateSelBox();mapClick(wx,wy,0);return;}
  if(drag&&!drag.moved){const [wx,wy]=toWorld(e.offsetX,e.offsetY);mapClick(wx,wy,drag.btn);}drag=null;cv.style.cursor=ui.mode?'crosshair':'grab';});
cv.addEventListener('pointerleave',()=>{$('#tip').style.display='none';ui.hover=null;});
cv.addEventListener('wheel',e=>{e.preventDefault();const [wx,wy]=toWorld(e.offsetX,e.offsetY);cam.z*=Math.exp(-e.deltaY*.0015);clampCam();cam.x=wx-e.offsetX/cam.z;cam.y=wy-e.offsetY/cam.z;clampCam();},{passive:false});
function mapClick(wx,wy,btn){const pi=provAt(wx,wy);
  if(!started){if(pi>=0){ui.menuSel=provs[pi].owner;renderMenu(true);}return;}
  if(btn===2&&!ui.mode&&selCount()){sendSelectionTo(wx,wy);return;}
  if(ui.mode==='sendSel'){if(btn===2){setMode(null);return;}sendSelectionTo(wx,wy);setMode(null);return;}
  if(ui.mode==='shipLaunch'){if(btn===2){setMode(null);return;}const d=depot(C[player]);if(pi<0||provs[pi].owner!==player||!portOf(provs[pi])){toast('Выберите свой прибрежный город с портом.','bad');return;}if(!(d.ships&&d.ships[ui.shipType]>0)){setMode(null);return;}d.ships[ui.shipType]--;shipSpawn(player,ui.shipType,provs[pi]);toast(`${SHIPS[ui.shipType].n} спущен на воду: ${provs[pi].name}`,'ok');if(!(d.ships[ui.shipType]>0))setMode(null);renderPanel();return;}
  if(ui.mode==='placeWing'){if(btn===2){setMode(null);return;}const e2=placeWing(pi,C[player].stock.bomber|0);if(e2)toast(e2,'bad');else{toast('Эскадрилья на аэродроме: '+provs[pi].name,'ok');setMode(null);}renderPanel();return;}
  if(ui.mode==='placeSquad'){if(btn===2){setMode(null);return;}const amt=ui.placeAmt==='all'?(C[player].stock[ui.squadK]|0):+ui.placeAmt;const e3=placeSquad(pi,ui.squadK,amt);if(e3)toast(e3,'bad');else{toast('Отряд дронов создан: '+provs[pi].name,'ok');setMode(null);}renderPanel();return;}
  if(ui.mode==='placeTroops'){if(btn===2){setMode(null);return;}const e0=placeTroopsAt(pi);if(e0)toast(e0,'bad');renderPanel();return;}
  if(ui.mode==='placeFac'){if(btn===2){setMode(null);return;}if(pi<0||provs[pi].owner!==player){toast('Завод можно поставить только на своей территории.','bad');return;}
    const e1=startBuild(C[player],provs[pi],ui.facType,wx,wy);if(e1)toast(e1,'bad');else{toast(`Стройка начата: ${BUILD[ui.facType].n} (${provs[pi].name})`,'ok');setMode(null);}ui.sel=pi;renderPanel();return;}
  if(btn===0&&!ui.mode){const ff=facAt(wx,wy);if(ff){ui.selFac=ff.id;ui.sel=ff.prov;if(ui.tab!=='prov')setTab('prov');else renderPanel();return;}ui.selFac=null;}
  if(ui.mode==='target'){if(btn===2){setMode(null);return;}launchAt(wx,wy);return;}
  if(ui.mode==='deploy'){if(btn===2){setMode(null);return;}if(pi<0||provs[pi].owner!==player){toast('Развернуть комплекс можно только на своей территории.','bad');return;}
    const c=C[player];addAD(player,ui.adk,provs[pi],12,wx,wy);c.adRes[ui.adk]--;toast(`${c.cat[ui.adk].n}: развёртывание 12 ч`,'ok');if(!(c.adRes[ui.adk]>0))setMode(null);renderPanel();return;}
  if(ui.mode==='move'||btn===2){if(ui.sel!=null&&pi>=0&&pi!==ui.sel){const err=sendArmy(player,ui.sel,pi,ui.frac);if(err)toast(err,'bad');else toast(`Войска выдвигаются: ${provs[pi].name}`,'ok');}setMode(null);renderPanel();return;}
  ui.sel=pi>=0?pi:null;if(ui.tab!=='prov')setTab('prov');else renderPanel();}
function tip(x,y,pi){const el=$('#tip');if(pi<0||pi==null||ui.mode){el.style.display='none';return;}const p=provs[pi],c=C[p.owner];
  let h=`<b>${esc(p.name)}</b>${p.capital?' ★':''}<br>${esc(c.name)}${p.core!==p.owner?` <span class="muted">(признан: ${esc(C[p.core].name)})</span>`:''}<br><span class="muted">${TERR[p.terrain].n} · доход ${fM(provIncome(p))}/сут.</span>`;
  if(!started||p.owner===player||p.vis||!ui.fog){const a=p.armies[p.owner];if(a&&tot(a)>.02)h+=`<br>Войска: ${fN(tot(a))} бат.`;h+=`<br>Заводы: гражд. ${facCount(p,'civ')} · воен. ${facCount(p,'mil')} · дронов ${facCount(p,'drone')}`;}
  else h+=`<br><span class="muted">Нет разведданных</span>`;
  el.innerHTML=h;el.style.display='block';const r=$('#mapwrap').getBoundingClientRect();el.style.left=Math.min(x+14,r.width-290)+'px';el.style.top=Math.min(y+14,r.height-120)+'px';}
window.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(!started)return;
  if(e.code==='Space'){e.preventDefault();if(!over){running=!running;setSpeedUI();}}
  else if(e.key==='Escape')setMode(null);
  else if(/^[1-6]$/.test(e.key)&&!over){speed=SPEEDS[+e.key-1];running=true;setSpeedUI();}
  else if(e.key==='F5'){e.preventDefault();saveGame('quick',false,'Быстрое сохранение');}
  else if(e.key==='F9'){e.preventDefault();loadGame('quick');}
  else if(e.ctrlKey&&(e.key==='s'||e.key==='ы')){e.preventDefault();openSaves(true);}});

/* =================== ВЕРХНЯЯ ПАНЕЛЬ =================== */
const SPEEDS=[1,3,6,12,24,48];
function setSpeedUI(){$('#speed').innerHTML=`<button data-s="0" class="${!running?'on':''}" title="Пауза (пробел)">❚❚</button>`+SPEEDS.map(s=>`<button data-s="${s}" class="${running&&speed===s?'on':''}">${s}ч/с</button>`).join('');}
$('#speed').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!started||over)return;const s=+b.dataset.s;if(!s)running=false;else{speed=s;running=true;}setSpeedUI();});
$('#tgAD').onclick=e=>{ui.showAD=!ui.showAD;e.target.classList.toggle('on',ui.showAD);};
$('#tgFog').onclick=e=>{ui.fog=!ui.fog;e.target.classList.toggle('on',ui.fog);};
$('#btnHelp').onclick=()=>{running=false;setSpeedUI();showOver(HELP);};
$('#btnSave').onclick=()=>{if(started)openSaves(true);};
$('#btnLoad').onclick=()=>openSaves(false);$('#menuLoad').onclick=()=>openSaves(false);
$('#btnMenu').onclick=()=>{showOver(`<h2>Меню</h2><p>Выйти в главное меню? Несохранённый прогресс будет потерян.</p><div style="display:flex;gap:8px"><button class="btn" data-act="closeOver">Вернуться к игре</button><button class="btn" data-act="save" data-k="quick">Быстрое сохранение</button><button class="btn dng" data-act="toMenu">В главное меню</button></div>`);running=false;setSpeedUI();};
$('#over').addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(el)act(el.dataset.act,el.dataset.k,el);});
function showOver(html){$('#overBox').innerHTML=html;$('#over').style.display='flex';}
const HELP=`<h2>Как играть</h2>
<p><b>Цель.</b> Захватывайте города противника и удерживайте свои. Каждый город — это регион на карте.</p>
<p><b>Деньги.</b> Доход дают города: малый — 3, средний — 6, крупный — 10 млн $ в сутки, столица ещё +15, гражданский завод +4. Чем больше городов, тем богаче страна. Войска и ПВО требуют содержания.</p>
<p><b>Производство.</b> «Заводы» — заказывайте пехоту, танки, артиллерию, ПВО, дроны и ракеты. Военный завод даёт 2 линии, завод дронов — 3. Больше заводов — быстрее выпуск.</p>
<p><b>Наступление.</b> Выберите вражеский город и нажмите «Штурмовать город» или щёлкните правой кнопкой по цели. Танки сильны в атаке, пехота — в обороне, артиллерия усиливает штурм. Лес и горы помогают защитникам.</p>
<p><b>Удары.</b> «Арсенал» — выберите залп и цель, нажмите «Пуск» и щёлкните по карте. FPV бьют войска на фронте, ударные дроны дёшевы и идут стаей, ракеты наносят сильный урон. Баллистику сбивает только дальняя ПВО.</p>
<p><b>ПВО.</b> Ближняя ПВО против дронов, дальняя — против ракет, РЭБ глушит дроны. Ракеты ПВО пополняются сами.</p>
<p><b>Заводы.</b> Во вкладке «Регион» выберите тип завода и щёлкните по своей территории — завод встанет в этой точке. Разрушенный завод можно восстановить или снести, а рядом поставить ПВО. Враг прицельно бьёт по заводам и ПВО.</p>
<p><b>Новое оружие.</b> Дроны-перехватчики охотятся на вражеские БПЛА. Воздушный десант перебрасывает войска на транспортниках. Ядерные державы могут нанести ядерный удар. В «Заводах» есть конструктор своего оружия.</p>
<p><b>Отряды.</b> Левая кнопка — выделить отряд, рамка — группу, Shift — добавить. Правая кнопка — отправить выделенных в точку, город или на вражеский корабль. Фильтр по типу — в панели внизу слева. Карту двигайте правой кнопкой или стрелками / WASD.</p>
<p><b>Флот.</b> Корабли ходят только по воде. Транспорт возит войска и дроны, носитель запускает дроны (в режиме удара нажмите на корабль и тяните к цели). Корабли можно потопить вместе с грузом.</p>
<p><b>Управление.</b> <kbd>Пробел</kbd> — пауза, <kbd>1</kbd>–<kbd>6</kbd> — скорость, <kbd>Esc</kbd> — отмена, <kbd>F5</kbd>/<kbd>F9</kbd> — быстрое сохранение и загрузка, колесо мыши — масштаб.</p>
<button class="btn pri" data-act="closeOver">Продолжить</button>`;
function topTick(){if(player<0)return;const c=C[player];$('#money').textContent=sb.money?'∞':fM(c.money);const pcost=prodCost(c),net=c.budget-c.upk-pcost;
  const el=$('#inc');el.textContent=(net>=0?'+':'')+fM(net);el.parentElement.title=`Доход ${fM(c.budget)} · содержание армии и ПВО −${fM(c.upk)} · выпуск заводов −${fM(pcost)}`;el.style.color=net>=0?'var(--grn)':'var(--red)';$('#date').textContent=dateStr(time);$('#gdp').textContent=c.ncity;}

/* =================== СОХРАНЕНИЯ =================== */
const api=()=>window.pywebview&&window.pywebview.api;
function serialize(){const inflight={};for(const p of projs)if(p.state!=='return'||true){inflight[p.owner]=inflight[p.owner]||{};inflight[p.owner][p.w]=(inflight[p.owner][p.w]||0)+(p.state==='return'?1:0);}
  return JSON.stringify({v:2,np:provs.length,time,player,speed,scen,aiMul,adId,
    provs:provs.map(p=>[p.owner,p.armies,p.b,p.fort,p.dmg,p.build,p.capital?1:0]),
    C:C.map(c=>{const st={...c.stock};if(inflight[c.id])for(const k in inflight[c.id])st[k]=(st[k]||0)+inflight[c.id][k];
      return {money:c.money,alive:c.alive,wars:[...c.wars],warStart:c.warStart,stock:st,adRes:c.adRes,queue:c.queue,doct:c.doct,capital:c.capital,rally:c.rally,share:c.share,gdpMul:c.gdpMul,st:c.st,peaceOffer:c.peaceOffer,mobCd:c.mobCd,custom:c.custom||[],sanction:c.sanction||0,depot:c.depot||null,autoReinf:!!c.autoReinf};}),
    ads,moves,sb,facs,facId,ext:saveExt(),logs:logs.slice(0,200),title:serialize.saveName||`${C[player].name} — ${dateStr(time).slice(0,10)}`,country:C[player].name,gameDate:dateStr(time),saved:Date.now()});}
function deserialize(s){const d=JSON.parse(s);if(d.np!==provs.length)throw new Error('Сохранение от другой версии карты');
  initCountries();time=d.time;player=d.player;speed=d.speed;scen=d.scen;aiMul=d.aiMul;adId=d.adId;
  d.provs.forEach((a,i)=>{const p=provs[i];[p.owner,p.armies,p.b,p.fort,p.dmg,p.build]=a;p.capital=!!a[6];});
  d.C.forEach((x,i)=>{const c=C[i];Object.assign(c,x);c.wars=new Set(x.wars);c.isPlayer=i===player;for(const s of (c.custom||[]))buildCustom(c,s);});
  if(d.facs){facs=d.facs;facId=d.facId||0;}else{facs=[];for(const p of provs)for(const t of ['civ','mil','drone'])for(let i=0;i<Math.round((p.b&&p.b[t])||0);i++)addFac(p,t,'ok');}syncFac();
  loadExt(d.ext);moves.forEach(m=>{if(m.id==null)m.id=++moveId;});
  ads=d.ads;moves=d.moves;logs=d.logs;const remap={mrsam:'lrsam',manpads:'shorad'};ads=ads.filter(a=>{a.type=remap[a.type]||a.type;return !!ADT[a.type];});
  for(const c of C){for(const k in c.adRes)if(remap[k]){c.adRes[remap[k]]=(c.adRes[remap[k]]||0)+c.adRes[k];delete c.adRes[k];}c.queue=c.queue.filter(q=>BASE[q.k]||String(q.k).startsWith('cw'));}for(const k in sb)sb[k]=false;Object.assign(sb,d.sb||{});projs=[];ints=[];salvos={};fx=[];
  for(const p of provs)baseDirty.add(p.id);fogAll();ctrlDirty=true;economyPass();}
async function saveGame(slot,silent,name){if(!started)return;serialize.saveName=name||'';const data=serialize();
  try{if(api())await api().save(slot,data);else localStorage.setItem('lf_save_'+slot,data);if(!silent)toast(slot==='auto'?'Автосохранение':`Сохранено: ${JSON.parse(data).title}`,'ok');}
  catch(e){toast('Не удалось сохранить: '+e,'bad');}
  if(!silent&&$('#over').style.display==='flex'&&$('#overBox').dataset.saves)openSaves(true);panelDirty=true;}
async function listSaves(){try{if(api())return JSON.parse(await api().list_saves());const r=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('lf_save_')){try{const d=JSON.parse(localStorage.getItem(k));r.push({slot:k.slice(8),title:d.title,country:d.country,gameDate:d.gameDate,mtime:(d.saved||0)/1000});}catch(e){}}}return r.sort((a,b)=>b.mtime-a.mtime);}catch(e){return [];}}
async function delSave(slot){try{if(api())await api().delete(slot);else localStorage.removeItem('lf_save_'+slot);toast('Сохранение удалено');}catch(e){toast('Не удалось удалить: '+e,'bad');}openSaves(!!$('#overBox').dataset.saving);}
async function openSaves(saving){const list=await listSaves();running=false;setSpeedUI();
  const label=e=>e.slot==='auto'?'Автосохранение':e.slot==='quick'?'Быстрое сохранение (F5)':esc(e.title||e.slot);
  const when=e=>e.mtime?new Date(e.mtime*1000).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
  let h=`<h2>${saving?'Сохранить игру':'Загрузить игру'}</h2>`;if(!saving&&api())h+=`<div style="margin-bottom:10px"><button class="btn" data-act="importSave">Импорт из файла…</button></div>`;
  if(saving)h+=`<p class="muted" style="margin:0 0 8px">Название сохранения:</p><div class="pair"><input class="search" id="saveName" maxlength="60" value="${esc(C[player].name+' — '+dateStr(time).slice(0,10))}"><button class="btn pri" data-act="saveNew">Сохранить</button></div><h3>Существующие сохранения</h3>`;
  if(!list.length)h+='<p class="muted">Сохранений пока нет.</p>';
  for(const e of list)h+=`<div class="row"><div class="nm"><b>${label(e)}</b><small>${esc(e.country||'')}${e.gameDate?' · в игре '+esc(e.gameDate):''}${e.mtime?' · сохранено '+when(e):''}</small></div>
    ${saving?(e.slot==='auto'?'':`<button class="btn" data-act="saveOver" data-k="${esc(e.slot)}">Перезаписать</button>`):`<button class="btn pri" data-act="load" data-k="${esc(e.slot)}">Загрузить</button>`}
    ${api()?`<button class="btn" data-act="exportSave" data-k="${esc(e.slot)}">Экспорт</button>`:''}<button class="btn dng" data-act="delSave" data-k="${esc(e.slot)}">${ui.delPending===e.slot?'Точно удалить?':'Удалить'}</button></div>`;
  h+=`<div class="hint">F5 — быстрое сохранение, F9 — быстрая загрузка, Ctrl+S — это окно. Автосохранение — раз в игровую неделю.${api()?' Файлы лежат в папке игры: saves.':''}</div><div style="margin-top:12px"><button class="btn" data-act="closeOver">Закрыть</button></div>`;
  showOver(h);$('#overBox').dataset.saves='1';$('#overBox').dataset.saving=saving?'1':'';}
async function loadGame(slot){try{const s=api()?await api().load(slot):localStorage.getItem('lf_save_'+slot);if(!s)throw new Error('пустой слот');
    deserialize(s);setPlayerColor();hourTick.lastSave=time;$('#over').style.display='none';$('#menu').style.display='none';started=true;over=false;running=false;
    const c=C[player];$('#cname').textContent=c.name;$('#flag').style.background=c.color;ui.sel=c.capital;updateVis();fogAll();
    focus(provs[c.capital].cx,provs[c.capital].cy,3);setSpeedUI();setTab('prov');toast('Игра загружена — нажмите пробел, чтобы продолжить','ok');}
  catch(e){toast('Не удалось загрузить: '+e.message,'bad');}}

/* =================== МЕНЮ =================== */
function renderMenu(scroll){const q=ui.search.toLowerCase();if(ui.menuSel!==renderMenu.ls){renderMenu.ls=ui.menuSel;repaintAll();}
  const list=C.filter(c=>c.alive&&(!q||c.name.toLowerCase().includes(q))).sort((a,b)=>b.budget-a.budget);
  $('#natList').innerHTML=list.map(c=>`<div class="nat ${ui.menuSel===c.id?'on':''}" data-c="${c.id}"><span class="sw" style="background:${c.color}"></span><b>${esc(c.name)}</b><small>доход ${fM(c.budget)}/сут.</small></div>`).join('');
  if(scroll){const el=$('#natList .nat.on');if(el)el.scrollIntoView({block:'nearest'});}
  const c=C[ui.menuSel];if(!c){$('#natInfo').innerHTML='<span class="muted">Выберите государство.</span>';return;}
  let t={inf:0,tank:0,art:0};for(const p of provs){const a=p.armies[c.id];if(a){t.inf+=a.inf;t.tank+=a.tank;t.art+=a.art;}}
  const by={};for(const a of ads)if(a.owner===c.id)by[a.type]=(by[a.type]||0)+1;const np=provs.filter(p=>p.owner===c.id).length;
  $('#natInfo').innerHTML=`<div class="ph" style="margin-bottom:6px"><span class="sw" style="background:${c.color};height:26px"></span><h2>${esc(c.name)}</h2></div>
  <div class="kv"><span>Городов</span><b>${np}</b><span>Доход в сутки</span><b>${fM(c.budget)}</b><span>Стартовая казна</span><b>${fM(c.money)}</b>
  <span>Сухопутные войска</span><b>${Math.round(tot(t))} бат. (танк. ${Math.round(t.tank)})</b><span>ПВО</span><b>${by.lrsam||0} дальн. · ${by.shorad||0} ближн.</b>
  <span>Дальняя ПВО</span><b>${esc(c.cat.lrsam.model)}</b><span>Ударный дрон</span><b>${esc(c.cat.shahed.model)}</b><span>Союзы</span><b>${c.pacts.length?c.pacts.map(p=>esc(p.name.split(' (')[0])).join(', '):'нет'}</b></div>`;}
$('#natList').addEventListener('click',e=>{const el=e.target.closest('.nat');if(!el)return;ui.menuSel=+el.dataset.c;renderMenu();const cp=provs[C[ui.menuSel].capital];focus(cp.cx,cp.cy,Math.max(cam.z,1.2));});
$('#natSearch').addEventListener('input',e=>{ui.search=e.target.value;renderMenu();});
for(const id of ['scen','diff','gmode'])$('#'+id).addEventListener('click',e=>{const ch=e.target.closest('.chip');if(!ch)return;$('#'+id).querySelectorAll('.chip').forEach(x=>x.classList.toggle('on',x===ch));
  if(id==='scen'){scen=ch.dataset.v;resetForMenu();}else if(id==='gmode')ui.gmode=ch.dataset.v;else ui.diff=+ch.dataset.v;});
$('#start').onclick=startGame;
function resetForMenu(){initCountries();applyScenario();for(const p of provs){p.vis=true;baseDirty.add(p.id);}ctrlDirty=true;renderMenu();}
function openMenu(){started=false;running=false;over=false;player=-1;ui.sel=null;ui.pending=null;setMode(null);
  resetForMenu();fitCam();$('#menu').style.display='flex';setSpeedUI();}
function startGame(){if(ui.menuSel==null){toast('Сначала выберите государство','bad');return;}
  player=ui.menuSel;aiMul=ui.diff;C.forEach(c=>c.isPlayer=c.id===player);setPlayerColor();const c=C[player];c.money*=1.5;
  for(const k in sb)sb[k]=false;repaintAll();
  $('#menu').style.display='none';$('#cname').textContent=c.name;$('#flag').style.background=c.color;
  started=true;running=true;over=false;speed=6;ui.sel=c.capital;ui.pending=null;ui.tab='prov';hourTick.lastSave=0;
  economyPass();updateVis();fogAll();
  log(`Вы приняли командование: ${c.name}. Городов: ${c.ncity}, доход ${fM(c.budget)} в сутки.`,'ok');
  if(c.wars.size)log(`Ваше государство уже в состоянии войны: ${[...c.wars].map(i=>C[i].name).join(', ')}.`,'bad');
  const cap=provs[c.capital];focus(cap.cx,cap.cy,c.initProvs>20?1.4:3);setSpeedUI();setTab('prov');}

/* =================== ЗАПУСК =================== */
let last=performance.now(),panelT=0,topT=0,fpsN=0,fpsT=0,nextT=0;
function frame(now){requestAnimationFrame(frame);
  if(fpsCap){const iv=1000/fpsCap;if(now<nextT-1.5)return;nextT=Math.max(nextT+iv,now-iv);}
  const rdt=Math.min(.1,(now-last)/1000);last=now;
  fpsN++;fpsT+=rdt;if(fpsT>=.5){fpsShown=Math.round(fpsN/fpsT);fpsN=0;fpsT=0;$('#fps').textContent=fpsShown+' FPS';}
  if(running&&started&&!over){let g=rdt*speed,n=0;while(g>1e-6&&n<300){const d=Math.min(g,.02);simStep(d);g-=d;n++;}}
  render(rdt);
  if(started){topT+=rdt;if(topT>.1){topT=0;topTick();}panelT+=rdt;const ae=document.activeElement;
    if(panelDirty&&panelT>.6&&!ui.mouseDown&&ae?.id!=='dipSearch'&&ae?.tagName!=='SELECT'){panelT=0;renderPanel();}}}
window.addEventListener('resize',()=>{resize();clampCam();});
setTimeout(()=>{try{buildWorld();resize();openMenu();flushLayers(true);$('#loading').style.display='none';requestAnimationFrame(frame);}
  catch(e){$('#loadMsg').textContent='Ошибка запуска: '+e.message;console.error(e);}},30);
