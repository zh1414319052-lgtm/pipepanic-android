// Real-time presentation for the existing PipePanic board. GPL-2.0-or-later.
var PumpProjection = (function () {
    function dot(a,b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
    var toward=[0,0,1], right=[1,0,0], up=[0,1,0];

    function frame(width,height) {
        return {center:[0,0],half:[width/2+.34,height/2+.30],width:width,height:height};
    }

    function cell(view,col,row,z) {
        return [col-(view.width-1)/2,(view.height-1)/2-row,z];
    }

    function project(view,point) {
        return [.5+.5*(dot(point,right)-view.center[0])/view.half[0],
                .5-.5*(dot(point,up)-view.center[1])/view.half[1]];
    }

    function pick(view,u,v) {
        var sx=(2*u-1)*view.half[0]+view.center[0];
        var sy=(1-2*v)*view.half[1]+view.center[1];
        var col=Math.floor(sx+view.width/2);
        var row=Math.floor(view.height/2-sy);
        return col>=0 && col<view.width && row>=0 && row<view.height ? [col,row] : null;
    }

    return {frame:frame, cell:cell, project:project, pick:pick, right:right, up:up, toward:toward};
})();

var PumpBoard = (function () {
    var masks=[8,2,9,12,6,3,13,14,7,11,15,10,5,8,1,2,4];
    var directions=[
        {bit:1, x:0,y:1,opposite:4,angle:Math.PI/2},
        {bit:2, x:1,y:0,opposite:8,angle:0},
        {bit:4, x:0,y:-1,opposite:1,angle:Math.PI/2},
        {bit:8, x:-1,y:0,opposite:2,angle:0}
    ];
    var stage, board, labels, queue, boardCanvas, queueCanvas, boardPass, queuePass, frame;
    var loading=true, requested=false, dirty=true, tiles=[], waterUntil=0;
    var tapHint, tapHintTimer;
    var hintsEnabled=false, hintButton, hintMarker, hintAdvice;
    var hintStorageKey='pipepanic.placementHints';
    var visualTime=0, previousFrame=0, drawnAt=0;
    var white=[1,1,1], danger=[1.8,.55,.47], amber=[1.32,.83,.58];
    var dry=[-1,0,0,0], brassPreview=[-2,0,0,0];
    var requestFrame=window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) :
        function (fn) { window.setTimeout(fn,16); };

    function tryPass(canvas) {
        try { return PumpFidelity.create(canvas,canvas===queueCanvas); }
        catch (error) {
            console.warn('PipePanic 3D unavailable: '+error.message);
            if (window.PumpFidelity) PumpFidelity.diagnostics.error=String(error);
            return null;
        }
    }

    function active() { return !!boardPass; }

    function showTapHint(key) {
        window.clearTimeout(tapHintTimer);
        tapHint.hidden = !key;
        tapHint.textContent = key ? tr(key) : '';
        if (key) {
            tapHintTimer = window.setTimeout(function () { showTapHint(); }, 2500);
        }
    }

    function updatePlacementHint() {
        var hint = null;
        if (hintsEnabled && active() && frame && playing() && !document.getElementById('game').hidden) {
            if (levelMode && levelMode.hasRound()) hint = levelMode.placementHint();
            else if (ppGameState === ppGamestateEnum.BUILDING) {
                hint = PipeLevels.classicHint(ppboardarray.slice().reverse(), pppreviewarray[0], ppnullpipeval);
            }
        }
        var cell = hint && hint.cell;
        hintMarker.hidden = !cell;
        if (cell) {
            var at = PumpProjection.project(frame,PumpProjection.cell(frame,cell[0],cell[1],0));
            hintMarker.style.left = (100*at[0])+'%';
            hintMarker.style.top = (100*at[1])+'%';
            hintMarker.style.width = (44/frame.half[0])+'%';
            hintMarker.style.height = (44/frame.half[1])+'%';
            hintMarker.classList.toggle('is-parking',hint.message === 'hintPark');
        }
        var advice = hint ? tr(hint.message) : '';
        hintAdvice.hidden = !advice;
        if (hintAdvice.textContent !== advice) hintAdvice.textContent = advice;
    }

    function initPlacementHint() {
        hintButton = document.getElementById('hintSwitch');
        hintMarker = document.getElementById('placementMarker');
        hintAdvice = document.getElementById('placementAdvice');
        try { hintsEnabled = localStorage.getItem(hintStorageKey) === '1'; } catch (error) {}
        hintButton.setAttribute('aria-pressed', String(hintsEnabled));
        hintButton.addEventListener('click',function () {
            hintsEnabled = !hintsEnabled;
            try { localStorage.setItem(hintStorageKey, hintsEnabled ? '1' : '0'); } catch (error) {}
            hintButton.setAttribute('aria-pressed', String(hintsEnabled));
            updatePlacementHint();
        });
    }

    function updateVisibility() {
        stage.classList.toggle('has3d',active());
        queue.classList.toggle('has3d-queue',active() && !!queuePass);
        var notice=document.getElementById('renderNotice');
        var message=loading ? 'renderLoading' : 'renderUnavailable';
        notice.setAttribute('data-text',message);
        notice.textContent=tr(message);
        notice.hidden=active();
        hintButton.disabled = !active();
        if (!active()) updatePlacementHint();
        ppscale();
        renderGameStatus();
    }

    function sizeCanvas(canvas,rect) {
        var dpr=Math.min(window.devicePixelRatio||1,3);
        var w=Math.max(1,Math.round(rect.width*dpr)), h=Math.max(1,Math.round(rect.height*dpr));
        if (canvas.width!==w) canvas.width=w;
        if (canvas.height!==h) canvas.height=h;
        return [w,h];
    }

    function pipe(renderer,id,x,y,flow,tint) {
        renderer.pipe(id,x,y,flow,tint);
    }

    function readBoard(rect) {
        var w=frame.width,h=frame.height;
        var old=tiles, frontier=[];
        var inFlight=typeof levelMode!=='undefined' && levelMode && levelMode.hasRound()
            ? levelMode.isFlowing()
            : typeof ppGameState!=='undefined' && ppGameState===ppGamestateEnum.FILLING;
        tiles=[];
        waterUntil=0;
        labels.textContent='';
        var outlet=0, fontSize=Math.min(11,Math.max(7,rect.width/(w+1)*.19));
        for (var row=0; row<h; row++) {
            tiles[row]=[];
            for (var col=0; col<w; col++) {
                var element=board.children[row].children[col];
                var state=element.pumpPipe;
                var p=PumpProjection.cell(frame,col,row,0);
                var leak=element.classList.contains('level-leak');
                var fault=element.classList.contains('level-fault') || (state && state.broken);
                var fixed=element.classList.contains('level-fixed');
                var previous=old[row] && old[row][col];
                var entry={state:state,p:p,wall:element.classList.contains('level-wall'),fault:fault,
                    shade:leak ? danger : fault ? amber : fixed ? [.85,1.11,1.11] : white};
                tiles[row][col]=entry;
                if (state && state.filled) {
                    entry.wetAt=previous && previous.state && previous.state.filled && previous.state.id===state.id ?
                        previous.wetAt : inFlight ? visualTime : visualTime-153;
                    waterUntil=Infinity;
                    if (state.id===0) {
                        entry.flow=[0,1,0,0];
                        frontier.push([col,row]);
                    }
                }
                if (state && state.id<=1) addTag([p[0],p[1]-.31,0],.505,
                    state.id===0 ? 'IN' : String.fromCharCode(65+outlet++),
                    state.id===0 ? 'pump-inlet' : 'pump-outlet',fontSize);
                if (fault) addTag([p[0]+.29,p[1]+.29,0],.46,'!','pump-fault',fontSize+1);
            }
        }
        // Follow only cells the existing rules have flooded. The renderer never advances game state.
        for (var i=0;i<frontier.length;i++) {
            var x=frontier[i][0], y=frontier[i][1], parent=tiles[y][x];
            for (var dir of directions) {
                if (!(masks[parent.state.id]&dir.bit)) continue;
                var col=x+dir.x,row=y-dir.y;
                var next=tiles[row] && tiles[row][col];
                if (!next || next.flow || !next.state || !next.state.filled || !(masks[next.state.id]&dir.opposite)) continue;
                next.flow=[0,-dir.x,-dir.y,parent.flow[3]+1];
                frontier.push([col,row]);
            }
        }
    }

    function renderBoard(rebuild) {
        if (!active() || !frame) return false;
        var rect=boardCanvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        var size=sizeCanvas(boardCanvas,rect);
        if (rebuild) {
            readBoard(rect);
            updatePlacementHint();
        }
        var draw=boardPass.draw;
        var w=frame.width,h=frame.height;
        boardPass.begin(visualTime/1000);
        boardPass.viewport(0,0,size[0],size[1],frame);
        draw('deck',0,0,0,(w+.55)/2,(h+.48)/2,1,0,dry,white);
        for (var a of [-1,1]) {
            draw('rail',a*(w/2+.188),0,0,(h-.28)/2,1,1,Math.PI/2,dry,white);
            for (var b of [-1,1]) draw('bolt',a*(w/2+.173),b*(h/2+.137),0,1,1,1,0,dry,white);
        }
        tiles.forEach(function (line,row) {
            line.forEach(function (entry,col) {
                var p=entry.p,state=entry.state;
                if (!state && !entry.wall) draw('tile'+((row+col)%4),p[0],p[1],0,1,1,1,0,dry,entry.shade);
                if (entry.wall) draw('wall',p[0],p[1],0,1,1,1,0,dry,white);
                if (!state) return;
                var flow=entry.flow;
                if (flow) flow[0]=Math.min(1.24,(visualTime-entry.wetAt)/153*1.24);
                else if (state.filled) flow=[1.24,0,0,0];
                pipe(boardPass,state.id,p[0],p[1],flow,entry.shade);
            });
        });
        boardPass.end();
        return true;
    }

    function addTag(p,z,code,kind,size) {
        var at=PumpProjection.project(frame,[p[0],p[1],z]);
        var label=document.createElement('span');
        label.className=kind;
        label.textContent=code;
        label.style.left=(100*at[0])+'%';
        label.style.top=(100*at[1])+'%';
        label.style.fontSize=size+'px';
        labels.appendChild(label);
    }

    function renderQueue() {
        if (!active() || !queuePass) return;
        var rect=queueCanvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var size=sizeCanvas(queueCanvas,rect);
        queuePass.begin(visualTime/1000);
        for (var i=0; i<4; i++) {
            var item=document.getElementById('preview'+i);
            var state=item.pumpPipe;
            if (!state) continue;
            var slot=item.getBoundingClientRect();
            var x=Math.round((slot.left-rect.left)/rect.width*size[0]);
            var y=Math.round((rect.bottom-slot.bottom)/rect.height*size[1]);
            var w=Math.round(slot.width/rect.width*size[0]);
            var h=Math.round(slot.height/rect.height*size[1]);
            var aspect=w/Math.max(h,1);
            queuePass.viewport(x,y,w,h,{center:[0,0],half:[.72*Math.max(1,aspect),.72*Math.max(1,1/aspect)]});
            pipe(queuePass,state.id,0,0,brassPreview,white);
            queuePass.end();
        }
    }

    function playing() {
        return !document.hidden && (typeof ppgamepaused==='undefined' || !ppgamepaused);
    }

    function animate() {
        if (!active() || requested) return;
        requested=true;
        requestFrame(function (now) {
            requested=false;
            if (!active()) { previousFrame=0; return; }
            now=typeof now==='number' ? now : Date.now();
            if (playing() && previousFrame) visualTime+=Math.min(70,now-previousFrame);
            previousFrame=now;
            try {
                if (dirty || visualTime-drawnAt>=30) {
                    var rebuild=dirty;
                    dirty=false;
                    if (!renderBoard(rebuild)) { previousFrame=0; return; }
                    if (rebuild) renderQueue();
                    drawnAt=visualTime;
                }
                if (playing() && visualTime<waterUntil) animate();
                else previousFrame=0;
            }
            catch (error) {
                console.warn('PipePanic 3D fallback: '+error.message);
                PumpFidelity.diagnostics.error=String(error);
                if(boardPass) boardPass.dispose();
                boardPass=null;
                updateVisibility();
            }
        });
    }

    function schedule() { dirty=true; animate(); }

    function fit(width,availableHeight,wide,size) {
        if (!stage) return;
        showTapHint();
        frame=PumpProjection.frame(size[0],size[1]);
        var ratio=frame.half[1]/frame.half[0];
        var dim=wide ? Math.min(width-236,Math.max(154,availableHeight)/ratio) :
            Math.min(width,620,Math.max(184,availableHeight-130)/ratio);
        stage.style.width=Math.max(96,dim)+'px';
        stage.style.height=Math.max(96,dim)*ratio+'px';
        schedule();
    }

    function marker(row,col) {
        if (!active() || !frame) return null;
        var rect=boardCanvas.getBoundingClientRect();
        var p=PumpProjection.project(frame,PumpProjection.cell(frame,col,pprows-1-row,.23));
        var s=rect.width/(frame.width+.5);
        return {left:rect.left+window.pageXOffset+p[0]*rect.width-s*.5,
                top:rect.top+window.pageYOffset+p[1]*rect.height-s*.5,width:s,height:s};
    }

    // A WebView software screenshot omits GPU canvases. Supply those two layers
    // from the same frame while the Android menu keeps the round paused.
    function capture() {
        if (!active() || !boardCanvas.clientWidth || !boardCanvas.clientHeight) return '';
        renderBoard(true);
        renderQueue();
        var layers=[];
        function collect(source,withLabels) {
            var rect=source.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            var copy=document.createElement('canvas');
            copy.width=source.width;
            copy.height=source.height;
            var paint=copy.getContext('2d');
            paint.drawImage(source,0,0);
            if (withLabels) {
                var ratio=copy.width/rect.width;
                paint.textAlign='center';
                paint.textBaseline='middle';
                for (var label of labels.children) {
                    var style=window.getComputedStyle(label);
                    var x=parseFloat(label.style.left)*copy.width/100;
                    var y=parseFloat(label.style.top)*copy.height/100;
                    var size=parseFloat(style.fontSize)*ratio;
                    if (label.classList.contains('pump-fault')) {
                        paint.fillStyle=style.backgroundColor;
                        paint.fillRect(x-size*.45,y-size*.68,size*.9,size*1.36);
                    }
                    paint.font='800 '+size+'px PipeNoto';
                    paint.fillStyle=style.color;
                    paint.fillText(label.textContent,x,y);
                }
            }
            layers.push({left:rect.left,top:rect.top,width:rect.width,height:rect.height,
                png:copy.toDataURL('image/png').split(',')[1]});
        }
        collect(boardCanvas,true);
        if (queuePass) collect(queueCanvas,false);
        return JSON.stringify({width:window.innerWidth,layers:layers});
    }

    function init() {
        stage=document.getElementById('boardStage');
        tapHint=document.getElementById('pumpTapHint');
        board=document.getElementById('board');
        labels=document.getElementById('pumpLabels');
        queue=document.querySelector('.queue-pipes');
        boardCanvas=document.getElementById('pumpBoard');
        queueCanvas=document.getElementById('pumpQueue');
        initPlacementHint();
        if (!window.MutationObserver || !window.PumpFidelity) {
            loading=false;
            updateVisibility();
            return;
        }
        boardCanvas.addEventListener('webglcontextlost',function (event) {
            event.preventDefault();
            if(boardPass) boardPass.dispose();
            boardPass=null;
            updateVisibility();
        });
        boardCanvas.addEventListener('webglcontextrestored',function () {
            boardPass=tryPass(boardCanvas);
            updateVisibility();
        });
        queueCanvas.addEventListener('webglcontextlost',function (event) {
            event.preventDefault();
            if(queuePass) queuePass.dispose();
            queuePass=null;
            updateVisibility();
        });
        queueCanvas.addEventListener('webglcontextrestored',function () {
            queuePass=tryPass(queueCanvas);
            updateVisibility();
        });
        PumpFidelity.prepare().then(function () {
            loading=false;
            boardPass=tryPass(boardCanvas);
            queuePass=boardPass && tryPass(queueCanvas);
            updateVisibility();
        }).catch(function (error) {
            loading=false;
            console.warn('PipePanic asset loading failed: '+error.message);
            updateVisibility();
        });
        boardCanvas.addEventListener('click',function (event) {
            if (!active() || !frame) return;
            var rect=boardCanvas.getBoundingClientRect();
            var tile=PumpProjection.pick(frame,(event.clientX-rect.left)/rect.width,
                (event.clientY-rect.top)/rect.height);
            if (tile) showTapHint(ppprocessboardclick(findBoardElId(pprows-1-tile[1],tile[0])));
        });
        var observer=new MutationObserver(schedule);
        observer.observe(board,{subtree:true,attributes:true,attributeFilter:['style','class','hidden']});
        observer.observe(queue,{subtree:true,attributes:true,attributeFilter:['style']});
        document.addEventListener('visibilitychange',schedule);
        updateVisibility();
    }

    return {init:init, active:active, fit:fit, marker:marker, capture:capture, refresh:schedule};
})();

