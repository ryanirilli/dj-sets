"use client";

import { useState, useEffect, Suspense } from "react";
import { AudioProvider, useAudio } from "@/contexts/AudioContext";
import { SceneProvider } from "@/contexts/SceneContext";
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

interface HomeContentProps {
  visualizerType: VisualizerType;
  onVisualizerChange: (type: VisualizerType) => void;
}

function HomeContent({ visualizerType, onVisualizerChange }: HomeContentProps) {
  const { audioData } = useAudio();
  const [isChangingVisualizer, setIsChangingVisualizer] = useState(false);
  const [activeVisualizerType, setActiveVisualizerType] =
    useState<VisualizerType>(visualizerType);

  // Handle visualizer switching with cleanup
  useEffect(() => {
    if (visualizerType !== activeVisualizerType) {
      // Visualizer is changing, trigger transition
      setIsChangingVisualizer(true);

      // Force garbage collection
      THREE.Cache.clear();

      // Add a small delay to allow for proper transition
      const timer = setTimeout(() => {
        setActiveVisualizerType(visualizerType);
        setIsChangingVisualizer(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [visualizerType, activeVisualizerType]);

  // Render the selected visualizer component
  const renderVisualizer = () => {
    switch (activeVisualizerType) {
      case "circular":
        return <AudioBars audioData={audioData} />;
      case "smoke":
        return <SmokeVisualizer audioData={audioData} />;
      case "icosahedron":
        return <IcosahedronVisualizer audioData={audioData} />;
      default:
        // If invalid type, use default
        if (visualizerType !== getDefaultVisualizerType()) {
          onVisualizerChange(getDefaultVisualizerType());
        }
        return <IcosahedronVisualizer audioData={audioData} />;
    }
  };

  return (
    <SceneProvider
      sceneContent={
        isChangingVisualizer ? null : (
          <Suspense fallback={<VisualizerLoading />}>
            {renderVisualizer()}
          </Suspense>
        )
      }
    >
      <Toolbar
        selectedVisualizer={visualizerType}
        onVisualizerChange={onVisualizerChange}
        visualizersInfo={visualizersInfo}
      />
    </SceneProvider>
  );
}

export default function Home() {
  const [visualizerType, setVisualizerType] = useState<VisualizerType>(
    getDefaultVisualizerType()
  );

  // Optimized visualizer change handler
  const handleVisualizerChange = (type: VisualizerType) => {
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
