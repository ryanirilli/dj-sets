import React from "react";
import dynamic from "next/dynamic";
import { registerVisualizer, VisualizerProps } from "@/types/visualizers";

// Loading component that doesn't use JSX directly in the dynamic import
const LoadingComponent = ({ name }: { name: string }) => {
  return <></>;
};

// Import visualizers with dynamic import to avoid SSR issues with Web Audio API
const AudioBars = dynamic(() => import("@/visualizers/components/AudioBars"), {
  ssr: false,
  loading: () => <LoadingComponent name="AudioBars" />,
}) as React.ComponentType<VisualizerProps>;

const WaveformBars = dynamic(
  () => import("@/visualizers/components/WaveformBars"),
  {
    ssr: false,
    loading: () => <LoadingComponent name="WaveformBars" />,
  }
) as React.ComponentType<VisualizerProps>;

const SmokeVisualizer = dynamic(
  () => import("@/visualizers/components/SmokeVisualizer"),
  {
    ssr: false,
    loading: () => <LoadingComponent name="SmokeVisualizer" />,
  }
) as React.ComponentType<VisualizerProps>;

// Register all visualizers
export function registerAllVisualizers() {
  // Register circular audio bars
  registerVisualizer({
    id: "circular",
    name: "Circular",
    component: AudioBars,
    description: "Circular audio bars that react to music",
  });

  // Register waveform bars
  registerVisualizer({
    id: "waveform",
    name: "Waveform",
    component: WaveformBars,
    description: "Linear waveform bars that react to music",
  });

  // Register smoke visualizer
  registerVisualizer({
    id: "smoke",
    name: "Smoke",
    component: SmokeVisualizer,
    description: "Smoke particles that react to music",
  });

  // You can add more visualizers here
  // Example:
  // registerVisualizer({
  //   id: 'water',
  //   name: 'Water',
  //   component: WaterVisualizer,
  //   description: 'Water effect that reacts to music'
  // });
}

// Export dynamic components for direct use if needed
export { AudioBars, WaveformBars, SmokeVisualizer };
