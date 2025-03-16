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
    colors: ["#ff2a6d", "#d1225b", "#9a48d0", "#5d2de0"],
    description: "Retro-futuristic gradient from hot pink to deep purple",
  },
  {
    id: "midnight",
    name: "Midnight Dream",
    colors: ["#0f2027", "#203a43", "#2c5364", "#12749d"],
    description: "Deep blue gradient reminiscent of a night sky",
  },
  {
    id: "sunset",
    name: "Golden Hour",
    colors: ["#f76b1c", "#fac36b", "#fcaf90", "#fce2c4"],
    description: "Warm sunset gradient from orange to soft peach",
  },
  {
    id: "arctic",
    name: "Arctic Aurora",
    colors: ["#00b4d8", "#48cae4", "#90e0ef", "#caf0f8"],
    description: "Cool blue gradient inspired by glacial ice",
  },
  {
    id: "forest",
    name: "Forest Depths",
    colors: ["#004b23", "#006400", "#38b000", "#70e000"],
    description: "Rich green gradient reminiscent of dense forests",
  },
  {
    id: "lavender",
    name: "Lavender Dusk",
    colors: ["#7209b7", "#9d4edd", "#c77dff", "#e0aaff"],
    description: "Soothing purple gradient with soft lavender tones",
  },
  {
    id: "coral",
    name: "Coral Reef",
    colors: ["#ff6b6b", "#ff8e8e", "#ffb3b3", "#ffd8d8"],
    description: "Vibrant coral gradient with soft pink undertones",
  },
  {
    id: "retro",
    name: "Retro Pastel",
    colors: ["#ffbe0b", "#fb5607", "#ff006e", "#8338ec"],
    description: "Bold retro color scheme with pastel undertones",
  },
  {
    id: "neon",
    name: "Neon Nights",
    colors: ["#00ffff", "#3d30a2", "#b537f2", "#ff00ff"],
    description: "Vibrant neon colors that pop in the dark",
  },
  {
    id: "monochrome",
    name: "Monochrome",
    colors: ["#f8f9fa", "#dee2e6", "#adb5bd", "#495057"],
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
