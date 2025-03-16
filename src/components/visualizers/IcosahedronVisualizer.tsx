import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VisualizerProps } from "@/types/visualizers";
import { useColorPalette } from "@/hooks/useColorPalette";
import { useAudio } from "@/contexts/AudioContext";

const IcosahedronVisualizer = ({ audioData }: VisualizerProps) => {
  const { isPlaying } = useAudio();
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const { threeColors } = useColorPalette();
  const [colorUpdateKey, setColorUpdateKey] = useState(0);

  // Animation state
  const rotationSpeedRef = useRef(0.003);
  const [faceCount, setFaceCount] = useState(7); // Default to 7 faces
  const nextDetailChangeRef = useRef(0);
  const scaleRef = useRef(1);

  // Base size - increased for better visibility
  const BASE_SIZE = 2.0; // Increased from default 1.0

  // Min and max face counts
  const MIN_FACES = 3;
  const MAX_FACES = 15;

  // Create geometries with different face counts
  const geometries = useMemo(() => {
    const geos = [];

    // Create geometries with different face counts from MIN_FACES to MAX_FACES
    for (let faceCount = MIN_FACES; faceCount <= MAX_FACES; faceCount++) {
      // Create a polyhedron with the specified number of faces
      const geometry = createPolyhedronWithFaces(faceCount, BASE_SIZE);
      geos.push(geometry);
    }

    return geos;
  }, []);

  // Function to create a polyhedron with approximately the specified number of faces
  function createPolyhedronWithFaces(
    targetFaces: number,
    radius: number
  ): THREE.BufferGeometry {
    let geometry;

    // Choose appropriate geometry based on target face count
    if (targetFaces <= 6) {
      // Use cube (6 faces)
      geometry = new THREE.BoxGeometry(radius, radius, radius);
    } else if (targetFaces <= 8) {
      // Use octahedron (8 faces)
      geometry = new THREE.OctahedronGeometry(radius);
    } else {
      // Use tetrahedron and subdivide once (8 faces)
      geometry = new THREE.TetrahedronGeometry(radius);

      // If we need more faces, use a different base shape
      if (targetFaces > 8) {
        // Use dodecahedron (12 faces) but we'll only show some of them
        geometry = new THREE.DodecahedronGeometry(radius);
      }
    }

    // All geometries in Three.js are already BufferGeometry in newer versions
    return geometry;
  }

  // Simple shader for wireframe
  const shaderMaterial = useMemo(() => {
    // Calculate gradient factor for shader
    const gradientScale = 1.0 / (2.0 * BASE_SIZE);

    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vPosition;
        
        void main() {
          vPosition = position;
          vec4 modelPosition = modelMatrix * vec4(position, 1.0);
          vec4 viewPosition = viewMatrix * modelPosition;
          vec4 projectedPosition = projectionMatrix * viewPosition;
          gl_Position = projectedPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vPosition;
        uniform vec3 uColors[${threeColors.length}];
        
        vec3 getGradientColor(float t) {
          t = clamp(t, 0.0, 1.0);
          float segmentCount = ${threeColors.length - 1}.0;
          float segmentPosition = t * segmentCount;
          int segmentIndex = int(floor(segmentPosition));
          float segmentT = segmentPosition - float(segmentIndex);
          vec3 colorA = uColors[segmentIndex];
          vec3 colorB = uColors[min(segmentIndex + 1, int(segmentCount))];
          return mix(colorA, colorB, segmentT);
        }
        
        void main() {
          float gradientFactor = (vPosition.y + ${BASE_SIZE.toFixed(
            1
          )}) * ${gradientScale.toFixed(6)};
          vec3 color = getGradientColor(gradientFactor);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      uniforms: {
        uColors: {
          value: threeColors.map((c) => new THREE.Vector3(c.r, c.g, c.b)),
        },
      },
      wireframe: true,
    });
  }, [threeColors, colorUpdateKey]);

  // Get a random face count within our defined range
  const getRandomFaceCount = () => {
    return MIN_FACES + Math.floor(Math.random() * (MAX_FACES - MIN_FACES + 1));
  };

  // Update animation and audio reactivity
  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;

    const currentTime = state.clock.elapsedTime;

    // Only process audio if playing
    if (isPlaying && audioData && audioData.length > 0) {
      // Check if it's time to change face count
      if (currentTime > nextDetailChangeRef.current) {
        // Calculate bass energy (for detail changes)
        const bassEnergy =
          Array.from(audioData.slice(0, 8)).reduce((sum, val) => sum + val, 0) /
          (8 * 255);

        // More energy = faster changes
        const changeInterval =
          bassEnergy > 0.5
            ? 0.2 + Math.random() * 0.3 // Fast changes (0.2-0.5s) when high energy
            : 0.5 + Math.random() * 1.0; // Slow changes (0.5-1.5s) when low energy

        // Schedule next change
        nextDetailChangeRef.current = currentTime + changeInterval;

        // Set new random face count
        setFaceCount(getRandomFaceCount());
      }

      // Calculate mid-range energy (for scaling)
      const midEnergy =
        Array.from(audioData.slice(8, 24)).reduce((sum, val) => sum + val, 0) /
        (16 * 255);

      // Apply scale based on mid-range energy - slightly reduced multiplier since base size is larger
      const targetScale = 1.0 + midEnergy * 0.4; // Scale between 1.0 and 1.4

      // Simple direct scale with minimal smoothing
      scaleRef.current = scaleRef.current * 0.8 + targetScale * 0.2;
      meshRef.current.scale.set(
        scaleRef.current,
        scaleRef.current,
        scaleRef.current
      );

      // Calculate overall energy (for rotation)
      const totalEnergy =
        Array.from(audioData.slice(0, 16)).reduce((sum, val) => sum + val, 0) /
        (16 * 255);

      // Apply rotation
      meshRef.current.rotation.x += 0.002 + totalEnergy * 0.005;
      meshRef.current.rotation.y += 0.003 + totalEnergy * 0.005;
    } else {
      // Default animation when not playing
      meshRef.current.rotation.y += 0.002;
      meshRef.current.rotation.x += 0.001;

      // Reset scale when not playing
      scaleRef.current = 1.0;
      meshRef.current.scale.set(1, 1, 1);

      // Occasionally change face count when not playing
      if (currentTime > nextDetailChangeRef.current) {
        nextDetailChangeRef.current = currentTime + 2.0;
        setFaceCount(getRandomFaceCount());
      }
    }
  });

  // Cleanup function
  useEffect(() => {
    return () => {
      geometries.forEach((geo) => geo.dispose());
      if (materialRef.current) materialRef.current.dispose();
    };
  }, [geometries]);

  // Initialize
  useEffect(() => {
    setFaceCount(7); // Start with 7 faces
    nextDetailChangeRef.current = 0;
    scaleRef.current = 1.0;
  }, []);

  // Update shader colors when palette changes
  useEffect(() => {
    setColorUpdateKey((prev) => prev + 1);
  }, [threeColors]);

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometries[faceCount - MIN_FACES]}
        position={[0, 0, 0]}
      >
        <primitive
          object={shaderMaterial}
          ref={materialRef}
          attach="material"
        />
      </mesh>
    </group>
  );
};

export default IcosahedronVisualizer;
