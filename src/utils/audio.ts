// Child Narrator Voice & Interactive Sound Manager for Preschoolers (Ages 3–6)

export const ANIMAL_AUDIO_MAP: Record<string, string> = {};

class SoundManager {
  private audioCtx: AudioContext | null = null;
  public enabled: boolean = true;
  private childVoice: SpeechSynthesisVoice | null = null;

  // Background music audio node references
  private bgMusicGainNode: GainNode | null = null;
  private isBgMusicPlaying: boolean = false;
  private bgTimerId: any = null;
  private isDucked: boolean = false;

  constructor() {
    this.initVoice();
    this.setupGlobalClickUnlocker();
  }

  // Auto-start audio context & background music on first user click/touch
  private setupGlobalClickUnlocker() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.getContext();
      this.startBackgroundMusic();
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
    window.addEventListener('keydown', unlock);
  }

  // Initialize SpeechSynthesis voice selection for consistent warm female storyteller voice
  private initVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoiceList = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;

      // Strictly exclude male voices
      const maleVoiceNames = ['david', 'mark', 'george', 'alex', 'guy', 'james', 'daniel', 'male', 'adam', 'fred', 'bruce'];
      const nonMaleVoices = voices.filter(
        (v) => !maleVoiceNames.some((m) => v.name.toLowerCase().includes(m))
      );

      const candidateVoices = nonMaleVoices.length > 0 ? nonMaleVoices : voices;

      // Prefer warm, natural female teacher / storyteller voices
      const preferredNames = [
        'samantha',
        'karen',
        'victoria',
        'zira',
        'jenny',
        'moira',
        'veena',
        'heera',
        'neerja',
        'kalpana',
        'google us english',
        'google uk english female',
        'english (united states)',
        'en-us',
        'en-gb',
      ];

      let selected = candidateVoices.find((v) =>
        preferredNames.some((name) => v.name.toLowerCase().includes(name))
      );

      if (!selected) {
        selected = candidateVoices.find((v) => v.lang === 'en-US' || v.lang.startsWith('en'));
      }

      if (selected) {
        this.childVoice = selected;
      }
    };

    updateVoiceList();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoiceList;
    }
  }

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  // --- SUBTLE PRE-SCHOOL BACKGROUND MUSIC SYNTHESIZER ---
  public startBackgroundMusic() {
    if (this.isBgMusicPlaying || !this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.isBgMusicPlaying = true;
    this.bgMusicGainNode = ctx.createGain();
    // Default soft volume: 0.035
    const targetGain = this.isDucked ? 0.008 : 0.035;
    this.bgMusicGainNode.gain.setValueAtTime(targetGain, ctx.currentTime);
    this.bgMusicGainNode.connect(ctx.destination);

    // Pentatonic Major gentle lullaby notes (C4, E4, G4, A4, C5, D5, E5, G5)
    const freqs = [261.63, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99];
    const pattern = [0, 2, 4, 3, 1, 5, 4, 2, 0, 3, 2, 6, 4, 1, 3, 0];
    let noteIdx = 0;

    const playNextNote = () => {
      if (!this.isBgMusicPlaying || !this.bgMusicGainNode || !this.enabled) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        // Warm soft sine/triangle hybrid note for gentle marimba/bell sound
        osc.type = 'triangle';
        const freq = freqs[pattern[noteIdx % pattern.length]];
        osc.frequency.setValueAtTime(freq, now);

        // Gentle envelope
        noteGain.gain.setValueAtTime(0.001, now);
        noteGain.gain.linearRampToValueAtTime(0.25, now + 0.08);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc.connect(noteGain);
        noteGain.connect(this.bgMusicGainNode);

        osc.start(now);
        osc.stop(now + 1.25);

        noteIdx++;
      } catch {
        // ignore
      }

      this.bgTimerId = setTimeout(playNextNote, 650);
    };

    playNextNote();
  }

  public stopBackgroundMusic() {
    this.isBgMusicPlaying = false;
    if (this.bgTimerId) {
      clearTimeout(this.bgTimerId);
      this.bgTimerId = null;
    }
    if (this.bgMusicGainNode) {
      try {
        this.bgMusicGainNode.disconnect();
      } catch {
        // ignore
      }
      this.bgMusicGainNode = null;
    }
  }

  // Lower bg music when narration/speech is active
  public duckBackgroundMusic() {
    this.isDucked = true;
    if (this.bgMusicGainNode && this.audioCtx) {
      try {
        this.bgMusicGainNode.gain.setValueAtTime(0.008, this.audioCtx.currentTime);
      } catch {
        // ignore
      }
    }
  }

  // Restore bg music when narration finishes
  public restoreBackgroundMusic() {
    this.isDucked = false;
    if (this.bgMusicGainNode && this.audioCtx) {
      try {
        this.bgMusicGainNode.gain.setValueAtTime(0.035, this.audioCtx.currentTime);
      } catch {
        // ignore
      }
    }
  }

  // Play cheerful button click / pop sound
  playPop() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(850, ctx.currentTime + 0.09);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {
      // Audio context fallback
    }
  }

  // Play cute cartoon eating / munching sound
  playMunch() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const munches = [
        { freq: 480, endFreq: 340, time: 0, dur: 0.1 },
        { freq: 520, endFreq: 380, time: 0.12, dur: 0.1 },
        { freq: 620, endFreq: 440, time: 0.24, dur: 0.14 },
      ];

      munches.forEach((m) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(m.freq, ctx.currentTime + m.time);
        osc.frequency.exponentialRampToValueAtTime(m.endFreq, ctx.currentTime + m.time + m.dur);

        gain.gain.setValueAtTime(0.22, ctx.currentTime + m.time);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + m.time + m.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + m.time);
        osc.stop(ctx.currentTime + m.time + m.dur);
      });
    } catch {
      // Audio context fallback
    }
  }

  // Play soft sparkle chime / reinforcement music for correct answers
  playSuccess() {
    this.playReinforcementMusic();
  }

  // Play rich upbeat reinforcement music chime on correct answer
  playReinforcementMusic() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      // Upbeat 5-note ascending major chime arpeggio: C5, E5, G5, C6, E6
      const notes = [
        { freq: 523.25, time: 0, dur: 0.32, gain: 0.22 },
        { freq: 659.25, time: 0.07, dur: 0.34, gain: 0.22 },
        { freq: 783.99, time: 0.14, dur: 0.36, gain: 0.24 },
        { freq: 1046.5, time: 0.21, dur: 0.42, gain: 0.26 },
        { freq: 1318.51, time: 0.28, dur: 0.48, gain: 0.22 },
      ];

      notes.forEach((n) => {
        // Primary warm chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.time);

        gain.gain.setValueAtTime(n.gain, ctx.currentTime + n.time);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.time + n.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + n.time);
        osc.stop(ctx.currentTime + n.time + n.dur);

        // Shimmering bell harmonic layer
        const oscHarmonic = ctx.createOscillator();
        const gainHarmonic = ctx.createGain();

        oscHarmonic.type = 'sine';
        oscHarmonic.frequency.setValueAtTime(n.freq * 2, ctx.currentTime + n.time);

        gainHarmonic.gain.setValueAtTime(n.gain * 0.35, ctx.currentTime + n.time);
        gainHarmonic.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.time + (n.dur * 0.7));

        oscHarmonic.connect(gainHarmonic);
        gainHarmonic.connect(ctx.destination);

        oscHarmonic.start(ctx.currentTime + n.time);
        oscHarmonic.stop(ctx.currentTime + n.time + (n.dur * 0.7));
      });
    } catch {
      // Audio context fallback
    }
  }

  // Play magical star catch glockenspiel chime
  playStarCatch() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      // Ascending high crystal bell chime: G5, C6, E6, G6
      const chimes = [783.99, 1046.5, 1318.51, 1567.98];
      chimes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.06);

        gain.gain.setValueAtTime(0.24, ctx.currentTime + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.06 + 0.38);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.06);
        osc.stop(ctx.currentTime + idx * 0.06 + 0.4);
      });
    } catch {
      // Audio context fallback
    }
  }

  // Play soft twinkling sparkle sound
  playStarTwinkle() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime); // D6
      osc.frequency.exponentialRampToValueAtTime(1760.0, ctx.currentTime + 0.12); // A6

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // Audio context fallback
    }
  }

  // Play satisfying clean room tidy snap chime
  playTidySnap() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      // Warm xylophone double-pop: E5 -> A5
      const notes = [659.25, 880.0];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);

        gain.gain.setValueAtTime(0.22, ctx.currentTime + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.07);
        osc.stop(ctx.currentTime + idx * 0.07 + 0.3);
      });
    } catch {
      // Audio context fallback
    }
  }

  // Play magical sparkle sweep when room is fully cleaned
  playSparkleSweep() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const arpeggio = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
      arpeggio.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

        gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.4);
      });
    } catch {
      // Audio context fallback
    }
  }

  // Play happy celebration fanfare after activity completion
  playCelebration() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const melody = [523.25, 659.25, 783.99, 880, 1046.5]; // C5, E5, G5, A5, C6
      melody.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.1);

        gain.gain.setValueAtTime(0.25, ctx.currentTime + index * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + index * 0.1 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + index * 0.1);
        osc.stop(ctx.currentTime + index * 0.1 + 0.35);
      });
    } catch {
      // Audio context fallback
    }
  }

  // Play gentle, non-scary error sound for incorrect choices
  playError() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.18);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // Audio context fallback
    }
  }

  // Play crisp scissors snip / string release sound for kite cutting
  playSnipCut() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // High quick dual snap for scissors snip
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1600, now);
      osc1.frequency.exponentialRampToValueAtTime(800, now + 0.05);

      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.06);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2200, now + 0.04);
      osc2.frequency.exponentialRampToValueAtTime(1100, now + 0.09);

      gain2.gain.setValueAtTime(0.25, now + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.04);
      osc2.stop(now + 0.1);
    } catch {
      // Audio context fallback
    }
  }

  // Play soft wind whoosh as kite flies away upward into the sky
  playKiteFlyAway() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.28);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      // Audio context fallback
    }
  }

  // Play traffic light switch chime
  playTrafficLightSwitch() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Audio context fallback
    }
  }

  // Play cute cartoon car beep beep
  playCarHonk() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [0, 0.1].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(580, now + delay);

        gain.gain.setValueAtTime(0.18, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.07);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.07);
      });
    } catch {
      // Audio context fallback
    }
  }

  // Play gentle vehicle brake squeak
  playBrakeStop() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.18);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Audio context fallback
    }
  }

  // Play playful sound effect for animal or shape fallback
  playAnimalTone(soundType: string) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (soundType.includes('roar') || soundType.includes('lion')) {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.3);
      } else if (soundType.includes('duck') || soundType.includes('quack')) {
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.setValueAtTime(250, ctx.currentTime + 0.15);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
      }

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio fallback
    }
  }

  // Stop any active text-to-speech synthesis immediately
  stopSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Fallback
      }
    }
    this.restoreBackgroundMusic();
  }

  /**
   * Speak text using Web Speech API configured with a warm, friendly female teacher storyteller voice.
   * Rate = 0.88 (gentle, expressive, easy for 3-6 year olds)
   * Pitch = 1.15 (warm, natural female voice pitch)
   */
  speak(text: string, onEnd?: () => void) {
    if (!this.enabled) {
      if (onEnd) onEnd();
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        // Duck background music while speaking so narration is crisp and loud
        this.duckBackgroundMusic();

        // Resume if speech synthesis engine is paused or stuck
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        // Cancel previous speech to prevent overlapping or stale audio
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Warm Female Teacher Storyteller Voice Parameters:
        utterance.rate = 0.88;  // Clear, friendly storyteller pace
        utterance.pitch = 1.15; // Natural warm female teacher tone
        utterance.lang = 'en-US';

        if (!this.childVoice) {
          this.initVoice();
        }
        if (this.childVoice) {
          utterance.voice = this.childVoice;
        }

        let hasCalled = false;
        const triggerEnd = () => {
          this.restoreBackgroundMusic();
          if (!hasCalled) {
            hasCalled = true;
            if (onEnd) onEnd();
          }
        };

        utterance.onend = triggerEnd;
        utterance.onerror = triggerEnd;

        // 50ms delay after cancel() ensures Chrome & WebKit process cancel before queueing speak()
        setTimeout(() => {
          try {
            if (window.speechSynthesis.paused) {
              window.speechSynthesis.resume();
            }
            window.speechSynthesis.speak(utterance);
          } catch {
            triggerEnd();
          }
        }, 50);
      } catch {
        this.restoreBackgroundMusic();
        if (onEnd) onEnd();
      }
    } else {
      if (onEnd) onEnd();
    }
  }

  private songAnimFrame: number | null = null;
  private songStartTime: number = 0;
  private isSongPlaying: boolean = false;

  public resumeContext(): AudioContext | null {
    return this.getContext();
  }

  public unlockMobileAudio(audioElement?: HTMLAudioElement | null) {
    const ctx = this.getContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      try {
        const silentBuffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(ctx.destination);
        source.start(0);
      } catch {
        // ignore
      }
    }

    if (audioElement) {
      try {
        audioElement.setAttribute('playsinline', 'true');
        audioElement.setAttribute('webkit-playsinline', 'true');
      } catch {
        // ignore
      }
    }
  }

  public isNurserySongPlaying(): boolean {
    return this.isSongPlaying;
  }

  public getNurserySongElapsed(): number {
    if (!this.isSongPlaying || !this.audioCtx) return 0;
    const elapsed = this.audioCtx.currentTime - this.songStartTime;
    return Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 0;
  }

  private songSourceNode: AudioBufferSourceNode | null = null;
  private cachedAudioBuffer: AudioBuffer | null = null;
  private cachedAudioUrl: string | null = null;

  public async preloadSongBuffer(url: string = '/rhyme.mp3', forceReload: boolean = false) {
    const ctx = this.getContext();
    if (!ctx) return;
    if (this.cachedAudioBuffer && this.cachedAudioUrl === url && !forceReload) return;
    try {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      this.cachedAudioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.cachedAudioUrl = url;
    } catch (err) {
      console.warn('Failed to load nursery song buffer:', err);
    }
  }

  async playNurserySong(startFromSec: number = 0, audioUrl?: string, onProgress?: (sec: number) => void, onEnded?: () => void) {
    this.stopNurserySong();
    const ctx = this.getContext();
    if (!ctx) return;

    if (!this.cachedAudioBuffer || (audioUrl && this.cachedAudioUrl !== audioUrl)) {
      await this.preloadSongBuffer(audioUrl || '/rhyme.mp3');
    }

    this.isSongPlaying = true;
    const safeStartSec = Number.isFinite(startFromSec) && startFromSec > 0 ? startFromSec : 0;
    this.songStartTime = ctx.currentTime - safeStartSec;

    if (this.cachedAudioBuffer) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = this.cachedAudioBuffer;
        source.connect(ctx.destination);
        source.start(0, safeStartSec);
        this.songSourceNode = source;

        source.onended = () => {
          if (this.isSongPlaying) {
            this.isSongPlaying = false;
            if (onEnded) onEnded();
          }
        };
      } catch (e) {
        console.warn('Web Audio buffer source start error:', e);
      }
    }

    const totalDuration = this.cachedAudioBuffer ? this.cachedAudioBuffer.duration : 39.0;

    const updateLoop = () => {
      if (!this.isSongPlaying || !this.audioCtx) return;
      const elapsed = this.audioCtx.currentTime - this.songStartTime;
      if (onProgress) onProgress(elapsed);

      if (elapsed >= totalDuration) {
        this.stopNurserySong();
        if (onEnded) onEnded();
      } else {
        this.songAnimFrame = requestAnimationFrame(updateLoop);
      }
    };

    this.songAnimFrame = requestAnimationFrame(updateLoop);
  }

  stopNurserySong() {
    this.isSongPlaying = false;
    if (this.songSourceNode) {
      try {
        this.songSourceNode.stop();
        this.songSourceNode.disconnect();
      } catch {
        // ignore
      }
      this.songSourceNode = null;
    }
    if (this.songAnimFrame) {
      cancelAnimationFrame(this.songAnimFrame);
      this.songAnimFrame = null;
    }
  }
}

export const soundManager = new SoundManager();

