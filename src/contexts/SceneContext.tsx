import { ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Preload, Environment, Stats } from "@react-three/drei";
import * as THREE from "three";
import { createContext, useContext } from "react";
import {
  ColorPalette,
  DEFAULT_PALETTE_ID,
  getColorPaletteById,
  getColorPalettes,
} from "@/types/colorPalettes";
import { useAudio } from "./AudioContext";
import StatsDisplay from "@/components/StatsDisplay";

// Force render component to ensure continuous animation
const ForceRender = () => {
  const { gl, scene, camera } = useThree();

  useFrame(() => {
    gl.render(scene, camera);
  });

  return null;
};

// Component to manage orbit controls auto-rotation
const AutoRotateManager = ({ autoRotate }: { autoRotate: boolean }) => {
  const { scene } = useThree();

  useFrame(() => {
    // Find the OrbitControls instance in the scene
    const orbitControls = scene.userData.controls;

    if (orbitControls) {
      // Set the autoRotate property directly
      orbitControls.autoRotate = autoRotate;
    }

    // Find all OrbitControls instances in the scene
    scene.traverse((object) => {
      if (object.userData && object.userData.controls) {
        object.userData.controls.autoRotate = autoRotate;
      }
    });
  });

  return null;
};

// Resource cleanup component to help with memory management
const ResourceCleaner = () => {
  const { gl, scene } = useThree();

  // Function to dispose of Three.js resources
  const disposeObject = useCallback((obj: THREE.Object3D) => {
    if (obj.children) {
      // Recursively dispose of children
      obj.children.forEach((child) => disposeObject(child));
    }

    // Dispose of geometries
    if ((obj as any).geometry) {
      (obj as any).geometry.dispose();
    }

    // Dispose of materials
    if ((obj as any).material) {
      if (Array.isArray((obj as any).material)) {
        (obj as any).material.forEach((material: THREE.Material) => {
          disposeMaterial(material);
        });
      } else {
        disposeMaterial((obj as any).material);
      }
    }
  }, []);

  // Helper to dispose of material resources
  const disposeMaterial = useCallback((material: THREE.Material) => {
    // Dispose of textures
    Object.keys(material).forEach((prop) => {
      const value = material[prop as keyof THREE.Material];
      if (
        value &&
        typeof value === "object" &&
        "isTexture" in value &&
        value.isTexture
      ) {
        value.dispose();
      }
    });

    // Dispose of material itself
    material.dispose();
  }, []);

  // Clean up unused resources periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      // Force garbage collection of unused resources
      THREE.Cache.clear();

      // Log memory usage
      if (process.env.NODE_ENV === "development") {
        console.log("Memory usage:", {
          geometries: (gl as any).info?.memory?.geometries || 0,
          textures: (gl as any).info?.memory?.textures || 0,
        });
      }
    }, 10000); // Run every 10 seconds

    return () => {
      clearInterval(cleanupInterval);
    };
  }, [gl]);

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
  toggleAutoRotate: () => void;
  environment: string | null;
  setEnvironment: (env: string | null) => void;
  backgroundBlurriness: number;
  setBackgroundBlurriness: (value: number) => void;
  backgroundIntensity: number;
  setBackgroundIntensity: (value: number) => void;
  showPerformanceStats: boolean;
  togglePerformanceStats: () => void;
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
  toggleAutoRotate: () => {},
  environment: null,
  setEnvironment: () => {},
  backgroundBlurriness: 0.3,
  setBackgroundBlurriness: () => {},
  backgroundIntensity: 0.7,
  setBackgroundIntensity: () => {},
  showPerformanceStats: false,
  togglePerformanceStats: () => {},
});

export const useSceneContext = () => useContext(SceneContext);

// Component to collect renderer stats and update the ref
const RendererStats = ({
  infoRef,
}: {
  infoRef: React.MutableRefObject<any>;
}) => {
  const { gl } = useThree();
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(0);

  useFrame((_, delta) => {
    // Update FPS calculation
    if (!lastTimeRef.current) {
      lastTimeRef.current = performance.now();
    }

    frameCountRef.current++;
    const currentTime = performance.now();
    const elapsed = currentTime - lastTimeRef.current;

    // Update stats every 500ms for smoother readings
    if (elapsed >= 500) {
      const fps = Math.round((frameCountRef.current * 1000) / elapsed);

      // Get detailed renderer info
      infoRef.current = {
        fps,
        geometries: gl.info?.memory?.geometries || 0,
        textures: gl.info?.memory?.textures || 0,
        triangles: gl.info?.render?.triangles || 0,
        calls: gl.info?.render?.calls || 0,
      };

      // Reset counters
      frameCountRef.current = 0;
      lastTimeRef.current = currentTime;
    }
  });

  return null;
};

export function SceneProvider({ children, sceneContent }: SceneProviderProps) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [autoRotateColors, setAutoRotateColors] = useState(true);
  const [environment, setEnvironment] = useState<string | null>(null);
  const [backgroundBlurriness, setBackgroundBlurriness] = useState(0.3);
  const [backgroundIntensity, setBackgroundIntensity] = useState(0.7);
  const [showPerformanceStats, setShowPerformanceStats] = useState(false);
  const [colorPalette, setColorPaletteState] = useState<ColorPalette>(
    getColorPaletteById(DEFAULT_PALETTE_ID) as ColorPalette
  );
  const [nextPalette, setNextPalette] = useState<ColorPalette | null>(null);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const colorRotationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transitionFrameRef = useRef<number | null>(null);
  const lastTransitionTimeRef = useRef<number>(0);
  const rendererInfoRef = useRef<{
    fps: number;
    geometries: number;
    textures: number;
    triangles: number;
    calls: number;
  }>({
    fps: 0,
    geometries: 0,
    textures: 0,
    triangles: 0,
    calls: 0,
  });

  // Debug auto-rotate state
  useEffect(() => {
    console.log("Auto-rotate state changed:", autoRotate);
  }, [autoRotate]);

  // Function to toggle auto-rotation
  const toggleAutoRotate = useCallback(() => {
    setAutoRotate((prev) => {
      const newValue = !prev;
      console.log("Toggling auto-rotate to:", newValue);
      return newValue;
    });
  }, []);

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

  // Toggle performance stats display
  const togglePerformanceStats = useCallback(() => {
    setShowPerformanceStats((prev) => !prev);
  }, []);

  // Add performance stats to context
  const contextValue: SceneContextType = {
    autoRotate,
    setAutoRotate,
    showGrid,
    setShowGrid,
    colorPalette: displayPalette,
    setColorPalette,
    autoRotateColors,
    setAutoRotateColors,
    transitionProgress,
    toggleAutoRotate,
    environment,
    setEnvironment,
    backgroundBlurriness,
    setBackgroundBlurriness,
    backgroundIntensity,
    setBackgroundIntensity,
    showPerformanceStats,
    togglePerformanceStats,
  };

  return (
    <SceneContext.Provider value={contextValue}>
      <div className="absolute inset-0 flex flex-col w-full h-full">
        <div className="relative flex-1 h-full">
          <Canvas
            camera={{
              position: [0, 6, 8],
              fov: 55,
              near: 0.1,
              far: 1000,
            }}
            shadows
            className="touch-none"
            gl={{
              antialias: false,
              powerPreference: "high-performance",
              alpha: false,
              stencil: false,
              depth: true,
              // Add performance optimizations
              logarithmicDepthBuffer: true, // Better depth precision
            }}
            frameloop="always"
            performance={{ min: 0.5 }} // Allow frame rate to drop to 30fps under load
          >
            <color attach="background" args={["#000"]} />

            {/* Environment map - only load when needed */}
            {environment && (
              <Environment
                files={`/images/environments/${environment}`}
                background={true}
                backgroundBlurriness={backgroundBlurriness}
                backgroundIntensity={backgroundIntensity}
                environmentIntensity={1.2}
              />
            )}

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
              minPolarAngle={Math.PI / 8}
              maxPolarAngle={Math.PI / 2}
              autoRotate={autoRotate}
              autoRotateSpeed={0.5}
              target={[0, 0, 0]}
              enableDamping={true}
              dampingFactor={0.05}
            />

            {/* Add the auto-rotate manager to ensure the controls are updated */}
            <AutoRotateManager autoRotate={autoRotate} />

            {/* Add a grid helper for debugging */}
            {showGrid && (
              <gridHelper
                args={[100, 100, "#333333", "#222222"]}
                position={[0, -5, 0]}
              />
            )}

            {/* Resource cleanup helper */}
            <ResourceCleaner />

            {/* Performance monitoring components - only use RendererStats to collect data */}
            {showPerformanceStats && (
              <RendererStats infoRef={rendererInfoRef} />
            )}

            <Preload all />
          </Canvas>

          {/* Performance monitoring - render outside Canvas with improved positioning */}
          {showPerformanceStats && (
            <StatsDisplay
              fps={rendererInfoRef.current.fps}
              geometries={rendererInfoRef.current.geometries}
              textures={rendererInfoRef.current.textures}
              triangles={rendererInfoRef.current.triangles}
              calls={rendererInfoRef.current.calls}
            />
          )}
        </div>
        {children}
      </div>
    </SceneContext.Provider>
  );
}
