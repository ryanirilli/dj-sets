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
  const [currentAudioFile, setCurrentAudioFile] = useState<string | null>(
    "/audio/set-00.mp3"
  );

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>();
  const isSourceConnectedRef = useRef<boolean>(false);

  // Add a throttle mechanism to reduce the frequency of audio data updates
  const lastUpdateTimeRef = useRef(0);
  const updateIntervalRef = useRef(1000 / 30); // 30 fps instead of 60

  // Define handleTimeUpdate and handleDurationChange first
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

  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();

        // Reduce FFT size for better performance
        analyserRef.current.fftSize = 128;

        // Reduce smoothing for more responsive visuals but less CPU usage
        analyserRef.current.smoothingTimeConstant = 0.5;
      } catch (error) {
        console.error("Failed to initialize AudioContext:", error);
      }
    }
  }, []);

  // Clean up audio resources
  const cleanupAudioResources = useCallback(() => {
    // Cancel any pending animation frames
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    // Disconnect source if it exists
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (error) {
        console.error("Error disconnecting audio source:", error);
      }
      sourceRef.current = null;
    }

    // Reset connection state
    isSourceConnectedRef.current = false;

    // Close audio context if it exists
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch (error) {
        console.error("Error closing AudioContext:", error);
      }
      audioContextRef.current = null;
      analyserRef.current = null;
    }
  }, []);

  const setupAudioAnalyser = useCallback(() => {
    if (!audioRef.current || !audioContextRef.current || !analyserRef.current)
      return;

    // If we already have a source connected to this audio element, don't create a new one
    if (isSourceConnectedRef.current) {
      return;
    }

    // Clean up previous source if it exists
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (error) {
        console.error("Error disconnecting previous source:", error);
      }
      sourceRef.current = null;
    }

    try {
      // Create and store new source
      sourceRef.current = audioContextRef.current.createMediaElementSource(
        audioRef.current
      );
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
      isSourceConnectedRef.current = true;
    } catch (error) {
      console.error("Error setting up audio analyser:", error);
    }
  }, []);

  const updateAudioData = useCallback(() => {
    if (!analyserRef.current) return;

    const now = performance.now();
    // Throttle updates to reduce CPU usage
    if (now - lastUpdateTimeRef.current < updateIntervalRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateAudioData);
      return;
    }

    lastUpdateTimeRef.current = now;

    try {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      setAudioData(dataArray);
    } catch (error) {
      console.error("Error updating audio data:", error);
    }

    animationFrameRef.current = requestAnimationFrame(updateAudioData);
  }, []);

  // Start animation when playing
  useEffect(() => {
    if (isPlaying) {
      updateAudioData();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    };
  }, [isPlaying, updateAudioData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudioResources();
    };
  }, [cleanupAudioResources]);

  // Initialize audio element with the current audio file
  useEffect(() => {
    if (audioRef.current && currentAudioFile) {
      audioRef.current.src = currentAudioFile;
      audioRef.current.load();
    }
  }, []);

  // Resume AudioContext if it's suspended (needed for browsers that block autoplay)
  const resumeAudioContext = useCallback(async () => {
    if (
      audioContextRef.current &&
      audioContextRef.current.state === "suspended"
    ) {
      try {
        await audioContextRef.current.resume();
      } catch (error) {
        console.error("Error resuming AudioContext:", error);
      }
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    // If no audio file is set, don't do anything
    if (!audioRef.current.src) {
      console.warn("No audio file selected");
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    } else {
      initializeAudioContext();
      resumeAudioContext();

      if (!isSourceConnectedRef.current) {
        setupAudioAnalyser();
      }

      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error);
        // Log more details about the audio element
        console.log("Audio element state:", {
          src: audioRef.current?.src,
          readyState: audioRef.current?.readyState,
          paused: audioRef.current?.paused,
          error: audioRef.current?.error,
        });
      });
    }
    setIsPlaying(!isPlaying);
  }, [
    isPlaying,
    initializeAudioContext,
    setupAudioAnalyser,
    resumeAudioContext,
  ]);

  const setAudioFile = useCallback(
    (file: string) => {
      setCurrentAudioFile(file);
      if (audioRef.current) {
        const wasPlaying = !audioRef.current.paused;

        // Pause current playback
        audioRef.current.pause();

        // Create a new audio element to replace the current one
        const newAudio = new Audio();
        newAudio.src = file;

        // When we create a new audio element, we need to reset our source connection state
        isSourceConnectedRef.current = false;

        // Clean up the old source if it exists
        if (sourceRef.current) {
          try {
            sourceRef.current.disconnect();
          } catch (error) {
            console.error("Error disconnecting source:", error);
          }
          sourceRef.current = null;
        }

        // Replace the audio element
        if (audioRef.current.parentNode) {
          // Store a reference to the current audio element
          const currentAudio = audioRef.current;

          // Add event listeners to the new audio element
          newAudio.addEventListener("timeupdate", handleTimeUpdate);
          newAudio.addEventListener("durationchange", handleDurationChange);
          newAudio.addEventListener("ended", () => setIsPlaying(false));

          // Replace the element in the DOM
          if (currentAudio.parentNode) {
            currentAudio.parentNode.replaceChild(newAudio, currentAudio);
          }

          // Update our ref (safely, as a mutable object property)
          if (audioRef && typeof audioRef === "object") {
            (audioRef as any).current = newAudio;
          }

          // If it was playing before, start playing the new audio
          if (wasPlaying) {
            initializeAudioContext();
            resumeAudioContext();

            newAudio
              .play()
              .then(() => {
                setupAudioAnalyser();
              })
              .catch((error) => {
                console.error("Error playing new audio:", error);
                setIsPlaying(false);
              });
            setIsPlaying(true);
          }
        }
      }
    },
    [
      setupAudioAnalyser,
      initializeAudioContext,
      handleTimeUpdate,
      handleDurationChange,
      resumeAudioContext,
    ]
  );

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
        src={currentAudioFile || undefined}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />
      {children}
    </AudioContext.Provider>
  );
}
