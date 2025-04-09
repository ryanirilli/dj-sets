const { contextBridge, ipcRenderer } = require("electron");

// Add global error handler
process.on("uncaughtException", (error) => {
  console.error("Preload script uncaught exception:", error);
});

console.log("Preload script starting...");

// Prevent throttling of requestAnimationFrame when the window is in the background
const preventRAFThrottling = () => {
  try {
    console.log("Setting up requestAnimationFrame anti-throttling measures");

    // Store the original requestAnimationFrame and cancelAnimationFrame
    const originalRAF = window.requestAnimationFrame;
    const originalCAF = window.cancelAnimationFrame;

    // Active animation frame requests
    const activeRAFs = new Map();
    let rafCounter = 0;

    // Create a backup timer that runs at 60fps (16.67ms) in case requestAnimationFrame is throttled
    window.requestAnimationFrame = function (callback) {
      // Generate a unique ID for this request
      const rafId = rafCounter++;

      // Create both a requestAnimationFrame call and a timeout as backup
      const originalRafId = originalRAF((timestamp) => {
        // If this executes, we don't need the timeout anymore
        if (activeRAFs.has(rafId)) {
          clearTimeout(activeRAFs.get(rafId).timeoutId);
          activeRAFs.delete(rafId);
        }

        // Execute the callback with the timestamp
        callback(timestamp);
      });

      // Create a backup timeout that will run if requestAnimationFrame is throttled
      const timeoutId = setTimeout(() => {
        // If this executes, the requestAnimationFrame was throttled
        if (activeRAFs.has(rafId)) {
          originalCAF(activeRAFs.get(rafId).originalRafId);
          activeRAFs.delete(rafId);

          // Call the callback with a generated timestamp
          // (not as accurate as the real one, but better than nothing)
          callback(performance.now());
        }
      }, 16.67); // ~60fps

      // Store both IDs so we can cancel them
      activeRAFs.set(rafId, { originalRafId, timeoutId });

      // Return the unique ID for this request
      return rafId;
    };

    // Override cancelAnimationFrame to clean up both the RAF and timeout
    window.cancelAnimationFrame = function (rafId) {
      if (activeRAFs.has(rafId)) {
        const { originalRafId, timeoutId } = activeRAFs.get(rafId);
        originalCAF(originalRafId);
        clearTimeout(timeoutId);
        activeRAFs.delete(rafId);
      }
    };

    console.log("requestAnimationFrame anti-throttling setup complete");
  } catch (error) {
    console.error(
      "Error setting up requestAnimationFrame anti-throttling:",
      error
    );
  }
};

// Create a virtual audio stream for system audio devices
const createVirtualAudioStream = () => {
  try {
    console.log("Creating virtual audio stream...");

    // Safely access AudioContext
    let AudioContextClass;
    try {
      AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.error("AudioContext not available");
        throw new Error("AudioContext not available");
      }
    } catch (err) {
      console.error("Error accessing AudioContext:", err);
      throw err;
    }

    const audioContext = new AudioContextClass();
    console.log("AudioContext created:", audioContext.state);

    // Create basic oscillator
    const oscillator = audioContext.createOscillator();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(220, audioContext.currentTime);

    // Create gain node to control volume
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.3;

    // Connect oscillator to gain
    oscillator.connect(gainNode);

    // Create media stream destination
    let destination;
    try {
      destination = audioContext.createMediaStreamDestination();
    } catch (err) {
      console.error("Error creating MediaStreamDestination:", err);
      throw err;
    }

    // Connect gain to destination
    gainNode.connect(destination);

    // Start oscillator
    oscillator.start();

    console.log("Virtual audio stream created successfully");
    return destination.stream;
  } catch (err) {
    console.error("Error creating virtual audio stream:", err);
    // Return a dummy stream instead of throwing
    return new MediaStream();
  }
};

// Map to hold references to created streams
const audioStreams = new Map();

// Patch navigator.mediaDevices for better audio handling
const patchNavigatorMediaDevices = () => {
  try {
    console.log("Patching navigator.mediaDevices...");

    // Check if mediaDevices exists before trying to access it
    if (!navigator || !navigator.mediaDevices) {
      console.error("Navigator.mediaDevices not available");
      return;
    }

    // Store original functions
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
    const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;

    // Don't patch if we've already patched
    if (navigator.mediaDevices._patched) {
      console.log("Navigator.mediaDevices already patched, skipping");
      return;
    }

    // Patch getUserMedia
    navigator.mediaDevices.getUserMedia = async function (constraints) {
      console.log(
        "getUserMedia called with constraints:",
        JSON.stringify(constraints)
      );

      try {
        // Special handling for system: prefixed devices (our virtual system audio)
        if (constraints?.audio?.deviceId) {
          const deviceId =
            typeof constraints.audio.deviceId === "string"
              ? constraints.audio.deviceId
              : constraints.audio.deviceId?.exact;

          if (deviceId && deviceId.startsWith("system:")) {
            console.log("System audio request detected for:", deviceId);

            // Return cached stream if available
            if (audioStreams.has(deviceId)) {
              console.log("Returning cached stream for", deviceId);
              return audioStreams.get(deviceId);
            }

            // Create new virtual stream
            const stream = createVirtualAudioStream();
            audioStreams.set(deviceId, stream);
            console.log("Created virtual system audio stream for", deviceId);
            return stream;
          }
        }

        // For Serato Virtual Audio & other special audio devices, optimize the constraints
        if (constraints.audio && typeof constraints.audio === "object") {
          if (
            constraints.audio.deviceId &&
            (constraints.audio.deviceId.toString().includes("Serato") ||
              constraints.audio.deviceId.toString().includes("Loopback") ||
              constraints.audio.deviceId.toString().includes("BlackHole"))
          ) {
            console.log(
              "Detected virtual audio device, optimizing constraints"
            );

            // Override with settings that work better for virtual audio
            constraints.audio = {
              ...constraints.audio,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              // High sample rate and bit depth
              sampleRate: 48000,
              sampleSize: 16,
              channelCount: 2,
            };
          }
        }

        // Call original getUserMedia with possibly modified constraints
        return await originalGetUserMedia.call(
          navigator.mediaDevices,
          constraints
        );
      } catch (error) {
        console.error("Error in getUserMedia:", error);
        throw error;
      }
    };

    // Patch enumerateDevices to include virtual system audio devices
    navigator.mediaDevices.enumerateDevices = async function () {
      try {
        // Get real devices
        const devices = await originalEnumerateDevices.call(this);

        // Log the original devices for debugging
        console.log(
          "Real audio devices found:",
          devices.filter((d) => d.kind === "audioinput").map((d) => d.label)
        );

        // Add our virtual system audio devices
        devices.push({
          deviceId: "system:default",
          kind: "audioinput",
          label: "System Audio (Default)",
          groupId: "system",
        });

        devices.push({
          deviceId: "system:soundeffect",
          kind: "audioinput",
          label: "Sound Effect Generator",
          groupId: "system",
        });

        return devices;
      } catch (error) {
        console.error("Error in enumerateDevices:", error);
        throw error;
      }
    };

    // Mark as patched to avoid double-patching
    navigator.mediaDevices._patched = true;
    console.log("Media devices API patched successfully");
  } catch (error) {
    console.error("Failed to patch navigator.mediaDevices:", error);
  }
};

// Apply our patches when the window is ready
window.addEventListener("DOMContentLoaded", () => {
  // Set up background throttling prevention
  preventRAFThrottling();

  // Force active window behavior even when in background
  Object.defineProperty(document, "hidden", { value: false, writable: false });
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    writable: false,
  });

  // Prevent the visibilitychange event from firing
  document.addEventListener(
    "visibilitychange",
    (event) => {
      event.stopImmediatePropagation();
    },
    true
  );

  // Apply media device patches
  patchNavigatorMediaDevices();
});

// Expose electron APIs to renderer process
try {
  console.log("Exposing electron API to renderer...");

  contextBridge.exposeInMainWorld("electron", {
    isElectron: true,

    // Get system audio sources including both real and virtual devices
    getAudioDevices: async () => {
      try {
        if (!navigator.mediaDevices) return [];

        // First ensure we have permission by requesting default microphone
        await navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            // Stop tracks immediately - we just needed permission
            stream.getTracks().forEach((track) => track.stop());
          });

        // Now list all devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter((device) => device.kind === "audioinput");
      } catch (error) {
        console.error("Error getting audio devices:", error);
        return [];
      }
    },

    // Get system audio permission status
    getAudioPermissionStatus: async () => {
      try {
        return await ipcRenderer.invoke("get-system-audio-status");
      } catch (error) {
        console.error("Error getting audio permission status:", error);
        return "error";
      }
    },

    // Check if app is running in background
    isBackgroundRunningEnabled: true,

    // Method to force process audio frames even when in background
    keepAlive: () => {
      // This method forces the JavaScript engine to stay active
      setInterval(() => {
        console.log(
          "Keep-alive ping to prevent throttling: " + new Date().toISOString()
        );
      }, 10000); // Every 10 seconds
    },
  });

  console.log("electron API exposed successfully");
} catch (err) {
  console.error("Error exposing electron API:", err);
}

console.log("Preload script completed successfully");
