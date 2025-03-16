# Visualizer System

This directory contains the visualizer registry and visualizer components for the audio visualization app.

## Directory Structure

- `src/visualizers/index.tsx` - Registry and dynamic imports for all visualizers
- `src/visualizers/components/` - Individual visualizer components
- `src/types/visualizers.ts` - Type definitions and registry functions

## How to Add a New Visualizer

Adding a new visualizer is a simple 3-step process:

### Step 1: Create a new visualizer component

1. Copy the template file:

   - Copy `src/visualizers/components/VisualizerTemplate.tsx` to a new file
   - Name it after your visualizer (e.g., `MyNewVisualizer.tsx`)
   - Place it in the `src/visualizers/components/` directory

2. Modify the component:
   - Rename the component from `VisualizerTemplate` to your visualizer name
   - Implement your visualization logic using Three.js
   - Make sure to handle the case where `audioData` is null

Example:

```tsx
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VisualizerProps } from "@/types/visualizers";

const MyNewVisualizer = ({ audioData }: VisualizerProps) => {
  // Your visualization code here
  // ...

  return <mesh>{/* Your Three.js elements */}</mesh>;
};

export default MyNewVisualizer;
```

### Step 2: Import and register your visualizer

Open `src/visualizers/index.tsx` and add:

1. Import your visualizer with dynamic loading:

```tsx
const MyNewVisualizer = dynamic(
  () => import("@/visualizers/components/MyNewVisualizer"),
  {
    ssr: false,
    loading: () => <div>Loading MyNewVisualizer...</div>,
  }
) as React.ComponentType<VisualizerProps>;
```

2. Register your visualizer in the `registerAllVisualizers` function:

```tsx
// Register your new visualizer
registerVisualizer({
  id: "my-new-visualizer", // Unique ID (kebab-case recommended)
  name: "My New Visualizer", // Display name shown in the UI
  component: MyNewVisualizer, // Your component
  description: "Description of your visualizer", // Optional description
});
```

### Step 3: Export your visualizer

Add your visualizer to the exports at the bottom of the file:

```tsx
export {
  AudioBars,
  WaveformBars,
  SmokeVisualizer,
  MyNewVisualizer, // Add your visualizer here
};
```

That's it! Your visualizer will now appear in the toolbar and can be selected by users.

## How to Remove a Visualizer

Removing a visualizer is just as easy:

1. **Remove the registration**:

   - Open `src/visualizers/index.tsx`
   - Remove or comment out the `registerVisualizer` call for the visualizer

2. **Remove the import and export**:

   - Remove the dynamic import for the visualizer
   - Remove the visualizer from the exports at the bottom of the file

3. **Optional: Delete the component file**:
   - If you're no longer using the visualizer component, you can delete the file from `src/visualizers/components/`

## Visualizer Component Requirements

Each visualizer component must:

1. Accept a `VisualizerProps` interface with `audioData: Uint8Array | null`
2. Return a Three.js component that can be rendered in the scene
3. Handle the case where `audioData` is null (initial state)

## Tips for Creating Effective Visualizers

- Use `useMemo` for creating geometries and materials to avoid recreating them on every render
- Use `useRef` to maintain references to Three.js objects
- Use `useFrame` to animate your visualizer based on audio data
- Process the audio data to extract meaningful information (e.g., frequency bands, beat detection)
- Consider performance implications, especially for complex visualizations
