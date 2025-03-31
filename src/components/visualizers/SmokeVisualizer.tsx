import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useAudio } from "@/contexts/AudioContext";
import { VisualizerProps } from "@/types/visualizers";
import { useColorPalette } from "@/hooks/useColorPalette";

// Reduce particle count for mobile devices
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const PARTICLE_COUNT = isMobile ? 200 : 500;
const PARTICLE_LIFETIME = 10.0; // Increased from 0.5 to 3.0 seconds
const FORCE_CLEANUP_INTERVAL = 10000; // 30 seconds between forced cleanups (increased from 10s)

// Pre-initialized arrays with default values
const ACTIVE_ARRAY = new Float32Array(PARTICLE_COUNT).fill(0);
const BURST_TIME_ARRAY = new Float32Array(PARTICLE_COUNT).fill(0);
const COLOR_ARRAY = new Float32Array(PARTICLE_COUNT * 3).fill(0);
const LIFETIME_ARRAY = new Float32Array(PARTICLE_COUNT).fill(0);
const FADE_START_ARRAY = new Float32Array(PARTICLE_COUNT).fill(0);
const FADE_LENGTH_ARRAY = new Float32Array(PARTICLE_COUNT).fill(0);
const TURBULENCE_ARRAY = new Float32Array(PARTICLE_COUNT).fill(0);
const BAND_ARRAY = new Float32Array(PARTICLE_COUNT).fill(0);
const INITIAL_VELOCITY_ARRAY = new Float32Array(PARTICLE_COUNT * 3).fill(0);

// Simplified fragment shader - just solid color with alpha
const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  
  void main() {
    // Simple circular particle
    vec2 coord = gl_PointCoord - 0.5;
    float r = length(coord);
    
    // Sharp falloff for better performance
    float alpha = step(r, 0.5) * vAlpha;
    
    // Simple solid color without extra effects
    vec3 color = vColor;
    
    // Discard transparent pixels
    if (alpha < 0.01) discard;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

// Simplified vertex shader - remove rotation and complex movement
const vertexShader = `
  uniform float uTime;
  uniform float uSize;
  uniform vec3 uAudioData;
  
  attribute float aScale;
  attribute float aOffset;
  attribute float aActive;
  attribute float aBurstTime;
  attribute vec3 aColor;
  attribute float aLifetime;
  attribute float aFadeStart;
  attribute float aFadeLength;
  attribute vec3 aVelocity;
  
  varying vec3 vColor;
  varying float vAlpha;
  
  void main() {
    if (aActive < 0.5) {
      gl_Position = vec4(0.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      return;
    }
    
    float age = uTime - aBurstTime;
    float normalizedAge = clamp(age / aLifetime, 0.0, 1.0);
    
    // Simplified position calculation
    vec3 pos = position;
    
    // Basic upward movement with slight spread
    float upwardVelocity = aVelocity.y * 0.5;
    float horizontalSpread = min(1.0, normalizedAge * 2.0);
    
    pos.y += upwardVelocity * age;
    pos.x += aVelocity.x * age * horizontalSpread;
    pos.z += aVelocity.z * age * horizontalSpread;
    
    // Add gravity
    pos.y -= normalizedAge * normalizedAge * 0.5;
    
    // Simple fade out
    float fadeAlpha = 1.0;
    if (normalizedAge > aFadeStart) {
      fadeAlpha = 1.0 - (normalizedAge - aFadeStart) / aFadeLength;
    }
    vAlpha = max(0.0, fadeAlpha);
    
    // Calculate final position
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Simpler size calculation
    gl_PointSize = uSize * aScale * (1.0 / -mvPosition.z);
    
    // Pass color directly
    vColor = aColor;
  }
`;

// Plane mesh to visualize the emission surface
const EmissionPlane = () => {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.05, 0]} // Position slightly below the particles
      receiveShadow
      visible={false} // Hide the plane in production
      renderOrder={-1} // Ensure it renders behind particles
    >
      <circleGeometry args={[2, 32]} />{" "}
    </mesh>
  );
};

const SmokeVisualizer = ({ audioData }: VisualizerProps) => {
  // Get audio context values including beat detection
  const { isPlaying, onBeat, currentAudioFile, avgAudioLevel } = useAudio();
  const pointsRef = useRef<THREE.Points>(null);
  const activeParticlesRef = useRef(0);
  const requestIdRef = useRef<number>();
  const lastCleanupRef = useRef<number>(Date.now());
  const particleBudgetRef = useRef<number>(PARTICLE_COUNT * 0.95); // Increased from 0.8 to 0.95

  // Get gl context and canvas from R3F
  const { gl } = useThree();

  // Use refs instead of state for these values to reduce re-renders
  const lastAudioAmplitudeRef = useRef(0);
  const frequencyBandsRef = useRef<number[]>([0, 0, 0]); // [bass, mid, high]
  const beatActiveRef = useRef(false);
  const beatDecayRef = useRef(0);
  const beatDecayRateRef = useRef(0.05);
  const initialBurstRef = useRef(false);

  // Create uniforms for the shader - removed texture uniform
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 200 },
      uAudioData: { value: new THREE.Vector3(0, 0, 0) },
    }),
    []
  );

  // Create particle attributes
  const particleAttributes = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const scales = new Float32Array(PARTICLE_COUNT);
    const offsets = new Float32Array(PARTICLE_COUNT);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      // Smaller particles for better performance
      scales[i] = Math.random() * 0.3 + 0.2;
      offsets[i] = Math.random() * 5;

      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
    }

    return { positions, scales, offsets, velocities };
  }, []);

  // Function to initialize/reinitialize WebGL resources
  const initializeResources = useCallback(() => {
    if (!pointsRef.current) return;

    const geometry = pointsRef.current.geometry;
    const material = pointsRef.current.material as THREE.ShaderMaterial;

    try {
      // Reset uniforms
      material.uniforms = uniforms;
      material.needsUpdate = true;

      // Ensure all attributes are properly initialized
      const attributes = {
        position: particleAttributes.positions,
        aScale: particleAttributes.scales,
        aOffset: particleAttributes.offsets,
        aVelocity: particleAttributes.velocities,
        aInitialVelocity: INITIAL_VELOCITY_ARRAY,
        aActive: ACTIVE_ARRAY,
        aBurstTime: BURST_TIME_ARRAY,
        aColor: COLOR_ARRAY,
        aLifetime: LIFETIME_ARRAY,
        aFadeStart: FADE_START_ARRAY,
        aFadeLength: FADE_LENGTH_ARRAY,
        aTurbulence: TURBULENCE_ARRAY,
        aBand: BAND_ARRAY,
      };

      // Recreate all attributes
      Object.entries(attributes).forEach(([name, array]) => {
        const itemSize =
          name === "position" ||
          name === "aVelocity" ||
          name === "aInitialVelocity" ||
          name === "aColor"
            ? 3
            : 1;

        const attribute = new THREE.Float32BufferAttribute(array, itemSize);
        geometry.setAttribute(name, attribute);
      });

      // Reset all particles to inactive state
      const activeAttr = geometry.getAttribute(
        "aActive"
      ) as THREE.BufferAttribute;
      if (activeAttr) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          activeAttr.setX(i, 0);
        }
        activeAttr.needsUpdate = true;
      }

      // Reset particle count
      activeParticlesRef.current = 0;

      // Force geometry update
      geometry.computeBoundingSphere();
    } catch (error) {
      console.error("Error reinitializing WebGL resources:", error);
    }
  }, [uniforms, particleAttributes]);

  // Handle context loss
  const handleContextLost = useCallback((event: Event) => {
    event.preventDefault();
    console.log("WebGL context lost");

    // Stop animation loop
    if (requestIdRef.current !== undefined) {
      cancelAnimationFrame(requestIdRef.current);
      requestIdRef.current = undefined;
    }

    // Clear active particle count
    activeParticlesRef.current = 0;
  }, []);

  // Handle context restoration with retry logic
  const handleContextRestored = useCallback(() => {
    console.log("WebGL context restored");

    // Add a small delay to ensure the context is fully restored
    setTimeout(() => {
      initializeResources();
    }, 100);
  }, [initializeResources]);

  // Add context loss event listeners
  useEffect(() => {
    const canvas = gl.domElement;

    canvas.addEventListener(
      "webglcontextlost",
      handleContextLost as EventListener
    );
    canvas.addEventListener(
      "webglcontextrestored",
      handleContextRestored as EventListener
    );

    return () => {
      canvas.removeEventListener(
        "webglcontextlost",
        handleContextLost as EventListener
      );
      canvas.removeEventListener(
        "webglcontextrestored",
        handleContextRestored as EventListener
      );
    };
  }, [gl, handleContextLost, handleContextRestored]);

  // Reset state when audio track changes
  useEffect(() => {
    if (currentAudioFile) {
      // Reset beat detection state
      beatActiveRef.current = false;
      beatDecayRef.current = 0;

      // Reset audio processing state
      lastAudioAmplitudeRef.current = 0;
      frequencyBandsRef.current = [0, 0, 0];

      // Do NOT reset all particles when track changes
      // This allows particles to persist between track changes
      console.log("Audio track changed - keeping existing particles");
    }
  }, [currentAudioFile, pointsRef]);

  // Update the useEffect for audio playback state changes
  useEffect(() => {
    if (isPlaying) {
      // Reset beat detection when playback starts/resumes
      beatActiveRef.current = false;
      beatDecayRef.current = 0;
      initialBurstRef.current = true; // Mark that we need to emit particles
      console.log(
        "Playback started/resumed - initial particles will be emitted"
      );
    } else {
      // Reset beat detection when playback stops
      beatActiveRef.current = false;
      beatDecayRef.current = 0;
      initialBurstRef.current = false;

      // Optionally clear particles when audio stops completely
      // Uncomment this if you want particles to clear when audio stops
      /*
      if (pointsRef.current) {
        const geometry = pointsRef.current.geometry;
        const activeAttr = geometry.getAttribute(
          "aActive"
        ) as THREE.BufferAttribute;

        // Deactivate all particles
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          activeAttr.setX(i, 0);
        }

        activeAttr.needsUpdate = true;
        activeParticlesRef.current = 0;
      }
      */
      console.log("Playback stopped - keeping existing particles");
    }
  }, [isPlaying]);

  // Calculate average audio amplitude from frequency data
  const calculateAudioAmplitude = (audioData: Uint8Array): number => {
    if (!audioData || audioData.length === 0) return 0;

    let totalSum = 0;
    const totalSamples = Math.min(64, audioData.length);

    for (let i = 0; i < totalSamples; i++) {
      totalSum += audioData[i] / 255;
    }

    return totalSum / totalSamples;
  };

  // Analyze frequency bands (bass, mid, high)
  const analyzeFrequencyBands = (audioData: Uint8Array): number[] => {
    if (!audioData || audioData.length === 0) return [0, 0, 0];

    // Define frequency ranges
    const bassRange = [0, 10]; // Low frequencies
    const midRange = [11, 40]; // Mid frequencies
    const highRange = [41, 80]; // High frequencies

    // Calculate average energy in each band
    let bassSum = 0,
      midSum = 0,
      highSum = 0;

    for (
      let i = bassRange[0];
      i <= Math.min(bassRange[1], audioData.length - 1);
      i++
    ) {
      bassSum += audioData[i] / 255;
    }

    for (
      let i = midRange[0];
      i <= Math.min(midRange[1], audioData.length - 1);
      i++
    ) {
      midSum += audioData[i] / 255;
    }

    for (
      let i = highRange[0];
      i <= Math.min(highRange[1], audioData.length - 1);
      i++
    ) {
      highSum += audioData[i] / 255;
    }

    const bassAvg = bassSum / (bassRange[1] - bassRange[0] + 1);
    const midAvg = midSum / (midRange[1] - midRange[0] + 1);
    const highAvg = highSum / (highRange[1] - highRange[0] + 1);

    const bands = [bassAvg, midAvg, highAvg];
    frequencyBandsRef.current = bands;

    // Update audio data uniform for shader
    if (uniforms && uniforms.uAudioData) {
      uniforms.uAudioData.value.set(bassAvg, midAvg, highAvg);
    }

    return bands;
  };

  // Get color palette
  const { threeColors } = useColorPalette();

  // Interpolate between two colors
  const lerpColor = useCallback(
    (colorA: THREE.Color, colorB: THREE.Color, t: number): THREE.Color => {
      return new THREE.Color(
        colorA.r + (colorB.r - colorA.r) * t,
        colorA.g + (colorB.g - colorA.g) * t,
        colorA.b + (colorB.b - colorA.b) * t
      );
    },
    []
  );

  // Get color from palette gradient based on position (0-1)
  const getGradientColor = useCallback(
    (position: number): THREE.Color => {
      // Ensure position is between 0 and 1
      const t = Math.max(0, Math.min(1, position));

      // Map position to palette segment
      // For 4 colors, we have 3 segments: [0-0.333], [0.333-0.667], [0.667-1]
      const segmentCount = threeColors.length - 1;
      const segmentPosition = t * segmentCount;
      const segmentIndex = Math.min(
        Math.floor(segmentPosition),
        segmentCount - 1
      );

      // Calculate interpolation factor within this segment
      const segmentT = segmentPosition - segmentIndex;

      // Get the two colors to interpolate between
      const colorA = threeColors[segmentIndex];
      const colorB = threeColors[segmentIndex + 1];

      // Interpolate between the two colors
      return lerpColor(colorA, colorB, segmentT);
    },
    [threeColors, lerpColor]
  );

  // Convert THREE.Color to shader-compatible [r,g,b] array
  const colorToArray = useCallback(
    (color: THREE.Color): [number, number, number] => {
      return [color.r, color.g, color.b];
    },
    []
  );

  // Get color from frequency bands with vaporwave style
  const getColorFromFrequencyBands = (
    bands: number[],
    bandType: "low" | "mid" | "high"
  ): [number, number, number] => {
    // Map frequency bands to gradient positions
    // High frequencies get colors from left side of gradient (0-0.33)
    // Mid frequencies get colors from middle of gradient (0.33-0.67)
    // Low frequencies get colors from right side of gradient (0.67-1)
    let gradientPosition: number;

    switch (bandType) {
      case "high":
        // High frequencies - left side of gradient (0-0.33)
        // Use bass intensity to vary the exact position within this range
        gradientPosition = 0.0 + bands[0] * 0.33;
        break;
      case "mid":
        // Mid frequencies - middle of gradient (0.33-0.67)
        // Use mid intensity to vary the exact position within this range
        gradientPosition = 0.33 + bands[1] * 0.34;
        break;
      case "low":
        // Low frequencies - right side of gradient (0.67-1)
        // Use high intensity to vary the exact position within this range
        gradientPosition = 0.67 + bands[2] * 0.33;
        break;
      default:
        // Fallback - use middle of gradient
        gradientPosition = 0.5;
    }

    // Get color from gradient
    const color = getGradientColor(gradientPosition);

    // Scale down the color for better visual effect
    return colorToArray(color).map((c) => c * 0.6) as [number, number, number];
  };

  // Create a burst of particles on beat
  const emitParticleBurst = (
    count: number,
    currentTime: number,
    frequencyBands: number[]
  ) => {
    if (!pointsRef.current?.geometry) return;

    const geometry = pointsRef.current.geometry;

    // Get all required attributes with safety checks
    const attributes = {
      active: geometry.getAttribute("aActive") as THREE.BufferAttribute | null,
      burstTime: geometry.getAttribute(
        "aBurstTime"
      ) as THREE.BufferAttribute | null,
      color: geometry.getAttribute("aColor") as THREE.BufferAttribute | null,
      rotation: geometry.getAttribute(
        "aRotation"
      ) as THREE.BufferAttribute | null,
      lifetime: geometry.getAttribute(
        "aLifetime"
      ) as THREE.BufferAttribute | null,
      fadeStart: geometry.getAttribute(
        "aFadeStart"
      ) as THREE.BufferAttribute | null,
      fadeLength: geometry.getAttribute(
        "aFadeLength"
      ) as THREE.BufferAttribute | null,
      turbulence: geometry.getAttribute(
        "aTurbulence"
      ) as THREE.BufferAttribute | null,
      band: geometry.getAttribute("aBand") as THREE.BufferAttribute | null,
      initialVelocity: geometry.getAttribute(
        "aInitialVelocity"
      ) as THREE.BufferAttribute | null,
      position: geometry.getAttribute(
        "position"
      ) as THREE.BufferAttribute | null,
      velocity: geometry.getAttribute(
        "aVelocity"
      ) as THREE.BufferAttribute | null,
    };

    // Check if all required attributes exist
    if (!Object.values(attributes).every((attr) => attr !== null)) {
      console.warn("Some required attributes are missing");
      return;
    }

    let particlesActivated = 0;
    for (let i = 0; i < PARTICLE_COUNT && particlesActivated < count; i++) {
      if (attributes.active!.getX(i) < 0.5) {
        try {
          // Activate this particle
          attributes.active!.setX(i, 1.0);
          attributes.burstTime!.setX(i, currentTime);

          // Generate points in a circle rather than a square
          const radius = 4; // Circular emission radius
          const angle = Math.random() * Math.PI * 2;

          // NEW: Add multiple emission points and patterns
          let posX, posZ;
          const emissionPattern = Math.random();

          if (emissionPattern < 0.4) {
            // Standard circular emission
            const pointRadius = Math.sqrt(Math.random()) * radius * 0.8;
            posX = Math.cos(angle) * pointRadius;
            posZ = Math.sin(angle) * pointRadius;
          } else if (emissionPattern < 0.7) {
            // Ring emission
            const ringWidth = 0.2 + Math.random() * 0.3;
            const pointRadius = radius * (0.7 + ringWidth * Math.random());
            posX = Math.cos(angle) * pointRadius;
            posZ = Math.sin(angle) * pointRadius;
          } else if (emissionPattern < 0.9) {
            // Scattered points
            const clusterCount = 5;
            const clusterIndex = Math.floor(Math.random() * clusterCount);
            const clusterAngle = (clusterIndex / clusterCount) * Math.PI * 2;
            const clusterRadius = radius * 0.6;
            const offsetRadius = Math.random() * radius * 0.4;
            const offsetAngle = Math.random() * Math.PI * 2;

            posX =
              Math.cos(clusterAngle) * clusterRadius +
              Math.cos(offsetAngle) * offsetRadius;
            posZ =
              Math.sin(clusterAngle) * clusterRadius +
              Math.sin(offsetAngle) * offsetRadius;
          } else {
            // Center emission
            const pointRadius = Math.pow(Math.random(), 2) * radius * 0.5;
            posX = Math.cos(angle) * pointRadius;
            posZ = Math.sin(angle) * pointRadius;
          }

          // Position exactly at the plane level (y = 0)
          const posY = 0;

          // Set position with safety check
          attributes.position!.setXYZ(i, posX, posY, posZ);

          // Calculate velocities
          const upwardVelocity = avgAudioLevel / 8;
          const distanceFromCenter = Math.sqrt(posX * posX + posZ * posZ);
          const centerBias = Math.min(1.0, distanceFromCenter / radius);
          const dirFactor = centerBias * (0.15 + Math.random() * 0.2);
          const dirX =
            posX === 0
              ? 0
              : (Math.random() < 0.3 ? -Math.sign(posX) : Math.sign(posX)) *
                dirFactor;
          const dirZ =
            posZ === 0
              ? 0
              : (Math.random() < 0.3 ? -Math.sign(posZ) : Math.sign(posZ)) *
                dirFactor;
          const outwardFactor = 0.03 + Math.random() * 0.05;
          const swirling = 0.3;
          const swirlStrength = swirling * (0.2 + Math.random() * 0.05);
          const swirlTime =
            currentTime * (0.1 + Math.random() * 0.05) + i * 0.01;
          const dirVx = Math.cos(swirlTime) * swirlStrength;
          const dirVz = Math.sin(swirlTime) * swirlStrength;

          const vx = dirX * outwardFactor + dirVx + (Math.random() - 0.5) * 0.2;
          const vy = upwardVelocity * (0.6 + Math.random() * 0.3);
          const vz = dirZ * outwardFactor + dirVz + (Math.random() - 0.5) * 0.2;

          // Set velocities with safety checks
          attributes.velocity!.setXYZ(i, vx, vy, vz);
          attributes.initialVelocity!.setXYZ(i, vx, vy, vz);

          // Set color
          const bandType = ["low", "mid", "high"][
            Math.floor(Math.random() * 3)
          ] as "low" | "mid" | "high";
          let colorBrightness = 2.0 + Math.random() * 0.4;
          let colorVariation = 0;

          if (emissionPattern < 0.4) {
            colorBrightness = 2.0 + Math.random() * 0.4;
          } else if (emissionPattern < 0.7) {
            colorBrightness = 2.3 + Math.random() * 0.5;
            colorVariation = 0.1;
          } else if (emissionPattern < 0.9) {
            colorBrightness = 2.5 + Math.random() * 0.5;
            colorVariation = 0.2;
          } else {
            colorBrightness = 1.8 + Math.random() * 0.4;
            colorVariation = -0.1;
          }

          const [r, g, b] = getColorFromFrequencyBands(
            frequencyBands,
            bandType
          );
          const finalR = r * colorBrightness + colorVariation;
          const finalG = g * colorBrightness + colorVariation;
          const finalB = b * colorBrightness + colorVariation;

          attributes.color!.setXYZ(i, finalR, finalG, finalB);

          // Set other attributes with safety checks
          if (attributes.rotation) {
            attributes.rotation.setX(i, Math.random() * Math.PI * 2);
          }

          // Longer lifetime with more variation
          const lifetime = PARTICLE_LIFETIME + Math.random() * 2.0;
          attributes.lifetime!.setX(i, lifetime);

          // Adjust fade start to be later in the particle's life
          const fadeStart = 0.8 + Math.random() * 0.15;
          const fadeLength = 0.15 + Math.random() * 0.15;
          attributes.fadeStart!.setX(i, fadeStart);
          attributes.fadeLength!.setX(i, fadeLength);

          const turbulence = Math.random() * 0.4;
          attributes.turbulence!.setX(i, turbulence);

          const bandInfluence = Math.floor(Math.random() * 3);
          attributes.band!.setX(i, bandInfluence);

          particlesActivated++;
        } catch (error) {
          console.error("Error updating particle attributes:", error);
          continue;
        }
      }
    }

    // Mark attributes as needing update with safety checks
    Object.values(attributes).forEach((attr) => {
      if (attr) attr.needsUpdate = true;
    });

    // Update active particle count
    activeParticlesRef.current += particlesActivated;
  };

  // Forced cleanup function to prevent memory buildup
  const forceCleanup = useCallback(() => {
    if (!pointsRef.current) return;

    const now = Date.now();
    if (
      now - lastCleanupRef.current < FORCE_CLEANUP_INTERVAL &&
      activeParticlesRef.current < particleBudgetRef.current
    )
      return;

    lastCleanupRef.current = now;

    try {
      const geometry = pointsRef.current.geometry;
      const activeAttr = geometry.getAttribute(
        "aActive"
      ) as THREE.BufferAttribute;

      if (activeAttr && activeParticlesRef.current > 0) {
        const burstTimeAttr = geometry.getAttribute(
          "aBurstTime"
        ) as THREE.BufferAttribute;

        // Collect active particles with their burst times
        const activeParticles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          if (activeAttr.getX(i) > 0.5) {
            activeParticles.push({
              index: i,
              burstTime: burstTimeAttr.getX(i),
            });
          }
        }

        // Sort by burst time (oldest first)
        activeParticles.sort((a, b) => a.burstTime - b.burstTime);

        // Deactivate only the oldest 25% instead of 50%
        const deactivateCount = Math.ceil(activeParticles.length * 0.25);
        for (let i = 0; i < deactivateCount; i++) {
          if (i < activeParticles.length) {
            const idx = activeParticles[i].index;
            activeAttr.setX(idx, 0);
          }
        }

        activeAttr.needsUpdate = true;
        activeParticlesRef.current -= deactivateCount;

        THREE.Cache.clear();
        console.log(`Gentle cleanup: deactivated ${deactivateCount} particles`);
      }
    } catch (e) {
      console.error("Error during forced cleanup:", e);
    }
  }, []);

  // Update animation and audio reactivity
  useFrame(({ clock }) => {
    if (!pointsRef.current || !ACTIVE_ARRAY || !audioData) return;

    const currentTime = clock.getElapsedTime();

    // Update time uniform
    if (uniforms && uniforms.uTime) {
      uniforms.uTime.value = currentTime;
    }

    // Only proceed if audio is playing
    if (!isPlaying) return;

    // Store the animation frame ID
    requestIdRef.current = requestAnimationFrame(() => {});

    const audioAmplitude = calculateAudioAmplitude(audioData);
    lastAudioAmplitudeRef.current = audioAmplitude;

    // Analyze frequency bands - needed for particle colors and shader effects
    const bands = analyzeFrequencyBands(audioData);

    // Check if we need to emit initial particles when playback starts
    if (initialBurstRef.current && audioData) {
      console.log("Emitting initial particles burst");
      emitParticleBurst(
        Math.floor(200 + avgAudioLevel * 150),
        currentTime,
        bands
      );
      initialBurstRef.current = false;
    }

    // Use onBeat directly from AudioContext for beat detection
    // Fix conditional to not accidentally reset particles
    const isNewBeat = onBeat && !beatActiveRef.current && avgAudioLevel > 0;

    if (isNewBeat && avgAudioLevel > 25) {
      console.log(
        `New beat detected - active particles: ${activeParticlesRef.current}`
      );
      beatActiveRef.current = true;
      beatDecayRef.current = 1.0; // Full beat intensity

      // Pulse the particle size on beat
      if (uniforms && uniforms.uSize) {
        uniforms.uSize.value = 300;
        setTimeout(() => {
          if (uniforms && uniforms.uSize && uniforms.uSize.value > 200) {
            uniforms.uSize.value = 200;
          }
        }, 100);
      }

      emitParticleBurst(
        Math.floor(150 + avgAudioLevel * 200),
        currentTime,
        bands
      );

      console.log(
        `After burst, active particles: ${activeParticlesRef.current}`
      );
    }

    // Update beat decay for visual effects
    if (beatDecayRef.current > 0) {
      beatDecayRef.current = Math.max(
        0,
        beatDecayRef.current - beatDecayRateRef.current
      );
      if (beatDecayRef.current === 0) {
        beatActiveRef.current = false;
      }
    }

    // Clean up old particles periodically - but only those that have exceeded their lifetime
    if (currentTime % 1.0 < 0.01) {
      // Reduced frequency from 0.25 to 1.0 second intervals
      const activeAttr = pointsRef.current.geometry.getAttribute(
        "aActive"
      ) as THREE.BufferAttribute;
      const burstTimeAttr = pointsRef.current.geometry.getAttribute(
        "aBurstTime"
      ) as THREE.BufferAttribute;
      const lifetimeAttr = pointsRef.current.geometry.getAttribute(
        "aLifetime"
      ) as THREE.BufferAttribute;

      let activeCount = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Check if particle is too old (more than its lifetime)
        if (activeAttr.getX(i) > 0.5) {
          const lifetime = lifetimeAttr.getX(i);
          const age = currentTime - burstTimeAttr.getX(i);

          // Only deactivate if significantly past lifetime (add 50% buffer)
          if (age > lifetime * 1.5) {
            activeAttr.setX(i, 0); // Deactivate old particle
          } else {
            activeCount++;
          }
        }
      }

      activeAttr.needsUpdate = true;
      activeParticlesRef.current = activeCount;
    }

    // Run forced cleanup only if we're approaching the particle limit
    if (activeParticlesRef.current > particleBudgetRef.current * 0.95) {
      forceCleanup();
    }
  });

  // Update cleanup effect
  useEffect(() => {
    return () => {
      // Cancel any pending animation frame
      if (requestIdRef.current !== undefined) {
        cancelAnimationFrame(requestIdRef.current);
      }

      // Force garbage collection
      if (typeof window !== "undefined") {
        THREE.Cache.clear();
      }
    };
  }, []);

  return (
    <>
      {/* Static and invisible emission plane */}
      <EmissionPlane />

      {/* Particle system */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={PARTICLE_COUNT}
            array={particleAttributes.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aScale"
            count={PARTICLE_COUNT}
            array={particleAttributes.scales}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aOffset"
            count={PARTICLE_COUNT}
            array={particleAttributes.offsets}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aVelocity"
            count={PARTICLE_COUNT}
            array={particleAttributes.velocities}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aInitialVelocity"
            count={PARTICLE_COUNT}
            array={INITIAL_VELOCITY_ARRAY}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aActive"
            count={PARTICLE_COUNT}
            array={ACTIVE_ARRAY}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aBurstTime"
            count={PARTICLE_COUNT}
            array={BURST_TIME_ARRAY}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aColor"
            count={PARTICLE_COUNT}
            array={COLOR_ARRAY}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aLifetime"
            count={PARTICLE_COUNT}
            array={LIFETIME_ARRAY}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aFadeStart"
            count={PARTICLE_COUNT}
            array={FADE_START_ARRAY}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aFadeLength"
            count={PARTICLE_COUNT}
            array={FADE_LENGTH_ARRAY}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aTurbulence"
            count={PARTICLE_COUNT}
            array={TURBULENCE_ARRAY}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aBand"
            count={PARTICLE_COUNT}
            array={BAND_ARRAY}
            itemSize={1}
          />
        </bufferGeometry>
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent={true}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
        />
      </points>
    </>
  );
};

export default SmokeVisualizer;
