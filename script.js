// script.js — microinteractions: confetti + accessibility enhancements
(function(){
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Simple confetti implementation
  function makeConfetti(x, y, count = 40) {
    if (prefersReduced) return;
    let canvas = document.getElementById('confetti-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'confetti-canvas';
      document.body.appendChild(canvas);
      canvas.style.position = 'fixed';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = 9999;
      resizeCanvas(canvas);
      window.addEventListener('resize', () => resizeCanvas(canvas));
    }
    const ctx = canvas.getContext('2d');
    const colors = ['#ff6b6b','#ffb4b4','#ffd6a5','#ffd1dc','#ff7ab6','#dc2626'];
    const w = canvas.width, h = canvas.height;

    const particles = [];
    for(let i=0;i<count;i++){
      particles.push({
        x: x + (Math.random()-0.5)*40,
        y: y + (Math.random()-0.5)*20,
        vx: (Math.random()-0.5)*6,
        vy: Math.random()*-6 - 2,
        life: 60 + Math.round(Math.random()*40),
        color: colors[Math.floor(Math.random()*colors.length)],
        size: 6 + Math.random()*8
      });
    }

    let frame = 0;
    function render(){
      frame++;
      ctx.clearRect(0,0,w,h);
      for(let i=particles.length-1;i>=0;i--){
        const p = particles[i];
        p.vy += 0.25; // gravity
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        if(p.life<=0 || p.y>h+50) particles.splice(i,1);
      }
      if(particles.length>0) requestAnimationFrame(render);
      else ctx.clearRect(0,0,w,h);
    }
    requestAnimationFrame(render);
  }

  function resizeCanvas(canvas){
    const dpr = window.devicePixelRatio || 1;
    canvas.width = document.documentElement.clientWidth * dpr;
    canvas.height = document.documentElement.clientHeight * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  // Hook up envelope open to add confetti and better keyboard access
  const envelope = document.querySelector('.envelope');
  if(envelope){
    envelope.addEventListener('click', (e)=>{
      envelope.setAttribute('aria-pressed','true');
      const rect = envelope.getBoundingClientRect();
      const x = rect.left + rect.width/2;
      const y = rect.top + rect.height/2;
      makeConfetti(x,y,50);
      // Try to start background music on first user interaction
      tryStartBackgroundMusic();
    });
    envelope.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); envelope.click(); }
    });
    envelope.tabIndex = 0;
  }

  // Button microinteractions
  document.querySelectorAll('.yes-button').forEach(btn=>{
    btn.addEventListener('click', (ev)=>{
      const rect = ev.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width/2;
      const y = rect.top + rect.height/2;
      makeConfetti(x,y,36);
      // subtle scale pulse
      ev.currentTarget.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(1.06)' },
        { transform: 'scale(1)' }
      ],{ duration: 350, easing: 'ease-out' });
    });
  });

  // Improve countdown ARIA updates
  const countdown = document.getElementById('countdown');
  if(countdown){
    const originalTick = window.updateCountdown;
    // If updateCountdown exists as a global, wrap it to also set an accessible label
    if(typeof originalTick === 'function'){
      const original = originalTick.bind(window);
      let proceedLocked = false;
      const proceedBtn = document.getElementById('proceed-btn');

      function setProceedLocked(lock){
        proceedLocked = !!lock;
        if(proceedBtn){
          proceedBtn.setAttribute('aria-disabled', proceedLocked ? 'true' : 'false');
        }
      }

      // Try to proceed — exposed to global because the HTML uses inline onclick
      window.tryProceed = function(){
        if(proceedLocked){
          if(proceedBtn){
            proceedBtn.classList.remove('locked-shake');
            // force reflow to restart animation
            // eslint-disable-next-line no-unused-expressions
            void proceedBtn.offsetWidth;
            proceedBtn.classList.add('locked-shake');
            setTimeout(()=> proceedBtn.classList.remove('locked-shake'), 600);
          }
          return;
        }
        // allowed — navigate
        goToPage(2);
      };

      window.updateCountdown = function(){
        original();
        countdown.setAttribute('aria-label', 'Time remaining: ' + countdown.textContent);

        // Always unlock the proceed button (removed date lock)
        setProceedLocked(false);
      };
    }

    /* ----------------------
       Background audio glue
       ---------------------- */
    const audio = document.getElementById('audio-player');
    const globalPlayBtn = document.getElementById('global-play-btn');
    const globalProgressFill = document.getElementById('global-progress-fill');
    const globalVolume = document.getElementById('global-volume');
    const globalMuteBtn = document.getElementById('global-mute-btn');
    const pagePlayBtn = document.getElementById('play-pause-btn');
    const pageProgressBar = document.getElementById('progress-bar');
    const pagePrev = document.getElementById('prev-btn');
    const pageNext = document.getElementById('next-btn');

    function updatePlayUI(){
      const isPlaying = audio && !audio.paused && !audio.ended;
      if(globalPlayBtn) globalPlayBtn.textContent = isPlaying ? '⏸' : '▶';
      if(pagePlayBtn) pagePlayBtn.textContent = isPlaying ? '⏸' : '▶';
    }

    function updateMuteUI(){
      if(!globalMuteBtn || !audio) return;
      if(audio.muted){
        globalMuteBtn.textContent = '🔇';
        globalMuteBtn.setAttribute('aria-label','Unmute background music');
      } else {
        globalMuteBtn.textContent = '🔊';
        globalMuteBtn.setAttribute('aria-label','Mute background music');
      }
    }

    function updateProgress(){
      if(!audio || !audio.duration || isNaN(audio.duration)) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      if(globalProgressFill) globalProgressFill.style.width = pct + '%';
      if(pageProgressBar) pageProgressBar.style.width = pct + '%';
    }

    function togglePlay(){
      if(!audio) return;
      if(audio.paused){
        audio.play().catch(()=>{});
        localStorage.setItem('valentines_playing','1');
      } else {
        audio.pause();
        localStorage.setItem('valentines_playing','0');
      }
      updatePlayUI();
    }

    function toggleMute(){
      if(!audio) return;
      audio.muted = !audio.muted;
      localStorage.setItem('valentines_muted', audio.muted ? '1' : '0');
      updateMuteUI();
    }

    function tryStartBackgroundMusic(){
      if(!audio) return;
      // If user previously asked music on, or this is a direct user interaction, try play
      const wanted = localStorage.getItem('valentines_playing');
      if(wanted === '1' || true){
        audio.play().then(()=>{
          updatePlayUI();
        }).catch(()=>{
          // autoplay blocked — UI shows play button
          updatePlayUI();
        });
      }
    }

    // Hook up buttons
    if(globalPlayBtn) globalPlayBtn.addEventListener('click', togglePlay);
    if(pagePlayBtn) pagePlayBtn.addEventListener('click', togglePlay);
    if(pagePrev) pagePrev.addEventListener('click', ()=>{ if(audio) audio.currentTime = 0; });
    if(pageNext) pageNext.addEventListener('click', ()=>{ if(audio) audio.currentTime = 0; });
    if(globalMuteBtn) globalMuteBtn.addEventListener('click', toggleMute);

    // Volume control: initialize from localStorage or default
    (function initVolume(){
      if(!globalVolume || !audio) return;
      const saved = parseFloat(localStorage.getItem('valentines_volume'));
      const start = (isNaN(saved) ? 0.6 : Math.max(0, Math.min(1, saved)));
      globalVolume.value = start;
      audio.volume = start;

      globalVolume.addEventListener('input', (e)=>{
        const v = parseFloat(e.target.value);
        if(!isNaN(v) && audio) audio.volume = v;
        localStorage.setItem('valentines_volume', v);
      });
    })();

    // Update progress as audio plays
    if(audio){
      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('play', ()=>{ updatePlayUI(); localStorage.setItem('valentines_playing','1'); });
      audio.addEventListener('pause', ()=>{ updatePlayUI(); localStorage.setItem('valentines_playing','0'); });
      audio.addEventListener('ended', ()=>{ updatePlayUI(); localStorage.setItem('valentines_playing','0'); });
    }

    // On load, restore desired play state (attempt to play if previously playing)
    window.addEventListener('load', ()=>{
      const wanted = localStorage.getItem('valentines_playing');
      if(wanted === '1'){
        tryStartBackgroundMusic();
      }
      // restore mute preference
      const muted = localStorage.getItem('valentines_muted');
      if(audio && muted === '1') audio.muted = true;
      updateMuteUI();
      updatePlayUI();
      updateProgress();
    });
  }

})();
