import {useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {
  FolderOpen,
  Heart,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  ThumbsDown,
  Volume1,
  Volume2,
  VolumeX,
  Sparkles,
  Plus,
  X,
  Search,
  Shuffle,
  ListMusic,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  loadMusicTracks,
  saveMusicTracks,
  removeMusicTrack,
  loadMusicTaste,
  saveMusicTaste,
  type SavedTrack
} from './api';
import {invoke, isTauri, convertFileSrc} from '@tauri-apps/api/core';

type Taste = Record<string, 1 | -1>;

export type AudioProfileKey = 'studio' | 'warm' | 'bass' | 'vocal' | 'flat';

export interface AudioProfileConfig {
  name: string;
  label: string;
  icon: string;
  desc: string;
  lowGain: number;       // dB at 90Hz (warm bass shelf)
  midGain: number;       // dB at 2.6kHz (parametric peaking presence)
  midQ: number;
  highGain: number;      // dB at 10kHz (silky air shelf)
  compThreshold: number; // dB (dynamic headroom limiter)
  compRatio: number;
  compKnee: number;
  compAttack: number;
  compRelease: number;
}

export const AUDIO_PROFILES: Record<AudioProfileKey, AudioProfileConfig> = {
  studio: {
    name: 'Studio Hi-Fi Master',
    label: 'Studio Master',
    icon: '🎧',
    desc: 'Deep warm bass, silky highs & true-peak limiter for crisp, non-distorted sound',
    lowGain: 4.8,
    midGain: 1.6,
    midQ: 0.85,
    highGain: 3.8,
    compThreshold: -8,
    compRatio: 2.2,
    compKnee: 10,
    compAttack: 0.003,
    compRelease: 0.20,
  },
  warm: {
    name: 'Warm Focus & Lo-Fi',
    label: 'Warm & Lo-Fi',
    icon: '☕',
    desc: 'Velvety analog warmth, tamed harsh treble for long focus sessions with zero ear fatigue',
    lowGain: 5.2,
    midGain: -0.6,
    midQ: 1.0,
    highGain: -2.0,
    compThreshold: -9,
    compRatio: 2.4,
    compKnee: 14,
    compAttack: 0.005,
    compRelease: 0.30,
  },
  bass: {
    name: 'Bass & Beat Punch',
    label: 'Bass Boost',
    icon: '⚡',
    desc: 'Deep sub-bass rumble, heavy kick punch & clean hi-hat definition for beats',
    lowGain: 7.5,
    midGain: 0.8,
    midQ: 0.9,
    highGain: 2.2,
    compThreshold: -7,
    compRatio: 2.8,
    compKnee: 10,
    compAttack: 0.002,
    compRelease: 0.18,
  },
  vocal: {
    name: 'Vocal & Acoustic Clarity',
    label: 'Vocal Clarity',
    icon: '🎙️',
    desc: 'Brings voices, acoustic strings & piano directly to the center stage',
    lowGain: 0.5,
    midGain: 4.2,
    midQ: 0.95,
    highGain: 3.0,
    compThreshold: -8,
    compRatio: 2.0,
    compKnee: 10,
    compAttack: 0.004,
    compRelease: 0.20,
  },
  flat: {
    name: 'Direct Bypass (Off)',
    label: 'Direct / Flat',
    icon: '🎚️',
    desc: 'Bit-perfect raw stream without equalization or dynamic compensation',
    lowGain: 0,
    midGain: 0,
    midQ: 1.0,
    highGain: 0,
    compThreshold: 0,
    compRatio: 1.0,
    compKnee: 0,
    compAttack: 0.01,
    compRelease: 0.25,
  },
};

// Singleton Web Audio DSP Engine
let globalAudioCtx: AudioContext | null = null;
let connectedAudioEl: HTMLAudioElement | null = null;
let globalSourceNode: MediaElementAudioSourceNode | null = null;
let globalLowFilter: BiquadFilterNode | null = null;
let globalMidFilter: BiquadFilterNode | null = null;
let globalHighFilter: BiquadFilterNode | null = null;
let globalCompressor: DynamicsCompressorNode | null = null;
let globalGainNode: GainNode | null = null;

function applyProfileToEngine(key: AudioProfileKey, ctx?: AudioContext) {
  const p = AUDIO_PROFILES[key];
  const context = ctx || globalAudioCtx;
  if (!context) return;
  if (context.state === 'suspended') {
    void context.resume();
  }
  const t = context.currentTime;

  try {
    if (globalLowFilter) {
      globalLowFilter.gain.setTargetAtTime(p.lowGain, t, 0.03);
    }
    if (globalMidFilter) {
      globalMidFilter.gain.setTargetAtTime(p.midGain, t, 0.03);
      globalMidFilter.Q.setTargetAtTime(p.midQ, t, 0.03);
    }
    if (globalHighFilter) {
      globalHighFilter.gain.setTargetAtTime(p.highGain, t, 0.03);
    }
    if (globalCompressor) {
      globalCompressor.threshold.setTargetAtTime(p.compThreshold, t, 0.03);
      globalCompressor.ratio.setTargetAtTime(p.compRatio, t, 0.03);
      globalCompressor.knee.setTargetAtTime(p.compKnee, t, 0.03);
      globalCompressor.attack.setTargetAtTime(p.compAttack, t, 0.03);
      globalCompressor.release.setTargetAtTime(p.compRelease, t, 0.03);
    }
  } catch (err) {
    console.warn('Could not update DSP parameters:', err);
  }
}

function applyVolumeToEngine(vol: number, audioEl?: HTMLAudioElement | null) {
  // Smooth perceptual volume curve with clean headroom
  const clamped = Math.max(0, Math.min(1, vol));
  const perceptualGain = Math.pow(clamped, 1.6) * 0.95;

  if (globalAudioCtx && globalGainNode) {
    try {
      globalGainNode.gain.setTargetAtTime(perceptualGain, globalAudioCtx.currentTime, 0.02);
      if (audioEl) {
        audioEl.volume = 1.0; // Let gain node handle calibrated output
      }
      return;
    } catch {}
  }

  // Fallback to HTMLMediaElement volume if Web Audio is not yet ready
  if (audioEl) {
    audioEl.volume = perceptualGain;
  }
}
const label = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
const clock = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;

function getAudioMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mp3': return 'audio/mpeg';
    case 'm4a': return 'audio/mp4';
    case 'wav': return 'audio/wav';
    case 'ogg': return 'audio/ogg';
    case 'flac': return 'audio/flac';
    case 'aac': return 'audio/aac';
    case 'webm': return 'audio/webm';
    default: return 'audio/mpeg';
  }
}

function normalizePath(p?: string | null): string {
  if (!p) return '';
  return p.trim().toLowerCase().replace(/\\/g, '/');
}

/** Global helper to pause/stop background music (e.g. when Pomodoro break completes) */
export function stopMusicPlayback() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('metanoia:stop-music'));
  }
}

export default function MusicPlayer({
  activePage = 'Focus',
  onOpenFocus
}: {
  activePage?: string;
  onOpenFocus?: () => void;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(() => {
    return typeof document !== 'undefined' ? document.getElementById('focus-music-slot') : null;
  });

  useEffect(() => {
    if (activePage === 'Focus') {
      const check = () => {
        const el = document.getElementById('focus-music-slot');
        if (el) {
          setSlot(el);
          return true;
        }
        return false;
      };

      if (!check()) {
        const timer = setInterval(() => {
          if (check()) clearInterval(timer);
        }, 30);
        return () => clearInterval(timer);
      }
    } else {
      setSlot(null);
    }
  }, [activePage]);
  const audio = useRef<HTMLAudioElement>(null);
  const queueScrollRef = useRef<HTMLDivElement>(null);
  const [tracks, setTracks] = useState<SavedTrack[]>([]);
  const [currentTrack, setCurrentTrack] = useState<SavedTrack | null>(null);
  const [url, setUrl] = useState('');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    try {
      const v = localStorage.getItem('metanoia-music-volume');
      return v !== null ? Number(v) : 0.40;
    } catch {
      return 0.40;
    }
  });
  const [audioProfile, setAudioProfile] = useState<AudioProfileKey>(() => {
    try {
      const p = localStorage.getItem('metanoia-audio-profile') as AudioProfileKey;
      return p && AUDIO_PROFILES[p] ? p : 'studio';
    } catch {
      return 'studio';
    }
  });
  const [showProfiles, setShowProfiles] = useState(false);
  const qualityDropdownRef = useRef<HTMLDivElement>(null);
  const lastNonFlatProfile = useRef<AudioProfileKey>(
    audioProfile !== 'flat' ? audioProfile : 'studio'
  );
  const [isMuted, setIsMuted] = useState(false);
  const lastNonZeroVol = useRef(0.40);
  const [musicError, setMusicError] = useState('');
  const [taste, setTaste] = useState<Taste>({});
  const [feedbackToast, setFeedbackToast] = useState('');

  const toggleStudioMaster = () => {
    initAudioEngine();
    const nextKey: AudioProfileKey = audioProfile === 'flat' ? (lastNonFlatProfile.current || 'studio') : 'flat';
    setAudioProfile(nextKey);
    applyProfileToEngine(nextKey);
    setFeedbackToast(
      nextKey === 'flat'
        ? '🎚️ Studio Master Bypassed (Flat Audio)'
        : `✨ ${AUDIO_PROFILES[nextKey].label} Active`
    );
  };

  useEffect(() => {
    if (!feedbackToast) return;
    const t = setTimeout(() => setFeedbackToast(''), 2400);
    return () => clearTimeout(t);
  }, [feedbackToast]);
  const [likedOnly, setLikedOnly] = useState(() => {
    try {
      return localStorage.getItem('metanoia-music-liked-only') === 'true';
    } catch {
      return false;
    }
  });
  const [shuffle, setShuffle] = useState(() => {
    try {
      return localStorage.getItem('metanoia-music-shuffle') === 'true';
    } catch {
      return false;
    }
  });
  const [showQueue, setShowQueue] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Track paths that have been played in the current cycle so no repeats occur until entire list is over
  const [playedPaths, setPlayedPaths] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('metanoia-music-played-paths');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const playedSet = useMemo(() => new Set(playedPaths.map(p => normalizePath(p))), [playedPaths]);

  // Chronological playback history stack for standard Back (⏮️) and Forward (⏭️) navigation
  const [historyStack, setHistoryStack] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('metanoia-music-history-stack');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [historyIndex, setHistoryIndex] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('metanoia-music-history-index');
      return raw !== null ? Number(raw) : -1;
    } catch {
      return -1;
    }
  });

  // Resume playback position trackers
  const pendingResumeSeek = useRef<number>(0);
  const isInitialResume = useRef<boolean>(true);
  const lastSavedTime = useRef<number>(0);

  function pushToHistory(path: string) {
    const norm = normalizePath(path);
    if (!norm) return;
    setHistoryStack(prev => {
      // Truncate any forward history if navigated backward previously
      const curIdx = historyIndex;
      const base = curIdx >= 0 && curIdx < prev.length ? prev.slice(0, curIdx + 1) : prev;
      if (base.length > 0 && normalizePath(base[base.length - 1]) === norm) {
        return base;
      }
      const nextArr = [...base, path].slice(-150);
      try {
        localStorage.setItem('metanoia-music-history-stack', JSON.stringify(nextArr));
      } catch {}
      return nextArr;
    });
    setHistoryIndex(prev => {
      const nextIdx = (historyIndex >= 0 && historyIndex < historyStack.length ? historyIndex : prev) + 1;
      try {
        localStorage.setItem('metanoia-music-history-index', String(nextIdx));
      } catch {}
      return nextIdx;
    });
  }

  function markTrackPlayed(path: string) {
    const norm = normalizePath(path);
    if (!norm) return;
    setPlayedPaths(prev => {
      const set = new Set(prev);
      set.add(norm);
      const nextArr = Array.from(set);
      try {
        localStorage.setItem('metanoia-music-played-paths', JSON.stringify(nextArr));
      } catch {}
      return nextArr;
    });
  }

  function resetPlayedCycle() {
    const norm = currentTrack ? [normalizePath(currentTrack.path)] : [];
    setPlayedPaths(norm);
    setHistoryStack(norm);
    setHistoryIndex(norm.length ? 0 : -1);
    try {
      localStorage.setItem('metanoia-music-played-paths', JSON.stringify(norm));
      localStorage.setItem('metanoia-music-history-stack', JSON.stringify(norm));
      localStorage.setItem('metanoia-music-history-index', norm.length ? '0' : '-1');
    } catch {}
  }

  // Load persisted tracks and taste from SQLite on startup; resume last track & position
  useEffect(() => {
    void loadMusicTracks().then(saved => {
      if (saved && saved.length > 0) {
        setTracks(saved);
        const lastPath = localStorage.getItem('metanoia-music-current-path');
        const matched = lastPath ? saved.find(t => normalizePath(t.path) === normalizePath(lastPath)) : null;
        const initialTrack = matched || saved[0];
        const savedTime = parseFloat(localStorage.getItem('metanoia-music-current-time') || '0');
        if (savedTime > 0) {
          pendingResumeSeek.current = savedTime;
          setTime(savedTime);
        }
        setCurrentTrack(initialTrack);
        markTrackPlayed(initialTrack.path);
        setHistoryStack(prev => {
          if (!prev.length) {
            const initialStack = [initialTrack.path];
            try { localStorage.setItem('metanoia-music-history-stack', JSON.stringify(initialStack)); } catch {}
            return initialStack;
          }
          return prev;
        });
        setHistoryIndex(prev => {
          if (prev < 0) {
            try { localStorage.setItem('metanoia-music-history-index', '0'); } catch {}
            return 0;
          }
          return prev;
        });
      }
    }).catch(console.error);

    void loadMusicTaste().then(setTaste).catch(() => setMusicError('Preferences could not be loaded.'));
  }, []);

  const likedTracks = useMemo(() => {
    return tracks.filter(t => taste[t.path.toLowerCase()] === 1);
  }, [tracks, taste]);

  const activeTracks = useMemo(() => {
    if (likedOnly) return likedTracks;
    return tracks;
  }, [likedOnly, likedTracks, tracks]);

  // Current track index within active tracks (using normalized path)
  const currentIndex = useMemo(() => {
    if (!currentTrack) return -1;
    const curNorm = normalizePath(currentTrack.path);
    return activeTracks.findIndex(t => normalizePath(t.path) === curNorm);
  }, [currentTrack, activeTracks]);

  // Next track preview for the Up Next bar (respects unplayed shuffle and history)
  const nextTrack = useMemo(() => {
    if (!activeTracks.length) return null;

    // 1. If navigated back in history, next track is the forward historical track
    if (historyIndex >= 0 && historyIndex < historyStack.length - 1) {
      const forwardPath = historyStack[historyIndex + 1];
      const match = activeTracks.find(t => normalizePath(t.path) === normalizePath(forwardPath));
      if (match) return match;
    }

    const curNorm = normalizePath(currentTrack?.path);

    // 2. Strict unplayed filter: never suggest old played songs
    const unplayed = activeTracks.filter(t => {
      const norm = normalizePath(t.path);
      return norm !== curNorm && !playedSet.has(norm);
    });

    if (shuffle && activeTracks.length > 1) {
      if (unplayed.length > 0) {
        return unplayed[0];
      }
      const others = activeTracks.filter(t => normalizePath(t.path) !== curNorm);
      return others[0] || activeTracks[0];
    }

    // Sequential mode: find next unplayed in queue
    const curIdx = activeTracks.findIndex(t => normalizePath(t.path) === curNorm);
    const baseIdx = curIdx >= 0 ? curIdx : 0;
    for (let offset = 1; offset < activeTracks.length; offset++) {
      const idx = (baseIdx + offset) % activeTracks.length;
      const cand = activeTracks[idx];
      const candNorm = normalizePath(cand.path);
      if (!playedSet.has(candNorm) && candNorm !== curNorm) {
        return cand;
      }
    }
    const nextIdx = (baseIdx + 1) % activeTracks.length;
    return activeTracks[nextIdx];
  }, [activeTracks, currentTrack, shuffle, playedSet, historyStack, historyIndex]);

  const [loadingAudio, setLoadingAudio] = useState(false);
  const activeBlobUrl = useRef<string>('');

  // Load track audio into in-memory Blob URL for instantaneous, secure local playback across any drive
  useEffect(() => {
    if (!currentTrack) {
      if (activeBlobUrl.current) {
        URL.revokeObjectURL(activeBlobUrl.current);
        activeBlobUrl.current = '';
      }
      setUrl('');
      setLoadingAudio(false);
      return;
    }

    let cancelled = false;
    setLoadingAudio(true);
    setMusicError('');

    async function loadAudioSource() {
      try {
        let audioSrc = currentTrack!.path;
        if (isTauri()) {
          // Read native file bytes directly through Rust backend to bypass protocol & drive restrictions
          const cleanPath = currentTrack!.path.replace(/^["']|["']$/g, '').trim();
          const bytes = await invoke<number[]>('read_media_bytes', { path: cleanPath });
          if (cancelled) return;
          const mime = getAudioMimeType(cleanPath);
          const blob = new Blob([new Uint8Array(bytes)], { type: mime });
          const oldBlob = activeBlobUrl.current;
          const blobUrl = URL.createObjectURL(blob);
          activeBlobUrl.current = blobUrl;
          audioSrc = blobUrl;
          if (oldBlob && oldBlob !== blobUrl) {
            setTimeout(() => {
              try { URL.revokeObjectURL(oldBlob); } catch {}
            }, 2500);
          }
        }

        if (!cancelled) {
          setUrl(audioSrc);
          setLoadingAudio(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load track via read_media_bytes:', err);
          try {
            const fallback = convertFileSrc(currentTrack!.path);
            setUrl(fallback);
          } catch {
            setMusicError('Could not load audio: ' + (err as Error).message);
          }
          setLoadingAudio(false);
        }
      }
    }

    void loadAudioSource();

    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  const initAudioEngine = () => {
    if (!audio.current) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!globalAudioCtx) {
        globalAudioCtx = new AudioCtxClass();
      }
      if (globalAudioCtx.state === 'suspended') {
        void globalAudioCtx.resume();
      }

      if (connectedAudioEl !== audio.current) {
        connectedAudioEl = audio.current;
        globalSourceNode = globalAudioCtx.createMediaElementSource(audio.current);

        const low = globalAudioCtx.createBiquadFilter();
        low.type = 'lowshelf';
        low.frequency.value = 90;
        globalLowFilter = low;

        const mid = globalAudioCtx.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = 2600;
        globalMidFilter = mid;

        const high = globalAudioCtx.createBiquadFilter();
        high.type = 'highshelf';
        high.frequency.value = 10000;
        globalHighFilter = high;

        const comp = globalAudioCtx.createDynamicsCompressor();
        globalCompressor = comp;

        const masterGain = globalAudioCtx.createGain();
        globalGainNode = masterGain;

        globalSourceNode.connect(low);
        low.connect(mid);
        mid.connect(high);
        high.connect(comp);
        comp.connect(masterGain);
        masterGain.connect(globalAudioCtx.destination);
      }

      applyProfileToEngine(audioProfile, globalAudioCtx);
      applyVolumeToEngine(volume, audio.current);
    } catch (err) {
      console.warn('Audio engine setup deferred or skipped:', err);
    }
  };

  // Close sound quality popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (qualityDropdownRef.current && !qualityDropdownRef.current.contains(event.target as Node)) {
        setShowProfiles(false);
      }
    }
    if (showProfiles) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProfiles]);

  // Stop music on global signal (e.g. when Pomodoro break completes)
  useEffect(() => {
    const handleStop = () => {
      const player = audio.current;
      if (player && !player.paused) {
        player.pause();
        setPlaying(false);
        try {
          localStorage.setItem('metanoia-music-was-playing', 'false');
          localStorage.setItem('metanoia-music-current-time', player.currentTime.toFixed(1));
        } catch {}
      }
    };
    window.addEventListener('metanoia:stop-music', handleStop);
    return () => window.removeEventListener('metanoia:stop-music', handleStop);
  }, []);

  // Play / resume audio when url updates
  useEffect(() => {
    const player = audio.current;
    if (!player || !url) return;
    initAudioEngine();
    applyVolumeToEngine(volume, player);

    if (isInitialResume.current) {
      isInitialResume.current = false;
      const targetTime = pendingResumeSeek.current;
      if (targetTime > 0) {
        player.currentTime = targetTime;
        setTime(targetTime);
      }
      const wasPlaying = localStorage.getItem('metanoia-music-was-playing') === 'true';
      if (wasPlaying) {
        void player.play()
          .then(() => setPlaying(true))
          .catch(() => setPlaying(false));
      } else {
        setPlaying(false);
      }
      return;
    }

    // User initiated track change: play from start
    player.currentTime = 0;
    void player.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, [url]);

  useEffect(() => {
    applyVolumeToEngine(volume, audio.current);
    try {
      localStorage.setItem('metanoia-music-volume', String(volume));
    } catch {}
  }, [volume]);

  useEffect(() => {
    applyProfileToEngine(audioProfile);
    try {
      localStorage.setItem('metanoia-audio-profile', audioProfile);
    } catch {}
  }, [audioProfile]);

  function toggleMute() {
    initAudioEngine();
    if (isMuted || volume === 0) {
      setIsMuted(false);
      const restore = lastNonZeroVol.current > 0 ? lastNonZeroVol.current : 0.40;
      setVolume(restore);
    } else {
      lastNonZeroVol.current = volume;
      setIsMuted(true);
      setVolume(0);
    }
  }

  useEffect(() => {
    try {
      localStorage.setItem('metanoia-music-shuffle', String(shuffle));
    } catch {}
  }, [shuffle]);

  useEffect(() => {
    try {
      localStorage.setItem('metanoia-music-liked-only', String(likedOnly));
    } catch {}
  }, [likedOnly]);

  function selectTrack(track: SavedTrack, recordPlayed = true, addToHistory = true) {
    if (audio.current) {
      audio.current.pause();
      audio.current.currentTime = 0;
    }
    pendingResumeSeek.current = 0;
    setTime(0);
    setCurrentTrack(track);
    try {
      localStorage.setItem('metanoia-music-current-path', track.path);
      localStorage.setItem('metanoia-music-current-time', '0');
    } catch {}
    setMusicError('');
    if (recordPlayed) {
      markTrackPlayed(track.path);
    }
    if (addToHistory) {
      pushToHistory(track.path);
    }
  }

  function next(direction = 1) {
    if (!activeTracks.length) return;

    if (direction < 0) {
      // PREVIOUS / BACK BUTTON:
      // 1. Walk backward in chronological playback history
      if (historyIndex > 0 && historyStack.length > 1) {
        const prevIdx = historyIndex - 1;
        const targetPath = historyStack[prevIdx];
        const targetTrack = activeTracks.find(t => normalizePath(t.path) === normalizePath(targetPath)) ||
                            tracks.find(t => normalizePath(t.path) === normalizePath(targetPath));
        if (targetTrack) {
          setHistoryIndex(prevIdx);
          try {
            localStorage.setItem('metanoia-music-history-index', String(prevIdx));
          } catch {}
          selectTrack(targetTrack, false, false);
          return;
        }
      }

      // 2. If at beginning of history, restart current song if played > 2s
      if (audio.current && audio.current.currentTime > 2) {
        audio.current.currentTime = 0;
        setTime(0);
        return;
      }

      // 3. Fallback to previous sequential track
      const curNorm = normalizePath(currentTrack?.path);
      const curIdx = activeTracks.findIndex(t => normalizePath(t.path) === curNorm);
      const baseIdx = curIdx >= 0 ? curIdx : 0;
      const prevIdx = (baseIdx - 1 + activeTracks.length) % activeTracks.length;
      selectTrack(activeTracks[prevIdx], false, false);
      return;
    }

    // FORWARD / NEXT BUTTON (direction > 0 or onEnded):
    // 1. If previously stepped back into history, step forward through that history:
    if (historyIndex >= 0 && historyIndex < historyStack.length - 1) {
      const nextIdx = historyIndex + 1;
      const targetPath = historyStack[nextIdx];
      const targetTrack = activeTracks.find(t => normalizePath(t.path) === normalizePath(targetPath)) ||
                          tracks.find(t => normalizePath(t.path) === normalizePath(targetPath));
      if (targetTrack) {
        setHistoryIndex(nextIdx);
        try {
          localStorage.setItem('metanoia-music-history-index', String(nextIdx));
        } catch {}
        selectTrack(targetTrack, false, false);
        return;
      }
    }

    // 2. At the forward edge: pick a brand new track that HAS NEVER BEEN PLAYED in this cycle
    const curNorm = normalizePath(currentTrack?.path);
    // Strictly filter out all songs in playedSet AND the current song
    const unplayed = activeTracks.filter(t => {
      const norm = normalizePath(t.path);
      return norm !== curNorm && !playedSet.has(norm);
    });

    if (shuffle && activeTracks.length > 1) {
      if (unplayed.length > 0) {
        // Pick an unplayed song at random (guaranteed zero repeats of old songs)
        const pick = unplayed[Math.floor(Math.random() * unplayed.length)];
        selectTrack(pick, true, true);
      } else {
        // Entire active list is over! Reset cycle and pick from all other tracks
        const others = activeTracks.filter(t => normalizePath(t.path) !== curNorm);
        const pool = others.length ? others : activeTracks;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const fresh = [normalizePath(pick.path)];
        setPlayedPaths(fresh);
        try {
          localStorage.setItem('metanoia-music-played-paths', JSON.stringify(fresh));
        } catch {}
        selectTrack(pick, false, true);
      }
      return;
    }

    // Sequential mode:
    if (unplayed.length > 0) {
      // Find next unplayed track forward in queue order
      const curIdx = activeTracks.findIndex(t => normalizePath(t.path) === curNorm);
      const baseIdx = curIdx >= 0 ? curIdx : 0;
      let foundTrack: SavedTrack | null = null;
      for (let offset = 1; offset < activeTracks.length; offset++) {
        const idx = (baseIdx + offset) % activeTracks.length;
        const cand = activeTracks[idx];
        const candNorm = normalizePath(cand.path);
        if (!playedSet.has(candNorm) && candNorm !== curNorm) {
          foundTrack = cand;
          break;
        }
      }
      if (foundTrack) {
        selectTrack(foundTrack, true, true);
        return;
      }
    }

    // If entire list is over! Reset cycle and wrap around to next track in queue
    const curIdx = activeTracks.findIndex(t => normalizePath(t.path) === curNorm);
    const baseIdx = curIdx >= 0 ? curIdx : 0;
    const nextIdx = (baseIdx + 1) % activeTracks.length;
    const pick = activeTracks[nextIdx];
    const fresh = [normalizePath(pick.path)];
    setPlayedPaths(fresh);
    try {
      localStorage.setItem('metanoia-music-played-paths', JSON.stringify(fresh));
    } catch {}
    selectTrack(pick, false, true);
  }

  function togglePlay() {
    if (!audio.current) return;
    setMusicError('');
    initAudioEngine();
    if (audio.current.paused) {
      void audio.current.play()
        .then(() => {
          setPlaying(true);
          try {
            localStorage.setItem('metanoia-music-was-playing', 'true');
          } catch {}
        })
        .catch(() => setPlaying(false));
    } else {
      audio.current.pause();
      setPlaying(false);
      try {
        localStorage.setItem('metanoia-music-was-playing', 'false');
        if (audio.current) {
          localStorage.setItem('metanoia-music-current-time', audio.current.currentTime.toFixed(1));
        }
      } catch {}
    }
  }

  function rate(value: 1 | -1) {
    if (!currentTrack) return;
    const key = currentTrack.path.toLowerCase();
    const rating = taste[key] === value ? 0 : value;
    setTaste(prev => {
      const nextMap = { ...prev };
      if (rating === 0) delete nextMap[key];
      else nextMap[key] = rating;
      return nextMap;
    });
    void saveMusicTaste(key, rating).catch(() => setMusicError('This rating could not be saved.'));

    // If disliked, skip forward to next track
    if (value === -1) {
      next(1);
    }
  }

  function toggleLikedOnly() {
    if (!likedOnly) {
      if (likedTracks.length === 0) {
        setMusicError('No liked songs yet! Click the ❤️ button to like songs first.');
        return;
      }
      setLikedOnly(true);
      const curNorm = normalizePath(currentTrack?.path);
      const isAlreadyInLiked = likedTracks.some(t => normalizePath(t.path) === curNorm);
      if (!isAlreadyInLiked) {
        selectTrack(likedTracks[0]);
      }
    } else {
      setLikedOnly(false);
    }
  }

  async function revealInExplorer(path?: string) {
    if (!path || !isTauri()) return;
    try {
      await invoke('show_in_folder', { path });
    } catch (err) {
      console.error('Could not reveal path in Explorer:', err);
      setMusicError('Could not open folder: ' + (err as Error).message);
    }
  }

  async function addFolder() {
    if (!isTauri()) return;
    try {
      const folderPath = await invoke<string | null>('pick_folder');
      if (!folderPath) return;
      const jsonStr = await invoke<string>('scan_folder_audio', { folderPath });
      const parsed = JSON.parse(jsonStr) as { folder: string; tracks: SavedTrack[] };
      if (!parsed.tracks || !parsed.tracks.length) {
        setMusicError('No supported audio files found in this folder.');
        return;
      }
      await saveMusicTracks(parsed.tracks);
      setTracks(prev => {
        const seen = new Set(prev.map(t => normalizePath(t.path)));
        const added = parsed.tracks.filter(t => !seen.has(normalizePath(t.path)));
        const combined = [...prev, ...added];
        if (!currentTrack && combined.length > 0) {
          selectTrack(combined[0]);
        }
        return combined;
      });
      setMusicError('');
    } catch (e) {
      setMusicError((e as Error).message);
    }
  }

  async function addSongs() {
    if (!isTauri()) return;
    try {
      const paths = await invoke<string[]>('pick_audio_files');
      if (!paths || !paths.length) return;
      const newItems: SavedTrack[] = paths.map(p => {
        const fileName = p.split('\\').pop() || p;
        return {
          name: label(fileName),
          path: p
        };
      });
      await saveMusicTracks(newItems);
      setTracks(prev => {
        const seen = new Set(prev.map(t => normalizePath(t.path)));
        const added = newItems.filter(t => !seen.has(normalizePath(t.path)));
        const combined = [...prev, ...added];
        if (!currentTrack && combined.length > 0) {
          selectTrack(combined[0]);
        }
        return combined;
      });
      setMusicError('');
    } catch (e) {
      setMusicError((e as Error).message);
    }
  }

  async function removeTrackItem(e: React.MouseEvent, trackPath: string) {
    e.stopPropagation();
    await removeMusicTrack(trackPath);
    setTracks(prev => {
      const filtered = prev.filter(t => normalizePath(t.path) !== normalizePath(trackPath));
      if (normalizePath(currentTrack?.path) === normalizePath(trackPath)) {
        if (filtered.length > 0) selectTrack(filtered[0]);
        else {
          setCurrentTrack(null);
          setUrl('');
        }
      }
      return filtered;
    });
  }

  // Filtered queue for searching
  const filteredQueue = useMemo(() => {
    if (!searchQuery.trim()) return activeTracks;
    const q = searchQuery.toLowerCase().trim();
    return activeTracks.filter(t => t.name.toLowerCase().includes(q) || t.path.toLowerCase().includes(q));
  }, [activeTracks, searchQuery]);

  // Windowed display (up to 80 tracks around current to guarantee instant UI rendering)
  const windowedQueue = useMemo(() => {
    if (filteredQueue.length <= 80) return filteredQueue;
    const curNorm = normalizePath(currentTrack?.path);
    const curIdx = filteredQueue.findIndex(t => normalizePath(t.path) === curNorm);
    if (curIdx === -1) return filteredQueue.slice(0, 80);
    const start = Math.max(0, curIdx - 20);
    const end = Math.min(filteredQueue.length, start + 80);
    return filteredQueue.slice(start, end);
  }, [filteredQueue, currentTrack]);

  const isCurrentLiked = currentTrack ? taste[currentTrack.path.toLowerCase()] === 1 : false;
  const isCurrentDisliked = currentTrack ? taste[currentTrack.path.toLowerCase()] === -1 : false;

  const fullPlayerUI = (
    <section className="music-player" aria-label="Focus music player">
      {/* Header with track name, loved badge, open path & stats */}
      <div className="music-player-head">
        <div className="music-art">
          <Music2 size={24} />
          <i />
        </div>
        <div className="music-meta-wrap">
          <div className="music-eyebrow-row">
            <p className="eyebrow">✦ THE JAM STATION</p>
          </div>
          <h2 title={currentTrack?.path || currentTrack?.name || 'Your Focus Groove'}>
            {currentTrack?.name || '🎧 Your Focus Groove'}
          </h2>
          <p className="music-stats-subline">
            {activeTracks.length
              ? `Track ${currentIndex >= 0 ? currentIndex + 1 : 1} of ${activeTracks.length} · 🎧 ${playedSet.size}/${activeTracks.length} played in cycle${likedOnly ? ' · ❤️ Liked Mode' : ` · ${likedTracks.length} loved`}`
              : 'Choose songs or a folder from your PC 🎶'}
            {currentTrack && (
              <span
                className="clickable-path-breadcrumb"
                title={`Click to open in Explorer:\n${currentTrack.path}`}
                onClick={() => void revealInExplorer(currentTrack.path)}
              >
                · 📂 {currentTrack.path.split('\\').slice(-2).join('\\')}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Action buttons including modern Play Liked toggle and Open Folder */}
      <div className="music-inputs">
        <button type="button" className="music-action-btn" onClick={addSongs} title="Pick audio files">
          <Plus size={15} /> Add Songs 🎵
        </button>
        <button type="button" className="music-action-btn" onClick={addFolder} title="Select folder">
          <FolderOpen size={15} /> Add Album / Folder 📁
        </button>
        <button
          type="button"
          className={`music-action-btn ${likedOnly ? 'btn-liked-active' : ''}`}
          onClick={toggleLikedOnly}
          title={likedOnly ? 'Switch back to all tracks' : 'Play only loved tracks'}
        >
          <Heart size={14} className={likedOnly ? 'fill-red text-red' : ''} />
          <span>{likedOnly ? 'Playing Liked Only' : `Play Liked (${likedTracks.length})`}</span>
        </button>
        {currentTrack && (
          <button
            type="button"
            className="music-action-btn"
            onClick={() => void revealInExplorer(currentTrack.path)}
            title={`Reveal this track in File Explorer:\n${currentTrack.path}`}
          >
            <FolderOpen size={14} /> Open Song Folder 📂
          </button>
        )}
      </div>

      {/* Transport Controls Bar */}
      <div className="music-transport">
        <button
          type="button"
          className={`transport-btn ${shuffle ? 'active-toggle' : ''}`}
          aria-label="Shuffle playback"
          title={shuffle ? 'Shuffle: ON' : 'Shuffle: OFF'}
          onClick={() => setShuffle(!shuffle)}
        >
          <Shuffle size={16} />
        </button>
        <button
          type="button"
          className="transport-btn"
          aria-label="Previous track"
          title="Previous track"
          disabled={!currentTrack || activeTracks.length === 0}
          onClick={() => next(-1)}
        >
          <SkipBack size={18} />
        </button>
        <button
          type="button"
          className="transport-btn music-play"
          aria-label={playing ? 'Pause music' : 'Play music'}
          disabled={!currentTrack}
          onClick={togglePlay}
        >
          {playing ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
        </button>
        <button
          type="button"
          className="transport-btn"
          aria-label="Next track"
          title="Next track"
          disabled={!currentTrack || activeTracks.length === 0}
          onClick={() => next(1)}
        >
          <SkipForward size={18} />
        </button>
        <button
          type="button"
          className={`transport-btn ${isCurrentLiked ? 'rated-like' : ''}`}
          aria-label="Like this track"
          aria-pressed={isCurrentLiked}
          title="Like this track"
          disabled={!currentTrack}
          onClick={() => rate(1)}
        >
          <Heart size={17} fill={isCurrentLiked ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          className={`transport-btn ${isCurrentDisliked ? 'rated-dislike' : ''}`}
          aria-label="Dislike this track"
          aria-pressed={isCurrentDisliked}
          title="Dislike / skip"
          disabled={!currentTrack}
          onClick={() => rate(-1)}
        >
          <ThumbsDown size={16} />
        </button>
      </div>

      {/* Progress Bar with Current / Total Times */}
      <div className="music-progress">
        <span className="time-code">{clock(time)}</span>
        <input
          aria-label="Seek music"
          type="range"
          min={0}
          max={duration || 1}
          value={Math.min(time, duration || 1)}
          disabled={!currentTrack}
          onChange={e => {
            if (audio.current) audio.current.currentTime = Number(e.target.value);
          }}
        />
        <span className="time-code">{clock(duration || 0)}</span>
      </div>

      {/* Sleek Up Next Bar (Replaces annoying horizontal scroll with clean desktop UX) */}
      {activeTracks.length > 0 && (
        <div className="music-up-next-row">
          <div
            className="up-next-info-box"
            onClick={() => nextTrack && selectTrack(nextTrack)}
            title={nextTrack ? `Click to play next: ${nextTrack.name}` : undefined}
          >
            <span className="up-next-pill">UP NEXT</span>
            <strong className="up-next-song-name">
              {nextTrack ? nextTrack.name : 'End of playlist'}
            </strong>
          </div>
          <button
            type="button"
            className={`btn-queue-toggle ${showQueue ? 'queue-open' : ''}`}
            onClick={() => setShowQueue(!showQueue)}
            title={showQueue ? 'Hide playlist drawer' : 'View full playlist'}
          >
            <ListMusic size={14} />
            <span>Playlist ({activeTracks.length})</span>
            {showQueue ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      )}

      {/* Modern Vertical Playlist Drawer (No horizontal scroll, fully readable rows) */}
      {showQueue && activeTracks.length > 0 && (
        <div className="music-vertical-drawer">
          <div className="vertical-drawer-header">
            <div className="drawer-title-group">
              <strong>{likedOnly ? `Loved Songs (${activeTracks.length})` : `All Tracks (${tracks.length})`}</strong>
              <span className="drawer-cycle-badge" title="Tracks played in this shuffle cycle">
                {playedSet.size}/{activeTracks.length} played
              </span>
              {playedSet.size > 1 && (
                <button
                  type="button"
                  className="btn-cycle-reset"
                  onClick={resetPlayedCycle}
                  title="Reset cycle history to allow all songs to be picked again"
                >
                  ↺ Reset cycle
                </button>
              )}
              {likedOnly && (
                <button
                  type="button"
                  className="btn-switch-all-pill"
                  onClick={toggleLikedOnly}
                >
                  Switch to All →
                </button>
              )}
            </div>
            <div className="drawer-search-wrap">
              <Search size={13} className="drawer-search-icon" />
              <input
                type="text"
                placeholder="Search playlist…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="drawer-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="drawer-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="vertical-track-list" ref={queueScrollRef}>
            {windowedQueue.map(track => {
              const curNorm = normalizePath(currentTrack?.path);
              const trackNorm = normalizePath(track.path);
              const isSelected = curNorm === trackNorm;
              const isLiked = taste[track.path.toLowerCase()] === 1;
              const isPlayed = playedSet.has(trackNorm);
              const trackIndex = filteredQueue.findIndex(t => normalizePath(t.path) === trackNorm) + 1;

              return (
                <div
                  key={track.path}
                  className={`vertical-track-card ${isSelected ? 'card-playing' : ''} ${isPlayed && !isSelected ? 'card-played' : ''}`}
                  onClick={() => selectTrack(track)}
                >
                  <div className="card-left-section">
                    <span className={`card-track-number ${isPlayed && !isSelected ? 'num-played' : ''}`}>
                      {isSelected && playing ? '▶' : isPlayed ? '✓' : String(trackIndex).padStart(2, '0')}
                    </span>
                    <div className="card-text-block">
                      <strong className="card-track-title" title={track.name}>
                        {track.name}
                      </strong>
                      <span className="card-track-sub">
                        {track.path.split('\\').slice(-2, -1)[0] || 'Audio'}
                      </span>
                    </div>
                  </div>

                  <div className="card-right-actions" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      className={`track-action-btn ${isLiked ? 'liked' : ''}`}
                      title={isLiked ? 'Unlike song' : 'Like song'}
                      onClick={() => {
                        const key = track.path.toLowerCase();
                        const rating = isLiked ? 0 : 1;
                        setTaste(prev => {
                          const n = { ...prev };
                          if (rating === 0) delete n[key];
                          else n[key] = 1;
                          return n;
                        });
                        void saveMusicTaste(key, rating);
                      }}
                    >
                      <Heart size={13} fill={isLiked ? '#ef4444' : 'none'} color={isLiked ? '#ef4444' : 'currentColor'} />
                    </button>
                    <button
                      type="button"
                      className="track-action-btn"
                      title={`Show in File Explorer:\n${track.path}`}
                      onClick={() => void revealInExplorer(track.path)}
                    >
                      <FolderOpen size={13} />
                    </button>
                    <button
                      type="button"
                      className="track-action-btn btn-remove-item"
                      title="Remove from playlist"
                      onClick={e => void removeTrackItem(e, track.path)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredQueue.length > windowedQueue.length && (
            <div className="drawer-footer-notice">
              <span>Showing {windowedQueue.length} of {filteredQueue.length} tracks</span>
              {searchQuery && (
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search filter
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {musicError && <p className="music-error" role="alert">{musicError}</p>}

      {/* Audio Engine Deck: Studio Quality Enhancer & Perceptual Volume */}
      <div className="music-audio-deck">
        {/* Full-width smooth Volume Row */}
        <div className="music-volume-row">
          <button
            type="button"
            className="btn-volume-icon"
            onClick={toggleMute}
            title={volume === 0 || isMuted ? 'Unmute' : 'Mute'}
            aria-label={volume === 0 || isMuted ? 'Unmute' : 'Mute'}
          >
            {volume === 0 || isMuted ? (
              <VolumeX size={16} />
            ) : volume < 0.4 ? (
              <Volume1 size={16} />
            ) : (
              <Volume2 size={16} />
            )}
          </button>
          <input
            aria-label="Music volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={e => {
              const nextVal = Number(e.target.value);
              setVolume(nextVal);
              if (nextVal > 0) setIsMuted(false);
            }}
          />
          <span className="volume-pct-pill">{Math.round(volume * 100)}%</span>
        </div>

        {/* Studio Enhancer Row: Dedicated ON/OFF Toggle Pill & Presets Dropdown */}
        <div className="music-enhancer-row" ref={qualityDropdownRef}>
          <button
            type="button"
            className={`btn-sound-quality ${audioProfile !== 'flat' ? 'dsp-on' : 'dsp-off'}`}
            onClick={toggleStudioMaster}
            title={audioProfile !== 'flat' ? 'Click to bypass Studio Master (switch to raw flat audio)' : 'Click to enable Studio Master audio enhancement'}
          >
            <Sparkles size={13} className={audioProfile !== 'flat' ? 'sparkle-active' : 'sparkle-inactive'} />
            <span className="quality-pill-label">
              {AUDIO_PROFILES[audioProfile].icon} {AUDIO_PROFILES[audioProfile].label}
              <span className={`dsp-status-dot ${audioProfile !== 'flat' ? 'active' : ''}`} />
            </span>
            <span className={`enhancer-toggle-badge ${audioProfile !== 'flat' ? 'badge-on' : 'badge-off'}`}>
              {audioProfile !== 'flat' ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            type="button"
            className={`btn-profile-picker-trigger ${showProfiles ? 'active' : ''}`}
            onClick={() => {
              initAudioEngine();
              setShowProfiles(!showProfiles);
            }}
            title="Choose sound EQ preset (Studio Master, Warm & Lo-Fi, Deep Bass, Vocal)"
          >
            <span>Presets</span>
            <ChevronDown size={12} className={`quality-chevron ${showProfiles ? 'rotate-180' : ''}`} />
          </button>

          {feedbackToast && (
            <div className="enhancer-toast-pill" role="status">
              {feedbackToast}
            </div>
          )}

          {showProfiles && (
            <div className="audio-quality-popover">
              <div className="quality-popover-header">
                <div className="popover-title-row">
                  <Sparkles size={14} className="sparkle-active" />
                  <strong>Sound Presets & DSP</strong>
                </div>
                <div className="popover-header-actions">
                  <button
                    type="button"
                    className={`btn-enhancer-toggle ${audioProfile !== 'flat' ? 'active' : ''}`}
                    onClick={toggleStudioMaster}
                    title="Toggle between Enhanced DSP and Raw Audio"
                  >
                    {audioProfile !== 'flat' ? 'Active' : 'Bypass (Off)'}
                  </button>
                  <span className="quality-tech-badge">32-bit DSP</span>
                </div>
              </div>
              <div className="quality-profile-list">
                {(Object.keys(AUDIO_PROFILES) as AudioProfileKey[]).map(key => {
                  const prof = AUDIO_PROFILES[key];
                  const isSelected = audioProfile === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`quality-profile-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        initAudioEngine();
                        setAudioProfile(key);
                        if (key !== 'flat') lastNonFlatProfile.current = key;
                        applyProfileToEngine(key);
                        setFeedbackToast(key === 'flat' ? '🎚️ Enhancer Bypassed (Flat)' : `✦ ${prof.label} Active`);
                        setShowProfiles(false);
                      }}
                    >
                      <div className="profile-card-left">
                        <span className="profile-icon">{prof.icon}</span>
                        <div className="profile-info">
                          <strong className="profile-name">{prof.name}</strong>
                          <p className="profile-desc">{prof.desc}</p>
                        </div>
                      </div>
                      {isSelected && <span className="profile-active-tick">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="music-bottom-subline">
          <span className="volume-caption">
            {likedOnly
              ? 'Loved tracks ❤️'
              : likedTracks.length
              ? `${likedTracks.length} loved ✨`
              : 'Tap ❤️ to curate'}
          </span>
          <span className="audio-engine-badge" title="Dynamic soft compressor & master headroom prevent distortion and harsh peaks">
            <span className="engine-dot" /> Headroom Limiter (-1.2 dB)
          </span>
        </div>
      </div>
    </section>
  );

  return (
    <>
      <audio
        ref={audio}
        src={url}
        onTimeUpdate={e => {
          const cur = e.currentTarget.currentTime;
          setTime(cur);
          if (Math.abs(cur - lastSavedTime.current) >= 1) {
            lastSavedTime.current = cur;
            try {
              localStorage.setItem('metanoia-music-current-time', cur.toFixed(1));
            } catch {}
          }
        }}
        onLoadedMetadata={e => {
          const dur = e.currentTarget.duration;
          setDuration(dur);
          if (pendingResumeSeek.current > 0 && pendingResumeSeek.current < dur) {
            e.currentTarget.currentTime = pendingResumeSeek.current;
            setTime(pendingResumeSeek.current);
            pendingResumeSeek.current = 0;
          }
        }}
        onPlay={() => {
          initAudioEngine();
          setPlaying(true);
          try {
            localStorage.setItem('metanoia-music-was-playing', 'true');
          } catch {}
        }}
        onPause={() => {
          setPlaying(false);
          try {
            localStorage.setItem('metanoia-music-was-playing', 'false');
            if (audio.current) {
              localStorage.setItem('metanoia-music-current-time', audio.current.currentTime.toFixed(1));
            }
          } catch {}
        }}
        onEnded={() => next(1)}
        onError={(e) => {
          setPlaying(false);
          const err = (e.currentTarget as HTMLAudioElement).error;
          // Ignore transient abort events during track switching
          if (err && err.code === 20) return; // MEDIA_ERR_ABORTED
          if (url && !loadingAudio) {
            setMusicError('This audio file could not play. Choose another track.');
          }
        }}
      />

      {/* Render full player into Focus Lounge slot when on Focus page */}
      {slot ? createPortal(fullPlayerUI, slot) : null}

      {/* When navigating outside Focus page, keep compact floating player alive */}
      {activePage !== 'Focus' && currentTrack && (
        <div 
          className="floating-mini-player" 
          onClick={onOpenFocus}
          title="Click to open Focus Lounge"
          role="region"
          aria-label="Background music player"
        >
          <div className="mini-player-left">
            <div className={`mini-player-icon-pulse ${playing ? 'pulsing' : ''}`}>
              <Music2 size={13} className={playing ? 'icon-spin' : ''} />
            </div>
            <div className="mini-player-text">
              <span className="mini-title">{label(currentTrack.name)}</span>
              <span className="mini-state">
                {playing ? 'Playing' : 'Paused'} · {AUDIO_PROFILES[audioProfile].label}
              </span>
            </div>
          </div>

          <div className="mini-player-actions" onClick={e => e.stopPropagation()}>
            <button type="button" className="mini-btn" onClick={() => next(-1)} title="Previous track">
              <SkipBack size={12} />
            </button>
            <button type="button" className="mini-btn play-toggle" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
            </button>
            <button type="button" className="mini-btn" onClick={() => next(1)} title="Next track">
              <SkipForward size={12} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
