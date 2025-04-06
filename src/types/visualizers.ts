export interface VisualizerProps {
  audioData: Uint8Array | null;
}

// Valid visualizer types
export type VisualizerType =
  | "particular"
  | "unified"
  | "platonic"
  | "wave"
  | "amorphous";

// Constant array of all valid visualizer types
export const VALID_VISUALIZER_TYPES: VisualizerType[] = [
  "particular",
  "unified",
  "platonic",
  "wave",
  "amorphous",
];

// Simple metadata about visualizers for UI display
export interface VisualizerInfo {
  id: VisualizerType;
  name: string;
  description: string;
}
