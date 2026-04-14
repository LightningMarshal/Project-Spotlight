/* Reward signals — audio chime + confetti animation on save-as-complete.
 * Both are independently toggleable via settings (audioEnabled, confettiEnabled).
 * Defaults: both enabled.
 */
(function () {
  'use strict';

  const db = window.Uptrack.db;

  /* ---------- Audio sound library ----------
   * All sounds are synthesised via the Web Audio API — no external files,
   * no copyright concerns, no CSP impact. Each theme is a function that
   * accepts an AudioContext and a start time, and schedules its oscillators.
   */

  function makeContext() {
    return new (window.AudioContext || window.webkitAudioContext)();
  }

  /* Schedule a single sine tone with attack + exponential decay. */
  function tone(ctx, freq, start, dur, gain, type) {
    var osc = ctx.createOscillator();
    var vol = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    vol.gain.setValueAtTime(0.0001, start);
    vol.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    vol.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  /* Bell-like tone: fundamental + inharmonic partials at bell ratios.
   * The 2.4x and 4.2x partials give that distinctive metallic "ping". */
  function bell(ctx, freq, start, dur, gain) {
    tone(ctx, freq,        start, dur,       gain);
    tone(ctx, freq * 2,    start, dur * 0.7, gain * 0.5);
    tone(ctx, freq * 2.4,  start, dur * 0.5, gain * 0.35); // inharmonic
    tone(ctx, freq * 4.2,  start, dur * 0.3, gain * 0.18); // shimmer
  }

  /* THEME: Ascending chime — the original default. */
  function theme_chime(ctx, t) {
    tone(ctx, 659,  t,        0.25, 0.15);  // E5
    tone(ctx, 880,  t + 0.12, 0.30, 0.12);  // A5
    tone(ctx, 1047, t + 0.25, 0.40, 0.08);  // C6
  }

  /* THEME: Bright Bell — cheerful single bell ping, in the family of
   * notification tones. Inspired by generic retail "payment success"
   * chimes; not a reproduction of any specific copyrighted sound. */
  function theme_bell(ctx, t) {
    bell(ctx, 1318, t,        0.7, 0.18); // E6 ping
    bell(ctx, 1760, t + 0.05, 0.9, 0.12); // A6 overlay
  }

  /* THEME: Fanfare — triumphant ascending triad on a brass-like waveform. */
  function theme_fanfare(ctx, t) {
    tone(ctx, 523,  t,        0.15, 0.14, 'triangle'); // C5
    tone(ctx, 659,  t + 0.10, 0.15, 0.14, 'triangle'); // E5
    tone(ctx, 784,  t + 0.20, 0.15, 0.14, 'triangle'); // G5
    tone(ctx, 1047, t + 0.30, 0.60, 0.18, 'triangle'); // C6 (sustained)
    tone(ctx, 1319, t + 0.30, 0.60, 0.12, 'triangle'); // E6 (harmony)
  }

  /* THEME: Soft Ding — single gentle bell, quick and quiet. */
  function theme_ding(ctx, t) {
    bell(ctx, 1047, t, 0.6, 0.14); // C6
  }

  /* THEME: Level Up — video-game-style rising pentatonic arpeggio. */
  function theme_levelup(ctx, t) {
    tone(ctx, 523,  t,        0.08, 0.12, 'square'); // C5
    tone(ctx, 659,  t + 0.08, 0.08, 0.12, 'square'); // E5
    tone(ctx, 784,  t + 0.16, 0.08, 0.12, 'square'); // G5
    tone(ctx, 880,  t + 0.24, 0.08, 0.12, 'square'); // A5
    tone(ctx, 1047, t + 0.32, 0.35, 0.14, 'square'); // C6
  }

  /* THEME: Success Chord — major triad struck simultaneously with bell
   * partials, medium decay. */
  function theme_success(ctx, t) {
    bell(ctx, 659,  t, 0.8, 0.12); // E5
    bell(ctx, 831,  t, 0.8, 0.12); // G#5
    bell(ctx, 988,  t, 0.8, 0.12); // B5
  }

  var SOUND_THEMES = {
    chime:   { label: 'Ascending Chime',  play: theme_chime },
    bell:    { label: 'Bright Bell',      play: theme_bell },
    fanfare: { label: 'Fanfare',          play: theme_fanfare },
    ding:    { label: 'Soft Ding',        play: theme_ding },
    levelup: { label: 'Level Up',         play: theme_levelup },
    success: { label: 'Success Chord',    play: theme_success }
  };

  var DEFAULT_THEME = 'chime';

  function playTheme(themeKey) {
    try {
      var theme = SOUND_THEMES[themeKey] || SOUND_THEMES[DEFAULT_THEME];
      var ctx = makeContext();
      theme.play(ctx, ctx.currentTime);
      setTimeout(function () { ctx.close(); }, 2000);
    } catch (e) {
      // AudioContext not available — silently skip
    }
  }

  /* Back-compat: original playChime() now plays the currently-selected theme. */
  async function playChime() {
    var themeKey = await db.getSetting('soundTheme');
    playTheme(themeKey || DEFAULT_THEME);
  }

  /* ---------- Confetti burst ----------
   * Multi-colored cannon burst from bottom of screen with varied particle
   * shapes (rectangles, circles, streamers), sparkle, and gravity.
   * Canvas is created on demand and removed after animation.
   */
  function burstConfetti() {
    var canvas = document.getElementById('confetti-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'confetti-canvas';
      document.body.appendChild(canvas);
    }
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    var ctx = canvas.getContext('2d');

    /* Vibrant multicolor palette — rainbow + metallics */
    var PALETTE = [
      '#e8923e', // amber (brand)
      '#f04e4e', // red
      '#f0a050', // orange
      '#ffd93d', // yellow
      '#6bcb77', // green
      '#4dabf7', // blue
      '#9775fa', // purple
      '#f06595', // pink
      '#ffffff', // white sparkle
      '#ffe066'  // gold
    ];

    var SHAPES = ['rect', 'circle', 'streamer', 'star'];
    var particles = [];
    var count = 180;

    /* Two burst origins: bottom-left and bottom-right, fanning upward */
    var origins = [
      { x: canvas.width * 0.2, y: canvas.height + 10, angle: -Math.PI / 3 },
      { x: canvas.width * 0.8, y: canvas.height + 10, angle: -2 * Math.PI / 3 }
    ];

    for (var i = 0; i < count; i++) {
      var origin = origins[i % 2];
      /* Spread particles in a cone around the origin angle */
      var spread = (Math.random() - 0.5) * (Math.PI / 1.5);
      var angle = origin.angle + spread;
      var speed = 12 + Math.random() * 14;
      var shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];

      particles.push({
        x: origin.x + (Math.random() - 0.5) * 40,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: 6 + Math.random() * 8,
        h: 8 + Math.random() * 14,
        r: 3 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.35,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        shape: shape,
        opacity: 1,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.08 + Math.random() * 0.08
      });
    }

    var frame = 0;
    var maxFrames = 200;
    var gravity = 0.32;
    var drag = 0.992;

    function drawStar(cx, cy, r) {
      ctx.beginPath();
      for (var j = 0; j < 5; j++) {
        var a = (j * 2 * Math.PI) / 5 - Math.PI / 2;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        var a2 = a + Math.PI / 5;
        ctx.lineTo(cx + Math.cos(a2) * r * 0.45, cy + Math.sin(a2) * r * 0.45);
      }
      ctx.closePath();
      ctx.fill();
    }

    function draw() {
      frame++;
      if (frame > maxFrames) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var fadeStart = maxFrames * 0.6;
      var fade = frame > fadeStart ? Math.max(0, 1 - (frame - fadeStart) / (maxFrames - fadeStart)) : 1;

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.vx *= drag;
        p.vy = p.vy * drag + gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.rotV;
        p.wobble += p.wobbleSpeed;
        p.opacity = fade;

        ctx.save();
        ctx.translate(p.x + Math.sin(p.wobble) * 3, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'streamer') {
          /* Long thin rectangle — ribbon/streamer */
          ctx.fillRect(-p.w / 4, -p.h, p.w / 2, p.h * 2);
        } else if (p.shape === 'star') {
          drawStar(0, 0, p.r + 2);
        }

        ctx.restore();
      }
      requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
  }

  /* ---------- Public API ----------
   * fire() checks settings and triggers enabled effects.
   */
  async function fire() {
    var audioEnabled = await db.getSetting('audioEnabled');
    var confettiEnabled = await db.getSetting('confettiEnabled');
    var themeKey = await db.getSetting('soundTheme');

    // Default to enabled if never set
    if (audioEnabled !== false) playTheme(themeKey || DEFAULT_THEME);
    if (confettiEnabled !== false) burstConfetti();
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.rewards = {
    fire: fire,
    playChime: playChime,
    playTheme: playTheme,
    burstConfetti: burstConfetti,
    SOUND_THEMES: SOUND_THEMES,
    DEFAULT_THEME: DEFAULT_THEME
  };
})();
