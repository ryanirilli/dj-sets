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
    colors: ["#ff2a6d", "#d1225b", "#9a48d0", "#ff2a6d"],
    description: "Retro-futuristic gradient from hot pink to deep purple",
  },
  {
    id: "midnight",
    name: "Midnight Dream",
    colors: ["#1e88e5", "#039be5", "#00b0ff", "#1e88e5"],
    description: "Vibrant blue gradient inspired by moonlit waters",
  },
  {
    id: "sunset",
    name: "Golden Hour",
    colors: ["#f76b1c", "#fac36b", "#fcaf90", "#f76b1c"],
    description: "Warm sunset gradient from orange to soft peach",
  },
  {
    id: "arctic",
    name: "Arctic Aurora",
    colors: ["#00b4d8", "#48cae4", "#90e0ef", "#00b4d8"],
    description: "Cool blue gradient inspired by glacial ice",
  },
  {
    id: "forest",
    name: "Forest Depths",
    colors: ["#004b23", "#006400", "#38b000", "#004b23"],
    description: "Rich green gradient reminiscent of dense forests",
  },
  {
    id: "lavender",
    name: "Lavender Dusk",
    colors: ["#7209b7", "#9d4edd", "#c77dff", "#7209b7"],
    description: "Soothing purple gradient with soft lavender tones",
  },
  {
    id: "coral",
    name: "Coral Reef",
    colors: ["#ff6b6b", "#ff8e8e", "#ffb3b3", "#ff6b6b"],
    description: "Vibrant coral gradient with soft pink undertones",
  },
  {
    id: "retro",
    name: "Retro Pastel",
    colors: ["#ffbe0b", "#fb5607", "#ff006e", "#ffbe0b"],
    description: "Bold retro color scheme with pastel undertones",
  },
  {
    id: "neon",
    name: "Neon Nights",
    colors: ["#00ffff", "#3d30a2", "#b537f2", "#00ffff"],
    description: "Vibrant neon colors that pop in the dark",
  },
  {
    id: "monochrome",
    name: "Monochrome",
    colors: ["#f8f9fa", "#dee2e6", "#adb5bd", "#f8f9fa"],
    description: "Elegant grayscale gradient from light to dark",
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
