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
  function drawGround(t){
    const grass=mix('#15231c','#557441',t.daylight),dark=mix('#0c1513','#344a30',t.daylight),light=mix('#263628','#7f9555',t.daylight);
    ctx.fillStyle=grass;ctx.fillRect(0,350,W,290);
    // Dense pixel grass, flowers, pebbles and tiny shadows.
    for(let i=0;i<175;i++){
      const x=(i*53+i*i*7)%W,y=360+(i*37+i*11)%270;
      const k=i%7;
      ctx.fillStyle=k<3?dark:k===3?light:k===4?'#8b794f':'#465938';
      ctx.fillRect(x,y,k===0?3:2,1);
      if(i%9===0){ctx.fillRect(x+1,y-2,1,2);ctx.fillRect(x-1,y-1,1,1);}
      if(i%31===0){ctx.fillStyle=i%62?'#d7c46d':'#d58b91';ctx.fillRect(x,y-3,1,1);ctx.fillRect(x+1,y-2,1,1);}
    }
    // Worn path with broken edges and embedded stones.
    ctx.fillStyle='#6c5336';
    for(let i=0;i<30;i++){const x=67+i*4,y=436+(i%4);ctx.fillRect(x,y,5,3);}
    ctx.fillStyle='#8b7049';for(let i=0;i<16;i++)ctx.fillRect(72+i*7,439+(i%3),2,1);
    ctx.fillStyle='#493925';for(let i=0;i<11;i++)ctx.fillRect(77+i*9,441+(i%2),3,1);
    // Foreground grass tufts.
    for(let i=0;i<30;i++){const x=(i*79)%W,y=500+(i*47)%132;ctx.fillStyle=i%2?dark:light;ctx.fillRect(x,y-4,1,4);ctx.fillRect(x+2,y-3,1,3);ctx.fillRect(x-1,y-2,1,2);}
  }
  function drawRiver(t){
    const water=mix('#101a2b','#2f7e91',t.daylight),deep=mix('#09111e','#235f75',t.daylight),hi=mix('#3c5874','#a7d8cf',t.daylight);
    ctx.fillStyle='#283526';poly([[181,457],[384,435],[384,640],[254,640],[220,575]],ctx.fillStyle);
    ctx.fillStyle=water;poly([[188,459],[384,440],[384,640],[258,640],[226,575]],ctx.fillStyle);
    ctx.fillStyle=deep;poly([[354,455],[384,450],[384,640],[333,640],[315,550]],ctx.fillStyle);
    // Banks and small stones.
    ctx.fillStyle='#766348';for(let i=0;i<34;i++){const x=190+i*6,y=460+(i%4)*2;ctx.fillRect(x,y,4,2);}    
    ctx.fillStyle='#9a8b6a';for(let i=0;i<9;i++){const x=214+i*18,y=466+(i%3)*3;ctx.fillRect(x,y,3,2);}
    // Multi-length ripples.
    ctx.fillStyle=hi;for(let y=480;y<630;y+=19){for(let x=241+((y*3)%29);x<384;x+=47){ctx.fillRect(x,y,14+(x%9),1);if((x+y)%3===0)ctx.fillRect(x+5,y+2,7,1);}}
    ctx.fillStyle='rgba(220,245,235,.22)';for(let i=0;i<13;i++){const x=235+(i*29)%145,y=487+(i*43)%135;ctx.fillRect(x,y,2,1);}
  }
  function drawRuins(t){
    const stone=mix('#191820','#6c655d',t.daylight),hi=mix('#292632','#948a78',t.daylight),moss=mix('#1a281d','#587044',t.daylight);
    ctx.fillStyle=stone;ctx.fillRect(30,290,9,70);ctx.fillRect(79,278,9,77);ctx.fillRect(28,287,62,8);ctx.fillRect(43,316,31,7);
    ctx.fillStyle=hi;ctx.fillRect(32,292,2,55);ctx.fillRect(81,281,2,52);ctx.fillRect(32,289,54,2);ctx.fillRect(47,318,23,2);
    // Cracks and chipped blocks.
    ctx.fillStyle='#272329';ctx.fillRect(35,307,3,1);ctx.fillRect(37,308,1,5);ctx.fillRect(83,300,3,1);ctx.fillRect(82,301,1,6);ctx.fillRect(51,320,1,4);ctx.fillRect(62,289,1,5);
    ctx.fillStyle=moss;ctx.fillRect(29,286,12,2);ctx.fillRect(78,277,10,2);ctx.fillRect(44,314,9,2);ctx.fillRect(36,295,2,4);ctx.fillRect(84,286,2,5);
    ctx.fillStyle='#92826a';for(let i=0;i<5;i++)ctx.fillRect(34+i*11,350+(i%2)*3,6,3);
  }
  function drawMine(t){
    const rock=mix('#0b0d12','#24282a',t.daylight),rock2=mix('#151820','#3b4242',t.daylight);
    ctx.fillStyle=rock;poly([[295,354],[324,287],[365,353]],ctx.fillStyle);
    ctx.fillStyle=rock2;poly([[306,335],[324,294],[340,333]],ctx.fillStyle);ctx.fillRect(343,330,10,18);
    ctx.fillStyle='#07090c';ctx.fillRect(317,316,26,39);ctx.fillStyle='#101315';ctx.fillRect(321,320,18,35);
    ctx.fillStyle='#73583a';ctx.fillRect(314,312,32,5);ctx.fillRect(314,312,5,44);ctx.fillRect(341,312,5,44);
    ctx.fillStyle='#a27a4d';ctx.fillRect(315,313,30,1);ctx.fillRect(315,320,4,2);ctx.fillRect(342,329,4,2);
    // Ore glints and loose rubble.
    ctx.fillStyle='#6d8584';ctx.fillRect(302,329,2,2);ctx.fillRect(350,337,2,2);ctx.fillStyle='#b88a54';ctx.fillRect(306,344,2,1);ctx.fillRect(357,348,2,1);
    ctx.fillStyle='#353838';for(let i=0;i<9;i++){const x=294+i*8,y=351+(i%3);ctx.fillRect(x,y,5,3);}
  }
  function drawHouse(t){
    // Shadow and timber frame.
    ctx.fillStyle='#2d221c';ctx.fillRect(59,386,76,57);
    ctx.fillStyle='#5b3927';ctx.fillRect(63,382,67,58);ctx.fillStyle='#93613b';ctx.fillRect(68,390,57,50);
    // Plank seams and warm highlights.
    ctx.fillStyle='#6f472d';for(let y=394;y<440;y+=8)ctx.fillRect(69,y,55,1);
    ctx.fillStyle='#b17749';for(let i=0;i<7;i++)ctx.fillRect(72+i*8,392+(i%3)*8,5,1);
    ctx.fillStyle='#3f2a21';ctx.fillRect(72,388,4,52);ctx.fillRect(121,388,4,52);ctx.fillRect(68,405,57,3);
    // Layered shingled roof.
    ctx.fillStyle='#30201b';poly([[55,388],[96,353],[139,388]],ctx.fillStyle);
    ctx.fillStyle='#b76a3b';poly([[62,383],[96,359],[132,383]],ctx.fillStyle);
    ctx.fillStyle='#8e4e31';for(let y=368;y<383;y+=5){const span=20+(y-368)*2;ctx.fillRect(96-span/2,y,span,2);}
    ctx.fillStyle='#dc8a4d';ctx.fillRect(91,363,10,2);ctx.fillRect(78,373,12,2);ctx.fillRect(105,374,13,2);
    // Door with boards, hinges and knob.
    ctx.fillStyle='#33251f';ctx.fillRect(81,408,19,32);ctx.fillStyle='#493126';ctx.fillRect(84,410,13,30);ctx.fillStyle='#2c201c';ctx.fillRect(87,410,1,30);ctx.fillRect(93,410,1,30);
    ctx.fillStyle='#8a6945';ctx.fillRect(84,417,13,2);ctx.fillRect(84,431,13,2);ctx.fillStyle='#d6ad68';ctx.fillRect(94,425,2,2);
    // Window frame, panes, sill and night glow.
    ctx.fillStyle='#35271f';ctx.fillRect(102,397,18,17);ctx.fillStyle='#c68e4b';ctx.fillRect(105,400,12,11);ctx.fillStyle='#4d392a';ctx.fillRect(110,400,2,11);ctx.fillRect(105,405,12,2);ctx.fillStyle='#d8ba73';ctx.fillRect(103,413,16,2);
    const night=1-t.daylight;if(night>.35){ctx.fillStyle='rgba(255,203,104,'+(night*.9)+')';ctx.fillRect(106,401,4,4);ctx.fillRect(113,408,3,2);}
    // Chimney bricks and smoke cap.
    ctx.fillStyle='#5b4031';ctx.fillRect(112,364,10,26);ctx.fillStyle='#8a6042';ctx.fillRect(114,365,6,24);ctx.fillStyle='#392d29';ctx.fillRect(112,369,10,2);ctx.fillRect(112,378,10,2);ctx.fillStyle='#242022';ctx.fillRect(114,356,7,9);ctx.fillStyle='#605552';ctx.fillRect(113,355,9,2);
    // Tiny doorstep and stacked firewood.
    ctx.fillStyle='#5d4632';ctx.fillRect(78,439,26,4);ctx.fillStyle='#38291f';ctx.fillRect(65,430,11,3);ctx.fillRect(67,434,10,3);ctx.fillStyle='#a16a3f';ctx.fillRect(67,430,2,3);ctx.fillRect(72,434,2,3);
  }
  function drawGarden(t){
    ctx.fillStyle='#4a3424';ctx.fillRect(120,443,64,39);ctx.fillStyle='#67472c';ctx.fillRect(122,445,60,35);
    for(let y=451;y<478;y+=9){ctx.fillStyle='#33261d';ctx.fillRect(124,y,56,5);ctx.fillStyle='#7b5938';ctx.fillRect(125,y,55,1);for(let x=128;x<179;x+=12){ctx.fillStyle='#397b45';ctx.fillRect(x,y-7,2,7);ctx.fillStyle='#69b55f';ctx.fillRect(x-3,y-6,3,2);ctx.fillRect(x+2,y-5,3,2);ctx.fillStyle='#a7cf72';ctx.fillRect(x,y-8,1,1);}}
    // Fence posts, rails and watering can.
    ctx.fillStyle='#8a6b43';ctx.fillRect(119,441,3,43);ctx.fillRect(182,441,3,43);ctx.fillRect(120,443,64,2);ctx.fillRect(120,480,64,2);ctx.fillStyle='#b08a58';for(let x=121;x<=183;x+=15)ctx.fillRect(x,441,1,40);
    ctx.fillStyle='#6f8074';ctx.fillRect(166,466,8,6);ctx.fillRect(173,468,5,2);ctx.fillRect(164,464,3,3);ctx.fillStyle='#aab8a6';ctx.fillRect(168,466,3,1);
  }
  function drawCampfire(t){
    const x=126,y=423;
    ctx.fillStyle='#2e241d';for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.fillRect(Math.round(x+Math.cos(a)*10)-2,Math.round(y+8+Math.sin(a)*4)-1,4,3);}
    ctx.fillStyle='#4a2f1f';ctx.fillRect(x-11,y+7,23,4);ctx.fillStyle='#704225';ctx.fillRect(x-8,y+10,17,3);ctx.fillStyle='#a34d2b';ctx.fillRect(x-6,y-2,13,14);ctx.fillStyle='#ef7b35';ctx.fillRect(x-4,y-6,9,15);ctx.fillStyle='#ffb54d';ctx.fillRect(x-2,y-8,5,13);ctx.fillStyle='#ffe18a';ctx.fillRect(x,y-7,2,8);
    if(t.daylight<.4){ctx.globalAlpha=.11;ctx.fillStyle='#ffb24f';ctx.beginPath();ctx.arc(x,y,43,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  }
  function drawBridge(t){
    ctx.fillStyle='#38291f';ctx.fillRect(201,473,84,3);ctx.fillRect(203,509,82,3);
    for(let i=0;i<9;i++){const x=201+i*10,y=478+i*3;ctx.fillStyle=i%2?'#765338':'#855f3d';ctx.fillRect(x,y,12,7);ctx.fillStyle='#a77a4e';ctx.fillRect(x+1,y+1,9,1);ctx.fillStyle='#3e2b21';ctx.fillRect(x+9,y+2,2,4);}
    ctx.fillStyle='#b69061';for(let i=0;i<7;i++){ctx.fillRect(205+i*12,475+i*3,2,2);ctx.fillRect(211+i*12,478+i*3,1,1);}
  }
  function drawWorkshop(t){
    ctx.fillStyle='#36271f';ctx.fillRect(143,367,61,44);ctx.fillStyle='#5c3b28';ctx.fillRect(147,366,55,42);ctx.fillStyle='#845332';ctx.fillRect(152,372,45,36);
    ctx.fillStyle='#5f3b28';for(let y=376;y<407;y+=7)ctx.fillRect(153,y,43,1);
    ctx.fillStyle='#25201f';poly([[140,369],[173,344],[207,369]],ctx.fillStyle);ctx.fillStyle='#a3683b';poly([[147,366],[174,349],[201,366]],ctx.fillStyle);
    ctx.fillStyle='#c9844c';ctx.fillRect(165,355,18,2);ctx.fillRect(155,361,15,2);ctx.fillRect(182,361,12,2);
    ctx.fillStyle='#1d1918';ctx.fillRect(180,378,12,30);ctx.fillStyle='#4b3024';ctx.fillRect(183,381,6,27);ctx.fillStyle='#c59b5e';ctx.fillRect(187,392,2,2);
    // Anvil, forge and orange glow.
    ctx.fillStyle='#4b5150';ctx.fillRect(153,385,21,7);ctx.fillStyle='#7c8380';ctx.fillRect(155,383,16,3);ctx.fillStyle='#383b3a';ctx.fillRect(160,392,7,8);ctx.fillStyle='#222020';ctx.fillRect(193,388,8,17);ctx.fillStyle='#a44f2d';ctx.fillRect(194,391,6,8);ctx.fillStyle='#f09a4c';ctx.fillRect(196,393,3,5);ctx.fillStyle='#ffd276';ctx.fillRect(197,394,1,3);
    ctx.fillStyle='#8c6543';ctx.fillRect(148,405,50,3);
  }
  function drawTower(t){
    ctx.fillStyle='#3e393b';ctx.fillRect(14,215,32,89);ctx.fillStyle='#68605d';ctx.fillRect(18,218,24,84);ctx.fillStyle='#827974';ctx.fillRect(20,220,3,78);
    // Masonry blocks.
    ctx.fillStyle='#514b4b';for(let y=225;y<300;y+=10){for(let x=23+(y%20?0:8);x<41;x+=13)ctx.fillRect(x,y,8,2);}
    ctx.fillStyle='#29252c';poly([[10,220],[30,192],[50,220]],ctx.fillStyle);ctx.fillStyle='#544452';poly([[15,216],[30,198],[45,216]],ctx.fillStyle);ctx.fillStyle='#756071';ctx.fillRect(24,202,12,2);
    ctx.fillStyle='#2b272c';ctx.fillRect(24,230,12,13);ctx.fillStyle='#15151a';ctx.fillRect(27,233,6,10);
    if(t.daylight<.5){ctx.fillStyle='#ffd16c';ctx.fillRect(27,234,6,7);ctx.fillStyle='#fff0a4';ctx.fillRect(29,235,2,4);}
    ctx.fillStyle='#302b2d';ctx.fillRect(20,272,20,3);ctx.fillRect(23,286,14,3);
  }
  function drawTrees(t){for(let i=0;i<10;i++){const x=270+(i%5)*27,y=360+Math.floor(i/5)*55+(i%2)*8;drawTree(x,y,1+(i%3)*.1,t.daylight);}drawTree(25,405,1.15,t.daylight);drawTree(360,398,1.2,t.daylight);}
  function drawTree(x,y,s,day){
    const trunk='#59402b',trunkHi='#8a6040',leaf1=mix('#0b1a14','#2f5733',day),leaf2=mix('#10231a','#447044',day),leaf3=mix('#1a3020','#5f8550',day);
    // trunk with bark and exposed root pixels.
    ctx.fillStyle='#3d2d21';ctx.fillRect(Math.round(x-4*s),Math.round(y-29*s),Math.round(8*s),Math.round(31*s));ctx.fillStyle=trunk;ctx.fillRect(Math.round(x-3*s),Math.round(y-28*s),Math.round(6*s),Math.round(29*s));ctx.fillStyle=trunkHi;ctx.fillRect(Math.round(x-2*s),Math.round(y-26*s),Math.max(1,Math.round(s)),Math.round(15*s));ctx.fillStyle='#38271d';ctx.fillRect(Math.round(x+1*s),Math.round(y-18*s),Math.max(1,Math.round(s)),Math.round(11*s));ctx.fillRect(Math.round(x-8*s),Math.round(y),Math.round(7*s),Math.max(2,Math.round(2*s)));ctx.fillRect(Math.round(x+2*s),Math.round(y),Math.round(8*s),Math.max(2,Math.round(2*s)));
    // Four layered foliage masses with cut-in shadow pixels.
    ctx.fillStyle=leaf1;poly([[x-24*s,y-22*s],[x,y-66*s],[x+24*s,y-22*s]],ctx.fillStyle);poly([[x-20*s,y-39*s],[x,y-78*s],[x+20*s,y-39*s]],ctx.fillStyle);
    ctx.fillStyle=leaf2;poly([[x-18*s,y-26*s],[x-2*s,y-58*s],[x+17*s,y-28*s]],ctx.fillStyle);poly([[x-14*s,y-44*s],[x+1*s,y-75*s],[x+15*s,y-45*s]],ctx.fillStyle);
    ctx.fillStyle=leaf3;ctx.fillRect(Math.round(x-9*s),Math.round(y-49*s),Math.round(7*s),Math.max(2,Math.round(3*s)));ctx.fillRect(Math.round(x+3*s),Math.round(y-58*s),Math.round(6*s),Math.max(2,Math.round(3*s)));ctx.fillRect(Math.round(x-4*s),Math.round(y-68*s),Math.round(5*s),Math.max(2,Math.round(2*s)));
    ctx.fillStyle=leaf1;ctx.fillRect(Math.round(x-13*s),Math.round(y-36*s),Math.round(4*s),Math.max(2,Math.round(2*s)));ctx.fillRect(Math.round(x+11*s),Math.round(y-32*s),Math.round(4*s),Math.max(2,Math.round(2*s)));
  }
  function drawHero(x,y,flip,step,mode){
    ctx.save();ctx.translate(Math.round(x),Math.round(y));if(flip)ctx.scale(-1,1);const bob=mode==='walk'?Math.round(Math.sin(step)*1):0;ctx.translate(0,bob);
    // Ground shadow.
    ctx.fillStyle='#12151a';ctx.fillRect(-9,19,19,2);ctx.fillStyle='#1c2025';ctx.fillRect(-6,18,13,1);
    // Large leather pack, straps, flap, rolled blanket and dangling bottle.
    ctx.fillStyle='#4a3025';ctx.fillRect(-12,-5,8,18);ctx.fillStyle='#75492f';ctx.fillRect(-11,-4,6,16);ctx.fillStyle='#a56d3f';ctx.fillRect(-10,-2,4,10);ctx.fillStyle='#2f241f';ctx.fillRect(-12,-6,8,4);ctx.fillStyle='#9a6843';ctx.fillRect(-11,-5,6,2);ctx.fillStyle='#c69b57';ctx.fillRect(-7,0,1,8);ctx.fillStyle='#2d211d';ctx.fillRect(-10,10,5,3);
    ctx.fillStyle='#625247';ctx.fillRect(-11,-9,7,3);ctx.fillStyle='#9b8369';ctx.fillRect(-10,-10,5,2);ctx.fillStyle='#3e2f26';ctx.fillRect(-10,-9,1,4);ctx.fillRect(-6,-9,1,4);
    ctx.fillStyle='#41231f';ctx.fillRect(-12,9,3,5);ctx.fillStyle='#bd5141';ctx.fillRect(-11,10,2,3);ctx.fillStyle='#e5b764';ctx.fillRect(-11,9,2,1);
    // Torso coat with edge light, belt and scarf.
    ctx.fillStyle='#1d2730';ctx.fillRect(-5,-5,12,18);ctx.fillStyle='#31434b';ctx.fillRect(-4,-4,10,16);ctx.fillStyle='#536e70';ctx.fillRect(-2,-3,6,12);ctx.fillStyle='#78908a';ctx.fillRect(-1,-2,2,7);ctx.fillStyle='#202c3f';ctx.fillRect(-5,-6,11,4);ctx.fillStyle='#36516a';ctx.fillRect(-3,-5,8,2);
    ctx.fillStyle='#3b281f';ctx.fillRect(-5,7,12,2);ctx.fillStyle='#bd8c4e';ctx.fillRect(0,7,3,2);ctx.fillStyle='#f0c66d';ctx.fillRect(1,7,1,1);
    // Head, hair, ear, brows, eye, nose and beard pixels.
    ctx.fillStyle='#30201f';ctx.fillRect(-4,-18,9,11);ctx.fillStyle='#9b674f';ctx.fillRect(-3,-16,8,9);ctx.fillStyle='#c18765';ctx.fillRect(-2,-15,6,7);ctx.fillStyle='#d49a73';ctx.fillRect(-1,-14,4,4);
    ctx.fillStyle='#21191b';ctx.fillRect(-5,-19,10,5);ctx.fillRect(-5,-16,3,5);ctx.fillRect(2,-18,4,3);ctx.fillStyle='#473029';ctx.fillRect(-2,-10,6,3);ctx.fillStyle='#6a4036';ctx.fillRect(1,-11,3,1);
    ctx.fillStyle='#3a2523';ctx.fillRect(0,-14,3,1);ctx.fillStyle='#e8d8b6';ctx.fillRect(2,-13,1,1);ctx.fillStyle='#33201f';ctx.fillRect(3,-13,1,1);ctx.fillStyle='#b77859';ctx.fillRect(4,-12,2,2);ctx.fillStyle='#e3aa7d';ctx.fillRect(4,-12,1,1);
    // Arms, gloves and tiny tool handle.
    ctx.fillStyle='#8b603d';ctx.fillRect(6,-1,4,11);ctx.fillStyle='#b57c50';ctx.fillRect(7,0,2,8);ctx.fillStyle='#3a2c27';ctx.fillRect(7,8,4,4);ctx.fillStyle='#c69b57';ctx.fillRect(9,2,2,7);ctx.fillStyle='#725130';ctx.fillRect(10,1,1,9);
    ctx.fillStyle='#6f4b35';ctx.fillRect(-6,-1,2,10);ctx.fillStyle='#9d6d4b';ctx.fillRect(-6,0,1,7);ctx.fillStyle='#342824';ctx.fillRect(-7,7,3,4);
    // Legs, folds, gaiter straps and boots.
    ctx.fillStyle='#252b32';ctx.fillRect(-5,11,5,8);ctx.fillRect(2,11,5,8);ctx.fillStyle='#3b4347';ctx.fillRect(-3,12,2,5);ctx.fillRect(3,12,2,5);ctx.fillStyle='#5f4939';ctx.fillRect(-5,15,5,1);ctx.fillRect(2,15,5,1);ctx.fillStyle='#382a25';ctx.fillRect(-6,18,6,3);ctx.fillRect(2,18,7,3);ctx.fillStyle='#76513a';ctx.fillRect(-5,18,4,1);ctx.fillRect(3,18,5,1);
    ctx.restore();
  }
  function drawDog(x,y){
    ctx.save();ctx.translate(Math.round(x),Math.round(y));
    ctx.fillStyle='#261e1a';ctx.fillRect(-6,-5,12,8);ctx.fillRect(4,-9,7,7);ctx.fillStyle='#9d7148';ctx.fillRect(-5,-4,10,6);ctx.fillStyle='#c28d59';ctx.fillRect(-2,-4,5,3);ctx.fillRect(5,-8,5,5);ctx.fillStyle='#e0b57a';ctx.fillRect(6,-7,2,2);ctx.fillStyle='#3a281f';ctx.fillRect(5,-10,2,4);ctx.fillRect(9,-9,2,3);ctx.fillStyle='#151313';ctx.fillRect(9,-6,2,2);ctx.fillRect(7,-7,1,1);
    ctx.fillStyle='#704c34';ctx.fillRect(-5,2,2,5);ctx.fillRect(3,2,2,5);ctx.fillStyle='#2d211d';ctx.fillRect(-6,6,3,1);ctx.fillRect(3,6,3,1);ctx.fillStyle='#8e6746';ctx.fillRect(-8,-4,3,2);ctx.fillRect(-9,-6,2,3);
    ctx.restore();
  }
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
