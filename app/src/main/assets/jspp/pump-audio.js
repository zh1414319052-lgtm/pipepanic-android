// Offline pump-station effects. Gameplay owns every cue and the flow phase.
var PumpAudio = (function () {
    var context, master, flow;
    var buffers = {};
    var effects = [];
    var muted = false;
    var volume = 0.78;
    var storageKey = 'pp-sound-muted';

    function audible() {
        return !muted && !document.hidden && !ppgamepaused &&
            !document.getElementById('game').hidden && PumpBoard.active();
    }

    function bufferFor(name) {
        if (buffers[name]) return buffers[name];
        var pcm = atob(PumpSounds.samples[name]);
        var buffer = context.createBuffer(1, pcm.length / 2, PumpSounds.rate);
        var samples = buffer.getChannelData(0);
        for (var i = 0; i < samples.length; i++) {
            var sample = pcm.charCodeAt(i * 2) | (pcm.charCodeAt(i * 2 + 1) << 8);
            samples[i] = (sample >= 32768 ? sample - 65536 : sample) / 32768;
        }
        buffers[name] = buffer;
        return buffer;
    }

    function start(name, gain, loop) {
        var source = context.createBufferSource();
        var channel = context.createGain();
        var now = context.currentTime;
        source.buffer = bufferFor(name);
        source.loop = loop;
        channel.gain.setValueAtTime(loop ? 0 : gain, now);
        if (loop) channel.gain.linearRampToValueAtTime(gain, now + .24);
        source.connect(channel);
        channel.connect(master);
        var voice = {source:source, channel:channel};
        source.onended = function () {
            source.disconnect();
            channel.disconnect();
            effects = effects.filter(function (effect) { return effect !== voice; });
        };
        source.start();
        return voice;
    }

    function fade(voice, seconds) {
        var now = context.currentTime;
        var gain = voice.channel.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
        gain.linearRampToValueAtTime(0, now + seconds);
        voice.source.stop(now + seconds);
    }

    function sync() {
        if (!context) return;
        var enabled = audible();
        master.gain.setTargetAtTime(enabled ? volume : 0, context.currentTime, .015);
        var flowing = enabled && (levelMode && levelMode.hasRound()
            ? levelMode.isFlowing() : ppGameState === ppGamestateEnum.FILLING);
        if (flowing && !flow && context.state === 'running') flow = start('flow', 1, true);
        if (!flowing && flow) {
            fade(flow, .13);
            flow = null;
        }
        if (!enabled) {
            effects.forEach(function (effect) { fade(effect, .04); });
            effects = [];
        }
    }

    function unlock() {
        if (muted) return;
        try {
            if (!context) {
                var Audio = window.AudioContext || window.webkitAudioContext;
                if (!Audio) return;
                context = new Audio();
                master = context.createGain();
                master.gain.value = audible() ? volume : 0;
                master.connect(context.destination);
                context.onstatechange = sync;
            }
            if (context.state !== 'running') context.resume().then(sync, function () {});
        } catch (error) {
            console.warn('PipePanic sound unavailable: ' + error.message);
        }
    }

    function play(name) {
        if (!context || !audible()) return;
        if (context.state !== 'running' && !(navigator.userActivation && navigator.userActivation.isActive)) return;
        try {
            if (effects.length >= 8) fade(effects.shift(), .02);
            effects.push(start(name, 1, false));
        } catch (error) {
            console.warn('PipePanic sound cue unavailable: ' + error.message);
        }
    }

    function label() {
        var button = document.getElementById('soundSwitch');
        button.textContent = tr(muted ? 'soundOff' : 'soundOn');
        button.setAttribute('aria-pressed', String(!muted));
    }

    function init() {
        try { muted = localStorage.getItem(storageKey) === '1'; } catch (error) {}
        label();
        document.addEventListener('click', unlock, true);
        document.addEventListener('keydown', unlock, true);
        document.addEventListener('visibilitychange', sync);
        document.getElementById('soundSwitch').addEventListener('click', function () {
            muted = !muted;
            try { localStorage.setItem(storageKey, muted ? '1' : '0'); } catch (error) {}
            if (!muted) unlock();
            label();
            sync();
            if (!muted) play('place');
        });
    }

    return {init:init, sync:sync, play:play, label:label};
})();
