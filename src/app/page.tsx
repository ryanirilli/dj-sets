"use client";

import { useState, useEffect, Suspense } from "react";
import { AudioProvider, useAudio } from "@/contexts/AudioContext";
import { SceneProvider } from "@/contexts/SceneContext";
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext";
import { Toolbar } from "@/components/Toolbar";
import { VisualizerType } from "@/types/visualizers";
import {
  AudioBars,
  SmokeVisualizer,
  IcosahedronVisualizer,
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
  const { audioData, setAudioFile, currentAudioFile } = useAudio();
  const { settings, updateSettings } = useSettings();
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
    console.log("[DEBUG] Current audio file in context:", currentAudioFile);

    // Log the URL to see if it has a visualizer parameter
    console.log("[DEBUG] Current URL:", window.location.href);
  }, [
    settings.visualizerType,
    activeVisualizerType,
    settings.selectedAudioFile,
    currentAudioFile,
  ]);

  // Initialize audio file from settings
  useEffect(() => {
    // If there's an audio file in settings and it's different from current
    if (
      settings.selectedAudioFile &&
      settings.selectedAudioFile !== currentAudioFile
    ) {
      console.log(
        "[DEBUG] Setting audio file from settings:",
        settings.selectedAudioFile
      );
      setAudioFile(settings.selectedAudioFile);
    } else if (currentAudioFile && !settings.selectedAudioFile) {
      // If audio is playing but not in settings, update settings
      console.log(
        "[DEBUG] Saving current audio file to settings:",
        currentAudioFile
      );
      updateSettings("selectedAudioFile", currentAudioFile);
    }
  }, [
    settings.selectedAudioFile,
    currentAudioFile,
    setAudioFile,
    updateSettings,
  ]);

  // Make sure we initialize with the correct visualizer type on mount
  useEffect(() => {
    const initialType = settings.visualizerType;
    console.log("[DEBUG] Initializing with visualizer type:", initialType);

    // If we don't have a valid type, force update to the default
    if (!["smoke", "circular", "icosahedron"].includes(initialType)) {
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
      case "circular":
        return <AudioBars audioData={audioData} key="circular-visualizer" />;
      case "smoke":
        return <SmokeVisualizer audioData={audioData} key="smoke-visualizer" />;
      case "icosahedron":
        return (
          <IcosahedronVisualizer
            audioData={audioData}
            key="icosahedron-visualizer"
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
          case "circular":
            return <AudioBars audioData={audioData} key="default-circular" />;
          case "smoke":
            return (
              <SmokeVisualizer audioData={audioData} key="default-smoke" />
            );
          case "icosahedron":
            return (
              <IcosahedronVisualizer
                audioData={audioData}
                key="default-icosahedron"
              />
            );
          default:
            // Fallback to Smoke as absolute default
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
      <Toolbar
        selectedVisualizer={settings.visualizerType}
        onVisualizerChange={handleVisualizerChange}
        visualizersInfo={visualizersInfo}
      />
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
