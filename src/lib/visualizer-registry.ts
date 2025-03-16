import { VisualizerRegistryEntry, VisualizerType } from "@/types/visualizers";

// Registry of all available visualizers
const visualizerRegistry: VisualizerRegistryEntry[] = [];

/**
 * Register a new visualizer
 * @param entry The visualizer entry to register
 */
export function registerVisualizer(entry: VisualizerRegistryEntry): void {
  // Check if visualizer with this ID already exists
  const existingIndex = visualizerRegistry.findIndex((v) => v.id === entry.id);

  if (existingIndex >= 0) {
    // Replace existing entry
    visualizerRegistry[existingIndex] = entry;
  } else {
    // Add new entry
    visualizerRegistry.push(entry);
  }
}

/**
 * Unregister a visualizer by ID
 * @param id The ID of the visualizer to unregister
 */
export function unregisterVisualizer(id: string): void {
  const index = visualizerRegistry.findIndex((v) => v.id === id);
  if (index >= 0) {
    visualizerRegistry.splice(index, 1);
  }
}

/**
 * Get all registered visualizers
 */
export function getVisualizers(): VisualizerRegistryEntry[] {
  return [...visualizerRegistry];
}

/**
 * Get a specific visualizer by ID
 * @param id The ID of the visualizer to get
 */
export function getVisualizer(
  id: VisualizerType
): VisualizerRegistryEntry | undefined {
  return visualizerRegistry.find((v) => v.id === id);
}

/**
 * Get the default visualizer (first in registry or undefined if empty)
 */
export function getDefaultVisualizer(): VisualizerRegistryEntry | undefined {
  return visualizerRegistry[0];
}
