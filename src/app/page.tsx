"use client";

import { useState, useEffect } from "react";
import { AudioProvider, useAudio } from "@/contexts/AudioContext";
import { SceneProvider } from "@/contexts/SceneContext";
import { Toolbar } from "@/components/Toolbar";
import { VisualizerType } from "@/types/visualizers";
import {
  getVisualizer,
  getDefaultVisualizer,
  getVisualizers,
} from "@/lib/visualizer-registry";
import { registerAllVisualizers } from "@/components/visualizers";

interface HomeContentProps {
  visualizerType: VisualizerType;
  onVisualizerChange: (type: VisualizerType) => void;
}

function HomeContent({ visualizerType, onVisualizerChange }: HomeContentProps) {
  const { audioData } = useAudio();
  const [initialized, setInitialized] = useState(false);

  // Register all visualizers on first render
  useEffect(() => {
    if (!initialized) {
      registerAllVisualizers();
      setInitialized(true);
    }
  }, [initialized]);

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
    <SceneProvider sceneContent={<VisualizerComponent audioData={audioData} />}>
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

  return (
    <AudioProvider>
      <HomeContent
        visualizerType={visualizerType}
        onVisualizerChange={setVisualizerType}
      />
    </AudioProvider>
  );
}
