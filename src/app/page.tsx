"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { AudioProvider, useAudio } from "@/contexts/AudioContext";
import { SceneProvider } from "@/contexts/SceneContext";
import { Toolbar } from "@/components/Toolbar";
import { VisualizerType } from "@/types/visualizers";
import {
  getVisualizer,
  getDefaultVisualizer,
  cleanupVisualizer,
} from "@/lib/visualizer-registry";
import { registerAllVisualizers } from "@/components/visualizers";
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

interface HomeContentProps {
  visualizerType: VisualizerType;
  onVisualizerChange: (type: VisualizerType) => void;
}

function HomeContent({ visualizerType, onVisualizerChange }: HomeContentProps) {
  const { audioData } = useAudio();
  const [initialized, setInitialized] = useState(false);
  const [isChangingVisualizer, setIsChangingVisualizer] = useState(false);
  const previousVisualizerRef = useRef<VisualizerType | null>(null);

  // Register all visualizers on first render
  useEffect(() => {
    if (!initialized) {
      registerAllVisualizers();
      setInitialized(true);
    }
  }, [initialized]);

  // Handle visualizer switching with cleanup
  useEffect(() => {
    if (
      previousVisualizerRef.current &&
      previousVisualizerRef.current !== visualizerType
    ) {
      // Visualizer is changing, trigger cleanup
      setIsChangingVisualizer(true);

      // Clean up previous visualizer
      cleanupVisualizer(previousVisualizerRef.current);

      // Force garbage collection
      THREE.Cache.clear();

      // Add a small delay to allow for proper cleanup
      const timer = setTimeout(() => {
        setIsChangingVisualizer(false);
      }, 300);

      return () => clearTimeout(timer);
    }

    previousVisualizerRef.current = visualizerType;
  }, [visualizerType]);

  // Debug log when visualizer type changes
  useEffect(() => {
    console.log("Visualizer type changed to:", visualizerType);
    console.log("Audio data available:", !!audioData);
  }, [visualizerType, audioData]);

  // Get the selected visualizer from registry
  const visualizer = getVisualizer(visualizerType);
  const VisualizerComponent = visualizer?.component;

  // If no visualizer is found, use the default one
  if (!visualizer || !VisualizerComponent) {
    const defaultVisualizer = getDefaultVisualizer();
    if (defaultVisualizer && visualizerType !== defaultVisualizer.id) {
      // If there's a default visualizer and it's not the current one, switch to it
      onVisualizerChange(defaultVisualizer.id);
    }
    return null; // Return null while switching to default
  }

  return (
    <SceneProvider
      sceneContent={
        isChangingVisualizer ? null : (
          <Suspense fallback={<VisualizerLoading />}>
            <VisualizerComponent audioData={audioData} />
          </Suspense>
        )
      }
    >
      <Toolbar
        selectedVisualizer={visualizerType}
        onVisualizerChange={onVisualizerChange}
      />
    </SceneProvider>
  );
}

export default function Home() {
  const [visualizerType, setVisualizerType] =
    useState<VisualizerType>("icosahedron");

  // Optimized visualizer change handler
  const handleVisualizerChange = (type: VisualizerType) => {
    // Clean up current visualizer before switching
    cleanupVisualizer(visualizerType);

    // Force cleanup before changing visualizer
    if (typeof window !== "undefined") {
      // Clear Three.js cache
      THREE.Cache.clear();
    }

    // Update visualizer type
    setVisualizerType(type);
  };

  return (
    <AudioProvider>
      <HomeContent
        visualizerType={visualizerType}
        onVisualizerChange={handleVisualizerChange}
      />
    </AudioProvider>
  );
}
