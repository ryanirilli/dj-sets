import { getColorPalettes } from "@/types/colorPalettes";
import { useSceneContext } from "@/contexts/SceneContext";

const ColorPaletteSelector = () => {
  const { colorPalette, setColorPalette } = useSceneContext();
  const palettes = getColorPalettes();

  return (
    <div className="space-y-4 flex flex-col h-full">
      <div className="text-sm text-white/70 mb-1">Select a color palette:</div>
      <div className="overflow-y-auto pr-2 flex-1 custom-scrollbar">
        <div className="grid grid-cols-1 gap-3">
          {palettes.map((palette) => (
            <button
              key={palette.id}
              onClick={() => setColorPalette(palette.id)}
              className={`
                flex flex-col p-3 rounded-lg transition-all
                ${
                  colorPalette.id === palette.id
                    ? "bg-white/15 ring-1 ring-white/30"
                    : "bg-black/30 hover:bg-white/10"
                }
              `}
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
