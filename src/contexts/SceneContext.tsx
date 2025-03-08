import { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

interface SceneProviderProps {
  children: ReactNode;
  sceneContent?: ReactNode;
}

export function SceneProvider({ children, sceneContent }: SceneProviderProps) {
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="relative flex-1">
        <Canvas
          camera={{ position: [0, 5, 10], fov: 50 }}
          shadows
          className="touch-none"
        >
          <color attach="background" args={["#000"]} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} castShadow />
          {sceneContent}
          <OrbitControls makeDefault />
          <gridHelper args={[20, 20, "#444444", "#222222"]} />
        </Canvas>
      </div>
      {children}
    </div>
  );
}
