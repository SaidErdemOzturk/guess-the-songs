import type { Song } from '@/types/song';

export type AudioProgressCallback = (currentSeconds: number, progressRatio: number) => void;

// Dahili melodik akor dizileri (Song modelinde saklanmak yerine ses servisinin dahili sentezinde kullanılır)
const DEFAULT_MELODIES: number[][] = [
  [587.33, 659.25, 698.46, 783.99, 880.0, 783.99, 698.46, 659.25],
  [440.0, 523.25, 659.25, 587.33, 523.25, 440.0, 392.0, 440.0],
  [329.63, 392.0, 440.0, 493.88, 523.25, 493.88, 440.0, 392.0],
  [349.23, 392.0, 440.0, 523.25, 440.0, 392.0, 349.23, 293.66],
  [261.63, 329.63, 392.0, 523.25, 440.0, 392.0, 329.63, 261.63],
  [293.66, 349.23, 440.0, 523.25, 587.33, 523.25, 440.0, 349.23],
  [392.0, 440.0, 493.88, 587.33, 493.88, 440.0, 392.0, 329.63],
  [220.0, 261.63, 329.63, 392.0, 329.63, 261.63, 220.0, 196.0],
];

class WebAudioService {
  private audioCtx: AudioContext | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private isPlaying: boolean = false;
  private globalVolume: number = 0.75;
  private isMuted: boolean = false;
  private stopTimeoutId: number | null = null;
  private animationFrameId: number | null = null;
  private currentProgressCallback: AudioProgressCallback | null = null;

  private initAudio(): void {
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public playSongClip(
    song: Song,
    durationInSeconds: number,
    onEnd?: () => void,
    onProgress?: AudioProgressCallback
  ): void {
    this.initAudio();
    this.stopCurrentAudio();

    if (!this.audioCtx) {
      if (onEnd) onEnd();
      return;
    }

    this.isPlaying = true;
    this.currentProgressCallback = onProgress || null;

    const masterGain = this.audioCtx.createGain();
    masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.globalVolume, this.audioCtx.currentTime);
    masterGain.connect(this.audioCtx.destination);

    // Şarkıya özel dahili melodik dizi
    const melodyIndex = Math.abs(song.id || 0) % DEFAULT_MELODIES.length;
    const notes = DEFAULT_MELODIES[melodyIndex];
    const noteDuration = 0.28;
    const totalNotes = notes.length;
    const startTime = this.audioCtx.currentTime;
    const startPerfTime = performance.now();

    const repeatCount = Math.ceil(durationInSeconds / (noteDuration * totalNotes)) + 2;
    const initialNoteOffset = Math.floor((song.startSecond || 0) / noteDuration) % totalNotes;
    let noteIndex = 0;

    for (let r = 0; r < repeatCount; r++) {
      for (let i = 0; i < totalNotes; i++) {
        const currentNoteFreq = notes[(i + initialNoteOffset) % totalNotes];
        const noteTime = startTime + noteIndex * noteDuration;
        if (noteTime - startTime >= durationInSeconds) break;

        const osc = this.audioCtx.createOscillator();
        const noteGain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(currentNoteFreq, noteTime);

        // Envelope (Zarf)
        noteGain.gain.setValueAtTime(0.001, noteTime);
        noteGain.gain.linearRampToValueAtTime(0.28, noteTime + 0.04);
        noteGain.gain.exponentialRampToValueAtTime(0.001, noteTime + noteDuration - 0.02);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(noteTime);
        osc.stop(noteTime + noteDuration);

        this.activeOscillators.push(osc);
        noteIndex++;
      }
    }

    // Canlı İlerleme Takibi
    const updateProgress = () => {
      if (!this.isPlaying) return;

      const elapsedSeconds = (performance.now() - startPerfTime) / 1000;
      const clampedSeconds = Math.min(durationInSeconds, Math.max(0, elapsedSeconds));
      const ratio = durationInSeconds > 0 ? clampedSeconds / durationInSeconds : 0;

      if (this.currentProgressCallback) {
        this.currentProgressCallback(clampedSeconds, ratio);
      }

      if (elapsedSeconds < durationInSeconds) {
        this.animationFrameId = requestAnimationFrame(updateProgress);
      }
    };

    this.animationFrameId = requestAnimationFrame(updateProgress);

    this.stopTimeoutId = window.setTimeout(() => {
      if (this.currentProgressCallback) {
        this.currentProgressCallback(durationInSeconds, 1);
      }
      this.stopCurrentAudio();
      if (onEnd) onEnd();
    }, durationInSeconds * 1000);
  }

  public stopCurrentAudio(): void {
    if (this.stopTimeoutId !== null) {
      clearTimeout(this.stopTimeoutId);
      this.stopTimeoutId = null;
    }

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch {
        // Durdurulmuş olabilir
      }
    });

    this.activeOscillators = [];
    this.isPlaying = false;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setVolume(volume: number): void {
    this.globalVolume = Math.max(0, Math.min(1, volume));
    if (this.globalVolume === 0) {
      this.isMuted = true;
    }
  }

  public getVolume(): number {
    return this.globalVolume;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export const webAudioService = new WebAudioService();
