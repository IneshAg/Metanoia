/**
 * Pomodoro Alerting Engine: Audio synthesis & OS Notifications
 */

export function playPomodoroChime(type: 'work_complete' | 'break_complete') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'work_complete') {
      // Warm, resonant, cheerful 4-note bell chime: C5, E5, G5, C6 (523.25, 659.25, 783.99, 1046.50)
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      // Play sequence twice so it's unmistakable even in background
      [0, 1.05].forEach((delay) => {
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle'; // Richer harmonics than basic sine
          
          const t = ctx.currentTime + delay + idx * 0.15;
          osc.frequency.setValueAtTime(freq, t);
          
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.24, t + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.58);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.62);
        });
      });
    } else {
      // Energizing break-complete chime: G4 -> C5 -> G5 -> E6
      const freqs = [392.00, 523.25, 783.99, 1318.51];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        
        const t = ctx.currentTime + idx * 0.14;
        osc.frequency.setValueAtTime(freq, t);
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.26, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.75);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.8);
      });
    }
  } catch (err) {
    console.warn('Audio synthesis notification warning:', err);
  }
}

let flashTitleInterval: number | null = null;

export function sendDesktopNotification(title: string, body: string) {
  if (typeof window === 'undefined') return;

  // Flash document title in browser / taskbar
  const originalTitle = 'Metanoia · Playful Workspace';
  if (flashTitleInterval) {
    clearInterval(flashTitleInterval);
    flashTitleInterval = null;
  }

  let count = 0;
  flashTitleInterval = window.setInterval(() => {
    count++;
    document.title = count % 2 === 0 ? `🔔 ${title}` : `☕ Take a Break · Metanoia`;
    if (count >= 10) {
      if (flashTitleInterval) clearInterval(flashTitleInterval);
      flashTitleInterval = null;
      document.title = originalTitle;
    }
  }, 1000);

  // Native Web Notifications API
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          silent: false,
        });
      } catch {}
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          try {
            new Notification(title, {
              body,
              icon: '/favicon.ico',
              silent: false,
            });
          } catch {}
        }
      });
    }
  }
}
