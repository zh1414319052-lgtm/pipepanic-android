// PipePanic level play and local save data. GPL-2.0-or-later.
levelMode = (function () {
    var active = null;
    var pickerOpen = false;
    var helpOpen = false;
    var tab = 'puzzle';
    var saveKey = 'pipepanic.levels.v1';
    var saved = loadSave();
    var sections = ['puzzle', 'repair', 'fork', 'daily'];

    function get(id) { return document.getElementById(id); }

    function loadSave() {
        try {
            var value = JSON.parse(window.localStorage.getItem(saveKey));
            if (value && value.completed && value.best) return value;
        } catch (error) {
            // A bad or unavailable save does not stop gameplay.
        }
        return {completed:{}, best:{}, round:null};
    }

    function save() {
        try {
            window.localStorage.setItem(saveKey, JSON.stringify(saved));
        } catch (error) {
            // The current session remains playable without persistent storage.
        }
    }

    function modeLabel(level) {
        var label = tr(level.mode);
        if (level.mode === 'daily') return label + ' · ' + PipeLevels.dateLabel(level.index);
        return label + ' · ' + (level.index + 1) + '/' + PipeLevels.count(level.mode);
    }

    function roundKey(level) {
        return level.mode + '-' + level.index;
    }

    function now() {
        return window.performance ? window.performance.now() : Date.now();
    }

    function elapsed(round) {
        return round.elapsed + (round.started === null ? 0 : Math.max(0, now() - round.started));
    }

    function resultSeconds(round) {
        return Math.max(1, Math.ceil(round.elapsed / 1000));
    }

    function checkpoint() {
        if (!active) return;
        saved.round = {
            mode:active.level.mode, index:active.level.index, moves:active.moves.slice(),
            elapsed:Math.floor(elapsed(active)), phase:active.phase
        };
        save();
    }

    function stopClock() {
        if (!active || active.started === null) return;
        active.elapsed = elapsed(active);
        active.started = null;
    }

    function isPlayable() {
        return active && !ppgamepaused && !pickerOpen && !helpOpen;
    }

    function syncClock() {
        if (pickerOpen || helpOpen || active) {
            var dailyPlaying = isPlayable() && active.level.mode === 'daily' && active.phase === 'build';
            if (dailyPlaying && active.started === null) active.started = now();
            if (!dailyPlaying) stopClock();
            if (dailyPlaying || (isPlayable() && active.phase === 'water')) {
                if (ppGameTickTimer.timerId === null) ppGameTickTimer.resume();
            } else {
                ppGameTickTimer.pause();
            }
            return true;
        }
        return false;
    }

    function keyFor(row, col) {
        return col + ',' + (pprows - 1 - row);
    }

    function square(key) {
        var xy = key.split(',').map(Number);
        return get(findBoardElId(pprows - 1 - xy[1], xy[0]));
    }

    function drawPipe(key, kind, tile) {
        var xy = key.split(',').map(Number);
        setBoardImage(pprows - 1 - xy[1], xy[0], kind, tile);
    }

    function layoutBoard(level) {
        var rows = get('board').children;
        for (var y = 0; y < rows.length; y++) {
            var line = rows[y];
            line.hidden = !!level && y >= level.height;
            line.style.height = (100 / (level ? level.height : pprows)) + '%';
            for (var x = 0; x < line.children.length; x++) {
                var tile = line.children[x];
                tile.hidden = !!level && x >= level.width;
                tile.style.width = (100 / (level ? level.width : ppcolumns)) + '%';
                tile.className = 'boardsquare';
                tile.removeAttribute('aria-label');
            }
        }
        get('classicStats').hidden = !!level;
        get('levelHud').hidden = !level;
        get('levelActions').hidden = !level;
        get('classicLegend').hidden = !!level;
        ppscale();
    }

    function drawBoard() {
        var level = active.level;
        for (var y = 0; y < level.height; y++) {
            for (var x = 0; x < level.width; x++) {
                var key = x + ',' + y;
                var tile = active.tiles[key];
                var cell = square(key);
                var wall = level.walls.indexOf(key) !== -1;
                var fault = level.repairable[key] && tile === level.tiles[key];
                cell.className = 'boardsquare';
                if (wall) cell.className += ' level-wall';
                else if (fault) cell.className += ' level-fault';
                else if (level.locked[key] && tile > 1) cell.className += ' level-fixed';
                if (key === level.inlet) cell.className += ' level-inlet';
                if (level.outlets.indexOf(key) !== -1) cell.className += ' level-outlet';
                drawPipe(key, typeof tile === 'undefined' ? 'blank' : 'empty', tile);
            }
        }
    }

    function drawQueue() {
        for (var i = 0; i < 4; i++) {
            var pipe = active.level.queue[active.moves.length + i];
            setBoardImage('preview' + i, 0, typeof pipe === 'undefined' ? 'blank' : 'empty', pipe);
        }
    }

    function paintWave() {
        if (!active.result) return;
        for (var i = 0; i < active.wave; i++) {
            active.result.layers[i].forEach(function (key) {
                drawPipe(key, 'full', active.tiles[key]);
            });
        }
        if (active.phase === 'result') {
            Object.keys(active.result.leaks).forEach(function (key) {
                square(key).className += ' level-leak';
            });
        }
    }

    function updateStats() {
        var level = active.level;
        var left = level.queue.length - active.moves.length;
        get('levelTitle').textContent = modeLabel(level);
        get('levelGoal').textContent = tr(level.mode === 'repair' ? 'repairGoal' :
            level.outlets.length > 1 ? 'forkGoal' : 'puzzleGoal');
        get('levelRemaining').textContent = tr(level.mode === 'repair' ? 'replacements' : 'piecesLeft') + ' ' + left;
        var daily = level.mode === 'daily';
        var clock = get('levelClock');
        clock.hidden = !daily;
        if (daily) {
            var best = saved.best[level.index];
            var time = active.phase === 'build' ? Math.floor(elapsed(active) / 1000) : resultSeconds(active);
            clock.textContent = tr('elapsed') + ' ' + time + ' ' + tr('seconds') +
                ' · ' + tr('bestTime') + ' ' + (best ? best + ' ' + tr('seconds') : '—');
        }
    }

    function renderStatus() {
        ppSyncSound();
        updateStats();
        var level = active.level;
        var building = active.phase === 'build';
        var result = active.phase === 'result' ? active.result : null;
        var solved = result && result.won;
        var text = tr('levelReady');
        if (active.notice) text = tr(active.notice);
        if (building && active.moves.length === level.queue.length) text = tr('levelTestReady');
        if (active.phase === 'water') text = tr('flowing');
        if (result) {
            text = tr(solved ? 'levelWon' : Object.keys(result.leaks).length ? 'levelLeak' : 'levelShort') +
                ' · ' + tr('outlet') + ' ' + result.outlets + '/' + level.outlets.length;
        }
        get('gameStatus').textContent = text;
        get('gameStatus').className = result ? (solved ? 'pump-result-win' : 'pump-result-issue') : '';
        get('fillButton').textContent = tr('testWater');
        get('fillButton').disabled = !building || !isPlayable() || !ppCanRenderBoard();
        get('levelUndo').disabled = !isPlayable() || active.phase === 'water' || !active.moves.length || !!solved;
        get('levelRetry').disabled = !isPlayable() || active.phase === 'water';
        get('levelNext').hidden = !solved || level.mode === 'daily' || level.index + 1 >= PipeLevels.count(level.mode);
        if (typeof PumpBoard !== 'undefined') PumpBoard.refresh();
    }

    function start(level, state) {
        if (!level) return;
        stopClock();
        ppGameTickTimer.pause();
        var markers = document.querySelectorAll('.scoreMarker');
        for (var j = 0; j < markers.length; j++) markers[j].parentNode.removeChild(markers[j]);
        active = {level:level, tiles:Object.assign({},level.tiles), moves:[], phase:'build',
            wave:0, result:null, notice:null, elapsed:0, started:null, lastSave:0};
        if (state) {
            if (Number.isFinite(state.elapsed) && state.elapsed >= 0) active.elapsed = state.elapsed;
            if (Array.isArray(state.moves)) {
                for (var i = 0; i < state.moves.length; i++) {
                    var key = state.moves[i];
                    if (typeof key !== 'string' || !PipeLevels.canPlace(level, active.tiles, key, i)) break;
                    active.tiles[key] = level.queue[i];
                    active.moves.push(key);
                }
            }
            if (state.phase === 'result') {
                active.phase = 'result';
                active.result = PipeLevels.flood(level, active.tiles);
                active.wave = active.result.layers.length;
            }
        }
        pickerOpen = false;
        window.scrollTo(0,0);
        updatePanels();
        layoutBoard(level);
        drawBoard();
        drawQueue();
        paintWave();
        syncClock();
        checkpoint();
        renderStatus();
    }

    function press(row, col) {
        if (!isPlayable()) return 'tapPaused';
        if (active.phase === 'water') return 'flowing';
        if (active.phase === 'result') {
            return active.result.won ? 'tapLevelDone' : 'tapRetry';
        }
        if (active.moves.length >= active.level.queue.length) return 'tapQueueEmpty';
        var key = keyFor(row, col);
        if (!PipeLevels.canPlace(active.level, active.tiles, key, active.moves.length)) {
            active.notice = active.level.mode === 'repair' ? 'repairInvalid' : 'levelInvalid';
            renderStatus();
            return active.notice;
        }
        active.tiles[key] = active.level.queue[active.moves.length];
        active.moves.push(key);
        ppSoundCue(active.level.mode === 'repair' ? 'repair' : 'place');
        active.notice = null;
        drawBoard();
        drawQueue();
        checkpoint();
        renderStatus();
    }

    function undo() {
        if (!isPlayable() || !active.moves.length || active.phase === 'water' ||
            (active.result && active.result.won)) return;
        var key = active.moves.pop();
        ppSoundCue('undo');
        if (typeof active.level.tiles[key] === 'undefined') delete active.tiles[key];
        else active.tiles[key] = active.level.tiles[key];
        active.phase = 'build';
        active.result = null;
        active.notice = null;
        active.wave = 0;
        drawBoard();
        drawQueue();
        syncClock();
        checkpoint();
        renderStatus();
    }

    function beginWater() {
        if (!isPlayable() || active.phase !== 'build' || !ppCanRenderBoard()) return;
        stopClock();
        ppSoundCue('valve');
        active.result = PipeLevels.flood(active.level, active.tiles);
        active.phase = 'water';
        active.wave = 0;
        checkpoint();
        syncClock();
        renderStatus();
    }

    function finishWater() {
        active.phase = 'result';
        ppSoundCue(active.result.won ? 'success' :
            Object.keys(active.result.leaks).length ? 'leak' : 'dry');
        if (active.result.won) {
            var level = active.level;
            if (level.mode === 'daily') {
                var time = resultSeconds(active);
                if (!saved.best[level.index] || time < saved.best[level.index]) saved.best[level.index] = time;
                var days = Object.keys(saved.best).map(Number).sort(function (a,b) {return b-a;});
                days.slice(60).forEach(function (day) { delete saved.best[day]; });
            } else {
                saved.completed[roundKey(level)] = true;
            }
        }
        syncClock();
        checkpoint();
        renderStatus();
    }

    function tick() {
        if (!active) return pickerOpen || helpOpen;
        if (!isPlayable()) return true;
        if (active.phase === 'water') {
            var wave = active.result.layers[active.wave++];
            wave.forEach(function (key) { drawPipe(key, 'full', active.tiles[key]); });
            if (active.wave === active.result.layers.length) {
                finishWater();
                paintWave();
            }
        } else if (active.level.mode === 'daily' && active.phase === 'build') {
            updateStats();
            var time = elapsed(active);
            if (time - active.lastSave >= 5000) {
                active.lastSave = time;
                checkpoint();
            }
        }
        return true;
    }

    function updatePanels() {
        get('levelPicker').hidden = !pickerOpen || helpOpen;
        get('game').hidden = pickerOpen || helpOpen;
        ppSyncSound();
        if (!get('game').hidden) ppscale();
    }

    function appendButton(parent, label, action, className) {
        var button = document.createElement('button');
        button.className = 'button ' + className;
        button.type = 'button';
        button.textContent = label;
        button.onclick = action;
        parent.appendChild(button);
        return button;
    }

    function showTab(mode) {
        tab = mode;
        renderPicker();
    }

    function renderPicker() {
        var tabs = get('levelTabs');
        tabs.textContent = '';
        sections.forEach(function (mode) {
            var button = appendButton(tabs,tr(mode),function () {showTab(mode);},'level-tab');
            button.setAttribute('aria-pressed', String(tab === mode));
        });
        get('modeDescription').textContent = tr(tab + 'Description');
        var list = get('levelList');
        list.textContent = '';
        if (tab === 'daily') {
            var day = PipeLevels.dayNumber(Date.now());
            var info = get('dailyInfo');
            var best = saved.best[day];
            info.hidden = false;
            info.textContent = PipeLevels.dateLabel(day) + ' · ' + tr('bestTime') + ' ' +
                (best ? best + ' ' + tr('seconds') : '—');
            var current = active && active.level.mode === 'daily' && active.level.index === day;
            var todayDraft = saved.round && saved.round.mode === 'daily' && saved.round.index === day &&
                saved.round.phase !== 'result';
            var unfinished = current ? active.phase !== 'result' : todayDraft;
            appendButton(list,tr(unfinished ? 'continueToday' : 'playToday'),function () {
                if (unfinished && current) closePicker();
                else if (unfinished) restore();
                else start(PipeLevels.get('daily',day));
            },'level-today');
        } else {
            get('dailyInfo').hidden = true;
            for (var i = 0; i < PipeLevels.count(tab); i++) {
                addLevelButton(list,tab,i);
            }
        }
        var hasStored = saved.round && PipeLevels.get(saved.round.mode,saved.round.index);
        var continueButton = get('levelContinue');
        continueButton.hidden = !active && !hasStored;
        if (!continueButton.hidden) {
            continueButton.textContent = tr('levelContinue') + ' · ' + modeLabel(active ? active.level : hasStored);
        }
    }

    function addLevelButton(list, mode, index) {
        var complete = !!saved.completed[mode + '-' + index];
        var button = appendButton(list,String(index + 1) + (complete ? ' ✓' : ''),function () {
            if (active && active.level.mode === mode && active.level.index === index) closePicker();
            else if (saved.round && saved.round.mode === mode && saved.round.index === index) restore();
            else start(PipeLevels.get(mode,index));
        },'level-select' + (complete ? ' is-complete' : ''));
        button.setAttribute('aria-label',tr(mode) + ' ' + (index + 1) + (complete ? ' · ' + tr('levelWon') : ''));
    }

    function openPicker() {
        pickerOpen = true;
        if (active) tab = active.level.mode;
        syncClock();
        checkpoint();
        renderPicker();
        updatePanels();
        window.scrollTo(0,0);
    }

    function closePicker() {
        pickerOpen = false;
        updatePanels();
        if (!syncClock() && !ppgamepaused && ppGameState !== ppGamestateEnum.DONE) ppGameTickTimer.resume();
        renderGameStatus();
    }

    function restore() {
        if (active) {
            closePicker();
            return;
        }
        var state = saved.round;
        if (state) start(PipeLevels.get(state.mode,state.index),state);
    }

    function exit() {
        stopClock();
        checkpoint();
        var wasActive = !!active;
        active = null;
        pickerOpen = false;
        updatePanels();
        if (wasActive) layoutBoard(null);
    }

    function toggleHelp(show) {
        helpOpen = !!show;
        updatePanels();
        syncClock();
    }

    return {
        hasRound:function () { return !!active; },
        isFlowing:function () { return !!active && active.phase === 'water'; },
        placementHint:function () {
            if (!isPlayable() || active.phase !== 'build') return null;
            return PipeLevels.placementHint(active.level, active.tiles, active.moves.length);
        },
        size:function () { return active ? [active.level.width,active.level.height] : [ppcolumns,pprows]; },
        openPicker:openPicker, closePicker:closePicker, restore:restore, exit:exit,
        press:press, fill:beginWater, tick:tick, render:renderStatus, undo:undo, help:toggleHelp,
        onPause:function () { stopClock(); checkpoint(); },
        sync:syncClock,
        languageChanged:function () { if (pickerOpen) renderPicker(); },
        retry:function () { if (isPlayable() && active.phase !== 'water') start(active.level); },
        next:function () {
            if (isPlayable() && active.result && active.result.won && active.level.mode !== 'daily') {
                start(PipeLevels.get(active.level.mode,active.level.index + 1));
            }
        }
    };
})();

