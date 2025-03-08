import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";

interface AudioContextType {
  audioData: Uint8Array | null;
  isPlaying: boolean;
  audioRef: React.RefObject<HTMLAudioElement>;
  currentTime: number;
  duration: number;
  togglePlayPause: () => void;
  setAudioFile: (file: string) => void;
  currentAudioFile: string | null;
}

const AudioContext = createContext<AudioContextType | null>(null);

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [audioData, setAudioData] = useState<Uint8Array | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentAudioFile, setCurrentAudioFile] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>();

  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;
    }
  }, []);

  const setupAudioAnalyser = useCallback(() => {
    if (!audioRef.current || !audioContextRef.current || !analyserRef.current)
      return;

    // Clean up previous source if it exists
    if (sourceRef.current) {
      sourceRef.current.disconnect();
    }

    // Create and store new source
    sourceRef.current = audioContextRef.current.createMediaElementSource(
      audioRef.current
    );
    sourceRef.current.connect(analyserRef.current);
    analyserRef.current.connect(audioContextRef.current.destination);
  }, []);

  const updateAudioData = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    setAudioData(dataArray);

    animationFrameRef.current = requestAnimationFrame(updateAudioData);
  }, []);

  // Start animation when playing
  useEffect(() => {
    if (isPlaying) {
      updateAudioData();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, updateAudioData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    } else {
      initializeAudioContext();
      if (!sourceRef.current) {
        setupAudioAnalyser();
      }
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, initializeAudioContext, setupAudioAnalyser]);

  const setAudioFile = useCallback(
    (file: string) => {
      setCurrentAudioFile(file);
      if (audioRef.current) {
        const wasPlaying = !audioRef.current.paused;
        const currentTime = audioRef.current.currentTime;

        audioRef.current.src = file;
        audioRef.current.load();

        // Reset audio context and analyzer
        if (sourceRef.current) {
          sourceRef.current.disconnect();
          sourceRef.current = null;
        }

        if (wasPlaying) {
          audioRef.current.play().then(() => {
            if (!sourceRef.current) {
              setupAudioAnalyser();
            }
          });
        }
        audioRef.current.currentTime = currentTime;
      }
    },
    [setupAudioAnalyser]
  );

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleDurationChange = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const value = {
    audioData,
    isPlaying,
    audioRef,
    currentTime,
    duration,
    togglePlayPause,
    setAudioFile,
    currentAudioFile,
  };

  return (
    <AudioContext.Provider value={value}>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onEnded={() => setIsPlaying(false)}
      />
      {children}
    </AudioContext.Provider>
  );
}
