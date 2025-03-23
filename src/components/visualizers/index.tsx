import React from "react";
import dynamic from "next/dynamic";
import {
  VisualizerProps,
  VisualizerType,
  VisualizerInfo,
} from "@/types/visualizers";

// Loading component that doesn't use JSX directly in the dynamic import
const LoadingComponent = () => {
  return <></>;
};

// Import visualizers with dynamic import to avoid SSR issues with Web Audio API
export const AudioBars = dynamic(
  () => import("@/components/visualizers/AudioBars"),
  {
    ssr: false,
    loading: () => <LoadingComponent />,
  }
) as React.ComponentType<VisualizerProps>;

export const SmokeVisualizer = dynamic(
  () => import("@/components/visualizers/SmokeVisualizer"),
  {
    ssr: false,
    loading: () => <LoadingComponent />,
  }
) as React.ComponentType<VisualizerProps>;

export const IcosahedronVisualizer = dynamic(
  () => import("@/components/visualizers/IcosahedronVisualizer"),
  {
    ssr: false,
    loading: () => <LoadingComponent />,
  }
) as React.ComponentType<VisualizerProps>;

// Visualizer metadata for UI display
export const visualizersInfo: VisualizerInfo[] = [
  {
    id: "circular",
    name: "Circular",
    description: "Circular audio bars that react to music",
  },
  {
    id: "smoke",
    name: "Smoke",
    description: "Smoke particles that react to music",
  },
  {
    id: "icosahedron",
    name: "Icosahedron",
    description: "Audio-reactive icosahedron with wireframe gradient",
  },
];

// A simple utility function to get visualizer info by ID
export function getVisualizerInfo(
  id: VisualizerType
): VisualizerInfo | undefined {
  return visualizersInfo.find((v) => v.id === id);
}

// Function to get the default visualizer type
export function getDefaultVisualizerType(): VisualizerType {
  return "smoke";
}
