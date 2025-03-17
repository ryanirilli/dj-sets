import { ReactNode, ComponentType } from "react";

// Base interface for all visualizer props
export interface VisualizerProps {
  audioData: Uint8Array | null;
}

// Valid visualizer types
export type VisualizerType =
  | "smoke"
  | "waveform"
  | "bars"
  | "icosahedron"
  | string; // Allow for dynamic registration

// Entry in the visualizer registry
export interface VisualizerRegistryEntry {
  id: VisualizerType;
  name: string;
  description: string;
  component: ComponentType<VisualizerProps>;
  cleanup?: () => void; // Optional cleanup function
}
