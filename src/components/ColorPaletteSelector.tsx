import { getColorPalettes } from "@/types/colorPalettes";
import { useSceneContext } from "@/contexts/SceneContext";
import { useMemo } from "react";

const ColorPaletteSelector = () => {
  const { colorPalette, setColorPalette, setAutoRotateColors } =
    useSceneContext();

  // Memoize palettes to prevent unnecessary recalculations
  const palettes = useMemo(() => getColorPalettes(), []);

  // Define classes outside of the render loop
  const activeClass = "bg-[var(--ui-active-bg)]";
  const inactiveClass = "hover:bg-[var(--ui-hover-bg)]";

  const handlePaletteSelect = (paletteId: string) => {
    setColorPalette(paletteId);
    setAutoRotateColors(false);
  };

  return (
    <div className="space-y-4 flex flex-col h-full">
      <div className="overflow-y-auto pr-2 flex-1 custom-scrollbar">
        <div className="grid grid-cols-1 gap-3">
          {palettes.map((palette) => (
            <button
              key={palette.id}
              onClick={() => handlePaletteSelect(palette.id)}
              className={`flex flex-col p-3 rounded-lg transition-all ${
                colorPalette.id === palette.id ? activeClass : inactiveClass
              }`}
            >
              <div className="flex-1 text-left text-sm font-medium text-white/90 mb-2">
                {palette.name}
              </div>
              <div
                className="w-full h-6 rounded-md overflow-hidden"
                style={{
                  background: `linear-gradient(to right, ${palette.colors.join(
                    ", "
                  )})`,
                  boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.1)",
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColorPaletteSelector;
