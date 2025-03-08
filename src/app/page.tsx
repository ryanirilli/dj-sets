"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { AudioBarsProps } from "@/components/AudioBars";
import type { WaveformBarsProps } from "@/components/WaveformBars";
import { AudioProvider, useAudio } from "@/contexts/AudioContext";
import { SceneProvider } from "@/contexts/SceneContext";
import { Toolbar, VisualizerType } from "@/components/Toolbar";

// Import visualizers with dynamic import to avoid SSR issues with Web Audio API
const AudioBars = dynamic(() => import("@/components/AudioBars"), {
  ssr: false,
  loading: () => null,
}) as React.ComponentType<AudioBarsProps>;

const WaveformBars = dynamic(() => import("@/components/WaveformBars"), {
  ssr: false,
  loading: () => null,
}) as React.ComponentType<WaveformBarsProps>;

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

  const sceneContent =
    visualizerType === "circular" ? (
      <AudioBars audioData={audioData} />
    ) : (
      <WaveformBars audioData={audioData} />
    );

  return (
    <SceneProvider sceneContent={sceneContent}>
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
