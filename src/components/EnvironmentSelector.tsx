import { useSceneContext } from "@/contexts/SceneContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useState, useEffect, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

// Define available environments
const environments = [
  { id: null, name: "None", description: "No environment map" },
  {
    id: "rogland_clear_night_1k.hdr",
    name: "Night Sky",
    description: "Clear night environment with stars",
  },
  {
    id: "mud_road_puresky_1k.hdr",
    name: "Mud Road",
    description: "Outdoor road with clear sky",
  },
];

const EnvironmentSelector = () => {
  // Get environment data from scene context for immediate visual updates
  const {
    environment,
    setEnvironment,
    backgroundBlurriness,
    setBackgroundBlurriness,
    backgroundIntensity,
    setBackgroundIntensity,
    environmentTintStrength,
    setEnvironmentTintStrength,
  } = useSceneContext();

  // Get settings access for persistence
  const { updateSettings } = useSettings();

  // Local state for slider values - only used for UI rendering
  const [localBlurriness, setLocalBlurriness] = useState(backgroundBlurriness);
  const [localIntensity, setLocalIntensity] = useState(backgroundIntensity);
  const [localTintStrength, setLocalTintStrength] = useState(
    environmentTintStrength
  );
  const [selectedEnvironment, setSelectedEnvironment] = useState<string | null>(
    environment
  );

  // Store user's settings for when environments change
  const userSettingsRef = useRef({
    blurriness: backgroundBlurriness,
    intensity: backgroundIntensity,
    tintStrength: environmentTintStrength,
  });

  // Sync local states with context values
  useEffect(() => {
    setLocalBlurriness(backgroundBlurriness);
  }, [backgroundBlurriness]);

  useEffect(() => {
    setLocalIntensity(backgroundIntensity);
  }, [backgroundIntensity]);

  useEffect(() => {
    setLocalTintStrength(environmentTintStrength);
  }, [environmentTintStrength]);

  // Update environment when selection changes, preserving slider settings
  useEffect(() => {
    if (selectedEnvironment !== environment) {
      // Save current settings
      const savedSettings = userSettingsRef.current;

      // Change the environment via scene context for immediate updates
      setEnvironment(selectedEnvironment);

      // Update in settings context for persistence
      updateSettings("environment", selectedEnvironment);

      // Apply saved settings after environment changes
      requestAnimationFrame(() => {
        setBackgroundBlurriness(savedSettings.blurriness);
        setBackgroundIntensity(savedSettings.intensity);
        setEnvironmentTintStrength(savedSettings.tintStrength);

        // Also update in settings for persistence
        updateSettings("backgroundBlurriness", savedSettings.blurriness);
        updateSettings("backgroundIntensity", savedSettings.intensity);
        updateSettings("environmentTintStrength", savedSettings.tintStrength);
      });
    }
  }, [
    selectedEnvironment,
    environment,
    setEnvironment,
    setBackgroundBlurriness,
    setBackgroundIntensity,
    setEnvironmentTintStrength,
    updateSettings,
  ]);

  // Optimized handler for blurriness slider
  const handleBlurrinessChange = (value: number[]) => {
    const newValue = value[0];
    // Update local and context state for immediate feedback
    setLocalBlurriness(newValue);
    setBackgroundBlurriness(newValue);

    // Update settings context with a throttle for persistence
    if (Math.abs(newValue - userSettingsRef.current.blurriness) > 0.05) {
      updateSettings("backgroundBlurriness", newValue);
      userSettingsRef.current.blurriness = newValue;
    }
  };

  // Optimized handler for intensity/opacity slider
  const handleIntensityChange = (value: number[]) => {
    const newValue = value[0];
    // Update local and context state for immediate feedback
    setLocalIntensity(newValue);
    setBackgroundIntensity(newValue);

    // Update settings context with a throttle for persistence
    if (Math.abs(newValue - userSettingsRef.current.intensity) > 0.05) {
      updateSettings("backgroundIntensity", newValue);
      userSettingsRef.current.intensity = newValue;
    }
  };

  // Optimized handler for tint strength slider
  const handleTintStrengthChange = (value: number[]) => {
    const newValue = value[0];
    // Update local and context state for immediate feedback
    setLocalTintStrength(newValue);
    setEnvironmentTintStrength(newValue);

    // Update settings context with a throttle for persistence
    if (Math.abs(newValue - userSettingsRef.current.tintStrength) > 0.05) {
      updateSettings("environmentTintStrength", newValue);
      userSettingsRef.current.tintStrength = newValue;
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-wrap gap-2">
        {environments.map((env) => (
          <Button
            key={env.id || "none"}
            variant={selectedEnvironment === env.id ? "default" : "secondary"}
            size="sm"
            onClick={() => setSelectedEnvironment(env.id)}
            title={env.description}
          >
            {env.name}
          </Button>
        ))}
      </div>

      {/* Environment controls section */}
      <div className="space-y-3 mt-2">
        {/* Blurriness slider */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label
              className={`text-xs ${
                !selectedEnvironment
                  ? "text-disabled-foreground"
                  : "text-foreground"
              }`}
            >
              Background Blurriness
            </label>
            <span
              className={`text-xs ${
                !selectedEnvironment
                  ? "text-disabled-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {Math.round(localBlurriness * 100)}%
            </span>
          </div>
          <Slider
            value={[localBlurriness]}
            max={1}
            step={0.01}
            onValueChange={handleBlurrinessChange}
            className="py-1"
            disabled={!selectedEnvironment}
          />
        </div>

        {/* Opacity slider */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label
              className={`text-xs ${
                !selectedEnvironment
                  ? "text-disabled-foreground"
                  : "text-foreground"
              }`}
            >
              Environment Opacity
            </label>
            <span
              className={`text-xs ${
                !selectedEnvironment
                  ? "text-disabled-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {Math.round(localIntensity * 100)}%
            </span>
          </div>
          <Slider
            value={[localIntensity]}
            max={1}
            step={0.01}
            onValueChange={handleIntensityChange}
            className="py-1"
            disabled={!selectedEnvironment}
          />
        </div>

        {/* Tint Strength slider - now always visible */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label
              className={`text-xs ${
                !selectedEnvironment
                  ? "text-disabled-foreground"
                  : "text-foreground"
              }`}
            >
              Color Tint Strength
            </label>
            <span
              className={`text-xs ${
                !selectedEnvironment
                  ? "text-disabled-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {Math.round(localTintStrength * 100)}%
            </span>
          </div>
          <Slider
            value={[localTintStrength]}
            max={1}
            step={0.01}
            onValueChange={handleTintStrengthChange}
            className="py-1"
            disabled={!selectedEnvironment}
          />
        </div>
      </div>
    </div>
  );
};

export default EnvironmentSelector;
