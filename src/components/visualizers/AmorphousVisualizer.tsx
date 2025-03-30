import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VisualizerProps } from "@/types/visualizers";
import { useAudio } from "@/contexts/AudioContext";
import { useColorPalette } from "@/hooks/useColorPalette";
import { createNoise3D } from "simplex-noise";

// Configuration
const SPHERE_RADIUS = 1;
const SPHERE_SEGMENTS = 128; // Higher detail for better deformation
const MAX_BULGE = SPHERE_RADIUS + 0.2; // Maximum bulge amount
const NOISE_SCALE = 2; // Scale of noise pattern
const BEAT_IMPACT = 0.2; // How strong beats affect the visualization
const BASS_IMPACT = 2.5; // How much bass frequencies create bulges
const MID_IMPACT = 1.0; // How much mid frequencies create bulges
const HIGH_IMPACT = 0.8; // How much high frequencies create bulges
const ROTATION_SPEED = 0.6; // Base rotation speed

const AmorphousVisualizer = ({ audioData }: VisualizerProps) => {
  const { isPlaying, onBeat, beatTime, avgAudioLevel } = useAudio();
  const { threeColors } = useColorPalette();

  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const lastBeatTimeRef = useRef(0);

  // Create noise generators - one for each axis for asymmetry
  const noiseGeneratorsRef = useRef({
    x: createNoise3D(),
    y: createNoise3D(),
    z: createNoise3D(),
  });

  // Frequency band data
  const frequencyBandsRef = useRef({
    bass: 0,
    mid: 0,
    high: 0,
  });

  // Beat impact info
  const beatImpactRef = useRef({
    time: 0,
    strength: 0,
  });

  // Create material
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: threeColors[0],
      metalness: 1,
      emissive: threeColors[1],
      flatShading: true, // Makes the surface more "blobby" by emphasizing facets
    });
  }, [threeColors]);

  // Analyze frequency bands from audio data
  const analyzeFrequencyBands = (audioData: Uint8Array | null) => {
    if (!audioData || audioData.length === 0) {
      frequencyBandsRef.current = { bass: 0, mid: 0, high: 0 };
      return;
    }

    // Define frequency band ranges
    const bassEnd = Math.floor(audioData.length * 0.15);
    const midEnd = Math.floor(audioData.length * 0.6);

    // Calculate average energy in each band
    let bassSum = 0;
    let midSum = 0;
    let highSum = 0;

    for (let i = 0; i < bassEnd; i++) {
      bassSum += audioData[i] / 255;
    }

    for (let i = bassEnd; i < midEnd; i++) {
      midSum += audioData[i] / 255;
    }

    for (let i = midEnd; i < audioData.length; i++) {
      highSum += audioData[i] / 255;
    }

    // Apply smoothing and scaling
    const smoothingFactor = 1; // Lower value = more responsive

    frequencyBandsRef.current = {
      bass:
        frequencyBandsRef.current.bass * (1 - smoothingFactor) +
        (bassSum / bassEnd) * smoothingFactor * BASS_IMPACT,
      mid:
        frequencyBandsRef.current.mid * (1 - smoothingFactor) +
        (midSum / (midEnd - bassEnd)) * smoothingFactor * MID_IMPACT,
      high:
        frequencyBandsRef.current.high * (1 - smoothingFactor) +
        (highSum / (audioData.length - midEnd)) * smoothingFactor * HIGH_IMPACT,
    };
  };

  // Create a deforming sphere
  useFrame((state, delta) => {
    if (!meshRef.current || !onBeat || avgAudioLevel < 25) return;

    const time = state.clock.getElapsedTime();
    timeRef.current = time;

    // Update audio analysis
    analyzeFrequencyBands(audioData);

    // Handle beat detection and impact
    if (isPlaying && beatTime > lastBeatTimeRef.current) {
      lastBeatTimeRef.current = beatTime;

      if (avgAudioLevel > 25) {
        // Calculate beat strength based on audio level
        const beatStrength = Math.min(1.0, avgAudioLevel / 80);
        beatImpactRef.current = {
          time: time,
          strength: beatStrength * BEAT_IMPACT,
        };
      }
    }

    // Decay beat impact over time
    const timeSinceBeat = time - beatImpactRef.current.time;
    const beatFactor =
      beatImpactRef.current.strength * Math.max(0, 1 - timeSinceBeat * 2);

    // Get the geometry
    const geometry = meshRef.current.geometry as THREE.BufferGeometry;
    const positions = geometry.attributes.position;

    // Original sphere positions (normalized)
    if (!geometry.userData.originalPositions) {
      const original = new Float32Array(positions.array.length);
      for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3;
        const x = positions.array[i3];
        const y = positions.array[i3 + 1];
        const z = positions.array[i3 + 2];

        // Store normalized direction
        const length = Math.sqrt(x * x + y * y + z * z);
        original[i3] = x / length;
        original[i3 + 1] = y / length;
        original[i3 + 2] = z / length;
      }
      geometry.userData.originalPositions = original;
    }

    // Apply deformations
    const original = geometry.userData.originalPositions;
    const { bass, mid, high } = frequencyBandsRef.current;

    // Apply deformation to each vertex
    for (let i = 0; i < positions.count; i++) {
      const i3 = i * 3;

      // Original normalized direction
      const nx = original[i3];
      const ny = original[i3 + 1];
      const nz = original[i3 + 2];

      // Base radius with some noise variation based on audio
      const noiseTime = time * 0.5;

      // Use different noise patterns for each dimension to create asymmetry
      const noise1 =
        noiseGeneratorsRef.current.x(
          nx * NOISE_SCALE,
          ny * NOISE_SCALE,
          noiseTime
        ) *
          0.5 +
        0.5; // Range 0-1

      const noise2 =
        noiseGeneratorsRef.current.y(
          ny * NOISE_SCALE,
          nz * NOISE_SCALE,
          noiseTime + 100
        ) *
          0.5 +
        0.5;

      const noise3 =
        noiseGeneratorsRef.current.z(
          nz * NOISE_SCALE,
          nx * NOISE_SCALE,
          noiseTime + 200
        ) *
          0.5 +
        0.5;

      // Apply audio data to noise using different frequencies for different areas
      // This is what creates the asymmetrical "blobby" look
      const bassFactor = Math.abs(ny) * bass * (noise1 * 0.8 + 0.2);
      const midFactor = (1 - Math.abs(ny)) * mid * (noise2 * 0.8 + 0.2);
      const highFactor = Math.abs(nx * nz) * high * (noise3 * 0.8 + 0.2);

      // Additional beat bulge
      const beatBulge = beatFactor * (noise1 * noise2 * 0.5 + 0.5);

      // Combined deformation
      const deformation =
        1 + (bassFactor + midFactor + highFactor + beatBulge) * MAX_BULGE;

      // Apply different bulge factors in different directions for asymmetry
      const bulgeX = deformation * (1 + noise1 * bassFactor * 0.5);
      const bulgeY = deformation * (1 + noise2 * midFactor * 0.5);
      const bulgeZ = deformation * (1 + noise3 * highFactor * 0.5);

      // Set new position
      positions.array[i3] = nx * bulgeX * SPHERE_RADIUS;
      positions.array[i3 + 1] = ny * bulgeY * SPHERE_RADIUS;
      positions.array[i3 + 2] = nz * bulgeZ * SPHERE_RADIUS;
    }

    // Mark the position attribute as needing an update
    positions.needsUpdate = true;

    // Compute vertex normals
    geometry.computeVertexNormals();

    // Apply rotation based on audio intensity
    const audioIntensity = Math.max(bass, mid, high);

    meshRef.current.rotation.y += delta * ROTATION_SPEED * (1 + audioIntensity);
    meshRef.current.rotation.x +=
      delta * ROTATION_SPEED * 0.5 * (1 + audioIntensity);

    // Update material properties based on audio
    if (material instanceof THREE.MeshStandardMaterial) {
      // Pulse emissive intensity on beat
      material.emissiveIntensity = 0.5 + beatFactor * 0.5;

      // Modify roughness based on high frequencies
      material.roughness = Math.max(0.1, 0.4 - high * 0.3);
    }
  });

  return (
    <mesh ref={meshRef} material={material}>
      <sphereGeometry
        args={[SPHERE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS]}
      />
    </mesh>
  );
};

export default AmorphousVisualizer;
