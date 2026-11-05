// A reproducible scene inventory from the actual level definitions, not a second
// gameplay implementation. Solved arrangements are editor references only.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'../..'),ctx=vm.createContext({});
for(const file of ['mersenne-twister','levels'])vm.runInContext(fs.readFileSync(path.join(root,'app/src/main/assets/jspp',file+'.js'),'utf8'),ctx);
const layouts=[];
for(const mode of ['puzzle','repair','fork'])for(let i=0;i<ctx.PipeLevels.count(mode);i++){
 const level=ctx.PipeLevels.get(mode,i),tiles={...level.tiles};
 level.targets.forEach((key,n)=>tiles[key]=level.queue[n]);
 layouts.push({name:mode+'_'+String(i+1).padStart(2,'0'),...level,tiles});
}
const day=ctx.PipeLevels.dayNumber(Date.parse('2026-11-04T12:00:00Z')),daily=ctx.PipeLevels.get('daily',day);
const tiles={...daily.tiles};daily.targets.forEach((key,n)=>tiles[key]=daily.queue[n]);
layouts.push({name:'daily_2026_11_04',...daily,tiles});
layouts.push({name:'classic_11x11',width:11,height:11,walls:[],tiles:Object.fromEntries(Array.from({length:11},(_,x)=>[x+',5',x===0?1:x===10?0:11]))});
fs.writeFileSync(path.join(root,'art/fidelity/layouts.json'),JSON.stringify(layouts,null,2));
console.log('22 editor layouts exported');
