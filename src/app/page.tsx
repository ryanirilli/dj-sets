"use client";

import { useState, useEffect } from "react";
import { AudioProvider, useAudio } from "@/contexts/AudioContext";
import { SceneProvider } from "@/contexts/SceneContext";
import { Toolbar } from "@/components/Toolbar";
import {
  VisualizerType,
  getVisualizer,
  getDefaultVisualizer,
  getVisualizers,
} from "@/types/visualizers";
import { registerAllVisualizers } from "@/visualizers";

const Controls = () => {
  const { isPlaying, togglePlayPause } = useAudio();

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/40 backdrop-blur-sm">
      <div className="max-w-md mx-auto">
        <button
          onClick={togglePlayPause}
          className="w-full px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg ring-1 ring-inset ring-white/10 transition-all duration-200 text-sm font-medium"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>
    </div>
  );
};

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
      <Controls />
      <Toolbar
        selectedVisualizer={visualizerType}
        onVisualizerChange={onVisualizerChange}
      />
    </SceneProvider>
  );
}

export default function Home() {
  const [visualizerType, setVisualizerType] =
    useState<VisualizerType>("circular");

  return (
    <AudioProvider>
      <HomeContent
        visualizerType={visualizerType}
        onVisualizerChange={setVisualizerType}
      />
    </AudioProvider>
  );
}
