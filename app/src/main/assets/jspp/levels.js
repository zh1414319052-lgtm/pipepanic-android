// PipePanic level definitions and water simulation. GPL-2.0-or-later.
var PipeLevels = (function () {
    var moves = {
        N: {x:0, y:-1, bit:1, opposite:4},
        E: {x:1, y:0, bit:2, opposite:8},
        S: {x:0, y:1, bit:4, opposite:1},
        W: {x:-1, y:0, bit:8, opposite:2}
    };
    // Keep pipe IDs aligned with the existing sprites and classic engine.
    var ports = [8, 2, 9, 12, 6, 3, 13, 14, 7, 11, 15, 10, 5, 8, 1, 2, 4];
    var oneDay = 86400000;
    var offset = 8 * 3600000;
    var definitions = {
        puzzle: [
            {size:[5,3], y:1, route:'WWWW', fixed:['2,1']},
            {size:[5,4], y:2, route:'WWNWW', walls:['3,1','1,2']},
            {size:[6,4], y:1, route:'WWSSWWW', fixed:['3,2'], walls:['2,1','2,2','1,1']},
            {size:[6,5], y:3, route:'WNWWNWW', walls:['3,3','2,3','1,3','1,2','3,1'], order:2},
            {size:[7,5], y:2, route:'WWNWNWWW', fixed:['4,1','2,0'], walls:['3,2','2,2','1,2','2,1'], order:3},
            {size:[7,5], y:0, route:'WSWWSWWW', walls:['4,0','3,0','4,2','2,1','1,1','1,0'], order:1},
            {size:[7,5], y:4, route:'WWNNWWNWW', fixed:['4,3','2,1'], walls:['3,4','2,4','1,4','3,3','1,2'], order:4},
            {size:[7,6], y:1, route:'WWSSWWSWW', fixed:['4,2','2,4'], walls:['3,1','2,1','2,2','1,3'], order:3},
            {size:[8,5], y:2, route:'WNWWSSWWNWW', fixed:['6,1','4,2','2,3'], walls:['5,2','5,3','3,2','1,3','2,1'], order:2},
            {size:[8,6], y:4, route:'WWNNWWSWWSW', fixed:['5,3','3,2','2,3'], walls:['4,4','4,3','2,4','1,2','2,2','1,5'], order:5},
            {size:[7,5], y:2, route:'WWWWWW', branch:['3,2','NNWWW'], fixed:['5,2','2,2','3,1','1,0'], walls:['2,1','1,1'], order:2},
            {size:[8,6], y:3, route:'WWWWWWW', branch:['4,3','NNWWNWW'], fixed:['6,3','4,2','2,1','2,0','1,3'], walls:['3,2','2,2','1,1','5,1','1,4'], order:4}
        ],
        repair: [
            {size:[6,4], y:2, route:'WWWWW', faults:[['4,2',12],['2,2',3]]},
            {size:[6,5], y:1, route:'WWSWWW', faults:[['3,1',2],['3,2',12]]},
            {size:[7,5], y:3, route:'WNWWNWWW', faults:[['5,3',4],['5,2',12],['3,2',11]]},
            {size:[8,5], y:2, route:'WWWWWWW', branch:['4,2','NNWWWW'], faults:[['4,2',11],['4,0',5],['2,2',12]]}
        ],
        fork: [
            {size:[6,5], y:2, route:'WWWWW', branch:['2,2','NNWW'], walls:['1,1'], order:2},
            {size:[7,5], y:2, route:'WWWWWW', branch:['4,2','SSWWWW'], fixed:['5,2','4,3'], walls:['3,3','2,3','1,3'], order:3},
            {size:[8,5], y:3, route:'WWNWWWWW', branch:['3,2','NNWWW'], fixed:['5,3','4,2','2,2'], walls:['4,3','2,1','1,1'], order:4},
            {size:[8,6], y:1, route:'WWWWWWW', branch:['4,1','SSWWWSW'], fixed:['6,1','4,2','3,3','1,4'], walls:['3,2','2,2','1,2','2,4'], order:5}
        ]
    };

    function compile(definition) {
        var width = definition.size[0];
        var height = definition.size[1];
        var mask = {};
        var inlet = (width - 1) + ',' + definition.y;
        var walls = definition.walls || [];
        function trace(start, route) {
            var xy = start.split(',').map(Number);
            var x = xy[0];
            var y = xy[1];
            var from = start;
            for (var i = 0; i < route.length; i++) {
                var direction = moves[route[i]];
                x += direction.x;
                y += direction.y;
                var to = x + ',' + y;
                if (x < 0 || x >= width || y < 0 || y >= height || walls.indexOf(to) !== -1 || mask[to]) {
                    throw new Error('Invalid authored route at ' + to);
                }
                mask[from] = (mask[from] || 0) | direction.bit;
                mask[to] = direction.opposite;
                from = to;
            }
            if (x !== 0 || mask[from] !== ports[1]) throw new Error('Invalid authored outlet ' + from);
            return from;
        }
        var outlets = [trace(inlet, definition.route)];
        if (definition.branch) outlets.push(trace(definition.branch[0], definition.branch[1]));
        if (mask[inlet] !== ports[0]) throw new Error('Invalid authored inlet');

        var routeCells = Object.keys(mask).filter(function (key) {
            return key !== inlet && outlets.indexOf(key) === -1;
        });
        var fixed = definition.fixed || [];
        var faults = definition.faults || [];
        var tiles = {};
        var locked = {};
        var repairable = {};
        tiles[inlet] = 0;
        locked[inlet] = true;
        outlets.forEach(function (key) { tiles[key] = 1; locked[key] = true; });
        walls.forEach(function (key) { locked[key] = true; });
        var answer = {};
        routeCells.forEach(function (key) { answer[key] = ports.indexOf(mask[key], 2); });
        fixed.forEach(function (key) {
            if (!(key in answer)) throw new Error('Invalid fixed pipe ' + key);
            locked[key] = true;
            tiles[key] = answer[key];
        });
        var targets;
        if (faults.length) {
            faults.forEach(function (fault) {
                if (!(fault[0] in answer) || answer[fault[0]] === fault[1]) throw new Error('Invalid fault ' + fault[0]);
                repairable[fault[0]] = true;
                tiles[fault[0]] = fault[1];
            });
            routeCells.forEach(function (key) {
                if (!repairable[key]) { locked[key] = true; tiles[key] = answer[key]; }
            });
            targets = faults.map(function (fault) { return fault[0]; });
        } else {
            targets = routeCells.filter(function (key) { return !locked[key]; });
            if (definition.order) {
                var offset = definition.order % targets.length;
                targets = targets.slice(offset).concat(targets.slice(0, offset)).reverse();
            }
        }
        return { width:width, height:height, inlet:inlet, outlets:outlets, walls:walls,
            locked:locked, repairable:repairable, tiles:tiles, queue:targets.map(function (key) {
                return answer[key];
            }), targets:targets };
    }

    function dayNumber(timestamp) {
        return Math.floor((timestamp + offset) / oneDay);
    }

    function dateLabel(day) {
        return new Date(day * oneDay).toISOString().slice(0,10);
    }

    function get(mode, index) {
        var level;
        if (mode === 'daily') {
            if (typeof index !== 'number' || index % 1 !== 0 || index < 0 || index > 100000) return null;
            var choices = definitions.puzzle.slice(2).concat(definitions.fork);
            var seed = new MersenneTwister(index);
            var base = choices[index % choices.length];
            level = compile(base);
            // Shuffle the order of the finite set, never the shapes needed to solve the board.
            for (var i = level.queue.length - 1; i > 0; i--) {
                var swap = Math.floor(seed.random() * (i + 1));
                var pipe = level.queue[swap];
                var target = level.targets[swap];
                level.queue[swap] = level.queue[i];
                level.targets[swap] = level.targets[i];
                level.queue[i] = pipe;
                level.targets[i] = target;
            }
        } else {
            var list = definitions[mode];
            if (!Array.isArray(list) || !list[index] || typeof index !== 'number') return null;
            level = compile(list[index]);
        }
        level.mode = mode;
        level.index = index;
        return level;
    }

    function count(mode) {
        return Array.isArray(definitions[mode]) ? definitions[mode].length : 0;
    }

    function canPlace(level, tiles, key, queueIndex) {
        if (!/^[0-9],[0-9]$/.test(key) || queueIndex < 0) return false;
        var xy = key.split(',').map(Number);
        if (xy.length !== 2 || xy[0] < 0 || xy[0] >= level.width ||
            xy[1] < 0 || xy[1] >= level.height || xy[0] % 1 !== 0 || xy[1] % 1 !== 0 ||
            queueIndex >= level.queue.length || level.locked[key]) return false;
        if (level.mode === 'repair') return !!level.repairable[key] && tiles[key] === level.tiles[key];
        return typeof tiles[key] === 'undefined';
    }

    function placementHint(level, tiles, queueIndex) {
        var remaining = level.queue.slice(queueIndex);
        var target;
        for (var i = 0; i < level.targets.length; i++) {
            var key = level.targets[i];
            var needed = level.queue[i];
            if (tiles[key] === needed) continue;
            var available = remaining.indexOf(needed);
            if (available === -1 || !canPlace(level, tiles, key, queueIndex)) {
                return {message:'hintUndo'};
            }
            remaining.splice(available, 1);
            if (!target && needed === level.queue[queueIndex]) target = key;
        }
        if (target) {
            return {cell:target.split(',').map(Number), message:'hintPlace'};
        }
        return {message:'hintReady'};
    }

    function classicRoute(width, start, end, bend) {
        var path = [];
        for (var x = width - 1; x >= bend; x--) path.push([x, start]);
        var step = Math.sign(end - start);
        for (var row = start; row !== end;) {
            row += step;
            path.push([bend, row]);
        }
        for (var x = bend - 1; x >= 0; x--) path.push([x, end]);
        return path.slice(1, -1).map(function (cell, i) {
            function port(other) {
                if (other[0] !== cell[0]) return other[0] < cell[0] ? 8 : 2;
                return other[1] < cell[1] ? 1 : 4;
            }
            return {cell:cell, id:ports.indexOf(port(path[i]) | port(path[i + 2]), 2)};
        });
    }

    function classicHint(board, piece, empty) {
        var width = board[0].length;
        var start = board.findIndex(function (row) { return row[width - 1] === 0; });
        var end = board.findIndex(function (row) { return row[0] === 1; });
        if (start < 0 || end < 0) return null;
        var best;
        for (var bend = 1; bend < width - 1; bend++) {
            var route = classicRoute(width, start, end, bend);
            var missing = route.filter(function (tile) {
                return board[tile.cell[1]][tile.cell[0]] !== tile.id;
            });
            var cost = missing.reduce(function (sum, tile) {
                return sum + (board[tile.cell[1]][tile.cell[0]] === empty ? 2 : 3);
            }, 0);
            if (!best || cost < best.cost) best = {route:route, missing:missing, cost:cost};
            if (start === end) break;
        }
        if (!best.missing.length) return {message:'hintReady'};
        var match = best.missing.find(function (tile) { return tile.id === piece; });
        if (match) return {cell:match.cell, message:'hintPlace'};
        // Park unusable shapes away from the route so the next piece can advance the connection.
        var reserved = new Set(best.route.map(function (tile) { return tile.cell.join(','); }));
        var fallback;
        for (var row = 0; row < board.length; row++) {
            for (var col = 0; col < width; col++) {
                if (board[row][col] <= 1 || reserved.has(col + ',' + row)) continue;
                if (board[row][col] === empty) return {cell:[col, row], message:'hintPark'};
                if (!fallback) fallback = [col, row];
            }
        }
        return {cell:fallback, message:'hintPark'};
    }

    function flood(level, tiles) {
        var reached = {};
        var leaks = {};
        var wave = [level.inlet];
        reached[level.inlet] = true;
        var layers = [];
        while (wave.length) {
            layers.push(wave);
            var nextWave = [];
            wave.forEach(function (key) {
                var xy = key.split(',').map(Number);
                var open = ports[tiles[key]];
                Object.keys(moves).forEach(function (name) {
                    var direction = moves[name];
                    if (!(open & direction.bit)) return;
                    var next = (xy[0] + direction.x) + ',' + (xy[1] + direction.y);
                    if (!(ports[tiles[next]] & direction.opposite)) {
                        leaks[key] = true;
                    } else if (!reached[next]) {
                        reached[next] = true;
                        nextWave.push(next);
                    }
                });
            });
            wave = nextWave;
        }
        var outlets = level.outlets.filter(function (key) { return reached[key]; }).length;
        return {layers:layers, leaks:leaks, outlets:outlets,
            won:outlets === level.outlets.length && Object.keys(leaks).length === 0};
    }

    return {get:get, count:count, canPlace:canPlace, placementHint:placementHint, classicHint:classicHint,
        flood:flood, dayNumber:dayNumber, dateLabel:dateLabel};
})();

