import { ReactNode } from "react";

// Base interface for all visualizer props
export interface VisualizerProps {
  audioData: Uint8Array | null;
}

// Visualizer registry entry
export interface VisualizerRegistryEntry {
  id: string;
  name: string;
  component: React.ComponentType<VisualizerProps>;
  description?: string;
}

// Type for visualizer ID
export type VisualizerType = string;
