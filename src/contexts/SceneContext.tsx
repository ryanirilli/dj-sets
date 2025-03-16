import { ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Preload } from "@react-three/drei";
import * as THREE from "three";
import { createContext, useContext } from "react";
import {
  ColorPalette,
  DEFAULT_PALETTE_ID,
  getColorPaletteById,
  getColorPalettes,
} from "@/types/colorPalettes";
import { useAudio } from "./AudioContext";

// Force render component to ensure continuous animation
const ForceRender = () => {
  const { gl, scene, camera } = useThree();

  useFrame(() => {
    gl.render(scene, camera);
  });

  return null;
};

interface SceneProviderProps {
  children: ReactNode;
  sceneContent?: ReactNode;
}

// Custom lighting setup optimized for volumetric effects like smoke
const SceneLighting = () => {
  return (
    <>
      {/* Ambient light - very subtle to avoid washing out the smoke */}
      <ambientLight intensity={0.1} color="#334455" />

      {/* Main directional light - reduced intensity */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={0.3}
        color="#eef0ff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Fill light from opposite side - very subtle */}
      <directionalLight
        position={[-5, 3, -5]}
        intensity={0.1}
        color="#aabbdd"
      />

      {/* Subtle rim light to define edges */}
      <directionalLight
        position={[0, 5, -10]}
        intensity={0.15}
        color="#ddeeff"
      />

      {/* Very subtle point light near the ground for depth */}
      <pointLight
        position={[0, 0.5, 0]}
        intensity={0.2}
        color="#445566"
        distance={8}
        decay={2}
      />
    </>
  );
};

// Create a context to manage auto-rotation state
interface SceneContextType {
  autoRotate: boolean;
  setAutoRotate: (value: boolean) => void;
  showGrid: boolean;
  setShowGrid: (value: boolean) => void;
  colorPalette: ColorPalette;
  setColorPalette: (paletteId: string) => void;
  autoRotateColors: boolean;
  setAutoRotateColors: (value: boolean) => void;
}

const SceneContext = createContext<SceneContextType>({
  autoRotate: true,
  setAutoRotate: () => {},
  showGrid: false,
  setShowGrid: () => {},
  colorPalette: getColorPaletteById(DEFAULT_PALETTE_ID) as ColorPalette,
  setColorPalette: () => {},
  autoRotateColors: true,
  setAutoRotateColors: () => {},
});

export const useSceneContext = () => useContext(SceneContext);

export function SceneProvider({ children, sceneContent }: SceneProviderProps) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [autoRotateColors, setAutoRotateColors] = useState(true);
  const [colorPalette, setColorPaletteState] = useState<ColorPalette>(
    getColorPaletteById(DEFAULT_PALETTE_ID) as ColorPalette
  );
  const colorRotationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const setColorPalette = useCallback((paletteId: string) => {
    const palette = getColorPaletteById(paletteId);
    if (palette) {
      setColorPaletteState(palette);
    }
  }, []);

  // Handle auto color palette rotation
  useEffect(() => {
    if (autoRotateColors) {
      const palettes = getColorPalettes();

      // Set up interval to change color palette
      colorRotationIntervalRef.current = setInterval(() => {
        const currentIndex = palettes.findIndex(
          (p) => p.id === colorPalette.id
        );
        const nextIndex = (currentIndex + 1) % palettes.length;
        setColorPaletteState(palettes[nextIndex]);
      }, 5000); // Change every 5 seconds
    } else {
      // Clear interval when auto-rotation is turned off
      if (colorRotationIntervalRef.current) {
        clearInterval(colorRotationIntervalRef.current);
        colorRotationIntervalRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (colorRotationIntervalRef.current) {
        clearInterval(colorRotationIntervalRef.current);
      }
    };
  }, [autoRotateColors, colorPalette.id]);

  // Log when scene content changes
  useEffect(() => {
    console.log("Scene content updated:", !!sceneContent);
  }, [sceneContent]);

  // Dispose Three.js resources when component unmounts
  useEffect(() => {
    return () => {
      // Force garbage collection of Three.js objects
      if (typeof window !== "undefined") {
        // Clear any cached resources in the Three.js cache
        THREE.Cache.clear();
      }
    };
  }, []);

  return (
    <SceneContext.Provider
      value={{
        autoRotate,
        setAutoRotate,
        showGrid,
        setShowGrid,
        colorPalette,
        setColorPalette,
        autoRotateColors,
        setAutoRotateColors,
      }}
    >
      <div className="absolute inset-0 flex flex-col w-full h-full">
        <div className="relative flex-1 h-full">
          <Canvas
            camera={{
              position: [0, 6, 8], // Lower height and further back for better perspective
              fov: 55, // Slightly wider field of view to see more
              near: 0.1,
              far: 1000,
            }}
            shadows
            className="touch-none"
            // Add performance optimizations
            gl={{
              antialias: false, // Disable antialiasing for better performance
              powerPreference: "high-performance",
              alpha: false,
              stencil: false,
              depth: true,
            }}
            // Use 'always' instead of 'demand' to ensure continuous rendering
            frameloop="always"
          >
            <color attach="background" args={["#000"]} />

            {/* Custom lighting setup for better smoke rendering */}
            <SceneLighting />

            {/* Scene content */}
            <group>{sceneContent}</group>

            {/* Force render component to ensure animations run */}
            <ForceRender />

            {/* Controls */}
            <OrbitControls
              makeDefault
              minDistance={2}
              maxDistance={50}
              minPolarAngle={Math.PI / 8} // Limit how far overhead the camera can go
              maxPolarAngle={Math.PI / 2} // Limit to not go below the horizon
              autoRotate={autoRotate}
              autoRotateSpeed={0.5} // Slow rotation speed
              target={[0, 0, 0]} // Look at the center of the scene
              enableDamping={true}
              dampingFactor={0.05}
            />

            {/* Add a grid helper for debugging */}
            {showGrid && (
              <gridHelper
                args={[100, 100, "#333333", "#222222"]}
                position={[0, -5, 0]}
              />
            )}

            <Preload all />
          </Canvas>
        </div>
        {children}
      </div>
    </SceneContext.Provider>
  );
}
