/**
 * WiamApp Notification Sound System
 * Generates 5 notification tones using Web Audio API
 */
(function(){
'use strict';

var _ctx = null;
function getCtx() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    return _ctx;
}

// Resume context on user interaction (required by browsers)
function resumeCtx() {
    try { var c = getCtx(); if (c.state === 'suspended') c.resume(); } catch(e){}
}
document.addEventListener('click', resumeCtx, {once: true});
document.addEventListener('touchstart', resumeCtx, {once: true});

// ── Tone Definitions ─────────────────────────────────────────────
// Each tone is a function that plays a short sound

var tones = {
    chime: function() {
        // Bright two-note chime (C6 → E6)
        var ctx = getCtx(), t = ctx.currentTime;
        _playNote(ctx, 1047, t, 0.15, 0.4, 'sine');
        _playNote(ctx, 1319, t + 0.12, 0.2, 0.35, 'sine');
    },
    bell: function() {
        // Rich bell with harmonic
        var ctx = getCtx(), t = ctx.currentTime;
        _playNote(ctx, 880, t, 0.3, 0.35, 'sine');
        _playNote(ctx, 1760, t, 0.2, 0.15, 'sine');
        _playNote(ctx, 2640, t, 0.12, 0.08, 'sine');
    },
    drop: function() {
        // Descending water drop
        var ctx = getCtx(), t = ctx.currentTime;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.25);
    },
    ping: function() {
        // Short crisp ping
        var ctx = getCtx(), t = ctx.currentTime;
        _playNote(ctx, 1568, t, 0.08, 0.45, 'sine');
        _playNote(ctx, 2093, t + 0.06, 0.1, 0.3, 'sine');
        _playNote(ctx, 2637, t + 0.1, 0.12, 0.2, 'sine');
    },
    marimba: function() {
        // Warm marimba-like three-note
        var ctx = getCtx(), t = ctx.currentTime;
        _playNote(ctx, 523, t, 0.12, 0.4, 'triangle');
        _playNote(ctx, 659, t + 0.1, 0.12, 0.35, 'triangle');
        _playNote(ctx, 784, t + 0.2, 0.15, 0.3, 'triangle');
    }
};

function _playNote(ctx, freq, startTime, duration, volume, type) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
}

// ── Public API ───────────────────────────────────────────────────

window.WiamNotifSound = {
    play: function(name) {
        try {
            resumeCtx();
            var fn = tones[name] || tones.chime;
            fn();
        } catch(e) { console.warn('Sound error:', e); }
    },
    preview: function(name) {
        this.play(name);
    },
    tones: Object.keys(tones)
};

})();
