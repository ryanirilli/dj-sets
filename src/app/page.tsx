"use client";

import { useState, useEffect, Suspense } from "react";
import { AudioProvider, useAudio } from "@/contexts/AudioContext";
import { SceneProvider } from "@/contexts/SceneContext";
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext";
import { useFullScreen } from "@/contexts/FullScreenContext";
import { useIsElectron } from "@/hooks/useIsElectron";
import { Toolbar } from "@/components/Toolbar";
import { VisualizerType, VALID_VISUALIZER_TYPES } from "@/types/visualizers";
import {
  AudioBars,
  SmokeVisualizer,
  IcosahedronVisualizer,
  SinWaveVisualizer,
  AmorphousVisualizer,
  getDefaultVisualizerType,
  visualizersInfo,
} from "@/components/visualizers";
import * as THREE from "three";

// Loading fallback component
const VisualizerLoading = () => (
  <div className="absolute inset-0 flex items-center justify-center text-white bg-black/80">
    <div className="text-center">
      <div className="mb-2">Loading visualizer...</div>
      <div className="w-16 h-1 mx-auto bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 animate-pulse"></div>
      </div>
    </div>
  </div>
);

function HomeContent() {
  const { audioData } = useAudio();
  const { settings, updateSettings } = useSettings();
  const { isFullScreen, toggleFullScreen } = useFullScreen();
  const isElectron = useIsElectron();
  const [activeVisualizerType, setActiveVisualizerType] =
    useState<VisualizerType>(settings.visualizerType);

  // Log initial state
  useEffect(() => {
    console.log(
      "[DEBUG] Initial settings visualizer type:",
      settings.visualizerType
    );
    console.log(
      "[DEBUG] Initial active visualizer type:",
      activeVisualizerType
    );
    console.log(
      "[DEBUG] Initial audio file from settings:",
      settings.selectedAudioFile
    );
    console.log("[DEBUG] Current URL:", window.location.href);
  }, [
    settings.visualizerType,
    activeVisualizerType,
    settings.selectedAudioFile,
  ]);

  // Make sure we initialize with the correct visualizer type on mount
  useEffect(() => {
    const initialType = settings.visualizerType;
    console.log("[DEBUG] Initializing with visualizer type:", initialType);

    // If we don't have a valid type, force update to the default
    if (!VALID_VISUALIZER_TYPES.includes(initialType)) {
      const defaultType = getDefaultVisualizerType();
      console.log("[DEBUG] Invalid initial type, using default:", defaultType);
      updateSettings("visualizerType", defaultType);
    } else {
      setActiveVisualizerType(initialType);
    }
  }, [settings.visualizerType, updateSettings]);

  // Update activeVisualizerType when settings visualizerType changes
  useEffect(() => {
    console.log(
      "[DEBUG] Updating active visualizer type to match settings:",
      settings.visualizerType
    );
    setActiveVisualizerType(settings.visualizerType);
  }, [settings.visualizerType]);

  // Add global key listener for fullscreen toggle
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore key presses if an input field is focused
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Cmd/Ctrl + F: Toggle Fullscreen state
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFullScreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleFullScreen]);

  // Function to handle visualizer changes
  const handleVisualizerChange = (type: VisualizerType) => {
    console.log("[DEBUG] handleVisualizerChange called with:", type);
    // Update the settings which will trigger the effect to update activeVisualizerType
    updateSettings("visualizerType", type);
    // Force garbage collection
    THREE.Cache.clear();
  };

  // Render the selected visualizer component
  const renderVisualizer = () => {
    console.log("[DEBUG] Rendering visualizer for type:", activeVisualizerType);

    switch (activeVisualizerType) {
      case "unified":
        return <AudioBars audioData={audioData} key="circular-visualizer" />;
      case "particular":
        return <SmokeVisualizer audioData={audioData} key="smoke-visualizer" />;
      case "platonic":
        return (
          <IcosahedronVisualizer
            audioData={audioData}
            key="icosahedron-visualizer"
          />
        );
      case "wave":
        return (
          <SinWaveVisualizer audioData={audioData} key="sinwave-visualizer" />
        );
      case "amorphous":
        return (
          <AmorphousVisualizer
            audioData={audioData}
            key="amorphous-visualizer"
          />
        );
      default:
        // If we get here, it means the activeVisualizerType is invalid
        console.log(
          "[DEBUG] Invalid activeVisualizerType:",
          activeVisualizerType
        );
        const defaultType = getDefaultVisualizerType();
        console.log("[DEBUG] Using default type:", defaultType);

        // Update settings to use the default type
        updateSettings("visualizerType", defaultType);

        // Return the appropriate component based on default type
        switch (defaultType) {
          case "unified":
            return <AudioBars audioData={audioData} key="default-circular" />;
          case "particular":
            return (
              <SmokeVisualizer audioData={audioData} key="default-smoke" />
            );
          case "platonic":
            return (
              <IcosahedronVisualizer
                audioData={audioData}
                key="default-icosahedron"
              />
            );
          case "wave":
            return (
              <SinWaveVisualizer audioData={audioData} key="default-sinwave" />
            );
          case "amorphous":
            return (
              <AmorphousVisualizer
                audioData={audioData}
                key="default-amorphous"
              />
            );
          default:
            // Fallback to Particular as absolute default
            return (
              <SmokeVisualizer audioData={audioData} key="fallback-smoke" />
            );
        }
    }
  };

  return (
    <SceneProvider
      sceneContent={
        <Suspense fallback={<VisualizerLoading />}>
          {renderVisualizer()}
        </Suspense>
      }
    >
      <div className={isFullScreen ? "hidden" : "block"}>
        <Toolbar
          selectedVisualizer={settings.visualizerType}
          onVisualizerChange={handleVisualizerChange}
          visualizersInfo={visualizersInfo}
          isFullScreen={isFullScreen}
          toggleFullScreen={toggleFullScreen}
        />
      </div>

      {/* ESC key indicator - only shown briefly when entering fullscreen */}
      {isFullScreen && (
        <div
          className="fixed top-4 right-4 z-50 bg-background/40 backdrop-blur-xl px-3 py-2 rounded-full text-white text-xs opacity-80 animate-fadeOut"
          style={{
            animation: "fadeOut 2s forwards",
            animationDelay: "3s",
          }}
        >
          Press ESC to exit fullscreen
        </div>
      )}
    </SceneProvider>
  );
}

export default function Home() {
  return (
    <SettingsProvider>
      <Suspense fallback={<LoadingFallback />}>
        <AudioProvider>
          <HomeContent />
        </AudioProvider>
      </Suspense>
    </SettingsProvider>
  );
}

// Simple loading fallback
function LoadingFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black">
      <div className="text-center">
        <div className="mb-4 text-xl text-white">Loading...</div>
        <div className="w-32 h-1 mx-auto bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-blue-500 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}
