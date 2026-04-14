/* Reward signals — audio chime + confetti animation on save-as-complete.
 * Both are independently toggleable via settings (audioEnabled, confettiEnabled).
 * Defaults: both enabled.
 */
(function () {
  'use strict';

  const db = window.Uptrack.db;

  /* ---------- Audio chime ----------
   * Synthesised using the Web Audio API — no external files needed.
   * Plays a pleasant two-tone ascending chime.
   */
  function playChime() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var now = ctx.currentTime;

      function tone(freq, start, dur, gain) {
        var osc = ctx.createOscillator();
        var vol = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        vol.gain.setValueAtTime(gain, start);
        vol.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(vol);
        vol.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      }

      tone(659, now, 0.25, 0.15);       // E5
      tone(880, now + 0.12, 0.3, 0.12); // A5
      tone(1047, now + 0.25, 0.4, 0.08); // C6

      setTimeout(function () { ctx.close(); }, 1200);
    } catch (e) {
      // AudioContext not available — silently skip
    }
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

    // Default to enabled if never set
    if (audioEnabled !== false) playChime();
    if (confettiEnabled !== false) burstConfetti();
  }

  window.Uptrack = window.Uptrack || {};
  window.Uptrack.rewards = { fire: fire, playChime: playChime, burstConfetti: burstConfetti };
})();
