export interface VisualizerProps {
  audioData: Uint8Array | null;
}

// Valid visualizer types
export type VisualizerType = "particular" | "unified" | "platonic" | "wave";

// Simple metadata about visualizers for UI display
export interface VisualizerInfo {
  id: VisualizerType;
  name: string;
  description: string;
}
