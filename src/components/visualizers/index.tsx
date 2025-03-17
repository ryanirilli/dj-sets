import React from "react";
import dynamic from "next/dynamic";
import { VisualizerProps } from "@/types/visualizers";
import { registerVisualizer } from "@/lib/visualizer-registry";

// Loading component that doesn't use JSX directly in the dynamic import
const LoadingComponent = ({ name }: { name: string }) => {
  return <></>;
};

// Import visualizers with dynamic import to avoid SSR issues with Web Audio API
const AudioBars = dynamic(() => import("@/components/visualizers/AudioBars"), {
  ssr: false,
  loading: () => <LoadingComponent name="AudioBars" />,
}) as React.ComponentType<VisualizerProps>;

const SmokeVisualizer = dynamic(
  () => import("@/components/visualizers/SmokeVisualizer"),
  {
    ssr: false,
    loading: () => <LoadingComponent name="SmokeVisualizer" />,
  }
) as React.ComponentType<VisualizerProps>;

const IcosahedronVisualizer = dynamic(
  () => import("@/components/visualizers/IcosahedronVisualizer"),
  {
    ssr: false,
    loading: () => <LoadingComponent name="IcosahedronVisualizer" />,
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

  // Register smoke visualizer
  registerVisualizer({
    id: "smoke",
    name: "Smoke",
    component: SmokeVisualizer,
    description: "Smoke particles that react to music",
  });

  // Register icosahedron visualizer
  registerVisualizer({
    id: "icosahedron",
    name: "Icosahedron",
    component: IcosahedronVisualizer,
    description: "Audio-reactive icosahedron with wireframe gradient",
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
export { AudioBars, SmokeVisualizer, IcosahedronVisualizer };
