import { useSceneContext } from "@/contexts/SceneContext";
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

      // Change the environment
      setEnvironment(selectedEnvironment);

      // Apply saved settings after environment changes
      requestAnimationFrame(() => {
        setBackgroundBlurriness(savedSettings.blurriness);
        setBackgroundIntensity(savedSettings.intensity);
        setEnvironmentTintStrength(savedSettings.tintStrength);
      });
    }
  }, [
    selectedEnvironment,
    environment,
    setEnvironment,
    setBackgroundBlurriness,
    setBackgroundIntensity,
    setEnvironmentTintStrength,
  ]);

  // Optimized handler for blurriness slider
  const handleBlurrinessChange = (value: number[]) => {
    const newValue = value[0];
    // Update both local and context state
    setLocalBlurriness(newValue);
    setBackgroundBlurriness(newValue);
    // Store in settings
    userSettingsRef.current.blurriness = newValue;
  };

  // Optimized handler for intensity/opacity slider
  const handleIntensityChange = (value: number[]) => {
    const newValue = value[0];
    // Update both local and context state
    setLocalIntensity(newValue);
    setBackgroundIntensity(newValue);
    // Store in settings
    userSettingsRef.current.intensity = newValue;
  };

  // Optimized handler for tint strength slider
  const handleTintStrengthChange = (value: number[]) => {
    const newValue = value[0];
    // Update both local and context state
    setLocalTintStrength(newValue);
    setEnvironmentTintStrength(newValue);
    // Store in settings
    userSettingsRef.current.tintStrength = newValue;
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
        {/* Blurriness slider - always visible */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-foreground">
              Background Blurriness
            </label>
            <span className="text-xs text-muted-foreground">
              {Math.round(localBlurriness * 100)}%
            </span>
          </div>
          <Slider
            value={[localBlurriness]}
            max={1}
            step={0.01}
            onValueChange={handleBlurrinessChange}
            className="py-1"
          />
        </div>

        {/* Opacity slider - always visible */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-foreground">
              Environment Opacity
            </label>
            <span className="text-xs text-muted-foreground">
              {Math.round(localIntensity * 100)}%
            </span>
          </div>
          <Slider
            value={[localIntensity]}
            max={1}
            step={0.01}
            onValueChange={handleIntensityChange}
            className="py-1"
          />
        </div>

        {/* Tint Strength slider - only visible when an environment is selected */}
        {selectedEnvironment && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-foreground">
                Color Tint Strength
              </label>
              <span className="text-xs text-muted-foreground">
                {Math.round(localTintStrength * 100)}%
              </span>
            </div>
            <Slider
              value={[localTintStrength]}
              max={1}
              step={0.01}
              onValueChange={handleTintStrengthChange}
              className="py-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Adjusts how much the environment is tinted to match your color
              palette.
            </p>
          </div>
        )}
      </div>

      <div className="mt-2 p-2 bg-muted rounded-md">
        <p className="text-xs text-muted-foreground mb-1">
          Current:{" "}
          <span className="text-foreground font-medium">
            {environments.find((env) => env.id === selectedEnvironment)?.name ||
              "None"}
          </span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          HDR environments provide realistic lighting and reflections for your
          3D scene.
        </p>
      </div>
    </div>
  );
};

export default EnvironmentSelector;
