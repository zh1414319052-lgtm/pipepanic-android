const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assets = path.join(__dirname,'../app/src/main/assets/jspp');
function load(files, sandbox) {
    const context = vm.createContext(sandbox || {});
    for (const file of files) vm.runInContext(fs.readFileSync(path.join(assets,file+'.js'),'utf8'),context,{filename:file});
    return context;
}
const {PipeLevels:levels} = load(['mersenne-twister','levels']);
function solve(level) {
    const tiles = {...level.tiles};
    level.targets.forEach((key,i) => {
        assert.equal(levels.canPlace(level,tiles,key,i),true);
        tiles[key] = level.queue[i];
    });
    return tiles;
}
test('all 20 handcrafted boards have legal, sealed solutions', () => {
    assert.equal(levels.count('puzzle'),12);
    for (const mode of ['puzzle','repair','fork']) {
        if (mode !== 'puzzle') assert.equal(levels.count(mode),4);
        for (let index=0; index<levels.count(mode); index++) {
            const level=levels.get(mode,index);
            assert.equal(levels.flood(level,solve(level)).won,true,mode+' '+(index+1));
            assert.equal(levels.canPlace(level,level.tiles,level.inlet,0),false);
            for (const wall of level.walls) assert.equal(levels.canPlace(level,level.tiles,wall,0),false);
        }
    }
});
test('placement hints complete finite queues and recover after undoing an off-route move', () => {
    const cases = ['puzzle','repair','fork'].flatMap(mode =>
        Array.from({length:levels.count(mode)}, (_,i) => levels.get(mode,i)));
    cases.push(levels.get('daily',20762));
    for (const level of cases) {
        const tiles = {...level.tiles};
        level.queue.forEach((pipe,i) => {
            const hint = levels.placementHint(level,tiles,i);
            assert.equal(hint.message,'hintPlace');
            const key = hint.cell.join(',');
            assert.equal(levels.canPlace(level,tiles,key,i),true);
            tiles[key] = pipe;
        });
        assert.equal(levels.placementHint(level,tiles,level.queue.length).message,'hintReady');
        assert.equal(levels.flood(level,tiles).won,true);
    }
    const level = levels.get('puzzle',0);
    // The first two pieces are identical. Either target remains valid as the first move.
    const second = level.targets[1];
    const swapped = {...level.tiles,[second]:level.queue[0]};
    assert.equal(levels.placementHint(level,swapped,1).cell.join(','),level.targets[0]);
    const misplaced = {...level.tiles,'1,0':level.queue[0]};
    assert.equal(levels.placementHint(level,misplaced,1).message,'hintUndo');
    delete misplaced['1,0'];
    assert.equal(levels.placementHint(level,misplaced,0).message,'hintPlace');
});
test('repair cannot spend a replacement on an unrelated cell or the same fault twice', () => {
    const level=levels.get('repair',0);
    const tiles={...level.tiles};
    assert.equal(levels.canPlace(level,tiles,'1,2',0),false);
    assert.equal(levels.canPlace(level,tiles,'1,1',0),false);
    const key=level.targets[0];
    assert.equal(levels.canPlace(level,tiles,key,0),true);
    tiles[key]=level.queue[0];
    assert.equal(levels.canPlace(level,tiles,key,1),false);
});
test('a wet outlet is insufficient if the second branch leaks', () => {
    const level=levels.get('fork',0);
    const tiles=solve(level);
    delete tiles['2,1'];
    const result=levels.flood(level,tiles);
    assert.equal(result.outlets,1);
    assert.equal(result.won,false);
    assert.equal(result.leaks['2,2'],true);
});
test('daily boards change at Beijing midnight and retain legal finite queues', () => {
    const before=levels.dayNumber(Date.parse('2026-11-04T15:59:59.999Z'));
    const after=levels.dayNumber(Date.parse('2026-11-04T16:00:00Z'));
    assert.equal(after,before+1);
    assert.equal(levels.dateLabel(before),'2026-11-04');
    assert.equal(levels.dateLabel(after),'2026-11-05');
    assert.notDeepEqual(levels.get('daily',before).tiles,levels.get('daily',after).tiles);
    for (let day=before; day<before+90; day++) {
        const level=levels.get('daily',day);
        assert.deepEqual(level.queue,levels.get('daily',day).queue);
        assert.equal(levels.flood(level,solve(level)).won,true);
    }
});

function makeUi(savedMap) {
    const nodes=new Map();
    let now=0;
    function node() {
        return {style:{}, children:[], hidden:false, className:'', clientWidth:360,
            set textContent(value) { this.text=value; this.children=[]; },
            get textContent() { return this.text || ''; },
            appendChild(child) { this.children.push(child); },
            setAttribute(){}, removeAttribute(){}, getBoundingClientRect(){return {top:250};} };
    }
    const document={createElement:node,querySelectorAll(){return [];},
        getElementById(id) {
            if (!nodes.has(id)) nodes.set(id,node());
            return nodes.get(id);
        }};
    const board=document.getElementById('board');
    for(let y=0; y<11; y++) {
        const row=node();
        for(let x=0; x<11; x++) row.appendChild(document.getElementById(
            'board'+String(10-y).padStart(2,'0')+String(x).padStart(2,'0')));
        board.appendChild(row);
    }
    const sandbox={document, console, Image:function(){},
        setInterval(){return 1;},clearInterval(){},setTimeout(){},innerWidth:360,innerHeight:790,
        performance:{now:()=>now}, scrollTo(){},
        localStorage:{getItem:k=>savedMap.get(k)??null,setItem:(k,v)=>savedMap.set(k,v)}};
    sandbox.window=sandbox;
    const game=load(['mersenne-twister','jspp','game-text','levels','level-play'],sandbox);
    game.ppreset(2,0);
    return {game, get:document.getElementById, step(ms){now+=ms;}};
}
test('undo restores the finite queue, switching to classic keeps the draft, and cold resume restores it', () => {
    const saved=new Map();
    const {game:g,get}=makeUi(saved);
    g.levelMode.openPicker();
    get('levelList').children[0].onclick();
    g.ppprocessboardclick('board0903');
    assert.match(get('levelRemaining').textContent,/1$/);
    g.levelMode.undo();
    assert.match(get('levelRemaining').textContent,/2$/);
    g.ppprocessboardclick('board0903');
    g.ppreset(2,0);
    assert.equal(get('classicStats').hidden,false);
    const fresh=makeUi(saved);
    fresh.game.levelMode.openPicker();
    fresh.game.levelMode.restore();
    assert.match(fresh.get('levelRemaining').textContent,/1$/);
    assert.equal(fresh.get('board0903').pumpPipe.id,11);
    assert.equal(fresh.get('board0903').pumpPipe.filled,false);
    fresh.game.ppprocessboardclick('board0901');
    fresh.game.ppfillpipesnow();
    for(let i=0;i<6;i++) fresh.game.ppExecGameTick();
    assert.match(fresh.get('gameStatus').textContent,/Level complete/);
    assert.equal(JSON.parse(saved.get('pipepanic.levels.v1')).completed['puzzle-0'],true);
});
test('daily clock pauses with the app and records the time before the water animation', () => {
    const saved=new Map();
    const {game:g,get,step}=makeUi(saved);
    g.levelMode.openPicker();
    get('levelTabs').children[3].onclick();
    get('levelList').children[0].onclick();
    step(2000);
    g.pauseGame();
    step(5000);
    g.resumeGame();
    const current=JSON.parse(saved.get('pipepanic.levels.v1')).round;
    const level=levels.get('daily',current.index);
    level.targets.forEach(k => {
        const [x,y]=k.split(',').map(Number);
        g.levelMode.press(10-y,x);
    });
    g.ppfillpipesnow();
    step(3000);
    for(let i=0;i<30;i++) g.ppExecGameTick();
    assert.equal(JSON.parse(saved.get('pipepanic.levels.v1')).best[current.index],2);
});

