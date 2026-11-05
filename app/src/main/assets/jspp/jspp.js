// JavaScript Pipepanic.
// Copyright (C) 2004 Thunor <thunorsif@hotmail.com>
// Copyright (C) 2016 Richard Nauber
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//game play  constants
const ppgametimerseconds = 240;
const ppstartbreakingpipesseconds = 200;
const pppipearraysize = 105; // do not change unless you read below...
const ppGameTimerTickMS = 200;

const pipebreakprob_base = 0.0002;
const pppipebreakagestep_base = 0.005;

const pprows = 11; //no value different from 11 will work for now
const ppcolumns = 11;

const ppfilledcounterbase = 20;
const ppleakypipeval = 200;
const ppnullpipeval = 0x1ff;
const ppdeadpipeval = 0x1fd;


//scoring
const pppipeplacementscore = 10;
const pppipeoverwritescore = -10;
const ppdeadpipescore = -10;
const ppfilledpipescore = 50;
const ppfilledendpointscore = 250;
const ppfillnowscore = 5;

//variables, should be aggregated in a game state object

var ppdebug = false;
var pipebreakprob;
var pppipebreakagestep;


var ppRNG = null;
var ppbattlemodeseed = 0;
var ppIndicateScore = true;

var ppgamepaused = false;
var levelMode = null;

ppGamestateEnum = {
    BUILDING: 0,
    CLEARINGDEAD: 1,
    FILLING: 2,
    DONE: 3
}

var ppGameState = ppGamestateEnum.DONE;

// --- Global variables. ---
var pppreviewarray = new Array(3);
var pppipearraypointer = null;
var ppgametimer = ppgametimerseconds;
var ppdifficulty = 0;
var ppinfinite = 0;
var ppReachedOutlet = false;

var ppGameTickTimer = new TimerInterval("ppExecGameTick()", ppGameTimerTickMS);
var ppGameTick = 0;

var ppcleardeadpipesy = pprows - 1;
var ppcleardeadpipesx = 0;
var ppfillpipespasscounter = ppfilledcounterbase;
var pphighscore = 0;
var ppscore = 0;
// --- Create 2 dimensional array for the game board. ---
var ppcount = 0;

var ppboardarray = new Array(pprows);
for (ppcount = 0; ppcount < ppcolumns; ppcount++) {
    ppboardarray[ppcount] = new Array(ppcolumns); // 11*11 = 121 board squares = [0][0] to [10][10].
}

// --- Create 2 dimensional array for the dead pipes. ---
var ppdeadpipesarray = new Array(pprows);
for (ppcount = 0; ppcount < pprows; ppcount++) {
    ppdeadpipesarray[ppcount] = new Array(ppcolumns); // 11*11 = 121 board squares = [0][0] to [10][10].
}

// --- Create 2 dimensional array for the number breakages of a pipe. ---
var pppipebreakagearray = new Array(pprows);
for (ppcount = 0; ppcount < pprows; ppcount++) {
    pppipebreakagearray[ppcount] = new Array(ppcolumns); // 11*11 = 121 board squares = [0][0] to [10][10].
}

window.console.log("Page loaded");
// ------------------------------------------------------------------
// Game Logic
// ------------------------------------------------------------------



function ppcreatedeadpipesarray() {
    var count = 0;
    var rowloop = 0;
    var colloop = 0;
    var pointexists = false;
    var endreached = false;
    var pointsconverge = false;
    var leakcount = 0;
    var deadcount = 0;
    var freepointer = 0;
    var filledcounter = ppfilledcounterbase;
    var north = false;
    var south = false;
    var east = false;
    var west = false;
    var targety = 0;
    var targetx = 0;
    var targettype = ppnullpipeval;
    var targetvalid = false;
    targetvisited = false;
    // --- Create 2 dimensional array for the route tracing points. ---
    var pointsarraysize = 75;
    var pointsarray = new Array(pointsarraysize);

    for (rowloop = 0; rowloop < pointsarraysize; rowloop++) {
        pointsarray[rowloop] = new Array(4); // y|x|direction|passcounter.
        pointsarray[rowloop][0] = pointsarray[rowloop][1] = pointsarray[rowloop][3] = 0;
        pointsarray[rowloop][2] = ppnullpipeval; // dead point.
    }

    // Find endpoints in game board array.
    for (rowloop = 0; rowloop <= pprows - 1; rowloop++) {
        for (colloop = 0; colloop <= ppcolumns - 1; colloop++) {
            if (ppboardarray[rowloop][colloop] == 0) {
                // Create a single point at start heading west (0=n|1=e|2=s|3=w).
                pointsarray[pointsarraysize - 1][0] = rowloop;
                pointsarray[pointsarraysize - 1][1] = colloop;
                pointsarray[pointsarraysize - 1][2] = 3;
                pointsarray[pointsarraysize - 1][3] = filledcounter;
            }

            // Duplicate the game board array into the dead pipes array.
            ppdeadpipesarray[rowloop][colloop] = ppboardarray[rowloop][colloop];
        }
    }

    // MAIN LOOP. Do this while points exist (no points means no more routes).
    do {
        pointexists = false;

        for (rowloop = 0; rowloop < pointsarraysize; rowloop++) {
            if (pointsarray[rowloop][2] != ppnullpipeval && pointsarray[rowloop][3] == filledcounter) {
                // Get target yx.
                switch (pointsarray[rowloop][2]) { // point direction.
                    case 0: // north.
                        targety = pointsarray[rowloop][0] + 1; // NOTE: As the array is upside down, so is this.
                        targetx = pointsarray[rowloop][1];
                        break;

                    case 1: // east.
                        targety = pointsarray[rowloop][0];
                        targetx = pointsarray[rowloop][1] + 1;
                        break;

                    case 2: // south.
                        targety = pointsarray[rowloop][0] - 1;
                        targetx = pointsarray[rowloop][1];
                        break;

                    case 3: // west.
                        targety = pointsarray[rowloop][0];
                        targetx = pointsarray[rowloop][1] - 1;
                        break;
                }

                // Get target pipe type.
                if (targety < 0 || targety >= pprows || targetx < 0 || targetx >= ppcolumns) {
                    targettype = ppnullpipeval; // targets outside the game board are invalid.

                } else {
                    targettype = ppboardarray[targety][targetx];
                }

                // Get direction information on the target piece.
                switch (targettype) {
                    case 0:
                        north = false;
                        east = false;
                        south = false;
                        west = true;
                        break;

                    case 1:
                        north = false;
                        east = true;
                        south = false;
                        west = false;
                        break;

                    case 2:
                        north = true;
                        east = false;
                        south = false;
                        west = true;
                        break;

                    case 3:
                        north = false;
                        east = false;
                        south = true;
                        west = true;
                        break;

                    case 4:
                        north = false;
                        east = true;
                        south = true;
                        west = false;
                        break;

                    case 5:
                        north = true;
                        east = true;
                        south = false;
                        west = false;
                        break;

                    case 6:
                        north = true;
                        east = false;
                        south = true;
                        west = true;
                        break;

                    case 7:
                        north = false;
                        east = true;
                        south = true;
                        west = true;
                        break;

                    case 8:
                        north = true;
                        east = true;
                        south = true;
                        west = false;
                        break;

                    case 9:
                        north = true;
                        east = true;
                        south = false;
                        west = true;
                        break;

                    case 10:
                        north = true;
                        east = true;
                        south = true;
                        west = true;
                        break;

                    case 11:
                        north = false;
                        east = true;
                        south = false;
                        west = true;
                        break;

                    case 12:
                        north = true;
                        east = false;
                        south = true;
                        west = false;
                        break;

                    case 13:
                        north = false;
                        east = false;
                        south = false;
                        west = true;
                        break;

                    case 14:
                        north = true;
                        east = false;
                        south = false;
                        west = false;
                        break;

                    case 15:
                        north = false;
                        east = true;
                        south = false;
                        west = false;
                        break;

                    case 16:
                        north = false;
                        east = false;
                        south = true;
                        west = false;
                        break;

                    default:
                        north = false;
                        east = false;
                        south = false;
                        west = false;
                        break;
                }

                // Get validity of target move.
                targetvalid = false;

                if (pointsarray[rowloop][2] == 0 && south == true) targetvalid = true;

                if (pointsarray[rowloop][2] == 1 && west == true) targetvalid = true;

                if (pointsarray[rowloop][2] == 2 && north == true) targetvalid = true;

                if (pointsarray[rowloop][2] == 3 && east == true) targetvalid = true;

                // Get visited status of target pipe.
                targetvisited = false;

                if (targetvalid) { // don't try and reference array elements using -1 ;)
                    if (ppdeadpipesarray[targety][targetx] >= ppfilledcounterbase && ppdeadpipesarray[targety][targetx] != ppnullpipeval) targetvisited = true;
                }

                // Now that we have all the info we make the MAIN DECISIONS HERE.
                // If source is THE endpoint...
                if (ppboardarray[pointsarray[rowloop][0]][pointsarray[rowloop][1]] == 1) {
                    if (ppdeadpipesarray[pointsarray[rowloop][0]][pointsarray[rowloop][1]] >= 0 && ppdeadpipesarray[pointsarray[rowloop][0]][pointsarray[rowloop][1]] < ppfilledcounterbase) ppdeadpipesarray[pointsarray[rowloop][0]][pointsarray[rowloop][1]] = filledcounter; // mark source as filled.

                    pointsarray[rowloop][2] = ppnullpipeval; // kill current point.
                    endreached = true;

                } else {
                    // ElseIf target is valid and not visited...
                    if (targetvalid && !targetvisited) {
                        if (ppdeadpipesarray[pointsarray[rowloop][0]][pointsarray[rowloop][1]] >= 0 && ppdeadpipesarray[pointsarray[rowloop][0]][pointsarray[rowloop][1]] < ppfilledcounterbase) ppdeadpipesarray[pointsarray[rowloop][0]][pointsarray[rowloop][1]] = filledcounter; // mark source as filled.

                        pointsarray[rowloop][2] = ppnullpipeval; // kill current point.

                        // Create a new point at target for each direction.
                        // Merge converging paths, caused when 2 sources converge on the same target at the same time.
                        if (north) {
                            pointsconverge = false;

                            for (count = 0; count < pointsarraysize; count++) {
                                if (pointsarray[count][2] != ppnullpipeval) {
                                    // We don't want 2 points in the same square going in the same direction.
                                    if (pointsarray[count][0] == targety && pointsarray[count][1] == targetx && pointsarray[count][2] == 0) {
                                        pointsconverge = true;
                                    }

                                } else {
                                    freepointer = count; // record this as we'll use it to store the new point.
                                }
                            }

                            if (!pointsconverge) {
                                pointsarray[freepointer][0] = targety;
                                pointsarray[freepointer][1] = targetx;
                                pointsarray[freepointer][2] = 0;
                                pointsarray[freepointer][3] = filledcounter + 1; // process it next do-while iteration.
                                pointexists = true;
                            }
                        }

                        if (east) {
                            pointsconverge = false;

                            for (count = 0; count < pointsarraysize; count++) {
                                if (pointsarray[count][2] != ppnullpipeval) {
                                    // We don't want 2 points in the same square going in the same direction.
                                    if (pointsarray[count][0] == targety && pointsarray[count][1] == targetx && pointsarray[count][2] == 1) {
                                        pointsconverge = true;
                                    }

                                } else {
                                    freepointer = count; // record this as we'll use it to store the new point.
                                }
                            }

                            if (!pointsconverge) {
                                pointsarray[freepointer][0] = targety;
                                pointsarray[freepointer][1] = targetx;
                                pointsarray[freepointer][2] = 1;
                                pointsarray[freepointer][3] = filledcounter + 1; // process it next do-while iteration.
                                pointexists = true;
                            }
                        }

                        if (south) {
                            pointsconverge = false;

                            for (count = 0; count < pointsarraysize; count++) {
                                if (pointsarray[count][2] != ppnullpipeval) {
                                    // We don't want 2 points in the same square going in the same direction.
                                    if (pointsarray[count][0] == targety && pointsarray[count][1] == targetx && pointsarray[count][2] == 2) {
                                        pointsconverge = true;
                                    }

                                } else {
                                    freepointer = count; // record this as we'll use it to store the new point.
                                }
                            }

                            if (!pointsconverge) {
                                pointsarray[freepointer][0] = targety;
                                pointsarray[freepointer][1] = targetx;
                                pointsarray[freepointer][2] = 2;
                                pointsarray[freepointer][3] = filledcounter + 1; // process it next do-while iteration.
                                pointexists = true;
                            }
                        }

                        if (west) {
                            pointsconverge = false;

                            for (count = 0; count < pointsarraysize; count++) {
                                if (pointsarray[count][2] != ppnullpipeval) {
                                    // We don't want 2 points in the same square going in the same direction.
                                    if (pointsarray[count][0] == targety && pointsarray[count][1] == targetx && pointsarray[count][2] == 3) {
                                        pointsconverge = true;
                                    }

                                } else {
                                    freepointer = count; // record this as we'll use it to store the new point.
                                }
                            }

                            if (!pointsconverge) {
                                pointsarray[freepointer][0] = targety;
                                pointsarray[freepointer][1] = targetx;
                                pointsarray[freepointer][2] = 3;
                                pointsarray[freepointer][3] = filledcounter + 1; // process it next do-while iteration.
                                pointexists = true;
                            }
                        }

                    } else {
                        // ElseIf target is valid and visited...
                        if (targetvalid && targetvisited) {
                            if (ppdeadpipesarray[pointsarray[rowloop][0]][pointsarray[rowloop][1]] >= 0 && ppdeadpipesarray[pointsarray[rowloop][0]][pointsarray[rowloop][1]] < ppfilledcounterbase) ppdeadpipesarray[pointsarray[rowloop][0]][pointsarray[rowloop][1]] = filledcounter; // mark source as filled.

                            pointsarray[rowloop][2] = ppnullpipeval; // kill current point.

                        } else {
                            // ElseIf target is not valid...
                            if (!targetvalid) {
                                ppdeadpipesarray[pointsarray[rowloop][0]][pointsarray[rowloop][1]] = filledcounter + ppleakypipeval; // mark source as leaky retaining fill count (important).
                                pointsarray[rowloop][2] = ppnullpipeval; // kill current point.
                                leakcount++;
                            }
                        }
                    }
                }
            }
        }

        filledcounter++;
    } while (pointexists);

    // MARK DEAD PIPES. The easy bit :)
    deadcount = 0;

    for (rowloop = 0; rowloop < pprows; rowloop++) {
        for (colloop = 0; colloop < ppcolumns; colloop++) {
            if (ppdeadpipesarray[rowloop][colloop] >= 0 && ppdeadpipesarray[rowloop][colloop] < ppfilledcounterbase) {
                ppdeadpipesarray[rowloop][colloop] = ppdeadpipeval;
                deadcount++; // count can include endpoint if it is unvisited.
            }
        }
    }

    // Preparing clear dead pipes
    ppcleardeadpipesy = pprows - 1;
    ppcleardeadpipesx = 0;

    debug("Board:<br>");
    debug_array(ppboardarray);
    debug("Dead pipes:<br>");
    debug_array(ppdeadpipesarray);
    debug("Pipe breakage:<br>");
    debug_array(pppipebreakagearray);
}


function ppcleardeadpipes() {
    if (ppGameState != ppGamestateEnum.CLEARINGDEAD)
        return;

    var row = 0;
    var column = 0;
    var deadpipefound = false;
    var nomorepipes = false;

    do {
        // Officially if the endpoint is unvisited it's dead, but we'll leave it onscreen anyway.
        if (ppdeadpipesarray[ppcleardeadpipesy][ppcleardeadpipesx] == ppdeadpipeval && ppboardarray[ppcleardeadpipesy][ppcleardeadpipesx] != 1) {
            // Erase dead pipe from the screen.
            setBoardImage(ppcleardeadpipesy, ppcleardeadpipesx, "blank");
            // Erase dead pipe from the board array.
            ppboardarray[ppcleardeadpipesy][ppcleardeadpipesx] = ppnullpipeval;
            ppUpdateGameScore(ppdeadpipescore, ppGameTimerTickMS * 4, ppcleardeadpipesy, ppcleardeadpipesx);
            deadpipefound = true;
        }

        // Work our way from top left to bottom right (board is upside down remember).
        ppcleardeadpipesx++;

        if (ppcleardeadpipesx >= pprows) {
            ppcleardeadpipesx = 0;
            ppcleardeadpipesy--;

            if (ppcleardeadpipesy < 0) nomorepipes = true;
        }
    } while (!deadpipefound && !nomorepipes)
    if (nomorepipes) {
        ppfillpipespasscounter = ppfilledcounterbase;
        ppGameState = ppGamestateEnum.FILLING;
        ppSoundCue('valve');
        ppSyncSound();
    }
}

function ppfillpipes() {
    if (ppGameState != ppGamestateEnum.FILLING)
        return;

    var row = 0;
    var column = 0;
    var rowloop = 0;
    var colloop = 0;
    var leakypipefound = false;
    var nomorepipes = true;

    // Show all filled pipes onscreen for this passcounter.
    for (rowloop = 0; rowloop < pprows; rowloop++) {
        for (colloop = 0; colloop < ppcolumns; colloop++) {
            if (ppdeadpipesarray[rowloop][colloop] == ppfillpipespasscounter || ppdeadpipesarray[rowloop][colloop] - ppleakypipeval == ppfillpipespasscounter) {
                // Draw filled pipe.
                setBoardImage(rowloop, colloop, "full", ppboardarray[rowloop][colloop]);
                breakage = Math.floor(pppipebreakagearray[rowloop][colloop]);
                ppUpdateGameScore(ppfilledpipescore, ppGameTimerTickMS * 4, rowloop, colloop);
                for (var i = 0; i < breakage; i++) // bonus for repaired pipes that are filled
                    ppUpdateGameScore(ppfilledpipescore * 2, ppGameTimerTickMS * 8, rowloop, colloop, i + 1);

                if (ppboardarray[rowloop][colloop] == 1) {
                    ppReachedOutlet = true;
                    ppUpdateGameScore(ppfilledendpointscore, ppGameTimerTickMS * 4, rowloop, colloop, 1); //bonus for filling the endpoint
                }

                // Is it a leaky pipe? If so break out of both for-next loops.
                if (ppdeadpipesarray[rowloop][colloop] >= ppfilledcounterbase + ppleakypipeval) {
                    leakypipefound = true;
                    break;
                }

            } else {
                if (ppdeadpipesarray[rowloop][colloop] > ppfillpipespasscounter && ppdeadpipesarray[rowloop][colloop] < ppdeadpipeval) nomorepipes = false;
            }
        }

        if (leakypipefound) break;
    }

    ppfillpipespasscounter++;

    if (!leakypipefound && !nomorepipes) {} else {
        ppGameState = ppGamestateEnum.DONE;
        ppSoundCue(leakypipefound ? 'leak' : ppReachedOutlet ? 'success' : 'dry');
        renderGameStatus();
        ppGameTickTimer.pause();

        // Update and persist the best score together.
        if (ppscore > pphighscore) {
            pphighscore = ppscore;
            ppdisplayanumber(pphighscore, 4, "hscore");
            // Save the high score
            ppSetHighscore(pphighscore, ppbattlemodeseed);
        }
    }
}


function ppbreakpipes() {
    if (ppGameState != ppGamestateEnum.BUILDING)
        return;
    if (pipebreakprob == 0)
        return;
    if (ppgametimer > ppstartbreakingpipesseconds)
        return;

    var row = 0;
    var column = 0;

    // Show all filled pipes onscreen for this passcounter.
    for (row = 0; row < pprows; row++) {
        for (column = 0; column < ppcolumns; column++) {
            pipeid = ppboardarray[row][column];
            breakage = pppipebreakagearray[row][column];

            if (!((pipeid > 1) && (pipeid != ppnullpipeval)))
                continue;

            fracbreakage = breakage - Math.floor(breakage);
            if (fracbreakage == 0)
                if (ppRNG2.random() < 1 - (pipebreakprob))
                    continue;

            if (fracbreakage <= 1 - pppipebreakagestep)
                breakage += pppipebreakagestep;
            else
                ppboardarray[row][column] = ppnullpipeval; //finally broken!

            setBoardImage(row, column, "empty", pipeid, breakage - Math.floor(breakage));
            pppipebreakagearray[row][column] = breakage;
            //debug("broken pipe r"+row+" c"+column+": "+breakage);
        }

    }

}

// main dispacher routine: gets called periodically
function ppExecGameTick() {
    if (levelMode && levelMode.tick()) return;

    ppGameTick++;
    //debug("tick "+ppGameTick);

    gametimerperiod = Math.round(1000 / ppGameTimerTickMS);

    if (ppGameTick % gametimerperiod == 0)
        ppdecgametimer();

    ppcleardeadpipes();
    ppfillpipes();
    ppbreakpipes();


}


function ppfillpipesnow() {
    if (levelMode && levelMode.hasRound()) {
        levelMode.fill();
        return;
    }
    if (!ppgamepaused && ppGameState == ppGamestateEnum.BUILDING) {
        ppUpdateGameScore(ppgametimer * ppfillnowscore, 1500, -1, -1);
        ppcreatedeadpipesarray();
        ppGameState = ppGamestateEnum.CLEARINGDEAD; // Fill now!
        renderGameStatus();
    }
}



function debug_array(a) {
    var debugstring = "";

    for (rowloop = 0; rowloop < pprows; rowloop++) {
        for (colloop = 0; colloop < ppcolumns; colloop++) {
            switch (a[rowloop][colloop]) {
                case ppnullpipeval:
                    debugstring = debugstring + "___|";
                    break;

                case ppdeadpipeval:
                    debugstring = debugstring + "XXX|";
                    break;

                default:
                    if (a[rowloop][colloop] < 10) debugstring = debugstring + "__";
                    else if (a[rowloop][colloop] < 100) debugstring = debugstring + "_";

                    debugstring = debugstring + a[rowloop][colloop] + "|";
                    break;
            }
        }

        debugstring = debugstring + "<br>";
    }

    debug(debugstring);
}

function ppprocessboardclick(boardyx) {
    if (!ppCanRenderBoard()) return;
    if (levelMode && levelMode.hasRound()) {
        return levelMode.press(Number(boardyx.substr(5,2)), Number(boardyx.substr(7,2)));
    }
    var count = 0;
    var row = 0;
    var column = 0;

    if (ppgamepaused)
        return 'tapPaused';

    if (ppGameState != ppGamestateEnum.BUILDING)
        return ppGameState === ppGamestateEnum.DONE ? 'tapRoundDone' : 'flowing';

    // Get and record yx.
    row = Math.abs(boardyx.substr(5, 2));
    column = Math.abs(boardyx.substr(7, 2));

    //debug(boardyx+" row:"+row+" col:"+column);

    // Don't allow replacing of the end points.
    if (ppboardarray[row][column] > 1) {
        // Place pipe piece from start of preview array.
        setBoardImage(row, column, "empty", pppreviewarray[0]);

        breakage = pppipebreakagearray[row][column];
        fracbreakage = breakage - Math.floor(breakage);

        if ((ppboardarray[row][column] != ppnullpipeval) && (fracbreakage == 0)) {
            ppUpdateGameScore(pppipeoverwritescore, 800 * ppIndicateScore, row, column);

        } else {
            ppUpdateGameScore(pppipeplacementscore, 800 * ppIndicateScore, row, column);
        }

        ppboardarray[row][column] = pppreviewarray[0];
        pppipebreakagearray[row][column] = Math.ceil(breakage);

        // Move all preview pieces down 1 place.
        for (count = 0; count < 3; count++) {
            pppreviewarray[count] = pppreviewarray[count + 1];
            setBoardImage("preview" + count, 0, "empty", pppreviewarray[count]);
        }

        // Add a new preview piece at the end.
        pppreviewarray[3] = ppgetnextpipepiece();
        setBoardImage("preview3", 0, "empty", pppreviewarray[3]);

    } else return 'tapTerminal';
}

function ppToggleScoreIndication() {
    ppIndicateScore = !ppIndicateScore;
}

function ppreset(battlemodeseed, difficulty) {
    if (levelMode) levelMode.exit();
    var count = 0;
    var endpoint = 0;
    var colloop = 0;
    var rowloop = 0;
    var column = 0;
    var row = 0;

    debug("Reset game");

    ppGameTickTimer.pause();
    ppGameTick = 0;

    ppReachedOutlet = false;
    var staleMarkers = document.querySelectorAll(".scoreMarker");
    for (var i = 0; i < staleMarkers.length; i++) {
        staleMarkers[i].parentNode.removeChild(staleMarkers[i]);
    }

    //seed the RNG
    if ((battlemodeseed == undefined) || (battlemodeseed == 0)) { // random game
        ppRNG = new MersenneTwister();
        ppRNG2 = new MersenneTwister();
        ppbattlemodeseed = 0;

    } else { // deterministic game "battle mode"
        ppbattlemodeseed = battlemodeseed;
        ppRNG = new MersenneTwister(ppbattlemodeseed);
        ppRNG2 = new MersenneTwister(ppbattlemodeseed);
    }

    if (difficulty != undefined)
        ppdifficulty = difficulty;
    else
        ppdifficulty = 0;

    ppinfinite = ppdifficulty === -1 ? 1 : 0;
    if (ppinfinite) ppdifficulty = 0;
    pipebreakprob = pipebreakprob_base * ppdifficulty;
    pppipebreakagestep = pppipebreakagestep_base * (ppdifficulty + 1);

    //clear pppipearray
    pppipearray = new Array(pppipearraysize);
    pppipearraypointer = pppipearraysize;

    // Clear game board and array.
    for (rowloop = 0; rowloop < pprows; rowloop++) {
        for (colloop = 0; colloop < ppcolumns; colloop++) {
            setBoardImage(rowloop, colloop, "blank")
            ppboardarray[rowloop][colloop] = ppnullpipeval; // Empty squares are ppnullpipeval.
            pppipebreakagearray[rowloop][colloop] = 0;
        }
    }

    // Setup and initialise preview pieces/array.
    for (count = 0; count < 4; count++) {
        pppreviewarray[count] = ppgetnextpipepiece();
        setBoardImage("preview" + count, 0, "empty", pppreviewarray[count]);
    }

    // Place end points and record in game board array.
    endpoint = Math.floor(ppRNG.random() * (ppcolumns - 1));
    ppboardarray[endpoint][0] = 1; // yx
    setBoardImage(endpoint, 0, "empty", 1);
    endpoint = Math.floor(ppRNG.random() * (ppcolumns - 1));
    ppboardarray[endpoint][pprows - 1] = 0; // yx
    setBoardImage(endpoint, pprows - 1, "empty", 0);

    pphighscore = ppGetHighscore(ppbattlemodeseed);
    ppdisplayanumber(pphighscore, 4, "hscore");
    ppscore = 0;
    ppdisplayanumber(ppscore, 4, "score");

    // Set off the game timer.
    ppgametimer = ppgametimerseconds;
    ppdisplayanumber(ppgametimer, 3, "timer");

    ppGameState = ppGamestateEnum.BUILDING;
    if (!ppgamepaused) ppGameTickTimer.resume();
    renderGameStatus();
}

function renderGameStatus() {
    ppSyncSound();
    if (levelMode && levelMode.hasRound()) {
        levelMode.render();
        return;
    }
    document.getElementById('fillButton').textContent = tr('fill');
    var building = ppGameState === ppGamestateEnum.BUILDING;
    var done = ppGameState === ppGamestateEnum.DONE;
    var labels = [];
    if (ppinfinite) labels.push(tr('unlimited'));
    if (ppbattlemodeseed) labels.push(tr('challenge') + ' ' + ppbattlemodeseed);
    document.getElementById('headline').textContent = labels.join(' · ');
    var status = document.getElementById('gameStatus');
    status.className = done ? (ppReachedOutlet ? 'pump-result-win' : 'pump-result-issue') : '';
    status.textContent =
        tr(building ? 'ready' : done ? (ppReachedOutlet ? 'connected' : 'stopped') : 'flowing');
    document.getElementById('fillButton').disabled = !building || ppgamepaused || !ppCanRenderBoard();
    if (typeof PumpBoard !== 'undefined') PumpBoard.refresh();
}

function ppgetnextpipepiece() {
    // Get next piece from the pipe array, or if at end
    // of array refill it and get piece from start.
    pppipearraypointer++;

    if (pppipearraypointer >= pppipearraysize) {
        ppfillpipearray();
        pppipearraypointer = 0;
    }

    return pppipearray[pppipearraypointer];
}

function ppfillpipearray() {

    var nextpointer = 0;
    var count = 0;
    var temp = 0;
    var swap = 0;

    // Fill pipe array with our recommended frequency.
    nextpointer = ppfillpipearraypieces(2, 7, nextpointer);
    nextpointer = ppfillpipearraypieces(3, 7, nextpointer);
    nextpointer = ppfillpipearraypieces(4, 7, nextpointer);
    nextpointer = ppfillpipearraypieces(5, 7, nextpointer);
    nextpointer = ppfillpipearraypieces(6, 5, nextpointer);
    nextpointer = ppfillpipearraypieces(7, 5, nextpointer);
    nextpointer = ppfillpipearraypieces(8, 5, nextpointer);
    nextpointer = ppfillpipearraypieces(9, 5, nextpointer);
    nextpointer = ppfillpipearraypieces(10, 5, nextpointer);
    nextpointer = ppfillpipearraypieces(11, 18, nextpointer);
    nextpointer = ppfillpipearraypieces(12, 18, nextpointer);
    nextpointer = ppfillpipearraypieces(13, 4, nextpointer);
    nextpointer = ppfillpipearraypieces(14, 4, nextpointer);
    nextpointer = ppfillpipearraypieces(15, 4, nextpointer);
    nextpointer = ppfillpipearraypieces(16, 4, nextpointer);

    // Go through the pipe array and shuffle the pieces. This maintains frequency :)
    // Fiddle with the above figures to tweek it, but don't forget the array size
    // is set as a constant and will need to be adjusted accordingly.
    for (count = 0; count < pppipearraysize; count++) {
        temp = pppipearray[count];
        swap = Math.floor(ppRNG.random() * (pppipearraysize - 1));
        pppipearray[count] = pppipearray[swap];
        pppipearray[swap] = temp;
    }
}

function ppfillpipearraypieces(pipepiece, frequency, nextpointer) {
    while (frequency > 0) {
        pppipearray[nextpointer] = pipepiece;
        nextpointer++;

        if (nextpointer >= pppipearraysize) nextpointer = 0;

        frequency--;
    }

    return nextpointer;
}

function ppdecgametimer() {
    if (ppGameState != ppGamestateEnum.BUILDING)
        return;

    ppgametimer--;
    ppdisplayanumber(ppgametimer, 3, "timer");

    if ((ppinfinite == 0) && (ppgametimer <= 0)) {
        ppfillpipesnow();
    };

}


// ------------------------------------------------------------------
// UI
// ------------------------------------------------------------------


// --- Load all images used within document. ---
function ppSoundCue(name) {
    if (typeof PumpAudio !== 'undefined') PumpAudio.play(name);
}

function ppSyncSound() {
    if (typeof PumpAudio !== 'undefined') PumpAudio.sync();
}

function ppCanRenderBoard() {
    return typeof PumpBoard === 'undefined' || PumpBoard.active();
}

function ppscale() {
    var stage = document.getElementById('boardStage');
    var width = document.getElementById('topBar').clientWidth;
    var wide = window.innerWidth >= 520 && window.innerWidth > window.innerHeight;
    var availableHeight = window.innerHeight - stage.getBoundingClientRect().top - 20;
    var size = levelMode ? levelMode.size() : [ppcolumns, pprows];
    if (typeof PumpBoard !== 'undefined') PumpBoard.fit(width, availableHeight, wide, size);
}

function findBoardElId(row, column) {
    if (row < 10) row = "0" + row;

    if (column < 10) column = "0" + column;

    return "board" + row + column;
}

function setBoardImage(row, column, pipetype, pipeid, breakage) {
    var id = typeof row === 'string' ? row : findBoardElId(row, column);
    var tile = document.getElementById(id);
    tile.pumpPipe = pipetype === 'blank' ? null :
        {id:pipeid, filled:pipetype === 'full', broken:breakage > 0};
    if (typeof PumpBoard !== 'undefined') PumpBoard.refresh();
}


function ppUpdateGameScore(diff, displayms, row, col, count) {
    debug("score at r" + row + " c" + col + ": " + diff);

    ppscore = ppscore + diff;
    ppdisplayanumber(ppscore, 4, "score");

    if (displayms > 0) {
        if ((row >= 0) && (col >= 0))
            el = document.getElementById(findBoardElId(row, col));
        else
            el = document.getElementById("timer1");

        var marker = document.createElement("div");
        marker.className = "scoreMarker";


        if (diff > 0) {
            marker.style.backgroundColor = "#3CB93C";
            text = "+" + diff;

        } else {
            marker.style.backgroundColor = "#B93C3C";
            text = "" + diff;
        }

        var projected = typeof PumpBoard !== 'undefined' && row >= 0 && col >= 0
            ? PumpBoard.marker(row,col) : null;
        var box = projected || {left:el.offsetLeft,top:el.offsetTop,width:el.offsetWidth,height:el.offsetHeight};
        toppos = Math.max(0,box.top - box.height * 0.7);
        leftpos = box.left + (col === ppcolumns - 1 ? 0 : box.width * 0.7);
        if (count > 0) toppos += 0.5 * count * box.height;

        width = box.height;
        height = box.height * 0.7;
        fontsize = box.height * (text.length > 3 ? 0.25 : 0.4);
        paddingTop = box.height * 0.2;

        marker.style.top = "" + toppos + "px";
        marker.style.left = "" + leftpos + "px";
        marker.style.width = "" + width + "px";
        marker.style.height = "" + height + "px";
        marker.style.fontSize = "" + fontsize + "px";
        marker.style.paddingTop = "" + paddingTop + "px";

        var markertext = document.createTextNode(text);
        marker.appendChild(markertext);

        document.body.appendChild(marker);

        window.setTimeout(function() {
            if (marker.parentNode) marker.parentNode.removeChild(marker);
        }, displayms);
    }
}

function ppdisplayanumber(number, digits, target) {
    var label = document.getElementById(target === 'timer' ? 'timer1' : target);
    label.textContent = String(number).replace('-', '−');
}

function pauseGame() {
    ppGameTickTimer.pause();
    ppgamepaused = true;
    if (levelMode) levelMode.onPause();
    renderGameStatus();
    if (typeof PumpBoard !== 'undefined') PumpBoard.refresh();
}

function resumeGame() {
    var wasPaused = ppgamepaused;
    ppgamepaused = false;
    if ((!levelMode || !levelMode.sync()) && wasPaused && ppGameState !== ppGamestateEnum.DONE) {
        ppGameTickTimer.resume();
    }
    renderGameStatus();
    if (typeof PumpBoard !== 'undefined') PumpBoard.refresh();
}


function help(show) {
    if (levelMode) levelMode.help(show);
    else document.getElementById("game").hidden = !!show;
    document.getElementById("help").style.display = show ? "block" : "none";
    window.scrollTo(0, 0);
    if (!show) ppscale();
}

function debug(dbg) {
    // Upstream tracing disabled in normal play; no hidden DOM log grows during a round.
}

// ------------------------------------------------------------------
// AUX
// ------------------------------------------------------------------



function resetHighscore() {
    ppSetHighscore(0, ppbattlemodeseed);
    pphighscore = 0;
    ppdisplayanumber(0, 4, "hscore");
}

function ppSetHighscore(value, battlemodeseed) {
    item = "";

    if (battlemodeseed > 0)
        item = "_" + battlemodeseed;

    window.localStorage.setItem("pphighscore" + item, value);
}

function ppGetHighscore(battlemodeseed) {
    item = "";

    if (battlemodeseed > 0)
        item = "_" + battlemodeseed;

    val = window.localStorage.getItem("pphighscore" + item);

    if (val == null)
        val = 0;

    return val;
}


function TimerInterval(action, delay) {
    this.timerId = null;
    this.action = action;
    this.interval = delay;
    this.running = true;

    //debug("create interval timer " + action + " " + delay );
    this.resume = function() {
        if (this.timerId != null)
            window.clearInterval(this.timerId);

        if (this.running && (this.action != null)) {
            this.timerId = window.setInterval(this.runnow.bind(this), this.interval);
        }
    };
    this.pause = function() {
        if (this.timerId != null)
            window.clearInterval(this.timerId);
        this.timerId = null;
    };
    this.stop = function() {
        this.running = false;
    };
    this.runnow = function() {
        //debug("TIMER interval srun:" + this.action);
        if (this.action != null)
            eval(this.action);
    };
    this.resume();
}
