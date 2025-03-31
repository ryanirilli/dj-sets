import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
  Suspense,
  useRef,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Vector3 } from "three";
import {
  ColorPalette,
  DEFAULT_PALETTE_ID,
  getColorPaletteById,
} from "@/types/colorPalettes";
import { VisualizerType } from "@/types/visualizers";
import { getDefaultVisualizerType } from "@/components/visualizers";

// Define the settings interface
interface Settings {
  // Visualizer settings
  visualizerType: VisualizerType;

  // Audio settings
  selectedAudioFile: string | null;

  // Scene settings
  autoRotate: boolean;
  showGrid: boolean;
  autoRotateColors: boolean;
  colorPaletteId: string;
  environment: string | null;
  backgroundBlurriness: number;
  backgroundIntensity: number;
  environmentTintStrength: number;
  showPerformanceStats: boolean;

  // Camera position (orbit controls)
  cameraPosition: Vector3;
  cameraTarget: Vector3;

  // UI state
  openSections: Record<string, boolean>;
}

// Default settings
const DEFAULT_SETTINGS: Settings = {
  visualizerType: getDefaultVisualizerType(),
  selectedAudioFile: null,
  autoRotate: true,
  showGrid: false,
  autoRotateColors: true,
  colorPaletteId: DEFAULT_PALETTE_ID,
  environment: null,
  backgroundBlurriness: 0,
  backgroundIntensity: 0.5,
  environmentTintStrength: 0.5,
  showPerformanceStats: false,
  cameraPosition: new Vector3(0, 2, 10),
  cameraTarget: new Vector3(0, 0, 0),
  openSections: {
    visualizers: true,
    camera: false,
    colors: false,
    audio: false,
    environment: false,
  },
};

// Context interface
interface SettingsContextType {
  settings: Settings;
  updateSettings: <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => void;
  getColorPalette: () => ColorPalette;
  updateCameraPosition: (position: Vector3, target: Vector3) => void;
  toggleSectionOpen: (sectionKey: string) => void;
  setIsCameraInteracting: React.Dispatch<React.SetStateAction<boolean>>;
}

// Create the context
const SettingsContext = createContext<SettingsContextType | null>(null);

// Hook to use the settings context
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

// URL serialization and parsing functions
function serializeSettings(settings: Settings): URLSearchParams {
  const params = new URLSearchParams();

  // Visualizer - ensure lowercase for consistency
  params.set("v", settings.visualizerType.toLowerCase());

  // Audio file selection - only if a file is selected
  if (settings.selectedAudioFile) {
    params.set("audio", settings.selectedAudioFile);
  }

  // Scene settings
  params.set("ar", settings.autoRotate.toString());
  params.set("grid", settings.showGrid.toString());
  params.set("arc", settings.autoRotateColors.toString());
  params.set("pal", settings.colorPaletteId);

  if (settings.environment) {
    params.set("env", settings.environment);
  }

  params.set("blur", settings.backgroundBlurriness.toString());
  params.set("bi", settings.backgroundIntensity.toString());
  params.set("tint", settings.environmentTintStrength.toString());
  params.set("stats", settings.showPerformanceStats.toString());

  // Camera
  params.set("cx", settings.cameraPosition.x.toString());
  params.set("cy", settings.cameraPosition.y.toString());
  params.set("cz", settings.cameraPosition.z.toString());
  params.set("tx", settings.cameraTarget.x.toString());
  params.set("ty", settings.cameraTarget.y.toString());
  params.set("tz", settings.cameraTarget.z.toString());

  // UI state - serialize open sections as a comma-separated list of section keys
  const openSectionKeys = Object.entries(settings.openSections)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .filter(([_, isOpen]) => isOpen)
    .map(([key]) => key)
    .join(",");

  if (openSectionKeys) {
    params.set("open", openSectionKeys);
  }

  return params;
}

function parseSettings(searchParams: URLSearchParams): Settings {
  // Create settings with explicit call to getDefaultVisualizerType
  const settings = {
    ...DEFAULT_SETTINGS,
    visualizerType: "wave" as VisualizerType,
  };

  // Visualizer
  if (searchParams.has("v")) {
    const vTypeValue = searchParams.get("v")?.toLowerCase(); // Convert to lowercase
    console.log("[DEBUG] URL visualizer param:", vTypeValue);

    // Validate that the value is a valid VisualizerType
    const isValidType = [
      "particular",
      "unified",
      "platonic",
      "wave",
      "amorphous",
    ].includes(vTypeValue as string);

    if (isValidType) {
      settings.visualizerType = vTypeValue as VisualizerType;
      console.log("[DEBUG] Setting visualizer type to:", vTypeValue);
    } else {
      console.log("[DEBUG] Invalid visualizer type in URL:", vTypeValue);
      console.log("[DEBUG] Using default visualizer:", "wave");
    }
  } else {
    console.log(
      "[DEBUG] No visualizer type in URL, using explicit default:",
      "wave"
    );
  }

  // Audio file
  if (searchParams.has("audio")) {
    const audioFile = searchParams.get("audio");
    if (audioFile) {
      console.log("[DEBUG] Setting audio file from URL:", audioFile);
      settings.selectedAudioFile = audioFile;
    }
  } else {
    console.log("[DEBUG] No audio file in URL");
  }

  // Scene settings
  if (searchParams.has("ar")) {
    settings.autoRotate = searchParams.get("ar") === "true";
  }

  if (searchParams.has("grid")) {
    settings.showGrid = searchParams.get("grid") === "true";
  }

  if (searchParams.has("arc")) {
    settings.autoRotateColors = searchParams.get("arc") === "true";
  }

  if (searchParams.has("pal")) {
    settings.colorPaletteId = searchParams.get("pal") as string;
  }

  if (searchParams.has("env")) {
    settings.environment = searchParams.get("env");
  }

  if (searchParams.has("blur")) {
    settings.backgroundBlurriness = parseFloat(searchParams.get("blur") || "0");
  }

  if (searchParams.has("bi")) {
    settings.backgroundIntensity = parseFloat(searchParams.get("bi") || "0.5");
  }

  if (searchParams.has("tint")) {
    settings.environmentTintStrength = parseFloat(
      searchParams.get("tint") || "0.5"
    );
  }

  if (searchParams.has("stats")) {
    settings.showPerformanceStats = searchParams.get("stats") === "true";
  }

  // Camera
  if (
    searchParams.has("cx") &&
    searchParams.has("cy") &&
    searchParams.has("cz")
  ) {
    settings.cameraPosition = new Vector3(
      parseFloat(searchParams.get("cx") || "0"),
      parseFloat(searchParams.get("cy") || "2"),
      parseFloat(searchParams.get("cz") || "10")
    );
  }

  if (
    searchParams.has("tx") &&
    searchParams.has("ty") &&
    searchParams.has("tz")
  ) {
    settings.cameraTarget = new Vector3(
      parseFloat(searchParams.get("tx") || "0"),
      parseFloat(searchParams.get("ty") || "0"),
      parseFloat(searchParams.get("tz") || "0")
    );
  }

  // Parse open sections
  if (searchParams.has("open")) {
    const openSections = { ...DEFAULT_SETTINGS.openSections };
    const openSectionKeys = searchParams.get("open")?.split(",") || [];

    // Reset all sections to closed first
    Object.keys(openSections).forEach((key) => {
      openSections[key] = false;
    });

    // Set open sections based on URL
    openSectionKeys.forEach((key) => {
      if (key in openSections) {
        openSections[key] = true;
      }
    });

    settings.openSections = openSections;
  }

  return settings;
}

// Create a settings loader component that uses useSearchParams
function SettingsLoader({
  onSettingsLoaded,
}: {
  onSettingsLoaded: (settings: Settings) => void;
}) {
  const searchParams = useSearchParams();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Skip if no search params are available yet or if we've already loaded
    if (!searchParams || hasLoadedRef.current) return;

    console.log(
      "[DEBUG] Initial URL search params:",
      searchParams.toString() || "empty"
    );

    // Create a proper URLSearchParams object from the search string
    const urlSearchParams = new URLSearchParams(searchParams.toString());

    // Log all parameters for debugging
    console.log("[DEBUG] URL params entries:");
    Array.from(urlSearchParams.entries()).forEach(([key, value]) => {
      console.log(`[DEBUG] ${key}: ${value}`);
    });

    // Check specifically for visualizer param
    const visualizerParam = urlSearchParams.get("v");
    console.log("[DEBUG] Visualizer param in URL:", visualizerParam);

    const parsedSettings = parseSettings(urlSearchParams);
    onSettingsLoaded(parsedSettings);
    hasLoadedRef.current = true;
  }, [searchParams, onSettingsLoaded]);

  return null; // This component doesn't render anything
}

// Provider component
interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [isCameraInteracting, setIsCameraInteracting] = useState(false);

  // Handler for when settings are loaded from URL
  const handleSettingsLoaded = useCallback((loadedSettings: Settings) => {
    setSettings(loadedSettings);
    setIsSettingsLoaded(true);
  }, []);

  // Debug: log settings after initialization
  useEffect(() => {
    if (isSettingsLoaded) {
      console.log("[DEBUG] Initialized settings:", settings);
      console.log(
        "[DEBUG] Visualizer type after init:",
        settings.visualizerType
      );
    }
  }, [settings, isSettingsLoaded]);

  // Update the URL when settings change
  useEffect(() => {
    if (!isSettingsLoaded) return; // Don't update URL until initial settings are loaded
    if (isCameraInteracting) return; // Don't update URL while camera is being interacted with

    // We need to delay URL updates to avoid too many history entries
    const updateTimeout = setTimeout(() => {
      const params = serializeSettings(settings);

      // Ensure visualizer type is always in the URL
      if (!params.has("v")) {
        params.set("v", settings.visualizerType.toLowerCase());
      }

      const urlParams = params.toString();
      const newUrl = `${pathname}?${urlParams}`;

      // Get current URL search params to compare
      const currentUrlParams = new URLSearchParams(
        window.location.search
      ).toString();

      // Only update URL if params actually changed
      if (urlParams !== currentUrlParams) {
        console.log(
          "[DEBUG] Updating URL with visualizer:",
          settings.visualizerType
        );
        console.log("[DEBUG] Full URL params:", urlParams);

        // Update URL without causing a navigation or fetch
        router.replace(newUrl, { scroll: false });
      }
    }, 1000);

    return () => clearTimeout(updateTimeout);
  }, [settings, pathname, router, isSettingsLoaded, isCameraInteracting]);

  // Update a single setting
  const updateSettings = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Get the current color palette
  const getColorPalette = useCallback(() => {
    const palette = getColorPaletteById(settings.colorPaletteId);
    return palette || getColorPaletteById(DEFAULT_PALETTE_ID)!;
  }, [settings.colorPaletteId]);

  // Update camera position
  const updateCameraPosition = useCallback(
    (position: Vector3, target: Vector3) => {
      setSettings((prev) => ({
        ...prev,
        cameraPosition: position.clone(),
        cameraTarget: target.clone(),
      }));
    },
    []
  );

  // Toggle a section's open state
  const toggleSectionOpen = useCallback((sectionKey: string) => {
    setSettings((prev) => {
      // Safety check to make sure the section exists
      if (sectionKey in prev.openSections) {
        return {
          ...prev,
          openSections: {
            ...prev.openSections,
            [sectionKey]: !prev.openSections[sectionKey],
          },
        };
      }
      return prev;
    });
  }, []);

  const contextValue = useMemo<SettingsContextType>(
    () => ({
      settings,
      updateSettings,
      getColorPalette,
      updateCameraPosition,
      toggleSectionOpen,
      setIsCameraInteracting,
    }),
    [
      settings,
      updateSettings,
      getColorPalette,
      updateCameraPosition,
      toggleSectionOpen,
    ]
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      <Suspense fallback={null}>
        <SettingsLoader onSettingsLoaded={handleSettingsLoaded} />
      </Suspense>
      {children}
    </SettingsContext.Provider>
  );
}
