import { ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Preload, Environment } from "@react-three/drei";
import * as THREE from "three";
import { createContext, useContext } from "react";
import {
  ColorPalette,
  DEFAULT_PALETTE_ID,
  getColorPaletteById,
  getColorPalettes,
} from "@/types/colorPalettes";
import StatsDisplay from "@/components/StatsDisplay";
import { useSettings } from "./SettingsContext";
import { ShortcutsDialog } from "@/components/ShortcutsDialog";
import { useIsElectron } from "../../hooks/useIsElectron";

// Add StatsData interface
interface StatsData {
  fps: number;
  geometries: number;
  textures: number;
}

// Add type for electronAPI if it doesn't exist globally
declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
    };
  }
}

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
    if (autoRotate) {
      scene.rotation.y += 0.001;
    }
  });

  return null;
};

interface SceneProviderProps {
  children: ReactNode;
  sceneContent?: ReactNode;
}

// Scene container that wraps the Canvas with edit mode functionality
const SceneContainer = ({
  children,
  editMode,
  onDoubleClick,
}: {
  children: ReactNode;
  editMode: boolean;
  onDoubleClick: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 100, height: 100 }); // Size in percentage
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<
    | "move"
    | "resize-n"
    | "resize-e"
    | "resize-s"
    | "resize-w"
    | "resize-ne"
    | "resize-se"
    | "resize-sw"
    | "resize-nw"
  >("move");
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [startValues, setStartValues] = useState({
    width: 100,
    height: 100,
    x: 0,
    y: 0,
  });

  // Handle mouse down for dragging
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!editMode) return;

      const container = containerRef.current;
      if (!container) return;

      // Prevent the event from being captured by Three.js/Canvas
      e.stopPropagation();
      e.preventDefault();

      // Check which edge/corner is being dragged
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const edgeThreshold = 20;

      // Check each edge and corner
      const isNearLeft = x < edgeThreshold;
      const isNearRight = x > rect.width - edgeThreshold;
      const isNearTop = y < edgeThreshold;
      const isNearBottom = y > rect.height - edgeThreshold;

      let mode: typeof dragMode = "move";

      // Set resize mode based on which edges are near
      if (isNearTop && isNearLeft) mode = "resize-nw";
      else if (isNearTop && isNearRight) mode = "resize-ne";
      else if (isNearBottom && isNearLeft) mode = "resize-sw";
      else if (isNearBottom && isNearRight) mode = "resize-se";
      else if (isNearTop) mode = "resize-n";
      else if (isNearRight) mode = "resize-e";
      else if (isNearBottom) mode = "resize-s";
      else if (isNearLeft) mode = "resize-w";
      else mode = "move";

      setDragMode(mode);
      setIsDragging(true);
      setDragStartPos({ x: e.clientX, y: e.clientY });
      setStartValues({
        width: size.width,
        height: size.height,
        x: position.x,
        y: position.y,
      });

      // Log for debugging
      console.log(`Starting ${mode} drag`);
    },
    [editMode, size, position]
  );

  // Handle dragging with independent edge resizing
  const handleDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging) return;

      const dx = clientX - dragStartPos.x;
      const dy = clientY - dragStartPos.y;

      if (dragMode === "move") {
        // Simple movement
        setPosition({
          x: startValues.x + dx,
          y: startValues.y + dy,
        });
      } else {
        // Resize based on which edge/corner is being dragged
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        // Calculate percentage changes (dx/dy as percentage of container)
        const parentWidth = containerRect.width / (size.width / 100);
        const parentHeight = containerRect.height / (size.height / 100);

        const dxPercent = (dx / parentWidth) * 100;
        const dyPercent = (dy / parentHeight) * 100;

        let newWidth = startValues.width;
        let newHeight = startValues.height;
        let newX = startValues.x;
        let newY = startValues.y;

        // Apply changes based on the drag mode
        switch (dragMode) {
          case "resize-e":
            // Right edge - just change width
            newWidth = Math.max(20, startValues.width + dxPercent);
            break;
          case "resize-w":
            // Left edge - change width and adjust position to keep right edge fixed
            const widthChange = dxPercent;
            newWidth = Math.max(20, startValues.width - widthChange);

            // Adjust x position to keep right edge fixed
            // We need to move x by dx in pixels, not as a percentage
            newX = startValues.x + dx;
            break;
          case "resize-s":
            // Bottom edge - just change height
            newHeight = Math.max(20, startValues.height + dyPercent);
            break;
          case "resize-n":
            // Top edge - change height and adjust position to keep bottom edge fixed
            const heightChange = dyPercent;
            newHeight = Math.max(20, startValues.height - heightChange);

            // Adjust y position to keep bottom edge fixed
            newY = startValues.y + dy;
            break;
          case "resize-ne":
            // Top-right corner
            newWidth = Math.max(20, startValues.width + dxPercent);
            newHeight = Math.max(20, startValues.height - dyPercent);
            newY = startValues.y + dy;
            break;
          case "resize-se":
            // Bottom-right corner
            newWidth = Math.max(20, startValues.width + dxPercent);
            newHeight = Math.max(20, startValues.height + dyPercent);
            break;
          case "resize-sw":
            // Bottom-left corner
            newWidth = Math.max(20, startValues.width - dxPercent);
            newHeight = Math.max(20, startValues.height + dyPercent);
            newX = startValues.x + dx;
            break;
          case "resize-nw":
            // Top-left corner
            newWidth = Math.max(20, startValues.width - dxPercent);
            newHeight = Math.max(20, startValues.height - dyPercent);
            newX = startValues.x + dx;
            newY = startValues.y + dy;
            break;
        }

        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
      }
    },
    [isDragging, dragMode, dragStartPos, startValues, size.width, size.height]
  );

  // Only add global event listeners when actually dragging
  useEffect(() => {
    if (!isDragging || !editMode) return;

    // These functions need to be defined inside the effect to access the latest state
    const handleGlobalMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleDrag(e.clientX, e.clientY);
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      setIsDragging(false);
      console.log("Drag ended");
    };

    // Add capture event listeners to document
    document.addEventListener("mousemove", handleGlobalMouseMove, {
      capture: true,
    });
    document.addEventListener("mouseup", handleGlobalMouseUp, {
      capture: true,
    });

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove, {
        capture: true,
      });
      document.removeEventListener("mouseup", handleGlobalMouseUp, {
        capture: true,
      });
    };
  }, [isDragging, editMode, handleDrag]);

  // Update cursor based on mouse position
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!editMode || isDragging) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const edgeThreshold = 20;

      // Determine cursor based on position
      const isNearLeft = x < edgeThreshold;
      const isNearRight = x > rect.width - edgeThreshold;
      const isNearTop = y < edgeThreshold;
      const isNearBottom = y > rect.height - edgeThreshold;

      let cursor = "move";

      // Set cursor based on which edges are near
      if (isNearTop && isNearLeft) cursor = "nw-resize";
      else if (isNearTop && isNearRight) cursor = "ne-resize";
      else if (isNearBottom && isNearLeft) cursor = "sw-resize";
      else if (isNearBottom && isNearRight) cursor = "se-resize";
      else if (isNearTop) cursor = "n-resize";
      else if (isNearRight) cursor = "e-resize";
      else if (isNearBottom) cursor = "s-resize";
      else if (isNearLeft) cursor = "w-resize";
      else cursor = "move";

      container.style.cursor = cursor;
    },
    [editMode, isDragging]
  );

  // Reset cursor when mouse leaves
  const handleMouseLeave = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.style.cursor = "auto";
    }
  }, []);

  // Get actual size and position styles
  const containerWidth = `${size.width}%`;
  const containerHeight = `${size.height}%`;

  return (
    <div
      className="absolute w-full h-full overflow-hidden"
      style={{ pointerEvents: editMode ? "auto" : "none" }}
    >
      <div
        ref={containerRef}
        className="absolute top-0 left-0 select-none origin-top-left"
        style={{
          width: containerWidth,
          height: containerHeight,
          transform: `translate(${position.x}px, ${position.y}px)`,
          border: editMode ? "2px solid red" : "none",
          overflow: "hidden",
          transition: isDragging ? "none" : "all 0.1s ease-out",
          touchAction: editMode ? "none" : "auto",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={editMode ? undefined : onDoubleClick}
      >
        <div className="w-full h-full">{children}</div>
      </div>
    </div>
  );
};

// Custom lighting setup optimized for volumetric effects like smoke
const SceneLighting = () => {
  const { colorPalette } = useSceneContext();

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
  transitionProgress: number;
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
  stats: StatsData;
  setStats: (stats: StatsData) => void;
  editMode: boolean;
  toggleEditMode: () => void;
  toggleShortcutsDialog: () => void;
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
  stats: { fps: 0, geometries: 0, textures: 0 },
  setStats: () => {},
  editMode: false,
  toggleEditMode: () => {},
  toggleShortcutsDialog: () => {},
});

export const useSceneContext = () => useContext(SceneContext);

// Component to collect renderer stats
const RendererStats = () => {
  const { gl } = useThree();
  const { setStats } = useSceneContext();

  // Keep track of frames for FPS calculation
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const lastFpsUpdateRef = useRef(performance.now());
  const fpsRef = useRef(0);

  useFrame(() => {
    // Count frames
    frameCountRef.current++;
    const now = performance.now();

    // Calculate FPS every 500ms
    if (now - lastFpsUpdateRef.current >= 200) {
      const elapsed = now - lastTimeRef.current;
      fpsRef.current = Math.round((frameCountRef.current * 1000) / elapsed);

      // Get memory stats
      const memory = gl.info?.memory || { geometries: 0, textures: 0 };

      // Update stats in context
      setStats({
        fps: fpsRef.current,
        geometries: memory.geometries || 0,
        textures: memory.textures || 0,
      });

      // Reset counters for next FPS calculation
      frameCountRef.current = 0;
      lastTimeRef.current = now;
      lastFpsUpdateRef.current = now;
    }
  });

  return null;
};

// Component to handle camera state persistence
const CameraPositionManager = () => {
  const { camera, controls } = useThree();
  const { updateCameraPosition, setIsCameraInteracting } = useSettings();
  const { settings } = useSettings();
  const lastPositionRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const lastTargetRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const userInteractingRef = useRef(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track when user starts/stops interacting with controls
  useEffect(() => {
    if (!controls) return;

    // Get the DOM element controlled by orbit controls
    const orbitControls = controls as unknown as {
      domElement: HTMLElement;
    };

    // Add event listeners for user interaction
    const startInteraction = () => {
      userInteractingRef.current = true;
      setIsCameraInteracting(true);
    };

    const endInteraction = () => {
      userInteractingRef.current = true;
      setIsCameraInteracting(true);

      // Set a short timeout to update camera position after user finishes interacting
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        // Check if position actually changed meaningfully
        if (camera && controls) {
          const orbitTarget = (controls as unknown as { target: THREE.Vector3 })
            .target;

          const positionChanged =
            !lastPositionRef.current.equals(camera.position) &&
            lastPositionRef.current.distanceTo(camera.position) > 0.01;

          const targetChanged =
            !lastTargetRef.current.equals(orbitTarget) &&
            lastTargetRef.current.distanceTo(orbitTarget) > 0.01;

          // Only update if position or target changed significantly
          if (positionChanged || targetChanged) {
            updateCameraPosition(camera.position.clone(), orbitTarget.clone());
            lastPositionRef.current.copy(camera.position);
            lastTargetRef.current.copy(orbitTarget);
          }
        }

        userInteractingRef.current = false;
        setIsCameraInteracting(false);
      }, 500);
    };

    // Set up the event listeners
    const element = orbitControls.domElement;
    element.addEventListener("mousedown", startInteraction);
    element.addEventListener("touchstart", startInteraction);
    element.addEventListener("mouseup", endInteraction);
    element.addEventListener("touchend", endInteraction);
    element.addEventListener("wheel", endInteraction);

    // Initialize last position/target for comparison
    if (camera && controls) {
      const orbitTarget = (controls as unknown as { target: THREE.Vector3 })
        .target;
      lastPositionRef.current.copy(camera.position);
      lastTargetRef.current.copy(orbitTarget);
    }

    return () => {
      // Clean up event listeners
      element.removeEventListener("mousedown", startInteraction);
      element.removeEventListener("touchstart", startInteraction);
      element.removeEventListener("mouseup", endInteraction);
      element.removeEventListener("touchend", endInteraction);
      element.removeEventListener("wheel", endInteraction);

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [controls, camera, updateCameraPosition, setIsCameraInteracting]);

  // Set initial camera position from URL
  useEffect(() => {
    if (
      controls &&
      camera &&
      settings.cameraPosition &&
      settings.cameraTarget
    ) {
      // Set camera position from settings
      camera.position.copy(settings.cameraPosition);

      // Set OrbitControls target - need to type cast controls to access target property
      const orbitControls = controls as unknown as {
        target: THREE.Vector3;
        update: () => void;
      };
      if (orbitControls.target) {
        orbitControls.target.copy(settings.cameraTarget);
        orbitControls.update();

        // Update last position/target refs to match initial settings
        lastPositionRef.current.copy(settings.cameraPosition);
        lastTargetRef.current.copy(settings.cameraTarget);
      }
    }
  }, [camera, controls, settings.cameraPosition, settings.cameraTarget]);

  // No need for useFrame tracking anymore - we're only updating when user interacts

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

  // Store initial values to debug any changes
  const envRef = useRef({
    intensity: backgroundIntensity,
    tintStrength: environmentTintStrength,
  });

  // Use the second ref to animate transitions regardless of whether environment is selected
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

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

  // Smoothly transition the color when palette changes
  useFrame(() => {
    if (materialRef.current) {
      // Smoothly transition to target color
      materialRef.current.color.lerp(saturatedTint, 0.05);

      // Directly set opacity to match tint strength
      materialRef.current.opacity = tintStrength;
    }
  });

  // Skip if no environment is selected
  if (!environment) return null;

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
  // Use SettingsContext for state management
  const { settings, updateSettings, getColorPalette, toggleSectionOpen } =
    useSettings();
  const [nextPalette, setNextPalette] = useState<ColorPalette | null>(null);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const colorRotationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transitionFrameRef = useRef<number | null>(null);
  const lastTransitionTimeRef = useRef<number>(0);
  const [stats, setStats] = useState<StatsData>({
    fps: 0,
    geometries: 0,
    textures: 0,
  });
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const isElectron = useIsElectron();

  // Convert settings to local state variables
  const autoRotate = settings.autoRotate;
  const showGrid = settings.showGrid;
  const autoRotateColors = settings.autoRotateColors;
  const colorPalette = getColorPalette();
  const environment = settings.environment;
  const backgroundBlurriness = settings.backgroundBlurriness;
  const backgroundIntensity = settings.backgroundIntensity;
  const environmentTintStrength = settings.environmentTintStrength;
  const showPerformanceStats = settings.showPerformanceStats;
  const editMode = settings.editMode;

  // Debug auto-rotate state
  useEffect(() => {
    console.log("Auto-rotate state changed:", autoRotate);
  }, [autoRotate]);

  // Function to toggle auto-rotation
  const toggleAutoRotate = useCallback(() => {
    updateSettings("autoRotate", !autoRotate);
    console.log("Toggling auto-rotate to:", !autoRotate);
  }, [autoRotate, updateSettings]);

  // Wrapper functions for settings updates
  const setAutoRotate = useCallback(
    (value: boolean) => {
      updateSettings("autoRotate", value);
    },
    [updateSettings]
  );

  const setShowGrid = useCallback(
    (value: boolean) => {
      updateSettings("showGrid", value);
    },
    [updateSettings]
  );

  const setAutoRotateColors = useCallback(
    (value: boolean) => {
      updateSettings("autoRotateColors", value);
    },
    [updateSettings]
  );

  const setEnvironment = useCallback(
    (value: string | null) => {
      updateSettings("environment", value);
    },
    [updateSettings]
  );

  const setBackgroundBlurriness = useCallback(
    (value: number) => {
      updateSettings("backgroundBlurriness", value);
    },
    [updateSettings]
  );

  const setBackgroundIntensity = useCallback(
    (value: number) => {
      updateSettings("backgroundIntensity", value);
    },
    [updateSettings]
  );

  const setEnvironmentTintStrength = useCallback(
    (value: number) => {
      updateSettings("environmentTintStrength", value);
    },
    [updateSettings]
  );

  const togglePerformanceStats = useCallback(() => {
    updateSettings("showPerformanceStats", !showPerformanceStats);
  }, [showPerformanceStats, updateSettings]);

  // Function to toggle edit mode (used by double-click and Enter key)
  const toggleEditMode = useCallback(() => {
    updateSettings("editMode", !editMode);
    console.log("Toggling edit mode to:", !editMode);
  }, [editMode, updateSettings]);

  // Function to toggle shortcuts dialog
  const toggleShortcutsDialog = useCallback(() => {
    setIsShortcutsDialogOpen((prev) => !prev);
  }, []);

  // Global keyboard listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore key presses if an input field is focused
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Enter key: Exit edit mode
      if (event.key === "Enter" && editMode) {
        event.preventDefault();
        toggleEditMode();
      }

      // '?' key: Toggle Shortcuts Dialog
      if (event.key === "?") {
        event.preventDefault();
        toggleShortcutsDialog();
      }

      // // Cmd/Ctrl + F: Toggle Fullscreen (Electron only) - MOVED TO HomeContent
      // if (
      //   isElectron &&
      //   (event.metaKey || event.ctrlKey) &&
      //   event.key.toLowerCase() === \"f\"
      // ) {
      //   event.preventDefault();
      //   // Use the exposed API from preload script
      //   window.electronAPI?.toggleFullScreen?.();
      // }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
    // Add dependencies for keys that trigger state changes or actions
  }, [editMode, toggleEditMode, toggleShortcutsDialog, isElectron]);

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
          updateSettings("colorPaletteId", paletteId);
        }
      }
    },
    [autoRotateColors, updateSettings]
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
          updateSettings("colorPaletteId", nextPalette.id);
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
  }, [isTransitioning, nextPalette, updateSettings]);

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

  // Add performance stats and edit mode to context
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
    stats,
    setStats,
    editMode,
    toggleEditMode,
    toggleShortcutsDialog,
  };

  return (
    <SceneContext.Provider value={contextValue}>
      <div className="absolute inset-0 flex flex-col w-full h-full">
        <SceneContainer editMode={editMode} onDoubleClick={toggleEditMode}>
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
              logarithmicDepthBuffer: true,
            }}
            frameloop="always"
            performance={{ min: 0.5 }}
            style={{
              width: "100%",
              height: "100%",
              touchAction: "none",
              display: "block",
            }}
            // In edit mode, disable automatic resize functionality
            resize={editMode ? { scroll: false, debounce: 0 } : undefined}
            dpr={[1, 2]} // Limit pixel ratio for better performance on high-DPI displays
          >
            {/* Set background color based on environment selection */}
            {environment ? (
              <color
                attach="background"
                args={[
                  new THREE.Color(colorPalette.colors[0])
                    .multiplyScalar(0.15)
                    .getStyle(),
                ]}
              />
            ) : (
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

            {/* Controls - disabled in edit mode */}
            {!editMode && (
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
                enableZoom={true}
                enablePan={true}
                enableRotate={true}
                // Add responsive controls
                rotateSpeed={0.5}
                zoomSpeed={0.5}
                panSpeed={0.5}
                screenSpacePanning={true}
              />
            )}

            {/* Auto-rotate manager - only when not in edit mode */}
            {!editMode && <AutoRotateManager autoRotate={autoRotate} />}

            {/* Add camera position manager for URL persistence */}
            <CameraPositionManager />

            {/* Add a grid helper for debugging */}
            {showGrid && (
              <gridHelper
                args={[100, 100, "#333333", "#222222"]}
                position={[0, -5, 0]}
              />
            )}

            {/* Performance monitoring - only add the data collector */}
            {showPerformanceStats && <RendererStats />}

            <Preload all />
          </Canvas>

          {/* Render the StatsDisplay outside the Canvas */}
          {showPerformanceStats && (
            <StatsDisplay
              fps={stats.fps}
              geometries={stats.geometries}
              textures={stats.textures}
            />
          )}
        </SceneContainer>
        {children}
        {/* Add the Shortcuts Dialog */}
        <ShortcutsDialog
          open={isShortcutsDialogOpen}
          onOpenChange={setIsShortcutsDialogOpen}
        />
      </div>
    </SceneContext.Provider>
  );
}
