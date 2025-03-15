import { ReactNode, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Preload } from "@react-three/drei";
import * as THREE from "three";
import { createContext, useContext } from "react";

interface SceneProviderProps {
  children: ReactNode;
  sceneContent?: ReactNode;
}

// Custom lighting setup optimized for volumetric effects like smoke
const SceneLighting = () => {
  return (
    <>
      {/* Ambient light - very subtle to avoid washing out the smoke */}
      <ambientLight intensity={0.1} color="#334455" />

      {/* Main directional light - reduced intensity */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={0.3}
        color="#eef0ff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Fill light from opposite side - very subtle */}
      <directionalLight
        position={[-5, 3, -5]}
        intensity={0.1}
        color="#aabbdd"
      />

      {/* Subtle rim light to define edges */}
      <directionalLight
        position={[0, 5, -10]}
        intensity={0.15}
        color="#ddeeff"
      />

      {/* Very subtle point light near the ground for depth */}
      <pointLight
        position={[0, 0.5, 0]}
        intensity={0.2}
        color="#445566"
        distance={8}
        decay={2}
      />
    </>
  );
};

// Create a context to manage auto-rotation state
interface SceneContextType {
  autoRotate: boolean;
  setAutoRotate: (value: boolean) => void;
}

const SceneContext = createContext<SceneContextType>({
  autoRotate: false,
  setAutoRotate: () => {},
});

export const useSceneContext = () => useContext(SceneContext);

export function SceneProvider({ children, sceneContent }: SceneProviderProps) {
  const [autoRotate, setAutoRotate] = useState(false);

  // Log when scene content changes
  useEffect(() => {
    console.log("Scene content updated:", !!sceneContent);
  }, [sceneContent]);

  return (
    <SceneContext.Provider value={{ autoRotate, setAutoRotate }}>
      <div className="absolute inset-0 flex flex-col w-full h-full">
        <div className="relative flex-1 h-full">
          <Canvas
            camera={{ position: [0, 2, 15], fov: 60 }}
            shadows
            className="touch-none"
          >
            <color attach="background" args={["#000"]} />

            {/* Custom lighting setup for better smoke rendering */}
            <SceneLighting />

            {/* Scene content */}
            <group>{sceneContent}</group>

            {/* Controls */}
            <OrbitControls
              makeDefault
              minDistance={2}
              maxDistance={50}
              autoRotate={autoRotate}
              autoRotateSpeed={0.5} // Slow rotation speed
            />

            {/* Add a grid helper for debugging */}
            <gridHelper
              args={[100, 100, "#333333", "#222222"]}
              position={[0, -5, 0]}
            />

            <Preload all />
          </Canvas>
        </div>
        {children}
      </div>
    </SceneContext.Provider>
  );
}
