(() => {
  let audioContext = null;
  let muted = localStorage.getItem('lexiconSoundMuted') === '1';

  function getAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }

  function tone({ frequency = 700, duration = 0.045, volume = 0.025, type = 'square', delay = 0, endFrequency = null }) {
    if (muted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const start = ctx.currentTime + delay;
    const end = start + duration;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, end);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.008, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.01);
  }

  function playInput() {
    tone({ frequency: 880, endFrequency: 1120, duration: 0.035, volume: 0.018, type: 'square' });
  }

  function playError() {
    tone({ frequency: 170, endFrequency: 105, duration: 0.13, volume: 0.035, type: 'sawtooth' });
    tone({ frequency: 135, endFrequency: 90, duration: 0.1, volume: 0.02, type: 'square', delay: 0.055 });
  }

  function playComplete() {
    tone({ frequency: 440, endFrequency: 660, duration: 0.09, volume: 0.026, type: 'square' });
    tone({ frequency: 660, endFrequency: 880, duration: 0.1, volume: 0.028, type: 'square', delay: 0.09 });
    tone({ frequency: 880, endFrequency: 1320, duration: 0.18, volume: 0.03, type: 'triangle', delay: 0.19 });
    tone({ frequency: 1320, duration: 0.22, volume: 0.016, type: 'sine', delay: 0.34 });
  }

  function updateSoundButton() {
    const button = document.getElementById('soundBtn');
    if (!button) return;
    button.textContent = muted ? 'SOUND: OFF' : 'SOUND: ON';
    button.setAttribute('aria-pressed', String(!muted));
  }

  function addSoundButton() {
    const actions = document.querySelector('.actions');
    if (!actions || document.getElementById('soundBtn')) return;

    const button = document.createElement('button');
    button.id = 'soundBtn';
    button.type = 'button';
    button.className = 'secondary';
    button.addEventListener('click', () => {
      muted = !muted;
      localStorage.setItem('lexiconSoundMuted', muted ? '1' : '0');
      updateSoundButton();
      if (!muted) playInput();
    });
    actions.appendChild(button);
    updateSoundButton();
  }

  document.addEventListener('input', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!input.closest('#crossword')) return;
    if (input.value) playInput();
  });

  document.getElementById('checkBtn')?.addEventListener('click', () => {
    const result = document.getElementById('result')?.textContent || '';
    if (result.includes('SEQUENCE COMPLETE')) playComplete();
    else playError();
  });

  addSoundButton();
})();
