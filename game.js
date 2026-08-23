(() => {
  'use strict';

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const rand = (a,b) => Math.floor(Math.random()*(b-a+1))+a;
  const pick = arr => arr[Math.floor(Math.random()*arr.length)];
  const uid = () => Math.random().toString(36).slice(2,9);

  const SCREENS = {
    home: $('#homeScreen'), skills: $('#skillsScreen'), game: $('#gameScreen')
  };

  const SKILLS = {
    vitality:{name:'IRON BODY',desc:'最大HP +10。死ににくくなる。',max:5,baseCost:90,glow:'#b84b3c',icon:'heart'},
    pack:{name:'DEEP POCKETS',desc:'バッグを拡張。Lv1で+1行、Lv2で+1列。',max:2,baseCost:180,glow:'#c79548',icon:'pack'},
    scavenge:{name:'SCAVENGER',desc:'レア報酬率を上げ、獲得XPも増やす。',max:5,baseCost:110,glow:'#4d9d82',icon:'gem'}
  };

  const ITEM_TEMPLATES = {
    rustKnife:{name:'錆びた短剣',rarity:'common',shape:[[1],[1]],kind:'weapon',damage:9,cd:1.35,desc:'1.35秒ごとに9ダメージ。毒瓶が隣接すると毒刃化。',palette:['#48261f','#9c5638','#d5a061','#d8d4bd'],icon:'knife'},
    buckler:{name:'鉄のバックラー',rarity:'common',shape:[[1,1],[1,1]],kind:'shield',block:7,cd:2.5,desc:'2.5秒ごとに7ブロック。武器を守る頼れる盾。',palette:['#2d3339','#68747a','#bec6bd','#b4813f'],icon:'shield'},
    poison:{name:'毒の小瓶',rarity:'uncommon',shape:[[1]],kind:'support',desc:'隣接する武器に毒+3/秒を付与。',palette:['#142a18','#43a65d','#91f17d','#d7f46a'],icon:'potion'},
    battery:{name:'古代電池',rarity:'uncommon',shape:[[1],[1]],kind:'support',desc:'隣接する武器の攻撃速度+22%。',palette:['#23343d','#41899c','#83e8e4','#e2c257'],icon:'battery'},
    ration:{name:'干し肉',rarity:'common',shape:[[1,1]],kind:'heal',heal:18,desc:'HP45%以下で自動使用し18回復。使うと消滅。',palette:['#4a1f19','#9e4c2d','#db9251','#f0c489'],icon:'ration'},
    cleaver:{name:'坑夫の鉈',rarity:'uncommon',shape:[[1,1],[0,1]],kind:'weapon',damage:16,cd:2.0,desc:'2秒ごとに16ダメージ。大きいが高威力。',palette:['#2c2627','#6f7474','#d4cbb0','#8b482e'],icon:'cleaver'},
    thornPlate:{name:'棘鉄板',rarity:'uncommon',shape:[[1,1,1]],kind:'armor',thorns:3,desc:'被弾するたび敵へ3反射ダメージ。',palette:['#24282a','#565e5c','#aab0a4','#c3653a'],icon:'thorns'},
    emberBlade:{name:'熾火の剣',rarity:'rare',shape:[[1],[1],[1]],kind:'weapon',damage:22,cd:1.75,burn:4,desc:'1.75秒ごとに22ダメージ。さらに炎上4/秒。',palette:['#431b16','#9f3621','#ef7b31','#ffd164'],icon:'fireSword'},
    shockCoil:{name:'雷撃コイル',rarity:'rare',shape:[[1,1],[1,0]],kind:'support',desc:'隣接武器の速度+35%、攻撃時に雷撃+4。',palette:['#1a283b','#365f9d','#62c9e8','#e1f28c'],icon:'coil'},
    relicMask:{name:'黄金の仮面',rarity:'epic',shape:[[1,1],[1,1]],kind:'relic',desc:'全武器ダメージ+25%。獲得XP+20%。',palette:['#382913','#8a5c22','#d9a63f','#ffe19a'],icon:'mask'}
  };

  const ENEMIES = [
    {name:'MOSS GNAWER',baseHp:46,atk:8,cd:2.25,xp:34,kind:'rat',color:'#6a8e55'},
    {name:'CRYPT HUSK',baseHp:58,atk:10,cd:2.55,xp:42,kind:'husk',color:'#947b62'},
    {name:'FUNGAL BRUTE',baseHp:75,atk:12,cd:2.85,xp:52,kind:'fungus',color:'#8a5da0'},
    {name:'IRON WARDEN',baseHp:92,atk:14,cd:2.35,xp:64,kind:'warden',color:'#708c91'}
  ];

  const THEMES = [
    {name:'OLD CATACOMB',from:1,to:3,sky:'#171015',wall:'#3f3030',brick:'#5d4034',accent:'#d28b42',fog:'#6e574b'},
    {name:'FUNGAL GROTTO',from:4,to:5,sky:'#0f1717',wall:'#203c38',brick:'#34594d',accent:'#7ccf7a',fog:'#437f74'},
    {name:'RUST FOUNDRY',from:6,to:8,sky:'#141519',wall:'#3e3029',brick:'#6d4430',accent:'#e36f3f',fog:'#5d6f79'},
    {name:'SUNLESS TEMPLE',from:9,to:10,sky:'#15111e',wall:'#352b49',brick:'#5b446c',accent:'#d7b65c',fog:'#6c5980'}
  ];

  let meta = loadMeta();
  let run = null;
  let combatTimer = null;
  let animFrame = null;
  let selectedItemId = null;
  let drag = null;
  let toastTimer = null;
  let stageFx = [];
  const spriteCache = new Map();

  function loadMeta(){
    try{
      const raw = JSON.parse(localStorage.getItem('packdepth_meta') || 'null');
      return Object.assign({xp:0,bestFloor:0,clears:0,skills:{vitality:0,pack:0,scavenge:0}}, raw||{});
    }catch(_){return {xp:0,bestFloor:0,clears:0,skills:{vitality:0,pack:0,scavenge:0}};}
  }
  function saveMeta(){ localStorage.setItem('packdepth_meta', JSON.stringify(meta)); }

  function showScreen(name){
    Object.values(SCREENS).forEach(s=>s.classList.remove('active'));
    SCREENS[name].classList.add('active');
    if(name!=='game' && animFrame){ cancelAnimationFrame(animFrame); animFrame=null; }
    if(name==='home') renderHome();
    if(name==='skills') renderSkills();
  }

  function renderHome(){
    $('#metaXp').textContent = meta.xp;
    $('#bestFloor').textContent = `${meta.bestFloor}F`;
    $('#clears').textContent = meta.clears;
    drawHomeHero();
  }

  function renderSkills(){
    $('#skillXp').textContent = meta.xp;
    const root = $('#skillTree'); root.innerHTML='';
    Object.entries(SKILLS).forEach(([key,s])=>{
      const lv = meta.skills[key]||0;
      const cost = skillCost(key,lv);
      const card = document.createElement('article');
      card.className='skill-card panel'; card.style.setProperty('--skill-glow',s.glow);
      card.innerHTML=`<div class="skill-top"><div class="skill-title"><canvas class="skill-icon" width="48" height="48"></canvas><div><h3>${s.name}</h3><p>${s.desc}</p></div></div><div class="skill-level">LV ${lv}/${s.max}</div></div><button class="skill-buy" ${lv>=s.max||meta.xp<cost?'disabled':''}>${lv>=s.max?'MAX':`${cost} XPで強化`}</button>`;
      drawSkillIcon($('canvas',card),s.icon,s.glow);
      $('button',card).addEventListener('click',()=>{
        if(lv>=s.max||meta.xp<cost)return;
        meta.xp-=cost; meta.skills[key]=lv+1; saveMeta(); renderSkills(); pulseToast(`${s.name} LV ${lv+1}`);
      });
      root.appendChild(card);
    });
  }
  function skillCost(key,lv){ return Math.round(SKILLS[key].baseCost*(1+lv*.75)); }

  function newRun(){
    stopCombat();
    const rows = 5 + (meta.skills.pack>=1?1:0);
    const cols = 5 + (meta.skills.pack>=2?1:0);
    run={floor:1,runXp:0,maxHp:80+(meta.skills.vitality||0)*10,hp:80+(meta.skills.vitality||0)*10,block:0,rows,cols,items:[],enemy:null,combat:false,rewardPending:null,bestThisRun:1,poisonDps:0,burnDps:0};
    addItemToFirstSpace(makeItem('rustKnife'));
    addItemToFirstSpace(makeItem('buckler'));
    addItemToFirstSpace(makeItem('ration'));
    selectedItemId=null;
    showScreen('game');
    prepareFloor();
  }

  function makeItem(templateId){ return {id:uid(),templateId,x:0,y:0,rot:0,used:false,next:0}; }
  function tpl(item){ return ITEM_TEMPLATES[item.templateId]; }
  function rotateShapeOnce(sh){ return sh[0].map((_,c)=>sh.map(r=>r[c]).reverse()); }
  function shapeOf(item){
    let sh=tpl(item).shape.map(r=>[...r]);
    const turns=((item.rot||0)%4+4)%4;
    for(let k=0;k<turns;k++) sh=rotateShapeOnce(sh);
    return sh;
  }
  function dimsOf(item){ const sh=shapeOf(item); return {w:sh[0].length,h:sh.length}; }
  function cellsOf(item,x=item.x,y=item.y){
    const sh=shapeOf(item), out=[];
    sh.forEach((r,yy)=>r.forEach((v,xx)=>{if(v)out.push([x+xx,y+yy]);})); return out;
  }
  function canPlace(item,x,y,ignoreId=item.id){
    const cells=cellsOf(item,x,y);
    if(!cells.length)return false;
    if(cells.some(([cx,cy])=>cx<0||cy<0||cx>=run.cols||cy>=run.rows))return false;
    const occupied=new Set();
    run.items.filter(i=>i.id!==ignoreId).forEach(i=>cellsOf(i).forEach(([cx,cy])=>occupied.add(`${cx},${cy}`)));
    return !cells.some(([cx,cy])=>occupied.has(`${cx},${cy}`));
  }
  function nearestPlacement(item,preferredX,preferredY,maxRadius=1){
    const d=dimsOf(item);
    const px0=clamp(preferredX,0,Math.max(0,run.cols-d.w));
    const py0=clamp(preferredY,0,Math.max(0,run.rows-d.h));
    const candidates=[];
    for(let y=0;y<=Math.max(0,run.rows-d.h);y++){
      for(let x=0;x<=Math.max(0,run.cols-d.w);x++){
        const dist=Math.abs(x-px0)+Math.abs(y-py0);
        if(dist<=maxRadius&&canPlace(item,x,y))candidates.push({x,y,dist});
      }
    }
    candidates.sort((a,b)=>a.dist-b.dist||Math.abs(a.y-py0)-Math.abs(b.y-py0)||Math.abs(a.x-px0)-Math.abs(b.x-px0));
    return candidates[0]||null;
  }
  function addItemToFirstSpace(item){
    for(let y=0;y<run.rows;y++)for(let x=0;x<run.cols;x++) if(canPlace(item,x,y,null)){item.x=x;item.y=y;run.items.push(item);return true;}
    return false;
  }

  function prepareFloor(){
    stopCombat();
    run.bestThisRun=Math.max(run.bestThisRun,run.floor);
    meta.bestFloor=Math.max(meta.bestFloor,run.floor); saveMeta();
    const enemy = createEnemy(run.floor);
    run.enemy=enemy; run.block=0; run.poisonDps=0; run.burnDps=0; run._dotAt=0;
    $('#battleBtn').disabled=false; $('#battleBtn').textContent=run.floor===10?'ボス戦を開始':'戦闘開始';
    $('#combatFeed').textContent=run.floor===10?'最深部。生きて帰れ。':'装備を整えて戦闘を開始。';
    updateGameUI(); renderBackpack(); startStageLoop();
  }

  function createEnemy(floor){
    if(floor===10)return {name:'THE BURIED KING',hp:320,maxHp:320,atk:24,cd:2.2,xp:320,kind:'king',color:'#bd8e48',next:0,boss:true};
    if(floor===5)return {name:'BONE COLOSSUS',hp:170,maxHp:170,atk:18,cd:2.65,xp:145,kind:'colossus',color:'#b9aa8c',next:0,boss:true};
    const base=ENEMIES[Math.min(ENEMIES.length-1,Math.floor((floor-1)/2))];
    const scale=1+(floor-1)*.12;
    const hp=Math.round(base.baseHp*scale);
    return {...base,hp,maxHp:hp,atk:Math.round(base.atk*(1+(floor-1)*.08)),xp:Math.round(base.xp*scale),next:0};
  }

  function updateGameUI(){
    if(!run)return;
    const theme=getTheme(run.floor);
    $('#zoneName').textContent=theme.name;
    $('#floorLabel').textContent=`FLOOR ${String(run.floor).padStart(2,'0')} / 10`;
    $('#runXp').textContent=run.runXp;
    $('#packSizeLabel').textContent=`${run.cols} × ${run.rows}`;
    $('#playerHpText').textContent=`${Math.max(0,Math.ceil(run.hp))}/${run.maxHp}`;
    $('#playerHpBar').style.width=`${clamp(run.hp/run.maxHp*100,0,100)}%`;
    if(run.enemy){
      $('#enemyName').textContent=run.enemy.name;
      $('#enemyHpText').textContent=`${Math.max(0,Math.ceil(run.enemy.hp))}/${run.enemy.maxHp}`;
      $('#enemyHpBar').style.width=`${clamp(run.enemy.hp/run.enemy.maxHp*100,0,100)}%`;
    }
    $('#synergyChip').textContent=`SYNERGY ${calculateSynergies().count}`;
  }

  function renderBackpack(){
    const root=$('#backpack');
    const cell = cellSize();
    root.style.width=`${run.cols*cell+10}px`; root.style.height=`${run.rows*cell+10}px`;
    root.innerHTML='';
    run.items.forEach(item=>{
      const d=dimsOf(item), el=document.createElement('button');
      el.type='button'; el.className='pack-item'; el.dataset.id=item.id;
      if(item.id===selectedItemId)el.classList.add('selected');
      el.style.left=`${5+item.x*cell}px`; el.style.top=`${5+item.y*cell}px`;
      el.style.width=`${d.w*cell}px`; el.style.height=`${d.h*cell}px`;
      const cv=document.createElement('canvas'); cv.width=d.w*48; cv.height=d.h*48; drawItemIcon(cv,item);
      el.appendChild(cv);
      el.addEventListener('pointerdown',e=>beginDrag(e,item,el));
      el.addEventListener('click',()=>{ if(drag&&drag.moved)return; selectItem(item.id); });
      root.appendChild(el);
    });
    renderInspector(); updateGameUI();
  }
  function cellSize(){
    const v=getComputedStyle(document.documentElement).getPropertyValue('--cell').trim(); return parseInt(v,10)||52;
  }

  function selectItem(id){selectedItemId=id;renderBackpack();}
  function renderInspector(){
    const panel=$('#itemInspector'), item=run.items.find(i=>i.id===selectedItemId);
    if(!item){panel.hidden=true;return;} panel.hidden=false;
    const t=tpl(item); $('#inspectName').textContent=`${rarityMark(t.rarity)} ${t.name}`; $('#inspectDesc').textContent=t.desc;
    drawItemIcon($('#inspectIcon'),item,true);
    $('#rotateBtn').disabled=run.combat;
    $('#discardBtn').disabled=run.combat;
  }

  function beginDrag(e,item,el){
    if(run.combat)return;
    e.preventDefault();
    const rect=el.getBoundingClientRect();
    el.setPointerCapture?.(e.pointerId);
    drag={
      id:item.id,
      startX:e.clientX,startY:e.clientY,
      originX:item.x,originY:item.y,
      grabOffsetX:e.clientX-rect.left,
      grabOffsetY:e.clientY-rect.top,
      moved:false,el,pointerId:e.pointerId
    };
    el.classList.add('dragging');
    el.addEventListener('pointermove',moveDrag);
    el.addEventListener('pointerup',endDrag,{once:true});
    el.addEventListener('pointercancel',endDrag,{once:true});
  }
  function moveDrag(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    e.preventDefault();
    const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
    if(Math.hypot(dx,dy)>6)drag.moved=true;
    drag.el.style.transform=`translate(${dx}px,${dy}px) scale(1.05)`;
  }
  function endDrag(e){
    if(!drag)return;
    const d=drag;
    d.el.removeEventListener('pointermove',moveDrag);
    d.el.classList.remove('dragging');
    d.el.style.transform='';
    const item=run.items.find(i=>i.id===d.id);
    if(e.type!=='pointercancel'&&d.moved&&item){
      const rect=$('#backpack').getBoundingClientRect(), cell=cellSize(), size=dimsOf(item);
      const rawX=(e.clientX-rect.left-5-d.grabOffsetX)/cell;
      const rawY=(e.clientY-rect.top-5-d.grabOffsetY)/cell;
      const targetX=clamp(Math.round(rawX),0,Math.max(0,run.cols-size.w));
      const targetY=clamp(Math.round(rawY),0,Math.max(0,run.rows-size.h));
      let spot=canPlace(item,targetX,targetY)?{x:targetX,y:targetY}:nearestPlacement(item,targetX,targetY,1);
      if(spot){item.x=spot.x;item.y=spot.y;}
      else pulseToast('そこには置けない');
      selectedItemId=item.id;
      renderBackpack();
    }
    setTimeout(()=>{drag=null;},0);
  }

  function rotateSelected(){
    if(run.combat)return;
    const item=run.items.find(i=>i.id===selectedItemId); if(!item)return;
    const old={rot:item.rot,x:item.x,y:item.y};
    item.rot=(item.rot+1)%4;
    const size=dimsOf(item);
    const preferredX=clamp(old.x,0,Math.max(0,run.cols-size.w));
    const preferredY=clamp(old.y,0,Math.max(0,run.rows-size.h));
    const spot=canPlace(item,preferredX,preferredY)?{x:preferredX,y:preferredY}:nearestPlacement(item,preferredX,preferredY,2);
    if(spot){item.x=spot.x;item.y=spot.y;}
    else{item.rot=old.rot;item.x=old.x;item.y=old.y;pulseToast('回転するスペースがない');}
    renderBackpack();
  }
  function discardSelected(){
    if(run.combat)return;
    const idx=run.items.findIndex(i=>i.id===selectedItemId); if(idx<0)return;
    const name=tpl(run.items[idx]).name; run.items.splice(idx,1); selectedItemId=null; renderBackpack(); pulseToast(`${name}を捨てた`);
  }

  function calculateSynergies(){
    let count=0,globalDamage=1,xpBonus=1; const itemBuffs=new Map();
    const neighbor=(a,b)=>{
      const A=cellsOf(a),B=cellsOf(b);
      return A.some(([ax,ay])=>B.some(([bx,by])=>Math.abs(ax-bx)+Math.abs(ay-by)===1));
    };
    run.items.forEach(i=>itemBuffs.set(i.id,{speed:1,poison:0,shock:0,damage:1}));
    run.items.forEach(a=>{
      const ta=tpl(a);
      if(ta.icon==='mask'){globalDamage*=1.25;xpBonus*=1.2;count++;}
      run.items.forEach(b=>{
        if(a.id===b.id||!neighbor(a,b))return; const tb=tpl(b);
        if(ta.kind==='weapon'&&tb.icon==='potion'){itemBuffs.get(a.id).poison=Math.max(itemBuffs.get(a.id).poison,3);count++;}
        if(ta.kind==='weapon'&&tb.icon==='battery'){itemBuffs.get(a.id).speed=Math.min(itemBuffs.get(a.id).speed,.78);count++;}
        if(ta.kind==='weapon'&&tb.icon==='coil'){itemBuffs.get(a.id).speed=Math.min(itemBuffs.get(a.id).speed,.65);itemBuffs.get(a.id).shock=4;count++;}
      });
    });
    return {count,globalDamage,xpBonus,itemBuffs};
  }

  function startCombat(){
    if(run.combat||!run.enemy)return;
    run.combat=true; selectedItemId=null; renderBackpack();
    $('#battleBtn').disabled=true; $('#battleBtn').textContent='戦闘中…';
    const now=performance.now()/1000; run.enemy.next=now+1.35;
    run.items.forEach(i=>{i.next=now+.35+Math.random()*.5;i.used=false;});
    $('#combatFeed').textContent='装備が動き出した。';
    combatTimer=setInterval(combatTick,80);
  }

  function combatTick(){
    if(!run?.combat)return;
    const now=performance.now()/1000, syn=calculateSynergies();
    for(const item of [...run.items]){
      const t=tpl(item), buff=syn.itemBuffs.get(item.id)||{speed:1,poison:0,shock:0};
      if(t.kind==='heal'&&!item.used&&run.hp/run.maxHp<=.45){
        item.used=true; run.hp=Math.min(run.maxHp,run.hp+t.heal); fx('heal',90,125); flashItem(item.id); $('#combatFeed').textContent=`${t.name}でHP +${t.heal}`;
        const idx=run.items.findIndex(i=>i.id===item.id); if(idx>=0)run.items.splice(idx,1); selectedItemId=null; renderBackpack(); continue;
      }
      if((t.kind==='weapon'||t.kind==='shield')&&now>=item.next){
        if(t.kind==='weapon'){
          const dmg=Math.round(t.damage*syn.globalDamage); damageEnemy(dmg,'hit');
          if(t.burn)run.burnDps=Math.max(run.burnDps,t.burn);
          if(buff.poison)run.poisonDps=Math.max(run.poisonDps,buff.poison);
          if(buff.shock)damageEnemy(buff.shock,'shock');
          item.next=now+t.cd*buff.speed;
          $('#combatFeed').textContent=`${t.name} → ${dmg}${buff.shock?` +雷${buff.shock}`:''} dmg`;
        }else{
          run.block=Math.min(30,run.block+t.block); item.next=now+t.cd; fx('block',92,128); $('#combatFeed').textContent=`${t.name} → BLOCK +${t.block}`;
        }
        flashItem(item.id);
      }
      if(run.enemy.hp<=0)break;
    }
    if(run.enemy.hp<=0){winCombat();return;}
    if(!run._dotAt)run._dotAt=now+1;
    if(now>=run._dotAt){
      const dot=run.poisonDps+run.burnDps; if(dot>0)damageEnemy(dot,'dot'); run._dotAt=now+1;
    }
    if(now>=run.enemy.next){
      let dmg=run.enemy.atk; const absorbed=Math.min(run.block,dmg); run.block-=absorbed; dmg-=absorbed; run.hp-=dmg;
      fx('enemyHit',115,126);
      const thorns=run.items.reduce((s,i)=>s+(tpl(i).thorns||0),0); if(thorns)damageEnemy(thorns,'thorn');
      $('#combatFeed').textContent=absorbed?`敵の攻撃 ${run.enemy.atk} / ${absorbed} BLOCK`:`敵の攻撃 → ${dmg} dmg`;
      run.enemy.next=now+run.enemy.cd;
      if(run.hp<=0){loseRun();return;}
    }
    updateGameUI();
  }

  function damageEnemy(amount,type){ run.enemy.hp-=amount; fx(type,265,112); }
  function flashItem(id){const el=$(`.pack-item[data-id="${id}"]`);if(!el)return;el.classList.add('cooldown-flash');setTimeout(()=>el.classList.remove('cooldown-flash'),120);}

  function winCombat(){
    stopCombat(); run.enemy.hp=0; updateGameUI();
    const syn=calculateSynergies();
    const sc=meta.skills.scavenge||0;
    const gained=Math.round(run.enemy.xp*(1+sc*.05)*syn.xpBonus); run.runXp+=gained; updateGameUI();
    if(run.floor===10){
      bankRunXp(); meta.clears++; saveMeta();
      openModal('DUNGEON CLEARED','10階踏破',`最深部を制圧した。${gained} XPを含むランXPをすべて持ち帰った。`,[],[
        {label:'拠点へ帰還',primary:true,action:()=>{closeModal();showScreen('home');}}
      ]); return;
    }
    const rewards=rollRewards(3);
    run.rewardPending={choices:rewards,gained};
    openRewardModal(gained,rewards);
  }

  function rollRewards(n){
    const sc=meta.skills.scavenge||0, keys=Object.keys(ITEM_TEMPLATES);
    const weight=r=>r==='common'?52-sc*3:r==='uncommon'?31:r==='rare'?14+sc*2:r==='epic'?3+sc:1;
    const out=[];
    while(out.length<n){
      const pool=[]; keys.forEach(k=>{const w=Math.max(1,weight(ITEM_TEMPLATES[k].rarity));for(let i=0;i<w;i++)pool.push(k);});
      const k=pick(pool); if(!out.includes(k))out.push(k);
    }
    return out;
  }

  function openRewardModal(gained,rewards){
    $('#modalEyebrow').textContent='VICTORY'; $('#modalTitle').textContent=`+${gained} XP / 報酬を1つ選択`;
    $('#modalText').textContent='拾った装備はその場でバッグの空きへ入る。入らない場合は報酬を諦めて先へ進める。';
    const root=$('#rewardChoices'); root.innerHTML='';
    rewards.forEach(k=>{
      const t=ITEM_TEMPLATES[k], btn=document.createElement('button'); btn.className=`reward-card ${t.rarity}`;
      const cv=document.createElement('canvas');cv.width=96;cv.height=96;drawItemIcon(cv,{templateId:k,rot:0},true);btn.appendChild(cv);
      btn.insertAdjacentHTML('beforeend',`<strong>${t.name}</strong><small>${t.rarity.toUpperCase()}</small>`);
      btn.addEventListener('click',()=>claimReward(k)); root.appendChild(btn);
    });
    const aa=$('#modalActions'); aa.innerHTML='';
    const skip=document.createElement('button');skip.className='secondary-btn';skip.textContent='報酬を諦めて次へ';skip.addEventListener('click',()=>{run.rewardPending=null;closeModal();openNextFloorPrompt();});aa.appendChild(skip);
    $('#modal').hidden=false;
  }

  function claimReward(k){
    const item=makeItem(k);
    if(!addItemToFirstSpace(item)){pulseToast('バッグに入らない。別の報酬かスキップを選ぼう');return;}
    run.rewardPending=null; closeModal(); selectedItemId=item.id; renderBackpack();
    openNextFloorPrompt();
  }

  function openNextFloorPrompt(){
    openModal('DESCEND','次の階へ',`${run.floor}階を突破。さらに深く潜る。`,[],[
      {label:`FLOOR ${String(run.floor+1).padStart(2,'0')}へ`,primary:true,action:()=>{closeModal();run.floor++;prepareFloor();}}
    ]);
  }

  function loseRun(){
    stopCombat(); run.hp=0; updateGameUI(); const carried=run.runXp; bankRunXp();
    openModal('YOU DIED','探索失敗',`${run.floor}階で倒れた。装備は失ったが、${carried} XPは拠点へ持ち帰った。`,[],[
      {label:'拠点へ戻る',primary:true,action:()=>{closeModal();showScreen('home');}}
    ]);
  }
  function bankRunXp(){ if(!run||run.runXp<=0)return; meta.xp+=run.runXp;run.runXp=0;saveMeta(); }

  function stopCombat(){ if(combatTimer){clearInterval(combatTimer);combatTimer=null;} if(run)run.combat=false; }

  function openModal(eyebrow,title,text,rewards=[],actions=[]){
    $('#modalEyebrow').textContent=eyebrow;$('#modalTitle').textContent=title;$('#modalText').textContent=text;
    const rr=$('#rewardChoices');rr.innerHTML='';
    const aa=$('#modalActions');aa.innerHTML='';
    actions.forEach(a=>{const b=document.createElement('button');b.className=a.primary?'primary-btn':'secondary-btn';b.textContent=a.label;b.addEventListener('click',a.action);aa.appendChild(b);});
    $('#modal').hidden=false;
  }
  function closeModal(){ $('#modal').hidden=true; }

  function pulseToast(msg){
    const t=$('#toast'); t.textContent=msg;t.classList.add('show'); clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1450);
  }

  function rarityMark(r){return r==='epic'?'◆':r==='rare'?'✦':r==='uncommon'?'▰':'▪';}
  function getTheme(f){return THEMES.find(t=>f>=t.from&&f<=t.to)||THEMES[0];}

  function px(ctx,x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function ppoly(ctx,pts,c){ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);pts.slice(1).forEach(p=>ctx.lineTo(p[0],p[1]));ctx.closePath();ctx.fill();}
  function getHeroSprite(){
    if(spriteCache.has('hero128-v2'))return spriteCache.get('hero128-v2');
    const c=document.createElement('canvas');c.width=128;c.height=128;
    const x=c.getContext('2d');x.imageSmoothingEnabled=false;

    // Ground-contact shadow baked into the sprite at very low opacity-like dark pixels.
    px(x,31,118,70,3,'#171319');px(x,39,121,54,2,'#0e0c10');

    // Oversized backpack silhouette — layered canvas, leather, straps and hardware.
    ppoly(x,[[69,12],[96,10],[108,21],[112,43],[111,77],[105,96],[91,101],[72,92]],'#241a18');
    px(x,75,11,23,5,'#5a3b29');px(x,79,8,16,4,'#9d7048');px(x,81,7,12,2,'#c39a68');
    px(x,72,18,34,55,'#513321');px(x,76,20,28,51,'#75492c');px(x,80,23,22,45,'#98633a');
    px(x,84,26,16,12,'#b47a46');px(x,85,27,14,3,'#d3a064');
    px(x,73,39,36,5,'#3b2720');px(x,77,41,27,2,'#b5814f');
    px(x,72,60,37,5,'#39241d');px(x,77,62,28,2,'#aa7443');
    px(x,88,16,4,62,'#39241d');px(x,89,18,2,58,'#c18b52');
    px(x,101,27,8,24,'#3a281f');px(x,103,31,4,16,'#d5a756');px(x,104,33,2,12,'#f5d077');
    px(x,98,69,12,19,'#33241d');px(x,100,72,8,13,'#6b4b32');px(x,102,74,4,3,'#c59b61');
    px(x,70,75,34,17,'#4b3023');px(x,75,78,25,11,'#7d5131');px(x,78,80,18,3,'#b77f49');
    px(x,67,22,7,63,'#35241e');px(x,69,25,3,57,'#a16c43');
    // Rolled blanket and rope.
    px(x,72,4,31,8,'#51433a');px(x,76,2,24,5,'#8c735e');px(x,79,1,18,3,'#bca386');
    px(x,75,4,3,8,'#34271f');px(x,96,4,3,8,'#34271f');px(x,83,5,2,7,'#cf9d59');px(x,91,5,2,7,'#cf9d59');
    // Hanging cup / lantern / tool handles.
    px(x,108,50,3,27,'#5f4937');px(x,106,74,8,8,'#2d2b29');px(x,107,76,6,5,'#89918b');px(x,109,75,2,3,'#c9d0c7');
    px(x,111,20,3,46,'#493128');px(x,113,17,2,36,'#9c7751');
    px(x,104,88,10,15,'#33251f');px(x,106,90,6,10,'#c27c2d');px(x,107,92,4,6,'#ffd06f');px(x,108,91,2,7,'#fff1a4');

    // Legs and boots — finer folds and highlights.
    ppoly(x,[[46,76],[62,75],[66,111],[58,117],[45,114]],'#1d2228');
    ppoly(x,[[65,76],[80,77],[86,112],[77,118],[65,112]],'#20252b');
    px(x,48,81,11,26,'#30383d');px(x,51,83,6,21,'#424b4b');px(x,67,82,11,26,'#2f373c');px(x,69,84,6,20,'#414a4a');
    px(x,46,94,16,3,'#675041');px(x,47,98,14,2,'#3b2c27');px(x,67,95,15,3,'#675041');px(x,68,99,13,2,'#3b2c27');
    ppoly(x,[[43,108],[61,108],[66,117],[62,123],[39,123],[39,116]],'#312621');
    ppoly(x,[[68,109],[83,108],[91,117],[89,123],[66,123],[64,117]],'#302520');
    px(x,43,111,17,4,'#594235');px(x,42,118,20,3,'#171316');px(x,69,112,15,4,'#594235');px(x,68,119,21,3,'#171316');
    px(x,48,109,3,11,'#a06e43');px(x,77,110,3,11,'#9c6940');

    // Torso jacket, shoulder shapes and layered scarf.
    ppoly(x,[[37,43],[48,38],[69,38],[83,47],[81,78],[70,85],[45,83],[34,72]],'#243036');
    ppoly(x,[[40,46],[50,42],[67,42],[77,48],[76,75],[68,80],[45,78],[39,69]],'#425650');
    px(x,45,49,27,25,'#536b60');px(x,48,51,21,20,'#60796a');
    px(x,42,57,5,17,'#2f403d');px(x,69,50,5,23,'#344943');
    px(x,49,55,2,15,'#819183');px(x,60,46,2,28,'#2b3835');px(x,63,47,2,27,'#758477');
    // Chest harness.
    ppoly(x,[[43,44],[48,42],[69,76],[64,80]],'#3b281f');
    ppoly(x,[[70,43],[74,46],[52,78],[47,75]],'#412b20');
    px(x,56,61,10,7,'#8c5b35');px(x,58,62,6,5,'#c49256');px(x,59,63,4,3,'#3a2820');
    // Scarf/cowl.
    ppoly(x,[[42,38],[49,34],[70,35],[78,42],[73,50],[48,48]],'#17243a');
    px(x,47,38,27,8,'#263b59');px(x,52,40,19,5,'#345579');px(x,43,44,31,5,'#1c2d47');

    // Arms and gloves.
    ppoly(x,[[35,48],[42,47],[43,68],[37,82],[29,79],[31,61]],'#8f6249');
    px(x,32,52,7,18,'#a97656');px(x,31,68,8,10,'#6f4839');px(x,29,76,10,8,'#2b2524');px(x,30,77,8,3,'#4d4138');
    ppoly(x,[[77,48],[85,45],[91,52],[88,70],[82,79],[76,74]],'#99694d');
    px(x,82,48,6,17,'#b27d59');px(x,81,67,7,10,'#71493a');px(x,79,73,10,7,'#2d2826');px(x,81,74,7,3,'#51443a');
    // Hand gripping the pack strap.
    px(x,84,39,7,9,'#9d6d50');px(x,85,40,5,6,'#c28a63');px(x,87,38,4,3,'#2d2320');

    // Belt, pouches, potion and dagger.
    px(x,39,73,43,6,'#30221c');px(x,42,74,38,3,'#845431');px(x,57,72,10,8,'#b27d43');px(x,59,74,6,4,'#efc36d');px(x,60,75,4,2,'#4c3326');
    px(x,39,78,14,12,'#513224');px(x,41,80,10,8,'#7e5030');px(x,44,80,4,2,'#cf9957');
    px(x,69,78,12,13,'#4a2e23');px(x,71,80,8,8,'#70482e');px(x,73,80,4,2,'#c58d50');
    // Potion: glass outline, red liquid, stopper.
    px(x,33,83,7,12,'#332522');px(x,34,85,5,8,'#7e2728');px(x,35,87,3,6,'#d44b45');px(x,35,83,3,2,'#d8b76b');px(x,36,86,1,4,'#ff9b7d');
    // Dagger sheath.
    px(x,83,77,5,26,'#4a3026');px(x,84,80,3,20,'#b9c2b8');px(x,82,76,9,4,'#c99d58');px(x,85,73,3,5,'#6b452e');px(x,83,101,6,3,'#30231f');

    // Neck and head base.
    px(x,51,34,16,8,'#80543f');px(x,53,33,12,9,'#a66e50');
    ppoly(x,[[45,18],[52,12],[68,12],[75,20],[74,34],[68,42],[53,42],[45,34]],'#392420');
    ppoly(x,[[48,19],[53,15],[67,15],[72,20],[71,33],[66,39],[54,39],[48,33]],'#a66f50');
    px(x,51,20,18,14,'#c18a63');px(x,54,18,13,5,'#d49c72');px(x,51,32,17,5,'#8f5c46');
    px(x,48,24,4,10,'#7f513f');px(x,69,23,4,10,'#76503f');
    // Ear and cheek details.
    px(x,45,25,4,8,'#875640');px(x,46,27,2,4,'#c08762');px(x,69,26,4,7,'#8c5a43');px(x,70,28,2,3,'#c48c66');
    px(x,53,34,5,2,'#d39a71');px(x,65,34,4,2,'#704338');

    // Hair silhouette and individual locks.
    ppoly(x,[[44,21],[46,14],[52,9],[65,8],[73,12],[77,19],[72,22],[68,18],[61,18],[56,21],[50,18]],'#171417');
    px(x,49,10,18,5,'#242025');px(x,53,7,13,4,'#30272a');px(x,45,15,7,10,'#211a1d');px(x,68,12,7,10,'#21191c');
    px(x,51,12,4,5,'#493536');px(x,58,9,4,6,'#433033');px(x,65,10,4,7,'#3b2a2d');px(x,47,18,3,8,'#2a2022');
    // Brows, eyes, nose, beard and scars.
    px(x,52,24,7,2,'#372421');px(x,64,24,6,2,'#372421');
    px(x,54,26,4,2,'#17151a');px(x,65,26,4,2,'#17151a');px(x,55,26,1,1,'#e5d29d');px(x,66,26,1,1,'#e5d29d');
    px(x,61,27,2,6,'#80513e');px(x,60,32,4,2,'#b97858');
    px(x,54,36,14,3,'#3d2826');px(x,57,36,9,1,'#d08a68');
    px(x,50,31,2,4,'#6d3f37');px(x,70,30,2,5,'#56342f');
    px(x,50,38,5,3,'#2e2323');px(x,66,38,4,3,'#302324');px(x,54,40,13,3,'#302425');
    // Thin scar over right cheek.
    px(x,68,27,1,6,'#d9a07c');px(x,69,30,1,5,'#71443a');

    // Tiny seam/specular details that make the sprite read as true 128px art.
    px(x,48,53,1,15,'#91a090');px(x,67,53,1,17,'#293833');px(x,54,76,2,2,'#d7a45f');px(x,70,75,2,2,'#d6a15d');
    px(x,79,24,2,2,'#d8aa6b');px(x,95,48,2,2,'#e0b576');px(x,82,56,2,2,'#d3a36c');px(x,98,82,2,2,'#c89459');
    px(x,51,90,2,2,'#606b69');px(x,72,91,2,2,'#5e6968');px(x,47,104,2,2,'#747e78');px(x,73,104,2,2,'#727b76');

    spriteCache.set('hero128-v2',c);return c;
  }

  function getEnemySprite(kind,color){
    const key=`enemy:${kind}:${color}`;if(spriteCache.has(key))return spriteCache.get(key);
    const c=document.createElement('canvas');c.width=128;c.height=128;const x=c.getContext('2d');x.imageSmoothingEnabled=false;
    if(kind==='rat'){
      px(x,25,66,72,31,'#22201f');px(x,31,59,57,32,color);px(x,70,48,30,27,color);px(x,83,42,12,10,'#b4776b');px(x,95,53,8,7,'#d9a09a');px(x,91,58,3,3,'#f4d66f');
      px(x,39,90,12,17,'#47372d');px(x,70,91,11,17,'#47372d');px(x,98,70,19,4,'#a26d62');px(x,115,67,8,3,'#c08880');
    } else if(kind==='fungus'){
      px(x,43,47,44,56,'#28312a');px(x,51,54,28,48,color);px(x,31,37,67,25,'#4b2d50');px(x,39,30,51,23,color);px(x,54,63,8,5,'#d4e68b');px(x,70,63,8,5,'#d4e68b');px(x,38,79,11,28,'#5f4a3b');px(x,83,80,10,27,'#5f4a3b');
      for(let i=0;i<8;i++)px(x,37+i*7,35+(i%2)*5,4,4,i%2?'#d680b5':'#e0c46f');
    } else if(kind==='warden'){
      px(x,37,31,54,76,'#20262b');px(x,43,34,42,58,color);px(x,47,20,34,25,'#303940');px(x,51,24,26,18,'#7a8f91');px(x,55,30,18,5,'#d04b3f');px(x,28,50,14,42,'#394349');px(x,87,50,14,42,'#394349');px(x,38,94,19,20,'#2b3036');px(x,72,94,19,20,'#2b3036');
      px(x,93,55,20,5,'#b08744');px(x,105,49,5,18,'#d3a952');
    } else if(kind==='colossus'){
      px(x,34,38,60,68,'#302c29');px(x,40,43,48,55,color);px(x,49,19,33,30,'#ded4ba');px(x,55,25,7,7,'#2b2324');px(x,70,25,7,7,'#2b2324');px(x,59,39,14,5,'#6d463e');px(x,22,48,18,49,'#b6a78d');px(x,89,48,18,49,'#b6a78d');px(x,45,98,18,22,'#5f5147');px(x,72,98,18,22,'#5f5147');
      px(x,28,56,8,35,'#e2d9c1');px(x,96,56,8,35,'#e2d9c1');
    } else if(kind==='king'){
      px(x,34,37,61,69,'#17151a');px(x,40,42,49,55,'#4a324f');px(x,48,17,34,31,'#cdbf9f');px(x,53,24,8,7,'#19151a');px(x,70,24,8,7,'#19151a');px(x,59,38,16,5,'#6d2d35');
      ppoly(x,[[48,19],[53,6],[60,15],[66,4],[72,15],[80,7],[83,22]],'#b58a35');px(x,51,18,29,6,'#e2b956');px(x,28,50,15,49,'#5e3b62');px(x,91,49,15,50,'#5e3b62');px(x,43,99,20,22,'#251d2d');px(x,71,99,20,22,'#251d2d');
      px(x,22,68,10,39,'#b88a43');px(x,18,63,18,8,'#e1b95b');
    } else {
      px(x,39,39,52,65,'#33302d');px(x,45,43,40,53,color);px(x,47,21,36,30,'#8b765e');px(x,51,28,8,5,'#d8d58a');px(x,70,28,8,5,'#d8d58a');px(x,58,39,14,4,'#51342f');px(x,29,53,15,42,'#795946');px(x,89,53,15,42,'#795946');px(x,42,98,19,18,'#3d3430');px(x,70,98,19,18,'#3d3430');
    }
    spriteCache.set(key,c);return c;
  }

  function drawHomeHero(){
    const cv=$('#homeHero'),ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,cv.width,cv.height);
    const g=ctx.createLinearGradient(0,0,0,220);g.addColorStop(0,'#1b1319');g.addColorStop(1,'#0d0b0f');ctx.fillStyle=g;ctx.fillRect(0,0,256,220);
    ctx.fillStyle='#3c2c2b';ctx.fillRect(24,24,208,196);ctx.fillStyle='#181218';ctx.fillRect(40,40,176,180);
    ctx.globalAlpha=.18;ctx.fillStyle='#e79640';ctx.beginPath();ctx.arc(187,83,58,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    ctx.drawImage(getHeroSprite(),64,54,128,128);
    ctx.fillStyle='#8b5b2f';ctx.fillRect(34,182,188,5);ctx.fillStyle='#2a1b18';ctx.fillRect(26,187,204,33);
  }

  function startStageLoop(){cancelAnimationFrame(animFrame);const loop=()=>{drawStage();animFrame=requestAnimationFrame(loop);};loop();}
  function drawStage(){
    if(!run)return;const cv=$('#battleCanvas'),ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;const t=getTheme(run.floor);ctx.clearRect(0,0,360,228);
    ctx.fillStyle=t.sky;ctx.fillRect(0,0,360,228);ctx.fillStyle=t.wall;ctx.fillRect(0,30,360,150);
    for(let y=34;y<175;y+=18){for(let x=(y/18)%2?0:-22;x<360;x+=44){ctx.fillStyle=t.brick;ctx.fillRect(x,y,40,14);ctx.fillStyle='#0003';ctx.fillRect(x,y+12,40,2);}}
    ctx.fillStyle='#171318';ctx.fillRect(14,20,26,166);ctx.fillRect(320,20,26,166);ctx.fillStyle=t.brick;ctx.fillRect(18,26,18,153);ctx.fillRect(324,26,18,153);
    ctx.fillStyle='#19151a';ctx.fillRect(0,178,360,50);for(let x=0;x<360;x+=36){ctx.fillStyle=x%72?'#2f2626':'#382b28';ctx.fillRect(x,184,32,12);ctx.fillRect(x+12,202,38,12);}
    if(run.floor<=3){drawTorch(ctx,52,65,t.accent);drawTorch(ctx,306,65,t.accent);} else if(run.floor<=5){drawMushroom(ctx,50,157,t.accent);drawMushroom(ctx,311,154,'#b578c4');} else if(run.floor<=8){drawPipe(ctx,43,46,t.accent);drawPipe(ctx,307,44,'#6bc1c9');} else {drawRune(ctx,51,70,t.accent);drawRune(ctx,309,70,t.accent);}
    ctx.drawImage(getHeroSprite(),39,70,108,108);
    const e=getEnemySprite(run.enemy.kind,run.enemy.color);const es=run.enemy.boss?118:94;ctx.drawImage(e,245-es/2,run.enemy.boss?54:78,es,es);
    if(run.block>0){ctx.fillStyle='#102a31';ctx.fillRect(71,66,46,15);ctx.strokeStyle='#6fc9d8';ctx.strokeRect(71.5,66.5,45,14);ctx.fillStyle='#a9eff1';ctx.font='bold 9px monospace';ctx.fillText(`BLOCK ${Math.ceil(run.block)}`,76,76);}
    const now=performance.now();stageFx=stageFx.filter(f=>now-f.start<520);stageFx.forEach(f=>drawFx(ctx,f,now));
  }
  function drawTorch(ctx,x,y,c){ctx.fillStyle='#4a3328';ctx.fillRect(x-2,y,4,24);ctx.fillStyle=c;ctx.fillRect(x-5,y-8,10,10);ctx.fillStyle='#ffd67b';ctx.fillRect(x-2,y-11,5,10);}
  function drawMushroom(ctx,x,y,c){ctx.fillStyle='#7a684e';ctx.fillRect(x-2,y-14,5,15);ctx.fillStyle=c;ctx.fillRect(x-10,y-20,20,8);ctx.fillRect(x-6,y-24,12,5);}
  function drawPipe(ctx,x,y,c){ctx.fillStyle='#6c5144';ctx.fillRect(x,y,6,88);ctx.fillRect(x,y,25,6);ctx.fillStyle=c;ctx.fillRect(x+17,y-2,8,10);}
  function drawRune(ctx,x,y,c){ctx.strokeStyle=c;ctx.lineWidth=2;ctx.strokeRect(x-8,y-8,16,16);ctx.beginPath();ctx.moveTo(x,y-12);ctx.lineTo(x+10,y+8);ctx.lineTo(x-10,y+8);ctx.closePath();ctx.stroke();}
  function fx(type,x,y){stageFx.push({type,x,y,start:performance.now()});}
  function drawFx(ctx,f,now){const p=(now-f.start)/520;ctx.save();ctx.globalAlpha=1-p;
    if(['hit','shock','dot','thorn'].includes(f.type)){ctx.fillStyle=f.type==='shock'?'#8eeaff':f.type==='dot'?'#7ddc75':'#ffd37b';for(let i=0;i<7;i++){const a=i*.9;ctx.fillRect(f.x+Math.cos(a)*p*24,f.y+Math.sin(a)*p*24,4,4);}}
    if(f.type==='enemyHit'){ctx.fillStyle='#d94c48';for(let i=0;i<6;i++)ctx.fillRect(f.x-rand(4,22)*p,f.y+rand(-15,15)*p,4,4);}
    if(f.type==='heal'){ctx.fillStyle='#7be1a4';ctx.fillRect(f.x-2,f.y-16,4,32);ctx.fillRect(f.x-16,f.y-2,32,4);}if(f.type==='block'){ctx.strokeStyle='#7bd5df';ctx.lineWidth=3;ctx.strokeRect(f.x-16-p*8,f.y-20-p*8,32+p*16,40+p*16);}ctx.restore();}

  function paintItemArt(ctx,w,h,t){
    const p=t.palette, sx=w/48, sy=h/48;
    const R=(x,y,ww,hh,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x*sx),Math.round(y*sy),Math.max(1,Math.round(ww*sx)),Math.max(1,Math.round(hh*sy)));};
    if(t.icon==='knife'||t.icon==='cleaver'||t.icon==='fireSword'){
      R(22,5,6,29,p[1]);R(23,7,4,25,p[2]);R(20,32,10,4,p[3]);R(22,36,6,9,p[0]);R(24,37,2,8,p[1]);if(t.icon==='fireSword'){R(17,8,4,8,p[2]);R(28,12,4,7,p[2]);R(19,4,3,5,p[3]);}
      if(t.icon==='cleaver'){R(16,8,13,23,p[2]);R(15,9,4,18,p[1]);R(19,30,12,4,p[3]);}
    } else if(t.icon==='shield'){
      R(9,7,30,31,p[1]);R(13,10,22,25,p[2]);R(22,8,4,30,p[0]);R(12,20,25,4,p[3]);R(17,14,14,14,p[1]);
    } else if(t.icon==='potion'){
      R(19,8,10,7,p[3]);R(17,15,14,4,p[1]);R(14,19,20,22,p[0]);R(17,22,14,16,p[1]);R(19,24,10,12,p[2]);R(21,20,6,3,p[3]);
    } else if(t.icon==='battery'){
      R(13,8,22,33,p[0]);R(16,11,16,27,p[1]);R(20,6,8,5,p[3]);R(20,18,8,4,p[2]);R(22,14,4,12,p[2]);R(18,32,12,3,p[3]);
    } else if(t.icon==='ration'){
      R(8,19,32,12,p[0]);R(12,16,24,17,p[1]);R(16,18,16,12,p[2]);R(4,21,9,8,p[3]);R(35,21,9,8,p[3]);
    } else if(t.icon==='thorns'){
      R(7,17,34,17,p[1]);R(10,20,28,11,p[2]);for(let xx=10;xx<39;xx+=7){ppoly(ctx,[[xx*sx,17*sy],[(xx+3)*sx,8*sy],[(xx+6)*sx,17*sy]],p[3]);}
    } else if(t.icon==='coil'){
      R(9,10,30,28,p[0]);R(13,13,22,22,p[1]);for(let yy=15;yy<34;yy+=5)R(15,yy,18,2,p[2]);R(20,6,8,7,p[3]);R(20,36,8,6,p[3]);
    } else if(t.icon==='mask'){
      R(11,9,26,30,p[0]);R(14,7,20,30,p[2]);R(17,12,5,7,p[3]);R(27,12,5,7,p[3]);R(20,25,9,4,p[1]);R(18,35,13,5,p[1]);
    }
  }

  function drawItemIcon(cv,item,fit=false){
    const ctx=cv.getContext('2d');
    ctx.imageSmoothingEnabled=false;
    ctx.clearRect(0,0,cv.width,cv.height);
    const t=ITEM_TEMPLATES[item.templateId];
    const baseShape=t.shape;
    const baseW=baseShape[0].length*48;
    const baseH=baseShape.length*48;
    const art=document.createElement('canvas');
    art.width=baseW; art.height=baseH;
    const ax=art.getContext('2d'); ax.imageSmoothingEnabled=false;
    paintItemArt(ax,baseW,baseH,t);

    const turns=((item.rot||0)%4+4)%4;
    const rotatedW=turns%2?baseH:baseW;
    const rotatedH=turns%2?baseW:baseH;
    const pad=fit?6:0;
    const scale=fit?Math.min((cv.width-pad*2)/rotatedW,(cv.height-pad*2)/rotatedH):1;

    ctx.save();
    ctx.translate(cv.width/2,cv.height/2);
    ctx.scale(scale,scale);
    ctx.rotate(turns*Math.PI/2);
    ctx.drawImage(art,-baseW/2,-baseH/2);
    ctx.restore();

    ctx.fillStyle=t.rarity==='epic'?'#b86bd2':t.rarity==='rare'?'#64c4d7':t.rarity==='uncommon'?'#79bf78':'#8c7358';
    ctx.fillRect(2,2,Math.max(3,cv.width*.07),Math.max(3,cv.height*.07));
  }

  function drawSkillIcon(cv,icon,color){const ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,48,48);ctx.fillStyle='#141217';ctx.fillRect(0,0,48,48);ctx.fillStyle=color;
    if(icon==='heart'){px(ctx,11,15,10,9,color);px(ctx,27,15,10,9,color);px(ctx,15,11,8,8,color);px(ctx,25,11,8,8,color);ppoly(ctx,[[11,20],[37,20],[24,38]],color);}
    if(icon==='pack'){px(ctx,12,13,24,26,'#7f5535');px(ctx,16,8,16,7,'#b77e48');px(ctx,16,19,16,13,color);px(ctx,20,22,8,7,'#33241f');}
    if(icon==='gem'){ppoly(ctx,[[24,7],[38,18],[31,38],[17,38],[10,18]],color);ppoly(ctx,[[10,18],[24,13],[38,18],[24,34]],'#8fe0c5');}
  }

  $('#startRunBtn').addEventListener('click',newRun);
  $('#openSkillsBtn').addEventListener('click',()=>showScreen('skills'));
  $$('[data-back-home]').forEach(b=>b.addEventListener('click',()=>showScreen('home')));
  $('#rotateBtn').addEventListener('click',rotateSelected);
  $('#discardBtn').addEventListener('click',discardSelected);
  $('#battleBtn').addEventListener('click',startCombat);
  window.addEventListener('resize',()=>{if(run&&SCREENS.game.classList.contains('active'))renderBackpack();});

  renderHome();
})();
