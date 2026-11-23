const COLS=40,ROWS=40,TILE=16;
const TERRAIN={
0:{cost:0,color:"#e6d3a5",name:"Jalanan"},
1:{cost:1,color:"#9b7653",name:"Tanah"},
2:{cost:2,color:"#3f7138",name:"Rumput panjang"},
3:{cost:3,color:"#6a4a2a",name:"Lumpur"},
4:{cost:5,color:"#2f82c2",name:"Sungai"},
5:{cost:Infinity,color:"#707a82",name:"Batu"},
6:{cost:Infinity,color:"#8b4146",name:"Bangunan kecil"}
};

function makeStaticMap(){
const rows=[
"2210122222222222222002344432222211110112",
"2220222222222222222002344432222221110112",
"2220222222222225222003444332222222110112",
"2120222222222211112000000313222222300111",
"0000000000000000000000000000000000000000",
"2110111112211111222033444222222222210111",
"2220121111211111226000443111222222210211",
"2220222111221111226000031111222222110222",
"2220111122222151126000311112222222116662",
"2220111122222111113004311112222222116662",
"2220111112221111134003111112222222216662",
"2220111111221111344001111111122222210666",
"1110112221111113444001151111121122210666",
"1220222266611134443011111111221211110666",
"2220222266611134433001112211222212110112",
"2220222266611344432001522222222222110111",
"2220222222113444312011122222222222220111",
"0000000000000000000000000000000000000000",
"2220222222113444322002226662222222220111",
"2220222221113444322022226662222222210111",
"2220222111111344432022226662222222110511",
"2220222111111334443002222222211111110111",
"1220222111111134443002222222312112220111",
"1220221122111113444002222222212222220111",
"2220111122111111346603112211122222510111",
"1110111152111111136604322111222222220112",
"1110011122222111114004431111222222220222",
"1120266622222111113004444311222222220222",
"1220266622222151121004444433122222220222",
"2220266612222111221003444444322222220222",
"2226622000111111122003344444432222220222",
"0006600000000000000000000000000000000000",
"2120252122222211111001134444433222220111",
"2220252222222211112002234444431122210111",
"2220222222222111512001134444431222666611",
"3220222222221111112001134444332222666611",
"2220222222666122222001113444432222666622",
"2220222222666222222022113344443222220222",
"2220222222666222222022211344444322220222",
"2220222212222222222022222334444433220222"
];
return rows.map(row=>[...row].map(Number));
}
const grid=makeStaticMap();

function isWalkable(x,y){return x>=0&&x<COLS&&y>=0&&y<ROWS&&TERRAIN[grid[y][x]].cost!==Infinity}
function key(p){return p.x+","+p.y}
function terrainCostAt(x,y){return TERRAIN[grid[y][x]].cost}
function pathStepCost(x,y){return 1+terrainCostAt(x,y)}

function heuristic(a,b,type){
const dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y);
if(type==="ucs")return 0;
if(type==="manhattan")return dx+dy;
return Math.sqrt(dx*dx+dy*dy);
}

function searchPath(start,goal,type){
const open=new Map(),closed=new Set(),explored=[];
const s={x:start.x,y:start.y,g:0,h:heuristic(start,goal,type),parent:null};s.f=s.g+s.h;open.set(key(s),s);
let expanded=0;
while(open.size){
let cur=null,curKey=null;
for(const [k,n] of open)if(!cur||n.f<cur.f||(n.f===cur.f&&n.h<cur.h)){cur=n;curKey=k}
open.delete(curKey);if(closed.has(curKey))continue;
closed.add(curKey);expanded++;explored.push({x:cur.x,y:cur.y});
if(cur.x===goal.x&&cur.y===goal.y){
const path=[];let n=cur;while(n){path.unshift({x:n.x,y:n.y});n=n.parent}
return {path,explored,nodesExpanded:expanded,found:true};
}
const ns=[{x:cur.x+1,y:cur.y},{x:cur.x-1,y:cur.y},{x:cur.x,y:cur.y+1},{x:cur.x,y:cur.y-1}];
for(const nb of ns){
if(!isWalkable(nb.x,nb.y))continue;
const nk=key(nb);if(closed.has(nk))continue;
const g=cur.g+pathStepCost(nb.x,nb.y),old=open.get(nk);
if(!old||g<old.g){const h=heuristic(nb,goal,type);open.set(nk,{x:nb.x,y:nb.y,g,h,f:g+h,parent:cur})}
}
if(expanded>6000)break;
}
return {path:[],explored,nodesExpanded:expanded,found:false};
}
