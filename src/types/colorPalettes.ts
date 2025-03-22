export type ColorPalette = {
  id: string;
  name: string;
  colors: [string, string, string, string]; // Array of 4 colors
  description?: string;
};

// Collection of predefined color palettes
export const colorPalettes: ColorPalette[] = [
  {
    id: "synthwave",
    name: "Synthwave",
    colors: ["#ff2a6d", "#d1225b", "#8a2be2", "#ff2a6d"],
  },
  {
    id: "midnight",
    name: "Midnight Dream",
    colors: ["#1e88e5", "#039be5", "#00b0ff", "#1e88e5"],
  },
  {
    id: "sunset",
    name: "Golden Hour",
    colors: ["#f76b1c", "#fac36b", "#fcaf90", "#f76b1c"],
  },
  {
    id: "arctic",
    name: "Arctic Aurora",
    colors: ["#00b4d8", "#48cae4", "#90e0ef", "#00b4d8"],
  },
  {
    id: "forest",
    name: "Forest Depths",
    colors: ["#2d6a4f", "#40916c", "#52b788", "#2d6a4f"],
  },
  {
    id: "lavender",
    name: "Lavender Dusk",
    colors: ["#8338ec", "#a56ef5", "#c77dff", "#8338ec"],
  },
  {
    id: "coral",
    name: "Coral Reef",
    colors: ["#ff6b6b", "#ff8e8e", "#ffb3b3", "#ff6b6b"],
  },
  {
    id: "retro",
    name: "Retro Pastel",
    colors: ["#ffbe0b", "#fb5607", "#ff006e", "#ffbe0b"],
  },
  {
    id: "neon",
    name: "Neon Nights",
    colors: ["#00ffff", "#5e17eb", "#b537f2", "#00ffff"],
  },
  {
    id: "monochrome",
    name: "Monochrome",
    colors: ["#f8f9fa", "#dee2e6", "#6c757d", "#f8f9fa"],
  },
];

// Function to get all available color palettes
export const getColorPalettes = (): ColorPalette[] => {
  return colorPalettes;
};

// Function to get a specific color palette by ID
export const getColorPaletteById = (id: string): ColorPalette | undefined => {
  return colorPalettes.find((palette) => palette.id === id);
};

// Default color palette ID
export const DEFAULT_PALETTE_ID = "synthwave";
