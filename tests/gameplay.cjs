// Run with node --test tests/gameplay.cjs. Use actual queue/board operations with a small DOM stand-in.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assets = path.join(__dirname, '../app/src/main/assets/jspp');
function loadGame() {
    const nodes = new Map(), store = new Map(), intervals = new Set();
    let sequence = 0;
    const node = () => ({
        style:{}, offsetHeight:30, offsetWidth:30, offsetTop:100, offsetLeft:50,
        textContent:'', appendChild(child){child.parentNode=this;},
        removeChild(child){child.parentNode=null;}
    });
    const document = {
        documentElement:{}, body:node(), createElement:node, createTextNode:()=>node(),
        querySelectorAll:()=>[], getElementById(id) {
            if (!nodes.has(id)) nodes.set(id,node());
            return nodes.get(id);
        }
    };
    const game = vm.createContext({document, console, Image:function(){},
        setInterval(){intervals.add(++sequence);return sequence;}, clearInterval(id){intervals.delete(id);},
        setTimeout(){return ++sequence;},
        localStorage:{setItem:(key,val)=>store.set(key,String(val)), getItem:key=>store.get(key)??null}
    });
    game.window=game;
    for (const js of ['mersenne-twister.js','jspp.js','game-text.js','levels.js'])
        vm.runInContext(fs.readFileSync(path.join(assets,js),'utf8'),game,{filename:js});
    return {game, document, intervals};
}
test('unlimited survives zero, then a timed round automatically fills at zero', () => {
    const {game:g}=loadGame();
    g.ppreset(2,-1);
    for(let i=0;i<241;i++) g.ppdecgametimer();
    assert.equal(g.ppgametimer,-1);
    assert.equal(g.ppGameState,g.ppGamestateEnum.BUILDING);
    g.ppreset(2,0);
    for(let i=0;i<240;i++) g.ppdecgametimer();
    assert.equal(g.ppgametimer,0);
    assert.equal(g.ppGameState,g.ppGamestateEnum.CLEARINGDEAD);
});
test('pause blocks both placement and manual fill; repeated resume leaves one clock', () => {
    const {game:g,intervals}=loadGame();
    g.ppreset(2,0);
    g.pauseGame();
    g.ppprocessboardclick('board0809');
    g.ppfillpipesnow();
    assert.equal(g.ppscore,0);
    assert.equal(g.ppGameState,g.ppGamestateEnum.BUILDING);
    assert.equal(intervals.size,0);
    g.resumeGame(); g.resumeGame();
    assert.equal(intervals.size,1);
    g.ppprocessboardclick('board0809');
    assert.equal(g.ppscore,10);
    assert.equal(intervals.size,1);
});
test('loading and lost 3D context freeze time and gameplay until rendering returns', () => {
    const {game:g,intervals}=loadGame();
    g.ppreset(2,0);
    const clock=g.ppgametimer, tick=g.ppGameTick;
    let ready=false;
    g.PumpBoard={active:()=>ready,refresh(){}};
    for(let i=0;i<100;i++) g.ppExecGameTick();
    g.ppprocessboardclick('board0809');
    assert.equal(g.ppgametimer,clock);
    assert.equal(g.ppGameTick,tick);
    assert.equal(g.ppscore,0);
    ready=true;
    const ticksPerSecond=vm.runInContext('Math.round(1000/ppGameTimerTickMS)',g);
    for(let i=0;i<ticksPerSecond;i++) g.ppExecGameTick();
    assert.equal(g.ppgametimer,clock-1);
    ready=false;
    for(let i=0;i<100;i++) g.ppExecGameTick();
    assert.equal(g.ppgametimer,clock-1);
    assert.equal(intervals.size,1);
});
test('same challenge repeats its queue; completed flood stores best by challenge and reset updates it immediately', () => {
    const {game:g,document,intervals}=loadGame();
    g.ppreset(2,-1);
    const queue=Array.from(g.pppreviewarray);
    g.ppreset(2,0);
    assert.deepEqual(Array.from(g.pppreviewarray),queue);
    g.ppprocessboardclick('board0809');
    g.ppfillpipesnow();
    for(let i=0;i<50 && g.ppGameState!==g.ppGamestateEnum.DONE;i++) g.ppExecGameTick();
    assert.equal(g.ppGameState,g.ppGamestateEnum.DONE);
    assert.equal(intervals.size,0);
    assert.match(document.getElementById('gameStatus').textContent,/before the outlet/);
    assert.equal(+g.ppGetHighscore(2),g.ppscore);
    assert.equal(g.ppGetHighscore(3),0);
    assert.equal(+document.getElementById('hscore').textContent,g.ppscore);
    g.resetHighscore();
    assert.equal(+g.ppGetHighscore(2),0);
    assert.equal(document.getElementById('hscore').textContent,'0');
});
test('a real sequence of placed straight pipes reaches the outlet in challenge 2', () => {
    const {game:g,document}=loadGame();
    g.ppreset(2,0);
    assert.equal(g.ppboardarray[8][0],1);
    assert.equal(g.ppboardarray[8][10],0);
    const moves=[];
    let column=9;
    for(let i=0; i<105 && column>=1; i++) {
        const straight=g.pppreviewarray[0]===11;
        const move=straight ? [8,column--] : [0,5];
        moves.push(move);
        g.ppprocessboardclick(g.findBoardElId(...move));
    }
    assert.equal(column,0);
    if (process.env.PIPEPANIC_PRINT_MOVES) console.log('MOVES '+JSON.stringify(moves));
    g.ppfillpipesnow();
    for(let i=0;i<50 && g.ppGameState!==g.ppGamestateEnum.DONE;i++) g.ppExecGameTick();
    assert.equal(g.ppReachedOutlet,true);
    assert.equal(document.getElementById('gameStatus').textContent,'Water reached the outlet!');
});
test('classic hints use the real queue to connect same-row and offset outlets', () => {
    const {game:g}=loadGame();
    const offsets = new Set();
    let parked = 0;
    for (const seed of [1,2,3,4,5,6,7,8]) {
        g.ppreset(seed,-1);
        const board = g.ppboardarray.slice().reverse();
        offsets.add(Math.sign(board.findIndex(row=>row[10]===0)-board.findIndex(row=>row[0]===1)));
        let hint;
        for (let i=0;i<180;i++) {
            hint=g.PipeLevels.classicHint(board,g.pppreviewarray[0],g.ppnullpipeval);
            if (hint.message==='hintReady') break;
            const [col,row]=hint.cell;
            assert.ok(board[row][col]>1);
            if (hint.message==='hintPark') parked++;
            g.ppprocessboardclick(g.findBoardElId(10-row,col));
        }
        assert.equal(hint.message,'hintReady','challenge '+seed);
        g.ppfillpipesnow();
        for(let i=0;i<50 && g.ppGameState!==g.ppGamestateEnum.DONE;i++) g.ppExecGameTick();
        assert.equal(g.ppReachedOutlet,true,'challenge '+seed);
    }
    assert.equal(offsets.size,3);
    assert.ok(parked>0);
});

