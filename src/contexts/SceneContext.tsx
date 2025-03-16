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

// Helper function to interpolate between two colors
const interpolateColor = (
  color1: string,
  color2: string,
  factor: number
): string => {
  // Convert hex to rgb
  const hex2rgb = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };

  // Convert rgb to hex
  const rgb2hex = (r: number, g: number, b: number): string => {
    return (
      "#" +
      Math.round(r).toString(16).padStart(2, "0") +
      Math.round(g).toString(16).padStart(2, "0") +
      Math.round(b).toString(16).padStart(2, "0")
    );
  };

  const [r1, g1, b1] = hex2rgb(color1);
  const [r2, g2, b2] = hex2rgb(color2);

  const r = r1 + factor * (r2 - r1);
  const g = g1 + factor * (g2 - g1);
  const b = b1 + factor * (b2 - b1);

  return rgb2hex(r, g, b);
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
  transitionProgress: number; // Add transition progress
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
  transitionProgress: 0,
});

export const useSceneContext = () => useContext(SceneContext);

export function SceneProvider({ children, sceneContent }: SceneProviderProps) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [autoRotateColors, setAutoRotateColors] = useState(true);
  const [colorPalette, setColorPaletteState] = useState<ColorPalette>(
    getColorPaletteById(DEFAULT_PALETTE_ID) as ColorPalette
  );
  const [nextPalette, setNextPalette] = useState<ColorPalette | null>(null);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const colorRotationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transitionFrameRef = useRef<number | null>(null);
  const lastTransitionTimeRef = useRef<number>(0);

  // Create a transitioning palette by interpolating between current and next
  const getTransitioningPalette = useCallback((): ColorPalette => {
    if (!nextPalette || !isTransitioning) return colorPalette;

    const interpolatedColors: [string, string, string, string] = [
      interpolateColor(
        colorPalette.colors[0],
        nextPalette.colors[0],
        transitionProgress
      ),
      interpolateColor(
        colorPalette.colors[1],
        nextPalette.colors[1],
        transitionProgress
      ),
      interpolateColor(
        colorPalette.colors[2],
        nextPalette.colors[2],
        transitionProgress
      ),
      interpolateColor(
        colorPalette.colors[3],
        nextPalette.colors[3],
        transitionProgress
      ),
    ];

    return {
      ...colorPalette,
      colors: interpolatedColors,
    };
  }, [colorPalette, nextPalette, transitionProgress, isTransitioning]);

  // Modified setColorPalette to handle transitions
  const setColorPalette = useCallback(
    (paletteId: string) => {
      const palette = getColorPaletteById(paletteId);
      if (palette) {
        if (autoRotateColors) {
          // Start transition to new palette
          setNextPalette(palette);
          setIsTransitioning(true);
          setTransitionProgress(0);
        } else {
          // Immediate change if auto-rotate is off
          setColorPaletteState(palette);
        }
      }
    },
    [autoRotateColors]
  );

  // Animation loop for smooth transitions
  useEffect(() => {
    if (isTransitioning && nextPalette) {
      const animateTransition = (timestamp: number) => {
        if (!lastTransitionTimeRef.current) {
          lastTransitionTimeRef.current = timestamp;
        }

        const elapsed = timestamp - lastTransitionTimeRef.current;
        const duration = 1000; // 1 second transition
        const progress = Math.min(elapsed / duration, 1);

        setTransitionProgress(progress);

        if (progress < 1) {
          transitionFrameRef.current = requestAnimationFrame(animateTransition);
        } else {
          // Transition complete
          setColorPaletteState(nextPalette);
          setNextPalette(null);
          setIsTransitioning(false);
          setTransitionProgress(0);
          lastTransitionTimeRef.current = 0;
        }
      };

      transitionFrameRef.current = requestAnimationFrame(animateTransition);

      return () => {
        if (transitionFrameRef.current) {
          cancelAnimationFrame(transitionFrameRef.current);
        }
      };
    }
  }, [isTransitioning, nextPalette]);

  // Handle auto color palette rotation
  useEffect(() => {
    if (autoRotateColors && !isTransitioning) {
      const palettes = getColorPalettes();

      // Set up interval to change color palette
      colorRotationIntervalRef.current = setInterval(() => {
        const currentIndex = palettes.findIndex(
          (p) => p.id === colorPalette.id
        );
        const nextIndex = (currentIndex + 1) % palettes.length;
        const nextPalette = palettes[nextIndex];

        // Start transition to next palette
        setNextPalette(nextPalette);
        setIsTransitioning(true);
        setTransitionProgress(0);
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
      if (transitionFrameRef.current) {
        cancelAnimationFrame(transitionFrameRef.current);
      }
    };
  }, [autoRotateColors, colorPalette.id, isTransitioning]);

  // Get the current palette (either static or transitioning)
  const displayPalette = isTransitioning
    ? getTransitioningPalette()
    : colorPalette;

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
        colorPalette: displayPalette,
        setColorPalette,
        autoRotateColors,
        setAutoRotateColors,
        transitionProgress,
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
