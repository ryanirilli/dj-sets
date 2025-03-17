import { useSceneContext } from "@/contexts/SceneContext";
import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";

// Define available environments
const environments = [
  { id: null, name: "None", description: "No environment map" },
  {
    id: "unfinished_office_1k.hdr",
    name: "Office",
    description: "Indoor office environment",
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
  const [selectedEnvironment, setSelectedEnvironment] = useState<string | null>(
    environment
  );

  // Update context when selection changes
  useEffect(() => {
    if (selectedEnvironment !== environment) {
      setEnvironment(selectedEnvironment);
    }
  }, [selectedEnvironment, environment, setEnvironment]);

  // Handle blurriness slider change
  const handleBlurrinessChange = (value: number[]) => {
    setBackgroundBlurriness(value[0]);
  };

  // Handle intensity slider change
  const handleIntensityChange = (value: number[]) => {
    setBackgroundIntensity(value[0]);
  };

  // Handle tint strength slider change
  const handleTintStrengthChange = (value: number[]) => {
    setEnvironmentTintStrength(value[0]);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-wrap gap-2">
        {environments.map((env) => (
          <button
            key={env.id || "none"}
            className={`px-3 py-1.5 rounded-md text-sm ${
              selectedEnvironment === env.id
                ? "bg-blue-500 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
            onClick={() => setSelectedEnvironment(env.id)}
            title={env.description}
          >
            {env.name}
          </button>
        ))}
      </div>

      {/* Environment controls section */}
      <div className="space-y-3 mt-2">
        {/* Blurriness slider - always visible */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-300">
              Background Blurriness
            </label>
            <span className="text-xs text-gray-400">
              {Math.round(backgroundBlurriness * 100)}%
            </span>
          </div>
          <Slider
            defaultValue={[backgroundBlurriness]}
            value={[backgroundBlurriness]}
            max={1}
            step={0.01}
            onValueChange={handleBlurrinessChange}
            className="py-1"
          />
        </div>

        {/* Transparency/Intensity slider - always visible */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-300">Environment Opacity</label>
            <span className="text-xs text-gray-400">
              {Math.round(backgroundIntensity * 100)}%
            </span>
          </div>
          <Slider
            defaultValue={[backgroundIntensity]}
            value={[backgroundIntensity]}
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
              <label className="text-xs text-gray-300">
                Color Tint Strength
              </label>
              <span className="text-xs text-gray-400">
                {Math.round(environmentTintStrength * 100)}%
              </span>
            </div>
            <Slider
              defaultValue={[environmentTintStrength]}
              value={[environmentTintStrength]}
              max={1}
              step={0.01}
              onValueChange={handleTintStrengthChange}
              className="py-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Adjusts how much the environment is tinted to match your color
              palette.
            </p>
          </div>
        )}
      </div>

      <div className="mt-2 p-2 bg-gray-800 rounded-md">
        <p className="text-xs text-gray-400 mb-1">
          Current:{" "}
          <span className="text-white font-medium">
            {environments.find((env) => env.id === selectedEnvironment)?.name ||
              "None"}
          </span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          HDR environments provide realistic lighting and reflections for your
          3D scene.
        </p>
      </div>
    </div>
  );
};

export default EnvironmentSelector;
