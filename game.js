(() => {
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const rand=(a,b)=>a+Math.random()*(b-a);
  const irand=(a,b)=>Math.floor(rand(a,b+1));

  const canvas=$('#world');
  const ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  const W=canvas.width,H=canvas.height;

  const UPGRADE_DEFS = {
    forage:{name:'採取を覚える',cost:30,type:'unlock',icon:'leaf',glow:'#78c778',desc:'森へ行き、木の実や薬草を拾う。'},
    fish:{name:'釣りを覚える',cost:90,type:'unlock',icon:'fish',glow:'#6ac3db',requires:'forage',desc:'川辺で釣りをする行動が増える。'},
    mine:{name:'採掘を覚える',cost:190,type:'unlock',icon:'pick',glow:'#c79b63',requires:'forage',desc:'岩山の坑道へ入り、鉱石を探す。'},
    explore:{name:'遺跡探索',cost:380,type:'unlock',icon:'sword',glow:'#c98265',requires:'mine',desc:'夕暮れの遺跡まで冒険するようになる。'},
    garden:{name:'小さな畑',cost:130,type:'world',icon:'sprout',glow:'#8fca66',requires:'forage',desc:'小屋の前に畑ができ、世話する行動が増える。'},
    campfire:{name:'焚き火',cost:170,type:'world',icon:'fire',glow:'#f0a14a',desc:'夜になると焚き火で休むことがある。'},
    bridge:{name:'木の橋',cost:310,type:'world',icon:'bridge',glow:'#b28b60',requires:'fish',desc:'川に橋が架かり、世界の動線が広がる。'},
    workshop:{name:'鍛冶小屋',cost:520,type:'world',icon:'hammer',glow:'#db8a58',requires:'mine',desc:'鉱石を加工する鍛冶小屋が建つ。'},
    dog:{name:'犬を迎える',cost:760,type:'world',icon:'dog',glow:'#dfb77b',requires:'garden',desc:'小さな相棒が主人公について歩く。'},
    tower:{name:'見張り塔',cost:1350,type:'world',icon:'tower',glow:'#af91d2',requires:'explore',desc:'遠景に塔が建ち、夜の灯りが増える。'},
    wisdom:{name:'経験効率',cost:100,type:'level',icon:'star',glow:'#e1c45f',max:8,desc:'時間あたりのXP獲得量を+20%。'},
    boots:{name:'旅人のブーツ',cost:80,type:'level',icon:'boot',glow:'#9f805e',max:6,desc:'歩く速度が上がり、行動回数が増える。'}
  };

  const LOCATIONS={
    home:{x:91,y:430},forest:{x:300,y:405},river:{x:250,y:515},mine:{x:326,y:310},ruins:{x:58,y:307},garden:{x:139,y:463},workshop:{x:174,y:397},campfire:{x:126,y:421}
  };

  const ACTIONS={
    idle:{label:'小屋の前でのんびりしている',place:'home',min:3,max:6,reward:[1,2]},
    forage:{label:'森で薬草を探している',place:'forest',min:5,max:8,reward:[5,10]},
    fish:{label:'川辺で釣り糸を垂らしている',place:'river',min:7,max:11,reward:[8,15]},
    mine:{label:'坑道で鉱石を掘っている',place:'mine',min:8,max:12,reward:[11,21]},
    explore:{label:'古い遺跡を探索している',place:'ruins',min:9,max:14,reward:[15,30]},
    garden:{label:'畑の芽を手入れしている',place:'garden',min:5,max:8,reward:[5,9]},
    workshop:{label:'鍛冶小屋で鉱石を叩いている',place:'workshop',min:6,max:10,reward:[10,18]},
    campfire:{label:'焚き火を眺めて休んでいる',place:'campfire',min:5,max:9,reward:[3,6]}
  };

  const defaultState=()=>({
    xp:0,totalXp:0,discoveries:0,unlocks:{},levels:{wisdom:0,boots:0},lastSeen:Date.now(),logs:[],weather:'clear',weatherUntil:0
  });
  let state=loadState();
  let lastTick=performance.now();
  let saveClock=0;
  let toastTimer=null;
  let weatherClock=0;
  let particles=[];
  let critters=[];
  let clouds=Array.from({length:6},(_,i)=>({x:i*80+irand(-20,20),y:60+irand(0,95),s:irand(1,3),v:rand(.4,1)}));
  let hero={x:LOCATIONS.home.x,y:LOCATIONS.home.y,targetX:LOCATIONS.home.x,targetY:LOCATIONS.home.y,mode:'act',action:'idle',timer:3,flip:false,step:0};
  let dog={x:hero.x-8,y:hero.y+4};

  function loadState(){
    try{
      const raw=JSON.parse(localStorage.getItem('pixel_life_state')||'null');
      const base=defaultState();
      if(!raw)return base;
      return {...base,...raw,unlocks:{...base.unlocks,...(raw.unlocks||{})},levels:{...base.levels,...(raw.levels||{})},logs:Array.isArray(raw.logs)?raw.logs.slice(0,60):[]};
    }catch(_){return defaultState();}
  }
  function saveState(){state.lastSeen=Date.now();localStorage.setItem('pixel_life_state',JSON.stringify(state));}

  function xpRate(){return (0.55 + worldLevel()*.035) * (1+(state.levels.wisdom||0)*.2);}
  function walkSpeed(){return 24*(1+(state.levels.boots||0)*.13);}
  function worldLevel(){return 1+Object.values(state.unlocks).filter(Boolean).length+Math.floor(((state.levels.wisdom||0)+(state.levels.boots||0))/2);}

  function addXp(n,source='時間経過'){
    n=Math.max(0,n);
    state.xp+=n;state.totalXp+=n;
    if(n>=8&&source)addLog(`${source}で +${Math.round(n)} XP`,n>=20);
  }

  function addLog(text,rare=false){
    const d=new Date();
    state.logs.unshift({time:d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),text,rare});
    state.logs=state.logs.slice(0,60);
    renderLog();
  }

  function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1500);}

  function isUnlocked(k){return !!state.unlocks[k];}
  function canBuy(k){const d=UPGRADE_DEFS[k];if(d.requires&&!isUnlocked(d.requires))return false;if(d.type==='level'&&(state.levels[k]||0)>=(d.max||99))return false;return state.xp>=upgradeCost(k);}
  function upgradeCost(k){const d=UPGRADE_DEFS[k];if(d.type!=='level')return d.cost;const lv=state.levels[k]||0;return Math.round(d.cost*Math.pow(1.62,lv));}

  function buyUpgrade(k){
    const d=UPGRADE_DEFS[k];
    if(d.requires&&!isUnlocked(d.requires)){toast('先に前提を解放しよう');return;}
    if(d.type==='level'&&(state.levels[k]||0)>=d.max)return;
    const cost=upgradeCost(k);if(state.xp<cost){toast(`あと ${Math.ceil(cost-state.xp)} XP`);return;}
    state.xp-=cost;
    if(d.type==='level'){state.levels[k]=(state.levels[k]||0)+1;addLog(`${d.name} LV${state.levels[k]} に成長`,true);}
    else{state.unlocks[k]=true;state.discoveries++;addLog(`${d.name} をアンロック`,true);burst(LOCATIONS.home.x,LOCATIONS.home.y-20,d.glow,18);}
    saveState();renderUI();toast(`${d.name}！`);
  }

  function chooseAction(){
    const hour=new Date().getHours();
    const pool=['idle','idle'];
    if(isUnlocked('forage'))pool.push('forage','forage');
    if(isUnlocked('fish'))pool.push('fish');
    if(isUnlocked('mine'))pool.push('mine');
    if(isUnlocked('explore'))pool.push('explore');
    if(isUnlocked('garden'))pool.push('garden');
    if(isUnlocked('workshop'))pool.push('workshop');
    if(isUnlocked('campfire')&&(hour>=18||hour<6))pool.push('campfire','campfire');
    const action=pick(pool);
    hero.action=action;
    const loc=LOCATIONS[ACTIONS[action].place];
    hero.targetX=loc.x;hero.targetY=loc.y;hero.mode='walk';
    $('#activityLabel').textContent=`${placeVerb(action)}へ向かっている`;
  }

  function placeVerb(a){return a==='forage'?'森':a==='fish'?'川':a==='mine'?'坑道':a==='explore'?'遺跡':a==='garden'?'畑':a==='workshop'?'鍛冶小屋':a==='campfire'?'焚き火':'小屋';}

  function finishAction(){
    const a=ACTIONS[hero.action];
    let reward=rand(a.reward[0],a.reward[1]);
    if(Math.random()<.08){reward*=2;state.discoveries++;addLog(`${a.label.replace('している','していた')}。珍しいものを見つけた！`,true);burst(hero.x,hero.y-20,'#ffd96a',14);}else addLog(`${a.label.replace('している','していた')}。 +${Math.round(reward)} XP`);
    addXp(reward,'');
    chooseAction();
  }

  function updateHero(dt){
    if(hero.mode==='walk'){
      const dx=hero.targetX-hero.x,dy=hero.targetY-hero.y,dist=Math.hypot(dx,dy),sp=walkSpeed()*dt;
      hero.flip=dx<0;hero.step+=dt*8;
      if(dist<=sp+1){hero.x=hero.targetX;hero.y=hero.targetY;hero.mode='act';const a=ACTIONS[hero.action];hero.timer=rand(a.min,a.max);$('#activityLabel').textContent=a.label;}
      else{hero.x+=dx/dist*sp;hero.y+=dy/dist*sp;}
    }else{
      hero.timer-=dt;hero.step+=dt*2;if(hero.timer<=0)finishAction();
    }
    if(isUnlocked('dog')){dog.x=lerp(dog.x,hero.x+(hero.flip?9:-9),clamp(dt*4,0,1));dog.y=lerp(dog.y,hero.y+4,clamp(dt*4,0,1));}
  }

  function updateWeather(dt){
    weatherClock+=dt;
    if(Date.now()>state.weatherUntil){
      const opts=['clear','clear','clear','cloudy','rain','mist'];state.weather=pick(opts);state.weatherUntil=Date.now()+irand(90000,210000);saveState();
    }
    $('#weatherLabel').textContent=state.weather.toUpperCase();
    if(state.weather==='rain'&&Math.random()<dt*14)particles.push({x:rand(0,W),y:-5,vx:-18,vy:170,life:2,c:'#9ccbe1',type:'rain'});
  }

  function updateCritters(dt){
    if(critters.length<4&&Math.random()<dt*.08)critters.push({x:Math.random()<.5?-10:W+10,y:390+rand(-25,35),dir:Math.random()<.5?1:-1,type:Math.random()<.65?'bird':'rabbit',v:rand(8,18)});
    critters.forEach(c=>c.x+=c.v*c.dir*dt);critters=critters.filter(c=>c.x>-30&&c.x<W+30);
  }

  function burst(x,y,c,n=10){for(let i=0;i<n;i++)particles.push({x,y,vx:rand(-25,25),vy:rand(-45,-10),life:rand(.5,1.2),c,type:'spark'});}
  function updateParticles(dt){particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.type==='spark')p.vy+=45*dt;});particles=particles.filter(p=>p.life>0&&p.y<H+20);}

  function tick(now){
    const dt=Math.min(.05,(now-lastTick)/1000||0);lastTick=now;
    addXp(xpRate()*dt,'');
    updateHero(dt);updateWeather(dt);updateCritters(dt);updateParticles(dt);
    saveClock+=dt;if(saveClock>8){saveClock=0;saveState();}
    renderUIValues();
    requestAnimationFrame(tick);
  }

  function timeLight(){
    const d=new Date();const h=d.getHours()+d.getMinutes()/60;
    const daylight=clamp(Math.sin((h-6)/12*Math.PI),0,1);
    const dusk=1-Math.min(1,Math.abs(h-18)/3);
    return {h,daylight,dusk:clamp(dusk,0,1)};
  }

  function mix(a,b,t){
    const pa=[parseInt(a.slice(1,3),16),parseInt(a.slice(3,5),16),parseInt(a.slice(5,7),16)],pb=[parseInt(b.slice(1,3),16),parseInt(b.slice(3,5),16),parseInt(b.slice(5,7),16)];
    return `rgb(${pa.map((v,i)=>Math.round(lerp(v,pb[i],t))).join(',')})`;
  }

  function draw(){drawWorld();requestAnimationFrame(draw);}
  function drawWorld(){
    ctx.imageSmoothingEnabled=false;
    const t=timeLight(),day=t.daylight;
    const skyTop=mix('#080c20','#62a9ce',day),skyBot=mix('#1b1730','#d7bf88',day);
    const g=ctx.createLinearGradient(0,0,0,390);g.addColorStop(0,skyTop);g.addColorStop(1,skyBot);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    drawCelestial(t);drawStars(t);drawClouds(t);drawMountains(t);drawFarForest(t);drawGround(t);drawRiver(t);drawRuins(t);drawMine(t);drawHouse(t);
    if(isUnlocked('garden'))drawGarden(t);if(isUnlocked('campfire'))drawCampfire(t);if(isUnlocked('bridge'))drawBridge(t);if(isUnlocked('workshop'))drawWorkshop(t);if(isUnlocked('tower'))drawTower(t);
    drawTrees(t);drawCritters();if(isUnlocked('dog'))drawDog(dog.x,dog.y);drawHero(hero.x,hero.y,hero.flip,hero.step,hero.mode);drawParticles();drawWeatherOverlay(t);
  }

  function drawCelestial(t){const day=t.daylight;if(day>.18){const x=45+day*250,y=170-day*105;ctx.fillStyle='#ffe39a';ctx.fillRect(Math.round(x)-7,Math.round(y)-7,14,14);ctx.fillStyle='#fff3be';ctx.fillRect(Math.round(x)-4,Math.round(y)-4,8,8);}else{const x=285,y=80;ctx.fillStyle='#d9e4df';ctx.fillRect(x,y,13,13);ctx.fillStyle='#8290a1';ctx.fillRect(x+7,y,7,8);}}
  function drawStars(t){if(t.daylight>.35)return;ctx.fillStyle='#dce7e7';for(let i=0;i<38;i++){const x=(i*83)%W,y=20+((i*47)%185);if((i+Math.floor(Date.now()/900))%7===0)ctx.fillRect(x,y,2,2);else ctx.fillRect(x,y,1,1);}}
  function drawClouds(t){const a=(state.weather==='cloudy'||state.weather==='rain')?.8:.42;ctx.globalAlpha=a;clouds.forEach(c=>{c.x+=c.v*.08;if(c.x>W+50)c.x=-60;ctx.fillStyle=mix('#263248','#eef2e5',t.daylight*.75);ctx.fillRect(Math.round(c.x),c.y,34*c.s,7*c.s);ctx.fillRect(Math.round(c.x+8*c.s),c.y-5*c.s,17*c.s,5*c.s);});ctx.globalAlpha=1;}
  function drawMountains(t){ctx.fillStyle=mix('#15162b','#536a70',t.daylight);poly([[0,304],[76,170],[140,304]],ctx.fillStyle);poly([[96,304],[202,135],[300,304]],mix('#17172b','#66756e',t.daylight));poly([[230,304],[325,168],[384,304]],mix('#111528','#4f6368',t.daylight));ctx.fillStyle=mix('#a9b8bf','#e7e2cd',t.daylight*.8);poly([[174,173],[202,135],[229,174],[212,163],[202,174],[191,161]],ctx.fillStyle);}
  function drawFarForest(t){ctx.fillStyle=mix('#0d1720','#314d3d',t.daylight);for(let x=0;x<W;x+=13){const h=24+(x*7%31);poly([[x,356],[x+7,356-h],[x+14,356]],ctx.fillStyle);}}
  function drawGround(t){const grass=mix('#15231c','#557441',t.daylight),dark=mix('#0c1513','#344a30',t.daylight);ctx.fillStyle=grass;ctx.fillRect(0,350,W,290);for(let i=0;i<110;i++){const x=(i*53)%W,y=365+(i*37)%245;ctx.fillStyle=i%3?dark:'#75834b';ctx.fillRect(x,y,2,1);}ctx.fillStyle='#6c5336';for(let i=0;i<28;i++)ctx.fillRect(70+i*4,437+(i%3),4,3);}
  function drawRiver(t){ctx.fillStyle=mix('#101a2b','#2f7e91',t.daylight);poly([[188,459],[384,440],[384,640],[258,640],[226,575]],ctx.fillStyle);ctx.fillStyle=mix('#3c5874','#91c8c3',t.daylight);for(let y=476;y<630;y+=24){for(let x=245+(y%3)*9;x<384;x+=43)ctx.fillRect(x,y,18,2);}}
  function drawRuins(t){ctx.fillStyle=mix('#191820','#6c655d',t.daylight);ctx.fillRect(30,290,9,70);ctx.fillRect(79,278,9,77);ctx.fillRect(28,287,62,8);ctx.fillRect(43,316,31,7);ctx.fillStyle='#9d8a68';ctx.fillRect(34,293,2,48);ctx.fillRect(83,283,2,38);}
  function drawMine(t){ctx.fillStyle=mix('#0b0d12','#24282a',t.daylight);poly([[295,354],[324,287],[365,353]],ctx.fillStyle);ctx.fillStyle='#07090c';ctx.fillRect(317,316,26,39);ctx.fillStyle='#73583a';ctx.fillRect(314,312,32,5);ctx.fillRect(314,312,5,44);ctx.fillRect(341,312,5,44);}
  function drawHouse(t){ctx.fillStyle='#5b3927';ctx.fillRect(63,382,67,58);ctx.fillStyle='#93613b';ctx.fillRect(69,390,55,50);ctx.fillStyle='#3c271f';poly([[57,386],[96,355],[137,386]],ctx.fillStyle);ctx.fillStyle='#b76a3b';poly([[65,382],[96,362],[129,382]],ctx.fillStyle);ctx.fillStyle='#372820';ctx.fillRect(82,409,17,31);ctx.fillStyle='#c68e4b';ctx.fillRect(104,400,13,12);const night=1-t.daylight;if(night>.35){ctx.fillStyle=`rgba(255,203,104,${night*.9})`;ctx.fillRect(106,402,9,8);}ctx.fillStyle='#6e4b34';ctx.fillRect(113,365,8,25);ctx.fillStyle='#2b2523';ctx.fillRect(115,357,6,12);}
  function drawGarden(t){ctx.fillStyle='#5d4029';ctx.fillRect(122,445,60,35);for(let y=451;y<476;y+=9){ctx.fillStyle='#3f2e21';ctx.fillRect(124,y,56,4);for(let x=128;x<178;x+=12){ctx.fillStyle='#5ba25f';ctx.fillRect(x,y-5,2,5);ctx.fillRect(x-2,y-4,2,2);ctx.fillRect(x+2,y-5,2,2);}}ctx.strokeStyle='#8a6b43';ctx.strokeRect(120,443,64,39);}
  function drawCampfire(t){const x=126,y=423;ctx.fillStyle='#4a2f1f';ctx.fillRect(x-10,y+8,22,4);ctx.fillStyle='#a34d2b';ctx.fillRect(x-5,y-3,12,14);ctx.fillStyle='#ef933e';ctx.fillRect(x-3,y-7,8,13);ctx.fillStyle='#ffd275';ctx.fillRect(x-1,y-8,4,9);if(t.daylight<.4){ctx.globalAlpha=.08;ctx.fillStyle='#ffb24f';ctx.beginPath();ctx.arc(x,y,40,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}}
  function drawBridge(t){ctx.fillStyle='#765338';for(let i=0;i<8;i++)ctx.fillRect(204+i*10,479+i*3,12,6);ctx.fillStyle='#3d2b21';ctx.fillRect(202,474,83,3);ctx.fillRect(202,510,83,3);}
  function drawWorkshop(t){ctx.fillStyle='#463126';ctx.fillRect(146,365,55,43);ctx.fillStyle='#784b2d';ctx.fillRect(151,372,45,36);ctx.fillStyle='#29211f';poly([[140,369],[173,346],[207,369]],ctx.fillStyle);ctx.fillStyle='#a36b3b';poly([[147,366],[174,351],[201,366]],ctx.fillStyle);ctx.fillStyle='#1d1918';ctx.fillRect(181,379,10,29);ctx.fillStyle='#6f6e66';ctx.fillRect(155,387,19,6);ctx.fillStyle='#d58b46';ctx.fillRect(160,389,9,3);}
  function drawTower(t){ctx.fillStyle='#4d4747';ctx.fillRect(16,214,28,88);ctx.fillStyle='#6c6260';ctx.fillRect(20,219,20,83);ctx.fillStyle='#302b31';poly([[12,218],[30,194],[48,218]],ctx.fillStyle);if(t.daylight<.5){ctx.fillStyle='#ffd16c';ctx.fillRect(25,233,9,8);}}
  function drawTrees(t){for(let i=0;i<10;i++){const x=270+(i%5)*27,y=360+Math.floor(i/5)*55+(i%2)*8;drawTree(x,y,1+(i%3)*.1,t.daylight);}drawTree(25,405,1.15,t.daylight);drawTree(360,398,1.2,t.daylight);}
  function drawTree(x,y,s,day){ctx.fillStyle='#59402b';ctx.fillRect(x-3*s,y-26*s,6*s,28*s);ctx.fillStyle=mix('#10231a','#365f37',day);poly([[x-22*s,y-21*s],[x,y-63*s],[x+22*s,y-21*s]],ctx.fillStyle);poly([[x-18*s,y-36*s],[x,y-74*s],[x+18*s,y-36*s]],mix('#0f2018','#447044',day));ctx.fillStyle='#66804b';ctx.fillRect(x-3*s,y-58*s,4*s,6*s);}
  function drawHero(x,y,flip,step,mode){ctx.save();ctx.translate(Math.round(x),Math.round(y));if(flip)ctx.scale(-1,1);const bob=mode==='walk'?Math.round(Math.sin(step)*1):0;ctx.translate(0,bob);ctx.fillStyle='#171820';ctx.fillRect(-7,14,15,3);ctx.fillStyle='#2b3540';ctx.fillRect(-5,-5,12,18);ctx.fillStyle='#51686d';ctx.fillRect(-3,-3,8,13);ctx.fillStyle='#2a2424';ctx.fillRect(-4,-17,9,10);ctx.fillStyle='#b57958';ctx.fillRect(-3,-15,7,8);ctx.fillStyle='#211a1b';ctx.fillRect(-4,-18,9,5);ctx.fillRect(-5,-15,3,5);ctx.fillStyle='#e6d8b8';ctx.fillRect(2,-12,2,2);ctx.fillStyle='#70472e';ctx.fillRect(-10,-2,7,16);ctx.fillStyle='#a56d3f';ctx.fillRect(-9,0,5,12);ctx.fillStyle='#33333a';ctx.fillRect(-5,12,4,7);ctx.fillRect(3,12,4,7);ctx.fillStyle='#583f30';ctx.fillRect(-6,18,5,3);ctx.fillRect(3,18,6,3);ctx.fillStyle='#8b603d';ctx.fillRect(5,0,4,11);ctx.fillStyle='#c69b57';ctx.fillRect(7,3,2,6);ctx.restore();}
  function drawDog(x,y){ctx.fillStyle='#2b221d';ctx.fillRect(x-5,y-5,11,8);ctx.fillRect(x+4,y-8,6,6);ctx.fillStyle='#b68454';ctx.fillRect(x-4,y-4,9,6);ctx.fillRect(x+4,y-7,5,5);ctx.fillStyle='#1d1716';ctx.fillRect(x+8,y-6,2,2);ctx.fillRect(x-4,y+2,2,4);ctx.fillRect(x+3,y+2,2,4);}
  function drawCritters(){critters.forEach(c=>{if(c.type==='bird'){ctx.fillStyle='#1b2225';ctx.fillRect(Math.round(c.x),Math.round(c.y),5,2);ctx.fillRect(Math.round(c.x)+(c.dir>0?4:-2),Math.round(c.y)-2,3,2);}else{ctx.fillStyle='#7e725e';ctx.fillRect(c.x,c.y,7,5);ctx.fillRect(c.x+4*c.dir,c.y-4,4,5);ctx.fillRect(c.x+5*c.dir,c.y-8,2,5);}});}
  function drawParticles(){particles.forEach(p=>{ctx.globalAlpha=clamp(p.life,0,1);ctx.fillStyle=p.c;ctx.fillRect(Math.round(p.x),Math.round(p.y),p.type==='rain'?1:2,p.type==='rain'?8:2);});ctx.globalAlpha=1;}
  function drawWeatherOverlay(t){if(state.weather==='mist'){ctx.fillStyle='rgba(190,210,205,.11)';for(let i=0;i<5;i++)ctx.fillRect(0,335+i*43+(Math.sin(Date.now()/1800+i)*8),W,22);}if(state.weather==='rain'){ctx.fillStyle='rgba(7,14,23,.12)';ctx.fillRect(0,0,W,H);}}
  function poly(points,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fill();}

  function drawUpgradeIcon(cv,icon,color){const c=cv.getContext('2d');c.imageSmoothingEnabled=false;c.clearRect(0,0,32,32);c.fillStyle='#0b1015';c.fillRect(0,0,32,32);c.fillStyle=color;const r=(x,y,w,h,col=color)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
    if(icon==='leaf'){r(14,5,4,21);r(10,8,7,7);r(17,5,7,8);r(8,15,8,6);r(18,14,7,7)}
    else if(icon==='fish'){r(7,12,16,9);r(22,9,6,6);r(22,18,6,6);r(10,10,8,2);r(9,20,9,2);r(11,14,2,2,'#0b1015')}
    else if(icon==='pick'){r(14,9,4,18,'#8e603d');r(7,7,18,5);r(5,9,7,4);r(22,10,5,3)}
    else if(icon==='sword'){r(15,5,3,17);r(13,7,7,3);r(11,21,10,3,'#c7a55f');r(15,24,3,5,'#805637')}
    else if(icon==='sprout'){r(15,13,3,14,'#7f6036');r(8,10,9,7);r(18,7,8,8);r(7,24,19,3,'#735332')}
    else if(icon==='fire'){r(12,11,9,14,'#d75f32');r(15,6,5,15,'#ffd168');r(7,25,19,3,'#6d4027')}
    else if(icon==='bridge'){for(let i=0;i<4;i++)r(5+i*6,11+i,7,5);r(4,9,24,2,'#67462f');r(4,20,24,2,'#67462f')}
    else if(icon==='hammer'){r(6,8,16,7);r(17,13,4,15,'#8a5b39');r(4,10,6,4,'#9ca2a0')}
    else if(icon==='dog'){r(7,13,15,9);r(19,9,8,8);r(22,6,3,5);r(8,21,3,6);r(18,21,3,6);r(25,13,3,2,'#151212')}
    else if(icon==='tower'){r(9,8,14,19,'#77716d');r(7,7,18,4);r(11,4,3,5);r(19,4,3,5);r(14,16,5,11,'#242128')}
    else if(icon==='star'){polyCtx(c,[[16,4],[19,12],[28,12],[21,17],[24,26],[16,21],[8,26],[11,17],[4,12],[13,12]],color)}
    else if(icon==='boot'){r(10,5,8,16,'#8b5d3c');r(12,19,14,7,'#6e4934');r(8,23,18,4,'#3b3029')}
  }
  function polyCtx(c,pts,col){c.fillStyle=col;c.beginPath();c.moveTo(pts[0][0],pts[0][1]);pts.slice(1).forEach(p=>c.lineTo(p[0],p[1]));c.closePath();c.fill();}

  function renderUpgrades(){const root=$('#upgradeGrid');root.innerHTML='';Object.entries(UPGRADE_DEFS).forEach(([k,d])=>{const unlocked=d.type==='level'?false:isUnlocked(k),lv=state.levels[k]||0,maxed=d.type==='level'&&lv>=d.max;const card=document.createElement('button');card.type='button';card.className=`upgrade-card ${unlocked?'unlocked':''} ${d.type==='level'?'levelled':''}`;card.style.setProperty('--glow',d.glow);const cost=upgradeCost(k);const reqLocked=d.requires&&!isUnlocked(d.requires);card.disabled=unlocked||maxed||reqLocked;const cv=document.createElement('canvas');cv.className='upgrade-icon';cv.width=32;cv.height=32;card.appendChild(cv);drawUpgradeIcon(cv,d.icon,d.glow);const label=d.type==='level'?`${d.name} LV${lv}/${d.max}`:d.name;const badge=unlocked?'UNLOCKED':maxed?'MAX':reqLocked?`要: ${UPGRADE_DEFS[d.requires].name}`:`${cost} XP`;card.insertAdjacentHTML('beforeend',`<strong>${label}</strong><p>${d.desc}</p><b>${badge}</b>`);card.addEventListener('click',()=>buyUpgrade(k));root.appendChild(card);});}
  function renderLog(){const root=$('#eventLog');root.innerHTML='';if(!state.logs.length){root.innerHTML='<li><time>--:--</time><span>まだ何も起きていない。</span></li>';return;}state.logs.slice(0,25).forEach(l=>{const li=document.createElement('li');li.innerHTML=`<time>${l.time}</time><span class="${l.rare?'rare':''}">${l.text}</span>`;root.appendChild(li);});}
  function renderUIValues(){const now=new Date();$('#xpValue').textContent=Math.floor(state.xp).toLocaleString();$('#xpRate').textContent=`+${xpRate().toFixed(1)} / sec`;$('#clockLabel').textContent=now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});$('#totalXp').textContent=Math.floor(state.totalXp).toLocaleString();$('#worldLevel').textContent=worldLevel();$('#discoveries').textContent=state.discoveries;$$('.upgrade-card').forEach((el,i)=>{const key=Object.keys(UPGRADE_DEFS)[i];if(!key)return;const d=UPGRADE_DEFS[key];if(d.type!=='level'&&!isUnlocked(key))el.disabled=!!(d.requires&&!isUnlocked(d.requires));});}
  function renderUI(){renderUpgrades();renderLog();renderUIValues();}

  function handleOffline(){const elapsed=Math.max(0,(Date.now()-(state.lastSeen||Date.now()))/1000);if(elapsed<20)return;const capped=Math.min(elapsed,12*3600);const gained=xpRate()*capped*.75;state.xp+=gained;state.totalXp+=gained;const journeys=Math.floor(capped/180);if(journeys>0)state.discoveries+=Math.min(5,Math.floor(journeys/8));$('#offlineText').textContent=`${formatDuration(elapsed)} 留守にしていた。\nそのあいだに ${Math.floor(gained).toLocaleString()} XP を獲得。${elapsed>capped?'\n（放置XPは最大12時間分まで）':''}`;$('#offlineModal').hidden=false;addLog(`留守中に +${Math.round(gained)} XP`,true);saveState();}
  function formatDuration(sec){if(sec<60)return `${Math.floor(sec)}秒`;if(sec<3600)return `${Math.floor(sec/60)}分`;return `${Math.floor(sec/3600)}時間${Math.floor((sec%3600)/60)}分`;}

  $$('.tab').forEach(btn=>btn.addEventListener('click',()=>{$$('.tab').forEach(b=>b.classList.toggle('active',b===btn));$('#growthPanel').classList.toggle('active',btn.dataset.tab==='growth');$('#journalPanel').classList.toggle('active',btn.dataset.tab==='journal');}));
  $('#clearLogBtn').addEventListener('click',()=>{state.logs=[];saveState();renderLog();});
  $('#offlineOk').addEventListener('click',()=>$('#offlineModal').hidden=true);
  $('#observeBtn').addEventListener('click',()=>$('#app').classList.add('observe'));
  $('#app').addEventListener('click',e=>{if($('#app').classList.contains('observe')&&e.target!==$('#observeBtn'))$('#app').classList.remove('observe');});
  window.addEventListener('beforeunload',saveState);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){saveState();return;}
    const elapsed=Math.max(0,(Date.now()-(state.lastSeen||Date.now()))/1000);
    if(elapsed>5){const gained=xpRate()*Math.min(elapsed,12*3600)*.75;state.xp+=gained;state.totalXp+=gained;addLog(`少し目を離した間に +${Math.round(gained)} XP`);toast(`+${Math.round(gained)} XP`);}
    state.lastSeen=Date.now();
  });

  handleOffline();
  if(!state.logs.length)addLog('小さな世界が動き始めた。');
  renderUI();
  chooseAction();
  requestAnimationFrame(tick);
  requestAnimationFrame(draw);
})();
