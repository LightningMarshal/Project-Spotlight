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
   * Renders ~60 falling particles on a full-screen canvas.
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

    var particles = [];
    var AMBER = ['#e8923e', '#d4a054', '#c48940', '#b87a30', '#f0a050', '#d07020'];
    var count = 60;

    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height * 0.5,
        w: 4 + Math.random() * 6,
        h: 6 + Math.random() * 10,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.2,
        color: AMBER[Math.floor(Math.random() * AMBER.length)],
        opacity: 0.9 + Math.random() * 0.1
      });
    }

    var frame = 0;
    var maxFrames = 120;

    function draw() {
      frame++;
      if (frame > maxFrames) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var progress = frame / maxFrames;

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.rot += p.rotV;
        p.opacity = Math.max(0, 0.9 * (1 - progress));

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
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
