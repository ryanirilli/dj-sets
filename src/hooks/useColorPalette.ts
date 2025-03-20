import { useSceneContext } from "@/contexts/SceneContext";
import { useMemo } from "react";
import * as THREE from "three";

// Hook to access the current color palette
export const useColorPalette = () => {
  const { colorPalette } = useSceneContext();

  // Convert hex colors to THREE.Color objects
  const threeColors = useMemo(() => {
    return colorPalette.colors.map((hex) => new THREE.Color(hex));
  }, [colorPalette]);

  // Create a color array for shaders (vec3 format)
  const shaderColors = useMemo(() => {
    return colorPalette.colors.map((hex) => {
      const color = new THREE.Color(hex);
      return [color.r, color.g, color.b];
    });
  }, [colorPalette]);

  return {
    palette: colorPalette,
    colors: colorPalette.colors,
    threeColors,
    shaderColors,

    // Helper to get a specific color by index
    getColor: (index: number) =>
      colorPalette.colors[index % colorPalette.colors.length],

    // Helper to get a specific THREE.Color by index
    getThreeColor: (index: number) => threeColors[index % threeColors.length],

    // Helper to get a specific shader color by index
    getShaderColor: (index: number) =>
      shaderColors[index % shaderColors.length],
  };
};
