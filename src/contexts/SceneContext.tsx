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
  const { colorPalette, transitionProgress } = useSceneContext();

  // Extract colors from the current palette
  const mainColor = colorPalette.colors[0]; // Primary color
  const secondaryColor = colorPalette.colors[1]; // Secondary color
  const accentColor = colorPalette.colors[2]; // Accent color

  // Create lighter, more subtle versions of the colors for lighting
  const createSubtleColor = (hexColor: string, factor: number = 0.3) => {
    const color = new THREE.Color(hexColor);
    // Mix with white to create a lighter version
    return color.lerp(new THREE.Color("#ffffff"), factor).getHexString();
  };

  // Create ambient, main and fill light colors based on the palette
  const ambientColor = `#${createSubtleColor(mainColor, 0.7)}`; // Very subtle version of main color
  const mainLightColor = `#${createSubtleColor(secondaryColor, 0.5)}`; // Lighter version of secondary color
  const fillLightColor = `#${createSubtleColor(accentColor, 0.6)}`; // Subtle version of accent color
  const rimLightColor = `#${createSubtleColor(mainColor, 0.4)}`; // Subtle version of main color

  // Use transition progress for smooth animations when changing palettes
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const mainLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);
  const pointLightRef = useRef<THREE.PointLight>(null);

  // Update colors smoothly using the transition progress
  useFrame(() => {
    if (
      ambientRef.current &&
      mainLightRef.current &&
      fillLightRef.current &&
      rimLightRef.current &&
      pointLightRef.current
    ) {
      // Get current colors
      const ambient = ambientRef.current.color;
      const main = mainLightRef.current.color;
      const fill = fillLightRef.current.color;
      const rim = rimLightRef.current.color;
      const point = pointLightRef.current.color;

      // Target colors
      const targetAmbient = new THREE.Color(ambientColor);
      const targetMain = new THREE.Color(mainLightColor);
      const targetFill = new THREE.Color(fillLightColor);
      const targetRim = new THREE.Color(rimLightColor);

      // Smoothly interpolate colors
      ambient.lerp(targetAmbient, 0.05);
      main.lerp(targetMain, 0.05);
      fill.lerp(targetFill, 0.05);
      rim.lerp(targetRim, 0.05);
      point.lerp(targetAmbient, 0.05);
    }
  });

  return (
    <>
      {/* Ambient light - very subtle to avoid washing out the smoke */}
      <ambientLight ref={ambientRef} intensity={0.1} color={ambientColor} />

      {/* Main directional light - reduced intensity */}
      <directionalLight
        ref={mainLightRef}
        position={[5, 8, 5]}
        intensity={0.3}
        color={mainLightColor}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Fill light from opposite side - very subtle */}
      <directionalLight
        ref={fillLightRef}
        position={[-5, 3, -5]}
        intensity={0.1}
        color={fillLightColor}
      />

      {/* Subtle rim light to define edges */}
      <directionalLight
        ref={rimLightRef}
        position={[0, 5, -10]}
        intensity={0.15}
        color={rimLightColor}
      />

      {/* Very subtle point light near the ground for depth */}
      <pointLight
        ref={pointLightRef}
        position={[0, 0.5, 0]}
        intensity={0.2}
        color={ambientColor}
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
  environmentTintStrength: number;
  setEnvironmentTintStrength: (value: number) => void;
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
  backgroundBlurriness: 0,
  setBackgroundBlurriness: () => {},
  backgroundIntensity: 0.5,
  setBackgroundIntensity: () => {},
  environmentTintStrength: 0.5,
  setEnvironmentTintStrength: () => {},
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

// Custom environment component that applies a color tint to match the palette
const ColorTintedEnvironment = () => {
  const {
    environment,
    backgroundBlurriness,
    backgroundIntensity,
    colorPalette,
    environmentTintStrength,
  } = useSceneContext();

  // Skip if no environment is selected
  if (!environment) return null;

  // Store initial values to debug any changes
  const envRef = useRef({
    intensity: backgroundIntensity,
    tintStrength: environmentTintStrength,
  });

  // Debug when values change
  useEffect(() => {
    console.log(
      `Environment values updated: intensity=${backgroundIntensity}, tintStrength=${environmentTintStrength}`
    );
    envRef.current = {
      intensity: backgroundIntensity,
      tintStrength: environmentTintStrength,
    };
  }, [backgroundIntensity, environmentTintStrength]);

  // Calculate average brightness of the palette for tint color
  const calculateBrightness = (color: string) => {
    const c = new THREE.Color(color);
    return c.r * 0.299 + c.g * 0.587 + c.b * 0.114; // Perceived brightness formula
  };

  const averageBrightness =
    colorPalette.colors.reduce(
      (sum, color) => sum + calculateBrightness(color),
      0
    ) / colorPalette.colors.length;

  // Create a color tint based on the current palette
  // Use a mix of the first two colors for the tint
  const tintColor = new THREE.Color()
    .set(colorPalette.colors[0])
    .lerp(new THREE.Color(colorPalette.colors[1]), 0.3);

  // For bright palettes, use a more saturated tint
  // For dark palettes, use a lighter tint
  const saturatedTint = tintColor.clone();
  if (averageBrightness > 0.6) {
    // For bright palettes, increase saturation
    saturatedTint.multiplyScalar(1.2);
  } else {
    // For dark palettes, add some brightness
    saturatedTint.lerp(new THREE.Color("#ffffff"), 0.3);
  }

  // Just use the raw tint strength directly - don't auto-adjust
  const tintStrength = environmentTintStrength;

  // Use the second ref to animate transitions
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  // Smoothly transition the color when palette changes
  useFrame(() => {
    if (materialRef.current) {
      // Smoothly transition to target color
      materialRef.current.color.lerp(saturatedTint, 0.05);

      // Directly set opacity to match tint strength
      materialRef.current.opacity = tintStrength;
    }
  });

  // Use correct file path
  const envPath = `/images/environments/${environment}`;

  // Debug the intensity value
  console.log(`Rendering environment with intensity: ${backgroundIntensity}`);

  return (
    <>
      {/* Original environment - with direct intensity setting */}
      <Environment
        files={envPath}
        background={true}
        backgroundBlurriness={backgroundBlurriness}
        backgroundIntensity={backgroundIntensity} // This directly controls opacity
        environmentIntensity={1.2}
        preset={undefined}
      />

      {/* Color tint layer - only show if tint strength > 0 */}
      {environmentTintStrength > 0 && (
        <mesh renderOrder={-1000} scale={[100, 100, 100]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial
            ref={materialRef}
            color={saturatedTint}
            transparent={true}
            opacity={tintStrength}
            side={THREE.BackSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </>
  );
};

export function SceneProvider({ children, sceneContent }: SceneProviderProps) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [autoRotateColors, setAutoRotateColors] = useState(true);
  const [environment, setEnvironment] = useState<string | null>(null);
  const [backgroundBlurriness, setBackgroundBlurriness] = useState(0);
  const [backgroundIntensity, setBackgroundIntensity] = useState(0.5);
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
  const [environmentTintStrength, setEnvironmentTintStrength] = useState(0.5);

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

  // Automatically adjust environment settings based on color palette
  useEffect(() => {
    // COMPLETELY DISABLED - Do not auto-adjust environment settings anymore
    // Settings are now fully controlled by the user in EnvironmentSelector

    // Log that an adjustment was attempted but skipped
    console.log(
      "Auto-adjustment of environment settings attempted but disabled"
    );

    // Original code is preserved in comments for reference
    /*
    // Only adjust automatically when first loading or changing palettes,
    // not when the user manually changes the value via the slider
    const userIsAdjustingManually = false; // Now controlled entirely by the slider

    if (userIsAdjustingManually) {
      return; // Skip automatic adjustments when user is controlling manually
    }

    // For bright color palettes, reduce background intensity
    const isBrightPalette = colorPalette.colors.some((color) => {
      const c = new THREE.Color(color);
      // Calculate perceived brightness (weighted RGB)
      return c.r * 0.299 + c.g * 0.587 + c.b * 0.114 > 0.7;
    });

    // Only apply automatic adjustment when initializing or changing palettes
    // This now only happens when the color palette changes, not when background intensity changes
    if (isBrightPalette && backgroundIntensity > 0.7) {
      // Reduce intensity for extremely bright palettes only if it's set too high
      setBackgroundIntensity((prevIntensity) => Math.min(prevIntensity, 0.6));
    } else if (!isBrightPalette && backgroundIntensity < 0.3) {
      // Increase intensity for dark palettes only if it's set too low
      setBackgroundIntensity((prevIntensity) => Math.max(prevIntensity, 0.4));
    }
    */
  }, [colorPalette]); // Keep dependency array as is

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
    environmentTintStrength,
    setEnvironmentTintStrength,
    showPerformanceStats,
    togglePerformanceStats,
  };

  return (
    <SceneContext.Provider value={contextValue}>
      <div className="absolute inset-0 flex flex-col w-full h-full">
        <div className="relative flex-1 h-full">
          <Canvas
            camera={{
              position: [0, 2, 10],
              fov: 50,
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
            {/* Set background color based on environment selection */}
            {environment ? (
              /* When environment is selected, use palette-derived color */
              <color
                attach="background"
                args={[
                  new THREE.Color(colorPalette.colors[0])
                    .multiplyScalar(0.15)
                    .getStyle(),
                ]}
              />
            ) : (
              /* When no environment is selected, use pure black */
              <color attach="background" args={["#000000"]} />
            )}

            {/* Only render the environment when we have an environment selected */}
            {environment && <ColorTintedEnvironment />}

            {/* Custom lighting setup for better smoke rendering */}
            <SceneLighting />

            {/* Scene content */}
            <group>{sceneContent}</group>

            {/* Force render component to ensure animations run */}
            <ForceRender />

            {/* Controls */}
            <OrbitControls
              makeDefault
              minDistance={3}
              maxDistance={50}
              minPolarAngle={Math.PI / 6}
              maxPolarAngle={Math.PI * 0.6}
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
