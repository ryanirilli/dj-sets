import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { useSettings } from "./SettingsContext";

// Add type declaration for Electron properties on window
declare global {
  interface Window {
    electron?: {
      isElectron: boolean;
      getSystemAudioSources: () => Promise<MediaDeviceInfo[]>;
      getDisplayMedia: () => Promise<MediaStream | null>;
    };
  }
}

const isElectron =
  typeof window !== "undefined" &&
  window.electron &&
  window.electron.isElectron === true;

interface AudioContextType {
  audioData: Uint8Array | null;
  isPlaying: boolean;
  audioRef: React.RefObject<HTMLAudioElement>;
  currentTime: number;
  duration: number;
  togglePlayPause: () => void;
  setAudioFile: (file: string, forcePlay?: boolean) => void;
  currentAudioFile: string | null;
  bpm: number;
  onBeat: boolean;
  beatTime: number;
  avgAudioLevel: number;
  availableTracks: string[];
  nextTrack: () => void;
  previousTrack: () => void;
  loadingTracks: boolean;
  inputType: "file" | "system";
  setInputType: (type: "file" | "system") => void;
  availableInputs: MediaDeviceInfo[];
  selectedInput: MediaDeviceInfo | null;
  setSelectedInput: (device: MediaDeviceInfo) => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
}

// Beat detection related constants
interface BeatInterval {
  interval: number;
  count: number;
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { settings, updateSettings } = useSettings();
  const [audioData, setAudioData] = useState<Uint8Array | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentAudioFile, setCurrentAudioFile] = useState<string | null>(null);
  const [bpm, setBpm] = useState<number>(120);
  const [onBeat, setOnBeat] = useState<boolean>(false);
  const [beatTime, setBeatTime] = useState<number>(0);
  const [avgAudioLevel, setAvgAudioLevel] = useState<number>(0);
  const [availableTracks, setAvailableTracks] = useState<string[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [inputType, setInputType] = useState<"file" | "system">("file");
  const [availableInputs, setAvailableInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<MediaDeviceInfo | null>(
    null
  );

  // Audio processing refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<
    MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null
  >(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const lastTrackChangeRef = useRef<number>(0);

  // Beat detection refs - based on Joe Sullivan's approach
  const peaksRef = useRef<number[]>([]);
  const lastPeakTimeRef = useRef<number>(0);
  const minPeakDistanceRef = useRef<number>(0.2); // Minimum time between peaks in seconds
  const peakThresholdRef = useRef<number>(0.65); // Threshold for peak detection
  const lastBassEnergyRef = useRef<number>(0);
  const beatHistoryRef = useRef<BeatInterval[]>([]);
  const beatIntervalRef = useRef<number>(0.5); // Default 120 BPM
  const lastBeatTimeRef = useRef<number>(0);
  const beatToleranceRef = useRef<number>(0.05); // Tolerance for beat timing (seconds)
  const lastUpdateTimeRef = useRef<number>(0);

  // Fetch audio files
  const fetchAudioFiles = useCallback(async () => {
    try {
      setLoadingTracks(true);
      const response = await fetch("/api/audio-files");
      if (!response.ok) throw new Error("Failed to fetch audio files");
      const data = await response.json();
      setAvailableTracks(data.files);
    } catch (err) {
      console.error("Error fetching audio files:", err);
      setAvailableTracks(["demo1.mp3", "demo2.mp3"]); // Fallback
    } finally {
      setLoadingTracks(false);
    }
  }, []);

  // Initialize audio context
  const initializeAudioContext = useCallback(() => {
    if (audioContextRef.current) return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      audioContextRef.current = new AudioContextClass();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;
      analyserRef.current.smoothingTimeConstant = 0.5;
    } catch (error) {
      console.error("Failed to initialize AudioContext:", error);
    }
  }, []);

  // Connect audio source to analyzer
  const connectAudioSource = useCallback(() => {
    if (!audioRef.current || !audioContextRef.current || !analyserRef.current)
      return false;

    try {
      // Clean up any existing source
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }

      // Create new source
      sourceRef.current = audioContextRef.current.createMediaElementSource(
        audioRef.current
      );
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
      return true;
    } catch (error) {
      console.error("Error connecting audio source:", error);
      return false;
    }
  }, []);

  // Beat detection - based on Joe Sullivan's approach: http://joesul.li/van/beat-detection-using-web-audio/

  // Function to analyze intervals between peaks to determine BPM
  const analyzePeakIntervals = useCallback(() => {
    if (peaksRef.current.length < 4) return; // Need at least 4 peaks for analysis

    // Calculate intervals between consecutive peaks
    const intervals: number[] = [];
    for (let i = 1; i < peaksRef.current.length; i++) {
      intervals.push(peaksRef.current[i] - peaksRef.current[i - 1]);
    }

    // Count occurrences of similar intervals (group by rounding to nearest 50ms)
    const intervalCounts: Record<string, number> = {};
    intervals.forEach((interval) => {
      // Round to nearest 50ms for grouping
      const roundedInterval = Math.round(interval * 20) / 20;
      intervalCounts[roundedInterval] =
        (intervalCounts[roundedInterval] || 0) + 1;
    });

    // Convert to array for sorting
    const intervalCountsArray: BeatInterval[] = Object.entries(
      intervalCounts
    ).map(([interval, count]) => ({
      interval: parseFloat(interval),
      count: count,
    }));

    // Sort by count (descending)
    intervalCountsArray.sort((a, b) => b.count - a.count);

    // Store the interval history
    beatHistoryRef.current = intervalCountsArray;

    // If we have a clear winner, use it to determine BPM
    if (
      intervalCountsArray.length > 0 &&
      (intervalCountsArray.length === 1 ||
        intervalCountsArray[0].count > intervalCountsArray[1].count * 1.5)
    ) {
      const mostCommonInterval = intervalCountsArray[0].interval;

      // Convert interval to BPM, adjusting to 90-180 BPM range
      let tempoBPM = 60 / mostCommonInterval;

      // Adjust to common BPM range (90-180)
      while (tempoBPM < 90) tempoBPM *= 2;
      while (tempoBPM > 180) tempoBPM /= 2;

      // Update beat interval
      beatIntervalRef.current = 60 / tempoBPM;

      // Update BPM state
      setBpm(Math.round(tempoBPM));
    }
  }, []);

  // Check if current time is on a beat
  const checkForBeat = useCallback((currentTime: number) => {
    if (beatIntervalRef.current <= 0) return false;

    // If this is the first beat after starting/resuming playback
    if (lastBeatTimeRef.current === 0) {
      lastBeatTimeRef.current = currentTime;
      setBeatTime(currentTime);
      return true;
    }

    // Calculate time since last beat
    const timeSinceLastBeat = currentTime - lastBeatTimeRef.current;

    // If we're within one interval (with tolerance) of the last beat
    if (
      timeSinceLastBeat >= beatIntervalRef.current - beatToleranceRef.current &&
      timeSinceLastBeat <= beatIntervalRef.current + beatToleranceRef.current
    ) {
      // This is a beat!
      lastBeatTimeRef.current = currentTime;
      setBeatTime(currentTime);
      return true;
    }

    // If we've somehow missed several beats (e.g., after a pause),
    // realign to the beat grid
    if (timeSinceLastBeat > beatIntervalRef.current * 2) {
      // Calculate how many beats we've missed
      const missedBeats = Math.floor(
        timeSinceLastBeat / beatIntervalRef.current
      );

      // Adjust the last beat time to maintain the beat grid
      lastBeatTimeRef.current =
        currentTime -
        (timeSinceLastBeat - missedBeats * beatIntervalRef.current);

      // Check if we're now on a beat
      const adjustedTimeSinceLastBeat = currentTime - lastBeatTimeRef.current;
      if (
        adjustedTimeSinceLastBeat >=
          beatIntervalRef.current - beatToleranceRef.current &&
        adjustedTimeSinceLastBeat <=
          beatIntervalRef.current + beatToleranceRef.current
      ) {
        lastBeatTimeRef.current = currentTime;
        setBeatTime(currentTime);
        return true;
      }
    }

    return false;
  }, []);

  // Reset beat detection when changing tracks or resuming playback
  const resetBeatDetection = useCallback(
    (maintainBPM = true) => {
      const previousBPM = maintainBPM ? bpm : 0;

      // Reset all beat detection state
      peaksRef.current = [];
      lastPeakTimeRef.current = 0;
      lastBeatTimeRef.current = 0;
      lastBassEnergyRef.current = 0;

      // If we have a valid BPM and want to maintain it, keep the beat interval
      if (previousBPM > 0) {
        beatIntervalRef.current = 60 / previousBPM;
      } else {
        // Otherwise reset to default (120 BPM)
        beatIntervalRef.current = 0.5;
      }
    },
    [bpm]
  );

  // Update audio data for visualizations and beat detection
  const updateAudioData = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current) return;

    const now = performance.now();
    // Throttle updates to 30fps to reduce CPU usage
    if (now - lastUpdateTimeRef.current < 33) {
      animationFrameRef.current = requestAnimationFrame(updateAudioData);
      return;
    }
    lastUpdateTimeRef.current = now;

    try {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Update audio data for visualizers
      setAudioData(dataArray);

      // Calculate average level
      if (dataArray.length > 0) {
        const sum = Array.from(dataArray).reduce((sum, val) => sum + val, 0);
        setAvgAudioLevel(sum / dataArray.length);
      }

      // Beat detection using Joe Sullivan's approach
      if (dataArray.length >= 4) {
        // Extract bass frequencies (first few bands)
        const bassData = Array.from(dataArray.slice(0, 4));

        // Normalize bass energy to 0-1 range
        const bassEnergy = Math.min(
          1.0,
          bassData.reduce((sum, val) => sum + val, 0) / (4 * 255)
        );

        // Peak detection
        const currentTimeSeconds = audioContextRef.current.currentTime;

        // Only detect peaks if we have a valid previous energy reading
        // This prevents false peaks when resuming from pause
        const isPeak =
          lastBassEnergyRef.current > 0 && // Ensure we have a previous reading
          bassEnergy > peakThresholdRef.current && // Above threshold
          bassEnergy > lastBassEnergyRef.current * 1.2 && // 20% increase from last frame
          currentTimeSeconds >
            lastPeakTimeRef.current + minPeakDistanceRef.current; // Minimum time between peaks

        if (isPeak) {
          // Record this peak time
          peaksRef.current.push(currentTimeSeconds);
          lastPeakTimeRef.current = currentTimeSeconds;

          // Keep only recent peaks (last 5 seconds)
          while (
            peaksRef.current.length > 0 &&
            peaksRef.current[0] < currentTimeSeconds - 5
          ) {
            peaksRef.current.shift();
          }

          // Analyze peak intervals to determine BPM
          analyzePeakIntervals();
        }

        // Store current bass energy for next frame comparison
        lastBassEnergyRef.current = bassEnergy;

        // Check if we're on a beat
        const isOnBeat = checkForBeat(currentTimeSeconds);
        setOnBeat(isOnBeat);
      }

      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(updateAudioData);
    } catch (error) {
      console.error("Error updating audio data:", error);
    }
  }, [analyzePeakIntervals, checkForBeat]);

  // Handle track initialization
  useEffect(() => {
    fetchAudioFiles();

    // Clean up on unmount
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [fetchAudioFiles]);

  // Initialize default track when available
  useEffect(() => {
    if (availableTracks.length > 0 && !currentAudioFile) {
      // Use track from settings or default to first track
      const trackToUse =
        settings.selectedAudioFile || `/audio/${availableTracks[0]}`;
      setCurrentAudioFile(trackToUse);
      updateSettings("selectedAudioFile", trackToUse);
    }
  }, [
    availableTracks,
    currentAudioFile,
    settings.selectedAudioFile,
    updateSettings,
  ]);

  // Initialize audio processor when playing starts
  useEffect(() => {
    if (isPlaying) {
      // Initialize audio context if needed
      if (!audioContextRef.current) {
        initializeAudioContext();
      }

      // Resume context if suspended
      if (audioContextRef.current?.state === "suspended") {
        audioContextRef.current.resume();
      }

      // Connect audio source if needed
      if (!sourceRef.current && audioRef.current && audioContextRef.current) {
        connectAudioSource();
      }

      // Start animation loop for audio data
      if (!animationFrameRef.current) {
        // Reset beat detection but maintain the BPM
        resetBeatDetection(true);
        updateAudioData();
      }
    } else {
      // Stop animation loop when not playing
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    }
  }, [
    isPlaying,
    initializeAudioContext,
    connectAudioSource,
    updateAudioData,
    resetBeatDetection,
  ]);

  // Handle system audio setup
  useEffect(() => {
    if (inputType === "system" && selectedInput) {
      // Clean up any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Set up system audio capture
      const setupSystemAudio = async () => {
        try {
          // Initialize audio context
          initializeAudioContext();

          // Get media stream
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: selectedInput.deviceId,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });

          streamRef.current = stream;

          // Connect stream to analyzer
          if (audioContextRef.current && analyserRef.current) {
            if (sourceRef.current) {
              sourceRef.current.disconnect();
            }

            sourceRef.current =
              audioContextRef.current.createMediaStreamSource(stream);
            sourceRef.current.connect(analyserRef.current);

            // Reset beat detection but maintain the BPM
            resetBeatDetection(true);

            // Start visualization
            if (!animationFrameRef.current) {
              updateAudioData();
            }

            setIsPlaying(true);
            setCurrentAudioFile(`system:${selectedInput.deviceId}`);
          }
        } catch (error) {
          console.error("Error setting up system audio:", error);
          setIsPlaying(false);
        }
      };

      setupSystemAudio();
    } else if (
      inputType === "file" &&
      currentAudioFile?.startsWith("system:")
    ) {
      // Clean up system audio when switching to file mode
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }

      setIsPlaying(false);

      // Reset to a file if available
      if (availableTracks.length > 0) {
        const firstTrack = `/audio/${availableTracks[0]}`;
        setCurrentAudioFile(firstTrack);
      } else {
        setCurrentAudioFile(null);
      }
    }
  }, [
    inputType,
    selectedInput,
    initializeAudioContext,
    updateAudioData,
    availableTracks,
    currentAudioFile,
    resetBeatDetection,
  ]);

  // Initialize available audio devices
  useEffect(() => {
    const getAudioDevices = async () => {
      try {
        // First request permission
        const tempStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        tempStream.getTracks().forEach((track) => track.stop());

        // Then enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(
          (device) => device.kind === "audioinput"
        );
        setAvailableInputs(audioInputs);

        // Select first device if none selected
        if (!selectedInput && audioInputs.length > 0) {
          setSelectedInput(audioInputs[0]);
        }
      } catch (error) {
        console.error("Error getting audio devices:", error);
      }
    };

    getAudioDevices();

    // Listen for device changes
    navigator.mediaDevices.addEventListener("devicechange", getAudioDevices);
    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        getAudioDevices
      );
    };
  }, [selectedInput]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (inputType === "system") {
      // For system audio, just toggle the state
      setIsPlaying(!isPlaying);
    } else {
      // For file audio, use the audio element
      if (isPlaying) {
        audioRef.current.pause();
      } else if (audioRef.current.src) {
        // Initialize if needed
        initializeAudioContext();

        // Play with automatic fallback for mobile
        const playPromise = audioRef.current.play();
        if (playPromise) {
          playPromise.catch((error) => {
            console.error("Error playing audio:", error);

            // If autoplay was prevented, try again on next user interaction
            if (error.name === "NotAllowedError") {
              const resumePlayback = () => {
                if (audioRef.current) {
                  audioRef.current
                    .play()
                    .catch((e) => console.error("Still can't play audio:", e));
                }
                document.removeEventListener("click", resumePlayback);
              };
              document.addEventListener("click", resumePlayback, {
                once: true,
              });
            }
          });
        }
      }
    }
  }, [isPlaying, inputType, initializeAudioContext]);

  // Set audio file
  const setAudioFile = useCallback(
    (file: string, forcePlay = false) => {
      // Don't change file in system audio mode
      if (inputType === "system" && !file.startsWith("system:")) return;

      // Update state
      setCurrentAudioFile(file);

      // Handle system audio separately
      if (file.startsWith("system:")) return;

      // For regular audio files
      if (audioRef.current) {
        const wasPlaying = forcePlay || isPlaying;

        // Pause current playback
        if (audioRef.current.played.length > 0) {
          audioRef.current.pause();
        }

        // Reset beat detection for the new track
        resetBeatDetection(false);

        // Update source
        audioRef.current.src = file;
        audioRef.current.load();

        // Play if needed
        if (wasPlaying) {
          // Use a small timeout to allow the browser to load the audio
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.play().catch((error) => {
                console.error("Error playing new audio:", error);
              });
            }
          }, 100);
        }

        // Save in settings
        updateSettings("selectedAudioFile", file);
      }
    },
    [inputType, isPlaying, updateSettings, resetBeatDetection]
  );

  // Track navigation
  const changeTrack = useCallback(
    (direction: "next" | "previous") => {
      if (
        availableTracks.length === 0 ||
        !currentAudioFile ||
        inputType === "system"
      )
        return;

      // Prevent rapid track changes
      const now = Date.now();
      if (now - lastTrackChangeRef.current < 500) return;
      lastTrackChangeRef.current = now;

      // Find current track index
      const currentFileName = currentAudioFile.split("/").pop();
      let currentIndex = availableTracks.findIndex(
        (track) => track === currentFileName
      );

      // Calculate next index
      if (currentIndex === -1) {
        currentIndex = direction === "next" ? -1 : availableTracks.length;
      }

      const nextIndex =
        direction === "next"
          ? (currentIndex + 1) % availableTracks.length
          : (currentIndex - 1 + availableTracks.length) %
            availableTracks.length;

      // Set new track
      const nextTrack = `/audio/${availableTracks[nextIndex]}`;
      setAudioFile(nextTrack, true);
    },
    [availableTracks, currentAudioFile, inputType, setAudioFile]
  );

  const nextTrack = useCallback(() => changeTrack("next"), [changeTrack]);
  const previousTrack = useCallback(
    () => changeTrack("previous"),
    [changeTrack]
  );

  // Value object for context
  const value: AudioContextType = {
    audioData,
    isPlaying,
    audioRef,
    currentTime,
    duration,
    togglePlayPause,
    setAudioFile,
    currentAudioFile,
    bpm,
    onBeat,
    beatTime,
    avgAudioLevel,
    availableTracks,
    nextTrack,
    previousTrack,
    loadingTracks,
    inputType,
    setInputType,
    availableInputs,
    selectedInput,
    setSelectedInput,
  };

  return (
    <AudioContext.Provider value={value}>
      <audio
        ref={audioRef}
        src={
          currentAudioFile && !currentAudioFile.startsWith("system:")
            ? currentAudioFile
            : undefined
        }
        onTimeUpdate={() =>
          audioRef.current && setCurrentTime(audioRef.current.currentTime)
        }
        onDurationChange={() =>
          audioRef.current && setDuration(audioRef.current.duration)
        }
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
        playsInline
        crossOrigin="anonymous"
        muted={inputType === "system"}
      />
      {children}
    </AudioContext.Provider>
  );
}
