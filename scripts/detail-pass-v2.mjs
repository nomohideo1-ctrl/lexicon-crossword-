import fs from 'node:fs';

const path='game.js';
let src=fs.readFileSync(path,'utf8');

function replaceFunction(name, body){
  const start=src.indexOf(`  function ${name}(`);
  if(start<0) throw new Error(`Missing function: ${name}`);
  const next=src.indexOf('\n  function ', start+12);
  const end=next<0?src.indexOf('\n\n  handleOffline();',start):next;
  if(end<0) throw new Error(`Cannot find end for: ${name}`);
  src=src.slice(0,start)+body.trimEnd()+src.slice(end);
}

replaceFunction('drawGround', String.raw`  function drawGround(t){
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
  }`);

replaceFunction('drawRiver', String.raw`  function drawRiver(t){
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
  }`);

replaceFunction('drawRuins', String.raw`  function drawRuins(t){
    const stone=mix('#191820','#6c655d',t.daylight),hi=mix('#292632','#948a78',t.daylight),moss=mix('#1a281d','#587044',t.daylight);
    ctx.fillStyle=stone;ctx.fillRect(30,290,9,70);ctx.fillRect(79,278,9,77);ctx.fillRect(28,287,62,8);ctx.fillRect(43,316,31,7);
    ctx.fillStyle=hi;ctx.fillRect(32,292,2,55);ctx.fillRect(81,281,2,52);ctx.fillRect(32,289,54,2);ctx.fillRect(47,318,23,2);
    // Cracks and chipped blocks.
    ctx.fillStyle='#272329';ctx.fillRect(35,307,3,1);ctx.fillRect(37,308,1,5);ctx.fillRect(83,300,3,1);ctx.fillRect(82,301,1,6);ctx.fillRect(51,320,1,4);ctx.fillRect(62,289,1,5);
    ctx.fillStyle=moss;ctx.fillRect(29,286,12,2);ctx.fillRect(78,277,10,2);ctx.fillRect(44,314,9,2);ctx.fillRect(36,295,2,4);ctx.fillRect(84,286,2,5);
    ctx.fillStyle='#92826a';for(let i=0;i<5;i++)ctx.fillRect(34+i*11,350+(i%2)*3,6,3);
  }`);

replaceFunction('drawMine', String.raw`  function drawMine(t){
    const rock=mix('#0b0d12','#24282a',t.daylight),rock2=mix('#151820','#3b4242',t.daylight);
    ctx.fillStyle=rock;poly([[295,354],[324,287],[365,353]],ctx.fillStyle);
    ctx.fillStyle=rock2;poly([[306,335],[324,294],[340,333]],ctx.fillStyle);ctx.fillRect(343,330,10,18);
    ctx.fillStyle='#07090c';ctx.fillRect(317,316,26,39);ctx.fillStyle='#101315';ctx.fillRect(321,320,18,35);
    ctx.fillStyle='#73583a';ctx.fillRect(314,312,32,5);ctx.fillRect(314,312,5,44);ctx.fillRect(341,312,5,44);
    ctx.fillStyle='#a27a4d';ctx.fillRect(315,313,30,1);ctx.fillRect(315,320,4,2);ctx.fillRect(342,329,4,2);
    // Ore glints and loose rubble.
    ctx.fillStyle='#6d8584';ctx.fillRect(302,329,2,2);ctx.fillRect(350,337,2,2);ctx.fillStyle='#b88a54';ctx.fillRect(306,344,2,1);ctx.fillRect(357,348,2,1);
    ctx.fillStyle='#353838';for(let i=0;i<9;i++){const x=294+i*8,y=351+(i%3);ctx.fillRect(x,y,5,3);}
  }`);

replaceFunction('drawHouse', String.raw`  function drawHouse(t){
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
  }`);

replaceFunction('drawGarden', String.raw`  function drawGarden(t){
    ctx.fillStyle='#4a3424';ctx.fillRect(120,443,64,39);ctx.fillStyle='#67472c';ctx.fillRect(122,445,60,35);
    for(let y=451;y<478;y+=9){ctx.fillStyle='#33261d';ctx.fillRect(124,y,56,5);ctx.fillStyle='#7b5938';ctx.fillRect(125,y,55,1);for(let x=128;x<179;x+=12){ctx.fillStyle='#397b45';ctx.fillRect(x,y-7,2,7);ctx.fillStyle='#69b55f';ctx.fillRect(x-3,y-6,3,2);ctx.fillRect(x+2,y-5,3,2);ctx.fillStyle='#a7cf72';ctx.fillRect(x,y-8,1,1);}}
    // Fence posts, rails and watering can.
    ctx.fillStyle='#8a6b43';ctx.fillRect(119,441,3,43);ctx.fillRect(182,441,3,43);ctx.fillRect(120,443,64,2);ctx.fillRect(120,480,64,2);ctx.fillStyle='#b08a58';for(let x=121;x<=183;x+=15)ctx.fillRect(x,441,1,40);
    ctx.fillStyle='#6f8074';ctx.fillRect(166,466,8,6);ctx.fillRect(173,468,5,2);ctx.fillRect(164,464,3,3);ctx.fillStyle='#aab8a6';ctx.fillRect(168,466,3,1);
  }`);

replaceFunction('drawCampfire', String.raw`  function drawCampfire(t){
    const x=126,y=423;
    ctx.fillStyle='#2e241d';for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.fillRect(Math.round(x+Math.cos(a)*10)-2,Math.round(y+8+Math.sin(a)*4)-1,4,3);}
    ctx.fillStyle='#4a2f1f';ctx.fillRect(x-11,y+7,23,4);ctx.fillStyle='#704225';ctx.fillRect(x-8,y+10,17,3);ctx.fillStyle='#a34d2b';ctx.fillRect(x-6,y-2,13,14);ctx.fillStyle='#ef7b35';ctx.fillRect(x-4,y-6,9,15);ctx.fillStyle='#ffb54d';ctx.fillRect(x-2,y-8,5,13);ctx.fillStyle='#ffe18a';ctx.fillRect(x,y-7,2,8);
    if(t.daylight<.4){ctx.globalAlpha=.11;ctx.fillStyle='#ffb24f';ctx.beginPath();ctx.arc(x,y,43,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  }`);

replaceFunction('drawBridge', String.raw`  function drawBridge(t){
    ctx.fillStyle='#38291f';ctx.fillRect(201,473,84,3);ctx.fillRect(203,509,82,3);
    for(let i=0;i<9;i++){const x=201+i*10,y=478+i*3;ctx.fillStyle=i%2?'#765338':'#855f3d';ctx.fillRect(x,y,12,7);ctx.fillStyle='#a77a4e';ctx.fillRect(x+1,y+1,9,1);ctx.fillStyle='#3e2b21';ctx.fillRect(x+9,y+2,2,4);}
    ctx.fillStyle='#b69061';for(let i=0;i<7;i++){ctx.fillRect(205+i*12,475+i*3,2,2);ctx.fillRect(211+i*12,478+i*3,1,1);}
  }`);

replaceFunction('drawWorkshop', String.raw`  function drawWorkshop(t){
    ctx.fillStyle='#36271f';ctx.fillRect(143,367,61,44);ctx.fillStyle='#5c3b28';ctx.fillRect(147,366,55,42);ctx.fillStyle='#845332';ctx.fillRect(152,372,45,36);
    ctx.fillStyle='#5f3b28';for(let y=376;y<407;y+=7)ctx.fillRect(153,y,43,1);
    ctx.fillStyle='#25201f';poly([[140,369],[173,344],[207,369]],ctx.fillStyle);ctx.fillStyle='#a3683b';poly([[147,366],[174,349],[201,366]],ctx.fillStyle);
    ctx.fillStyle='#c9844c';ctx.fillRect(165,355,18,2);ctx.fillRect(155,361,15,2);ctx.fillRect(182,361,12,2);
    ctx.fillStyle='#1d1918';ctx.fillRect(180,378,12,30);ctx.fillStyle='#4b3024';ctx.fillRect(183,381,6,27);ctx.fillStyle='#c59b5e';ctx.fillRect(187,392,2,2);
    // Anvil, forge and orange glow.
    ctx.fillStyle='#4b5150';ctx.fillRect(153,385,21,7);ctx.fillStyle='#7c8380';ctx.fillRect(155,383,16,3);ctx.fillStyle='#383b3a';ctx.fillRect(160,392,7,8);ctx.fillStyle='#222020';ctx.fillRect(193,388,8,17);ctx.fillStyle='#a44f2d';ctx.fillRect(194,391,6,8);ctx.fillStyle='#f09a4c';ctx.fillRect(196,393,3,5);ctx.fillStyle='#ffd276';ctx.fillRect(197,394,1,3);
    ctx.fillStyle='#8c6543';ctx.fillRect(148,405,50,3);
  }`);

replaceFunction('drawTower', String.raw`  function drawTower(t){
    ctx.fillStyle='#3e393b';ctx.fillRect(14,215,32,89);ctx.fillStyle='#68605d';ctx.fillRect(18,218,24,84);ctx.fillStyle='#827974';ctx.fillRect(20,220,3,78);
    // Masonry blocks.
    ctx.fillStyle='#514b4b';for(let y=225;y<300;y+=10){for(let x=23+(y%20?0:8);x<41;x+=13)ctx.fillRect(x,y,8,2);}
    ctx.fillStyle='#29252c';poly([[10,220],[30,192],[50,220]],ctx.fillStyle);ctx.fillStyle='#544452';poly([[15,216],[30,198],[45,216]],ctx.fillStyle);ctx.fillStyle='#756071';ctx.fillRect(24,202,12,2);
    ctx.fillStyle='#2b272c';ctx.fillRect(24,230,12,13);ctx.fillStyle='#15151a';ctx.fillRect(27,233,6,10);
    if(t.daylight<.5){ctx.fillStyle='#ffd16c';ctx.fillRect(27,234,6,7);ctx.fillStyle='#fff0a4';ctx.fillRect(29,235,2,4);}
    ctx.fillStyle='#302b2d';ctx.fillRect(20,272,20,3);ctx.fillRect(23,286,14,3);
  }`);

replaceFunction('drawTree', String.raw`  function drawTree(x,y,s,day){
    const trunk='#59402b',trunkHi='#8a6040',leaf1=mix('#0b1a14','#2f5733',day),leaf2=mix('#10231a','#447044',day),leaf3=mix('#1a3020','#5f8550',day);
    // trunk with bark and exposed root pixels.
    ctx.fillStyle='#3d2d21';ctx.fillRect(Math.round(x-4*s),Math.round(y-29*s),Math.round(8*s),Math.round(31*s));ctx.fillStyle=trunk;ctx.fillRect(Math.round(x-3*s),Math.round(y-28*s),Math.round(6*s),Math.round(29*s));ctx.fillStyle=trunkHi;ctx.fillRect(Math.round(x-2*s),Math.round(y-26*s),Math.max(1,Math.round(s)),Math.round(15*s));ctx.fillStyle='#38271d';ctx.fillRect(Math.round(x+1*s),Math.round(y-18*s),Math.max(1,Math.round(s)),Math.round(11*s));ctx.fillRect(Math.round(x-8*s),Math.round(y),Math.round(7*s),Math.max(2,Math.round(2*s)));ctx.fillRect(Math.round(x+2*s),Math.round(y),Math.round(8*s),Math.max(2,Math.round(2*s)));
    // Four layered foliage masses with cut-in shadow pixels.
    ctx.fillStyle=leaf1;poly([[x-24*s,y-22*s],[x,y-66*s],[x+24*s,y-22*s]],ctx.fillStyle);poly([[x-20*s,y-39*s],[x,y-78*s],[x+20*s,y-39*s]],ctx.fillStyle);
    ctx.fillStyle=leaf2;poly([[x-18*s,y-26*s],[x-2*s,y-58*s],[x+17*s,y-28*s]],ctx.fillStyle);poly([[x-14*s,y-44*s],[x+1*s,y-75*s],[x+15*s,y-45*s]],ctx.fillStyle);
    ctx.fillStyle=leaf3;ctx.fillRect(Math.round(x-9*s),Math.round(y-49*s),Math.round(7*s),Math.max(2,Math.round(3*s)));ctx.fillRect(Math.round(x+3*s),Math.round(y-58*s),Math.round(6*s),Math.max(2,Math.round(3*s)));ctx.fillRect(Math.round(x-4*s),Math.round(y-68*s),Math.round(5*s),Math.max(2,Math.round(2*s)));
    ctx.fillStyle=leaf1;ctx.fillRect(Math.round(x-13*s),Math.round(y-36*s),Math.round(4*s),Math.max(2,Math.round(2*s)));ctx.fillRect(Math.round(x+11*s),Math.round(y-32*s),Math.round(4*s),Math.max(2,Math.round(2*s)));
  }`);

replaceFunction('drawHero', String.raw`  function drawHero(x,y,flip,step,mode){
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
  }`);

replaceFunction('drawDog', String.raw`  function drawDog(x,y){
    ctx.save();ctx.translate(Math.round(x),Math.round(y));
    ctx.fillStyle='#261e1a';ctx.fillRect(-6,-5,12,8);ctx.fillRect(4,-9,7,7);ctx.fillStyle='#9d7148';ctx.fillRect(-5,-4,10,6);ctx.fillStyle='#c28d59';ctx.fillRect(-2,-4,5,3);ctx.fillRect(5,-8,5,5);ctx.fillStyle='#e0b57a';ctx.fillRect(6,-7,2,2);ctx.fillStyle='#3a281f';ctx.fillRect(5,-10,2,4);ctx.fillRect(9,-9,2,3);ctx.fillStyle='#151313';ctx.fillRect(9,-6,2,2);ctx.fillRect(7,-7,1,1);
    ctx.fillStyle='#704c34';ctx.fillRect(-5,2,2,5);ctx.fillRect(3,2,2,5);ctx.fillStyle='#2d211d';ctx.fillRect(-6,6,3,1);ctx.fillRect(3,6,3,1);ctx.fillStyle='#8e6746';ctx.fillRect(-8,-4,3,2);ctx.fillRect(-9,-6,2,3);
    ctx.restore();
  }`);

fs.writeFileSync(path,src);
console.log('Applied PIXEL LIFE detail pass v2');
