// Localized interface text. The Android shell supplies the system primary language.
var gameLanguage = 'en';
var gameText = {
    en: { name: 'PipePanic', best: 'Best', score: 'Score', time: 'Time', fill: 'Fill pipes',
          challenge: 'Challenge', unlimited: 'Unlimited', next: 'Next pipe', queue: 'Queue',
          inlet: 'Inlet', outlet: 'Outlet', ready: 'Tap a square to place the next pipe.',
          flowing: 'Water is flowing…', stopped: 'Water stopped before the outlet.',
          connected: 'Water reached the outlet!', menu: 'Menu', seconds: 's', pumpBoard: '3D pipe board' },
    zh: { name: '水管危机', best: '最高分', score: '得分', time: '时间', fill: '灌水',
          challenge: '挑战', unlimited: '无限练习', next: '下一件', queue: '管件队列',
          inlet: '入口', outlet: '出口', ready: '点棋盘放下下一件管件。',
          flowing: '正在灌水…', stopped: '水流未到达出口。',
          connected: '水流已抵达出口！', menu: '菜单', seconds: '秒', pumpBoard: '立体水管棋盘' }
};
Object.assign(gameText.en, {
    "renderLoading": "Loading 3D…",
    "renderUnavailable": "3D is unavailable. Reopen the game or check WebGL 2 support.",
    "soundOn": "Sound on",
    "soundOff": "Sound off",
    "levelMenu": "Levels",
    "levelBack": "Back",
    "puzzle": "Puzzles",
    "repair": "Repairs",
    "fork": "Two outlets",
    "daily": "Daily challenge",
    "puzzleDescription": "Place a fixed set of pipes with no time limit. The last two puzzles teach branching.",
    "repairDescription": "Use the next pipe to replace a marked fault. You have only two or three replacements.",
    "forkDescription": "Use the junction to send water to both red outlets without any leaks.",
    "dailyDescription": "Same board and queue for everyone on each Beijing date. Play offline and beat your best time.",
    "levelContinue": "Continue level",
    "playToday": "Play today",
    "continueToday": "Continue today's challenge",
    "puzzleGoal": "Connect the green inlet to the red outlet.",
    "repairGoal": "Replace marked faults to seal the network.",
    "forkGoal": "Send water to both red outlets.",
    "piecesLeft": "Pieces left",
    "replacements": "Replacements left",
    "elapsed": "Time",
    "bestTime": "Best time",
    "levelReady": "Place the next pipe, then test the flow.",
    "levelTestReady": "Test the flow or undo your last move.",
    "repairInvalid": "Tap a marked pipe that still needs repair.",
    "levelInvalid": "Choose an empty square. Walls and fixed pipes stay in place.",
    "tapPaused": "Game paused. Choose Resume in the menu.",
    "tapTerminal": "The inlet and outlets are fixed. Tap another square.",
    "tapQueueEmpty": "No pipes left. Test the flow or undo a move.",
    "tapRetry": "Test finished. Undo a move or retry.",
    "tapLevelDone": "Level complete. Retry or choose another level.",
    "tapRoundDone": "Round over. Start a new game from the menu.",
    "hintSwitch": "Hint",
    "hintPlace": "Place the next pipe in the highlighted square.",
    "hintPark": "Park this pipe in the amber square.",
    "hintReady": "Route ready. Test the flow.",
    "hintUndo": "Undo a move to recover the route.",
    "levelWon": "Level complete!",
    "levelLeak": "Leaks marked in red. Undo or retry.",
    "levelShort": "An outlet is still dry. Undo or retry.",
    "testWater": "Test flow",
    "levelUndo": "Undo",
    "levelRetry": "Retry",
    "levelNext": "Next level"
});
Object.assign(gameText.zh, {
    "renderLoading": "正在载入 3D…",
    "renderUnavailable": "3D 无法显示，请重新打开游戏或检查 WebGL 2 支持。",
    "soundOn": "音效开",
    "soundOff": "音效关",
    "levelMenu": "关卡",
    "levelBack": "返回",
    "puzzle": "解谜关卡",
    "repair": "抢修模式",
    "fork": "一进多出",
    "daily": "每日挑战",
    "puzzleDescription": "按固定队列放管，没有时间限制。最后两关要用三通分流。",
    "repairDescription": "用下一件管件替换标有感叹号的故障管，每关只有两到三次替换机会。",
    "forkDescription": "用三通分流，让水无泄漏地到达两个红色出口。",
    "dailyDescription": "按北京时间每天换题，同一天的棋盘和管件顺序相同。可离线挑战最快通关时间。",
    "levelContinue": "继续关卡",
    "playToday": "开始今日挑战",
    "continueToday": "继续今日挑战",
    "puzzleGoal": "从绿色入口接到红色出口。",
    "repairGoal": "替换标出的故障管，堵住漏口。",
    "forkGoal": "让水到达两个红色出口。",
    "piecesLeft": "剩余管件",
    "replacements": "剩余替换",
    "elapsed": "用时",
    "bestTime": "最快",
    "levelReady": "放置下一件管件，接好后试水。",
    "levelTestReady": "可以试水，也可以撤回上一步。",
    "repairInvalid": "请选择还没修好的故障管。",
    "levelInvalid": "请选择空格，墙和固定管件不能改动。",
    "tapPaused": "对局已暂停，请在菜单中点继续游戏。",
    "tapTerminal": "进出水口不能替换，请点其他方格。",
    "tapQueueEmpty": "管件已用完，请点试水或撤回。",
    "tapRetry": "试水已结束，可撤回或重试。",
    "tapLevelDone": "本关已完成，可重试或选择其他关卡。",
    "tapRoundDone": "本局已结束，请在菜单中开始新局。",
    "hintSwitch": "提示",
    "hintPlace": "把下一根管件放到亮起的格子。",
    "hintPark": "这根先放到金色暂存格。",
    "hintReady": "路线已接好，可以试水。",
    "hintUndo": "请撤回一步，再继续接管。",
    "levelWon": "通关成功！",
    "levelLeak": "漏口已标红，可以撤回或重试。",
    "levelShort": "还有出口未接通，可以撤回或重试。",
    "testWater": "试水",
    "levelUndo": "撤回",
    "levelRetry": "重试",
    "levelNext": "下一关"
});
function tr(key) { return gameText[gameLanguage][key]; }
function setGameLanguage(language) {
    gameLanguage = language === 'zh' ? 'zh' : 'en';
    document.documentElement.lang = gameLanguage === 'zh' ? 'zh-CN' : 'en';
    document.title = tr('name');
    ['pumpBoard'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.setAttribute) el.setAttribute('aria-label',tr(id));
    });
    var elements = document.querySelectorAll('[data-text]');
    for (var i = 0; i < elements.length; i++) {
        elements[i].textContent = tr(elements[i].getAttribute('data-text'));
    }
    document.getElementById('help-en').hidden = gameLanguage !== 'en';
    document.getElementById('help-zh').hidden = gameLanguage !== 'zh';
    if (typeof levelMode !== 'undefined' && levelMode) levelMode.languageChanged();
    if (typeof PumpAudio !== 'undefined') PumpAudio.label();
    if (typeof renderGameStatus === 'function') renderGameStatus();
}
