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
  setAudioFile: (file: string) => void;
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

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<
    MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null
  >(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const isSourceConnectedRef = useRef<boolean>(false);

  // Beat detection state
  const peaksRef = useRef<number[]>([]);
  const lastPeakTimeRef = useRef(0);
  const peakThresholdRef = useRef(0.65);
  const minPeakDistanceRef = useRef(0.2); // Minimum time between peaks in seconds
  const lastBeatTimeRef = useRef(0);
  const lastBassEnergyRef = useRef(0);
  const beatIntervalRef = useRef(0.5); // Default beat interval (120 BPM)
  const beatToleranceRef = useRef(0.05); // Tolerance for beat timing (in seconds)
  const beatHistoryRef = useRef<{ interval: number; count: number }[]>([]);

  // Add a throttle mechanism to reduce the frequency of audio data updates
  const lastUpdateTimeRef = useRef(0);
  const updateIntervalRef = useRef(1000 / 30); // 30 fps instead of 60

  // Fetch audio files
  const fetchAudioFiles = useCallback(async () => {
    try {
      setLoadingTracks(true);
      const response = await fetch("/api/audio-files");
      if (!response.ok) {
        throw new Error("Failed to fetch audio files");
      }
      const data = await response.json();
      setAvailableTracks(data.files);
    } catch (err) {
      console.error("Error fetching audio files:", err);
      // Fallback to a static list for demo purposes
      const fallbackFiles = ["demo1.mp3", "demo2.mp3"];
      setAvailableTracks(fallbackFiles);
    } finally {
      setLoadingTracks(false);
    }
  }, []);

  // Initial fetch effect
  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      fetchAudioFiles();
    }
    return () => {
      isMounted = false;
    };
  }, [fetchAudioFiles]);

  // Initialize audio file from settings
  useEffect(() => {
    // If tracks are loaded and no current audio file is selected
    if (availableTracks.length > 0 && !currentAudioFile) {
      // If there's a saved audio file in settings, use that
      if (settings.selectedAudioFile) {
        setAudioFile(settings.selectedAudioFile);
      }
      // Otherwise use the first track
      else {
        const firstTrack = `/audio/${availableTracks[0]}`;
        setAudioFile(firstTrack);
        updateSettings("selectedAudioFile", firstTrack);
      }
    }
  }, [
    availableTracks,
    currentAudioFile,
    settings.selectedAudioFile,
    updateSettings,
  ]);

  // Next and previous track functions
  const nextTrack = useCallback(() => {
    if (availableTracks.length === 0 || !currentAudioFile) return;

    const currentFileName = currentAudioFile.split("/").pop();
    const currentIndex = availableTracks.findIndex(
      (track) => track === currentFileName
    );

    if (currentIndex === -1) return;

    const nextIndex = (currentIndex + 1) % availableTracks.length;
    const nextTrack = `/audio/${availableTracks[nextIndex]}`;

    setAudioFile(nextTrack);
    updateSettings("selectedAudioFile", nextTrack);
  }, [availableTracks, currentAudioFile, updateSettings]);

  const previousTrack = useCallback(() => {
    if (availableTracks.length === 0 || !currentAudioFile) return;

    const currentFileName = currentAudioFile.split("/").pop();
    const currentIndex = availableTracks.findIndex(
      (track) => track === currentFileName
    );

    if (currentIndex === -1) return;

    const prevIndex =
      (currentIndex - 1 + availableTracks.length) % availableTracks.length;
    const prevTrack = `/audio/${availableTracks[prevIndex]}`;

    setAudioFile(prevTrack);
    updateSettings("selectedAudioFile", prevTrack);
  }, [availableTracks, currentAudioFile, updateSettings]);

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
        // Use AudioContext with a fallback to webkitAudioContext
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;

        audioContextRef.current = new AudioContextClass();
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

  // Function to analyze intervals between peaks and determine BPM
  // Based on Joe Sullivan's approach: http://joesul.li/van/beat-detection-using-web-audio/
  const analyzePeakIntervals = useCallback(() => {
    if (peaksRef.current.length < 4) return; // Need at least 4 peaks for analysis

    // Calculate intervals between consecutive peaks
    const intervals: number[] = [];
    for (let i = 1; i < peaksRef.current.length; i++) {
      intervals.push(peaksRef.current[i] - peaksRef.current[i - 1]);
    }

    // Count occurrences of similar intervals (group by rounding to nearest 50ms)
    const intervalCounts: { [key: string]: number } = {};
    intervals.forEach((interval) => {
      // Round to nearest 50ms for grouping
      const roundedInterval = Math.round(interval * 20) / 20;
      intervalCounts[roundedInterval] =
        (intervalCounts[roundedInterval] || 0) + 1;
    });

    // Convert to array for sorting
    const intervalCountsArray = Object.entries(intervalCounts).map(
      ([interval, count]) => ({
        interval: parseFloat(interval),
        count: count,
      })
    );

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

      // Convert interval to BPM, adjusting to 90-180 BPM range as in the article
      let tempoBPM = 60 / mostCommonInterval;

      // Adjust to common BPM range (90-180)
      while (tempoBPM < 90) tempoBPM *= 2;
      while (tempoBPM > 180) tempoBPM /= 2;

      // Update beat interval
      beatIntervalRef.current = 60 / tempoBPM;

      // Update BPM state
      setBpm(Math.round(tempoBPM));

      console.log(
        "BPM detected:",
        Math.round(tempoBPM),
        "Interval:",
        mostCommonInterval.toFixed(3)
      );
    }
  }, []);

  // Check if current time is on a beat
  const checkForBeat = useCallback((currentTime: number) => {
    if (beatIntervalRef.current <= 0) return false;

    // If this is the first beat after starting/resuming playback
    if (lastBeatTimeRef.current === 0) {
      // Set the first beat time
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

  const updateAudioData = useCallback(() => {
    if (!analyserRef.current || !audioContextRef.current) return;

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

      // Calculate and set average audio level
      if (dataArray.length > 0) {
        const avgLevel =
          Array.from(dataArray).reduce((sum, val) => sum + val, 0) /
          dataArray.length;
        setAvgAudioLevel(avgLevel);
      }

      // Beat detection based on Joe Sullivan's approach
      if (dataArray.length > 0) {
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
    } catch (error) {
      console.error("Error updating audio data:", error);
    }

    animationFrameRef.current = requestAnimationFrame(updateAudioData);
  }, [analyzePeakIntervals, checkForBeat, setAudioData, setOnBeat]);

  // Reset beat detection function to use when playback state changes
  const resetBeatDetection = useCallback(
    (maintainBPM = true) => {
      // Store the current BPM if we want to maintain it
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

  // Start animation when playing
  useEffect(() => {
    if (isPlaying) {
      // If we're starting playback, ensure we have a clean state for beat detection
      if (!animationFrameRef.current) {
        // Reset beat detection but maintain the BPM
        resetBeatDetection(true);
      }
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
  }, [isPlaying, updateAudioData, resetBeatDetection]);

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
  }, [currentAudioFile]);

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

      // Reset beat detection but maintain the BPM when resuming playback
      resetBeatDetection(true);

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
    resetBeatDetection,
  ]);

  const setAudioFile = useCallback(
    (file: string) => {
      console.log("Setting new audio file:", file);
      setCurrentAudioFile(file);

      if (audioRef.current) {
        const wasPlaying = !audioRef.current.paused;

        // Pause current playback
        audioRef.current.pause();

        // Cancel any pending animation frames
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = undefined;
        }

        // STEP 1: Completely clean up all audio resources
        // Disconnect and clean up all audio nodes
        if (sourceRef.current) {
          try {
            sourceRef.current.disconnect();
          } catch (error) {
            console.error("Error disconnecting source:", error);
          }
          sourceRef.current = null;
        }

        if (analyserRef.current) {
          try {
            analyserRef.current.disconnect();
          } catch (error) {
            console.error("Error disconnecting analyser:", error);
          }
        }

        // Close the AudioContext completely
        if (audioContextRef.current) {
          try {
            if (audioContextRef.current.state !== "closed") {
              audioContextRef.current.close();
              console.log("AudioContext closed successfully");
            }
          } catch (error) {
            console.error("Error closing AudioContext:", error);
          }
          audioContextRef.current = null;
          analyserRef.current = null;
        }

        // Reset connection state
        isSourceConnectedRef.current = false;

        // STEP 2: Reset all beat detection state
        // Reset all beat detection variables to their initial values
        peaksRef.current = [];
        lastPeakTimeRef.current = 0;
        lastBeatTimeRef.current = 0;
        lastBassEnergyRef.current = 0;
        beatHistoryRef.current = [];
        beatIntervalRef.current = 0.5; // Reset to default interval (120 BPM)

        // Reset state variables
        setBpm(120);
        setOnBeat(false);
        setBeatTime(0);
        setAudioData(null);

        // STEP 3: Create a new audio element
        const newAudio = new Audio();
        newAudio.src = file;
        newAudio.crossOrigin = "anonymous";
        newAudio.preload = "auto"; // Ensure audio is preloaded

        // Add event listeners to the new audio element
        newAudio.addEventListener("timeupdate", handleTimeUpdate);
        newAudio.addEventListener("durationchange", handleDurationChange);
        newAudio.addEventListener("ended", () => setIsPlaying(false));

        // STEP 4: Replace the audio element in the DOM
        if (audioRef.current.parentNode) {
          const currentAudio = audioRef.current;

          if (currentAudio.parentNode) {
            currentAudio.parentNode.replaceChild(newAudio, currentAudio);
            console.log("Audio element replaced in DOM");
          }

          // Update our ref
          if (audioRef && typeof audioRef === "object") {
            (audioRef as React.MutableRefObject<HTMLAudioElement>).current =
              newAudio;
          }
        }

        console.log("Audio element replaced, beat detection state reset");

        // STEP 5: If it was playing before, start playing the new audio
        if (wasPlaying) {
          // Use a longer timeout to ensure everything is ready
          setTimeout(() => {
            try {
              // Create a completely new AudioContext
              audioContextRef.current = new (window.AudioContext ||
                (
                  window as unknown as {
                    webkitAudioContext: typeof AudioContext;
                  }
                ).webkitAudioContext)();
              console.log(
                "New AudioContext created:",
                audioContextRef.current.state
              );

              // Create a new analyser node
              analyserRef.current = audioContextRef.current.createAnalyser();
              analyserRef.current.fftSize = 128;
              analyserRef.current.smoothingTimeConstant = 0.5;

              // Ensure the audio element is ready
              if (
                audioRef.current &&
                audioContextRef.current &&
                analyserRef.current
              ) {
                // Create and connect the source
                sourceRef.current =
                  audioContextRef.current.createMediaElementSource(
                    audioRef.current
                  );
                sourceRef.current.connect(analyserRef.current);
                analyserRef.current.connect(
                  audioContextRef.current.destination
                );
                isSourceConnectedRef.current = true;

                console.log("New audio source connected to analyser");

                // Resume the AudioContext if needed
                if (audioContextRef.current.state === "suspended") {
                  audioContextRef.current
                    .resume()
                    .then(() => console.log("AudioContext resumed"))
                    .catch((err) =>
                      console.error("Failed to resume AudioContext:", err)
                    );
                }

                // Start playback
                audioRef.current
                  .play()
                  .then(() => {
                    console.log("New audio playback started");
                    // Start the animation frame for beat detection
                    updateAudioData();
                    setIsPlaying(true);
                  })
                  .catch((error) => {
                    console.error("Error playing new audio:", error);
                    setIsPlaying(false);
                  });
              } else {
                console.error("Audio elements not properly initialized");
                setIsPlaying(false);
              }
            } catch (error) {
              console.error("Error in audio initialization:", error);
              setIsPlaying(false);
            }
          }, 300); // Increased delay to ensure everything is ready
        } else {
          setIsPlaying(false);
        }
      }
    },
    [handleTimeUpdate, handleDurationChange, updateAudioData]
  );

  // Initialize audio input devices
  useEffect(() => {
    const initializeDevices = async () => {
      try {
        // First request permission to access audio devices
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        // Stop the stream immediately after getting permission
        stream.getTracks().forEach((track) => track.stop());

        // Then enumerate all devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(
          (device) => device.kind === "audioinput"
        );
        setAvailableInputs(audioInputs);

        // If no input is selected and we have inputs available, select the first one
        if (!selectedInput && audioInputs.length > 0) {
          setSelectedInput(audioInputs[0]);
        }
      } catch (error) {
        console.error("Error initializing audio devices:", error);
      }
    };

    initializeDevices();

    // Listen for device changes
    const handleDeviceChange = () => {
      initializeDevices();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, [selectedInput]);

  // Setup system audio input
  const setupSystemAudio = useCallback(async () => {
    if (!selectedInput) return;

    try {
      // Clean up any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // For system: protocol devices in Electron
      if (isElectron && selectedInput.deviceId.startsWith("system:")) {
        console.log(
          "Using Electron system audio mode for:",
          selectedInput.deviceId
        );

        // Get system audio with the selected device - handled by Electron preload
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: selectedInput.deviceId,
            // Add constraints for system audio capture
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });

        streamRef.current = stream;
      } else {
        // Regular device or browser environment - use standard approach
        console.log(
          "Using standard audio input mode for:",
          selectedInput.deviceId
        );

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: selectedInput.deviceId,
            // Add constraints for system audio capture
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });

        streamRef.current = stream;
      }

      // Initialize audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.3;
      }

      // Ensure audio context is running
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      // Clean up previous source if it exists
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }

      // Create and connect new source
      if (audioContextRef.current && analyserRef.current && streamRef.current) {
        sourceRef.current = audioContextRef.current.createMediaStreamSource(
          streamRef.current
        );
        sourceRef.current.connect(analyserRef.current);
        // Don't connect to destination to mute the audio
        // analyserRef.current.connect(audioContextRef.current.destination);
        isSourceConnectedRef.current = true;
      }

      // Set currentAudioFile to indicate system input
      setCurrentAudioFile(`system:${selectedInput.deviceId}`);

      // Start audio analysis
      if (!animationFrameRef.current) {
        updateAudioData();
      }

      setIsPlaying(true);
    } catch (error) {
      console.error("Error setting up system audio:", error);
      setIsPlaying(false);
    }
  }, [selectedInput, updateAudioData]);

  // Handle input type changes
  useEffect(() => {
    if (inputType === "system") {
      setupSystemAudio();
    } else {
      // Clean up system audio resources
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      isSourceConnectedRef.current = false;
      setIsPlaying(false);
      // Reset currentAudioFile when switching back to file mode
      setCurrentAudioFile(null);
    }
  }, [inputType, setupSystemAudio]);

  // Update the value object to include new properties
  const value = {
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
        src={currentAudioFile || undefined}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
        muted={inputType === "system"}
      />
      {children}
    </AudioContext.Provider>
  );
}
