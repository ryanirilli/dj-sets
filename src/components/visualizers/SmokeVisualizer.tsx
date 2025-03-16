import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAudio } from "@/contexts/AudioContext";
import { VisualizerProps } from "@/types/visualizers";
import { useColorPalette } from "@/hooks/useColorPalette";

// Create a smoke texture
const createSmokeTexture = () => {
  const size = 512; // Even larger texture for more detail
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  // Create a radial gradient for softer particles with gentle fade
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );

  // Softer gradient with gentler fade for more graceful particles
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)"); // Reduced from 0.95 to 0.8
  gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.5)"); // Adjusted from 0.2/0.8 to 0.3/0.5
  gradient.addColorStop(0.6, "rgba(255, 255, 255, 0.2)"); // Adjusted from 0.5/0.3 to 0.6/0.2
  gradient.addColorStop(0.8, "rgba(255, 255, 255, 0.05)"); // Adjusted from 0.7/0.1 to 0.8/0.05
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Add minimal noise for texture - reduced for cleaner appearance
  ctx.globalAlpha = 0.01; // Reduced from 0.02 to 0.01
  for (let i = 0; i < 1500; i++) {
    // Reduced from 2000 to 1500
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = Math.random() * 1.2; // Reduced from 1.5 to 1.2
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
  }

  // Apply minimal blur for softer edges
  try {
    // @ts-ignore - filter is available in most browsers
    ctx.filter = "blur(3px)"; // Reduced from 4px to 3px for sharper particles
    ctx.drawImage(canvas, 0, 0);
    // @ts-ignore
    ctx.filter = "none";
  } catch (e) {
    // Fallback if filter not supported
    console.log("Canvas filter not supported, skipping blur");
  }

  return canvas;
};

// Vertex shader for smoke particles
const vertexShader = `
  uniform float uTime;
  uniform float uSize;
  uniform vec3 uAudioData; // Audio data [bass, mid, high]
  
  attribute float aScale;
  attribute float aOffset;
  attribute float aActive;
  attribute float aBurstTime;
  attribute vec3 aColor;
  attribute float aRotation;
  attribute float aLifetime;
  attribute float aFadeStart;
  attribute float aFadeLength;
  attribute float aTurbulence;
  attribute float aBand;
  attribute vec3 aVelocity;
  attribute vec3 aInitialVelocity;
  
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRotation;
  
  // Simplex noise function for more natural movement
  // Simplified 3D noise function
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    // First corner
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    // Permutations
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
            
    // Gradients
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    // Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  void main() {
    // If particle is inactive, make it invisible
    if (aActive < 0.5) {
      gl_Position = vec4(0.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      return;
    }
    
    // Calculate particle age based on current time and burst time
    float age = uTime - aBurstTime;
    float lifetime = aLifetime;
    float normalizedAge = clamp(age / lifetime, 0.0, 1.0);
    
    // Get the appropriate audio data based on the particle's band
    // Note: We no longer use this for movement, only for initial properties
    float bandValue = 0.0;
    if (aBand < 0.5) {
      bandValue = uAudioData.x; // Low frequency (bass)
    } else if (aBand < 1.5) {
      bandValue = uAudioData.y; // Mid frequency
    } else {
      bandValue = uAudioData.z; // High frequency
    }
    
    // Start with the original position
    vec3 pos = position;
    
    // Calculate noise for horizontal movement
    float noiseScale = 1.2;
    float noiseTime = uTime * 0.15;
    
    // Add particle-specific variation
    vec3 noisePos = vec3(
      position.x * noiseScale + noiseTime + aOffset * 10.0,
      position.y * noiseScale * 0.5 + noiseTime + aOffset * 5.0,
      position.z * noiseScale + noiseTime * 0.7 + aOffset * 8.0
    );
    
    // Get noise values
    float noiseX = snoise(noisePos);
    float noiseZ = snoise(noisePos + vec3(12.34, 56.78, 90.12));
    
    // Secondary noise for more complex movement
    float noiseX2 = snoise(noisePos * 2.0 + vec3(45.67, 89.01, 23.45));
    float noiseZ2 = snoise(noisePos * 2.0 + vec3(67.89, 12.34, 56.78));
    
    // Calculate upward movement - natural floating motion without audio reactivity
    // 1. Base upward velocity from initial velocity
    float baseUpwardVelocity = aVelocity.y * 1.5; // Keep the increased velocity
    
    // 2. Age-based acceleration - particles slow down as they age
    float ageAcceleration = 0.5 * (1.0 - normalizedAge * 0.3);
    
    // 3. Early-age boost for initial plume effect (not audio reactive)
    float earlyAgeBoost = max(0.0, 0.5 - normalizedAge) * 1.0;
    
    // Combine for total upward movement - natural deceleration without audio reactivity
    float totalUpwardMovement = (baseUpwardVelocity * ageAcceleration + earlyAgeBoost) * age;
    
    // Apply upward movement from initial velocity and calculated movement
    pos.y += totalUpwardMovement;
    
    // Apply horizontal movement from initial velocity
    pos.x += aVelocity.x * age;
    pos.z += aVelocity.z * age;
    
    // Apply natural horizontal movement from noise - no audio reactivity
    float turbulenceStrength = aTurbulence * 0.7;
    
    // Apply noise-based movement for natural floating
    pos.x += noiseX * turbulenceStrength * age * 0.6;
    pos.z += noiseZ * turbulenceStrength * age * 0.6;
    
    // Apply secondary noise for more complex movement
    pos.x += noiseX2 * turbulenceStrength * age * 0.3;
    pos.z += noiseZ2 * turbulenceStrength * age * 0.3;
    
    // Add slight sinusoidal movement for more floating effect
    pos.x += sin(age * (0.2 + aOffset * 0.1)) * 0.08 * age;
    pos.z += cos(age * (0.15 + aOffset * 0.05)) * 0.08 * age;
    
    // Individualized fade-out for each particle
    float fadeStart = aFadeStart;
    float fadeLength = aFadeLength;
    
    float fadeAlpha = 1.0;
    if (normalizedAge > fadeStart) {
      float fadeProgress = (normalizedAge - fadeStart) / fadeLength;
      fadeAlpha = 1.0 - pow(min(fadeProgress, 1.0), 2.0);
    }
    vAlpha = max(0.0, fadeAlpha);
    
    float endFade = smoothstep(1.0, 0.9, normalizedAge);
    vAlpha *= endFade;
    
    // Calculate position
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    // Size based on scale and distance - natural growth without audio reactivity
    float sizeModifier = 1.0 + pow(normalizedAge, 0.3) * 2.0;
    
    // No audio-reactive size boost, just use the initial scale
    float size = uSize * aScale * sizeModifier * (1.0 / -mvPosition.z);
    
    gl_PointSize = size;
    gl_Position = projectionMatrix * mvPosition;
    
    // Pass the particle color to fragment shader
    vColor = aColor;
    
    // Pass rotation to fragment shader - slower rotation for more graceful effect
    vRotation = aRotation + age * (0.2 + aOffset * 0.3);
  }
`;

// Fragment shader for smoke particles
const fragmentShader = `
  uniform sampler2D uTexture;
  
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRotation;
  
  void main() {
    // Calculate rotation
    float c = cos(vRotation);
    float s = sin(vRotation);
    
    // Get point coordinates relative to center (from -0.5 to 0.5)
    vec2 centeredCoord = gl_PointCoord - 0.5;
    
    // Rotate texture coordinates
    vec2 rotatedUV = vec2(
      c * centeredCoord.x + s * centeredCoord.y + 0.5,
      c * centeredCoord.y - s * centeredCoord.x + 0.5
    );
    
    // Sample texture with rotation
    vec4 texColor = texture2D(uTexture, rotatedUV);
    
    // Apply color and alpha - enhanced brightness for more visible particles
    vec3 color = vColor * texColor.rgb * 1.2; // Increased from 0.9 to 1.2
    
    // Add slight color shift for more vibrant appearance
    color += vec3(0.05, 0.05, 0.05); // Add a small amount of white to brighten
    
    // Enhance contrast
    color = pow(color, vec3(0.9)); // Slightly increase contrast
    
    // Adjust alpha for more defined particles - increased for better visibility
    float alpha = texColor.a * vAlpha * 1.0; // Increased from 0.8 to 1.0
    
    // Discard fewer transparent pixels for more visible particles
    if (alpha < 0.01) discard; // Reduced threshold from 0.02 to 0.01
    
    // Output color with alpha
    gl_FragColor = vec4(color, alpha);
  }
`;

// Plane mesh to visualize the emission surface - static and invisible
const EmissionPlane = () => {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
      visible={false} // Make the plane invisible
    >
      <planeGeometry args={[8, 8, 8, 8]} />
      <meshStandardMaterial
        color="#444"
        transparent
        opacity={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const SmokeVisualizer = ({ audioData }: VisualizerProps) => {
  const { isPlaying, onBeat, beatTime, currentAudioFile } = useAudio();
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 800;
  const activeParticlesRef = useRef(0);
  const [activeArray, setActiveArray] = useState<Float32Array | null>(null);
  const [burstTimeArray, setBurstTimeArray] = useState<Float32Array | null>(
    null
  );
  const [colorArray, setColorArray] = useState<Float32Array | null>(null);
  const [rotationArray, setRotationArray] = useState<Float32Array | null>(null);
  const [lifetimeArray, setLifetimeArray] = useState<Float32Array | null>(null);
  const [fadeStartArray, setFadeStartArray] = useState<Float32Array | null>(
    null
  );
  const [fadeLengthArray, setFadeLengthArray] = useState<Float32Array | null>(
    null
  );
  const [turbulenceArray, setTurbulenceArray] = useState<Float32Array | null>(
    null
  );
  const [bandArray, setBandArray] = useState<Float32Array | null>(null);
  const [initialVelocityArray, setInitialVelocityArray] =
    useState<Float32Array | null>(null);

  // Use refs instead of state for these values to reduce re-renders
  const lastAudioAmplitudeRef = useRef(0);
  const frequencyBandsRef = useRef<number[]>([0, 0, 0]); // [bass, mid, high]
  const lastContinuousEmissionTimeRef = useRef(0);
  const continuousEmissionIntervalRef = useRef(0.1);

  // Beat detection references
  const lastBeatTimeRef = useRef(0);
  const beatActiveRef = useRef(false);
  const beatDecayRef = useRef(0);
  const beatDecayRateRef = useRef(0.05);

  // Cleanup function to dispose resources
  const cleanupResources = useCallback(() => {
    if (pointsRef.current) {
      const geometry = pointsRef.current.geometry;
      const material = pointsRef.current.material as THREE.ShaderMaterial;

      if (geometry) geometry.dispose();
      if (material) {
        if (material.uniforms.uTexture?.value) {
          material.uniforms.uTexture.value.dispose();
        }
        material.dispose();
      }
    }
  }, []);

  // Create smoke texture with memoization
  const smokeTexture = useMemo(() => {
    // Only create texture in browser environment
    if (typeof window === "undefined") return null;

    const canvas = createSmokeTexture();
    if (!canvas) return null;

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  // Create particles with initial attributes
  const { positions, scales, offsets, velocities } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);
    const offsets = new Float32Array(particleCount);
    const velocities = new Float32Array(particleCount * 3);

    // Initialize all particles
    for (let i = 0; i < particleCount; i++) {
      // Initial positions - spread them out slightly to avoid all starting at the same point
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.1; // Very small initial spread
      positions[i * 3] = Math.cos(angle) * radius; // x
      positions[i * 3 + 1] = 0.05; // y (slightly above the grid)
      positions[i * 3 + 2] = Math.sin(angle) * radius; // z

      // Random scale for each particle - smaller for more natural look
      scales[i] = Math.random() * 0.5 + 0.3;

      // Random offset for staggered animation
      offsets[i] = Math.random() * 5;

      // Initial velocity vector (mostly upward)
      velocities[i * 3] = 0; // x
      velocities[i * 3 + 1] = 0; // y (upward)
      velocities[i * 3 + 2] = 0; // z
    }

    return { positions, scales, offsets, velocities };
  }, [particleCount]);

  // Create active state array, burst time array, color array, rotation array, and lifetime array
  useEffect(() => {
    const active = new Float32Array(particleCount).fill(0);
    const burstTime = new Float32Array(particleCount).fill(0);
    const colors = new Float32Array(particleCount * 3).fill(0);
    const rotations = new Float32Array(particleCount).fill(0);
    const lifetimes = new Float32Array(particleCount).fill(0);
    const fadeStarts = new Float32Array(particleCount).fill(0);
    const fadeLengths = new Float32Array(particleCount).fill(0);
    const turbulence = new Float32Array(particleCount).fill(0);
    const bands = new Float32Array(particleCount).fill(0);
    const initialVelocities = new Float32Array(particleCount * 3).fill(0);

    setActiveArray(active);
    setBurstTimeArray(burstTime);
    setColorArray(colors);
    setRotationArray(rotations);
    setLifetimeArray(lifetimes);
    setFadeStartArray(fadeStarts);
    setFadeLengthArray(fadeLengths);
    setTurbulenceArray(turbulence);
    setBandArray(bands);
    setInitialVelocityArray(initialVelocities);
  }, [particleCount]);

  // Create uniforms for the shader
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 200 }, // Increased from 150 to 200 for more visible particles
      uTexture: { value: smokeTexture },
      uAudioData: { value: new THREE.Vector3(0, 0, 0) },
    }),
    [smokeTexture]
  );

  // Reset particles when audio stops
  useEffect(() => {
    if (!isPlaying && activeArray && pointsRef.current) {
      // Set all particles to inactive
      activeArray.fill(0);
      const activeAttr = pointsRef.current.geometry.getAttribute(
        "aActive"
      ) as THREE.BufferAttribute;
      if (activeAttr) {
        for (let i = 0; i < particleCount; i++) {
          activeAttr.setX(i, 0);
        }
        activeAttr.needsUpdate = true;
      }
      activeParticlesRef.current = 0;
    }
  }, [isPlaying, activeArray, particleCount]);

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

  // Get detailed frequency data for waveform visualization
  const getFrequencyData = (
    audioData: Uint8Array,
    numPoints: number
  ): number[] => {
    if (!audioData || audioData.length === 0) return Array(numPoints).fill(0);

    const result = [];
    // Use the first 64 frequency bins for the waveform (more musical content)
    const maxBin = Math.min(64, audioData.length);

    // Sample the frequency data to get the desired number of points
    for (let i = 0; i < numPoints; i++) {
      const binIndex = Math.floor((i / numPoints) * maxBin);
      // Normalize to 0-1 range
      result.push(audioData[binIndex] / 255);
    }

    return result;
  };

  // Create a symmetrical waveform pattern centered at x=0
  const createSymmetricalWaveform = (
    audioData: Uint8Array,
    numPoints: number
  ): { position: number; value: number }[] => {
    if (!audioData || audioData.length === 0)
      return Array(numPoints).fill({ position: 0, value: 0 });

    // Ensure numPoints is odd to have a center point at x=0
    const adjustedNumPoints = numPoints % 2 === 0 ? numPoints + 1 : numPoints;

    // Get raw frequency data
    const frequencyData = getFrequencyData(
      audioData,
      Math.ceil(adjustedNumPoints / 2)
    );

    // Create symmetrical pattern
    const result = [];
    const centerIndex = Math.floor(adjustedNumPoints / 2);

    // Calculate grid width - reduced for tighter spacing
    const gridWidth = 6.0; // Reduced from 7.0 to 6.0 for tighter spacing
    const pointSpacing = gridWidth / (adjustedNumPoints - 1);

    // Create the symmetrical pattern
    for (let i = 0; i < adjustedNumPoints; i++) {
      // Calculate position on x-axis, centered at 0
      const position = (i - centerIndex) * pointSpacing;

      // Calculate the distance from center (0 to centerIndex)
      const distFromCenter = Math.abs(i - centerIndex);

      // Get the frequency value (mirror for the right side)
      let value;
      if (i <= centerIndex) {
        // Left side including center
        value = frequencyData[distFromCenter];
      } else {
        // Right side (mirror of left)
        value = frequencyData[distFromCenter];
      }

      result.push({ position, value });
    }

    return result;
  };

  // Get color palette
  const { getShaderColor, threeColors } = useColorPalette();

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

  // Get color directly from frequency bands using the color palette gradient
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

  // Create continuous emission of particles based on audio data
  const createContinuousEmission = (
    time: number,
    amplitude: number,
    bands: number[]
  ) => {
    if (
      !pointsRef.current ||
      !audioData ||
      !activeArray ||
      !burstTimeArray ||
      !colorArray ||
      !rotationArray ||
      !lifetimeArray ||
      !fadeStartArray ||
      !fadeLengthArray ||
      !turbulenceArray ||
      !bandArray ||
      !initialVelocityArray
    )
      return;

    // Calculate how many particles to emit based on amplitude
    const particlesToEmit = Math.floor(2 + amplitude * 4);
    if (particlesToEmit <= 0) return;

    // Emit particles in a simpler pattern
    const geometry = pointsRef.current.geometry;
    const positionAttr = geometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    const velocityAttr = geometry.getAttribute(
      "aVelocity"
    ) as THREE.BufferAttribute;
    const initialVelocityAttr = geometry.getAttribute(
      "aInitialVelocity"
    ) as THREE.BufferAttribute;
    const activeAttr = geometry.getAttribute(
      "aActive"
    ) as THREE.BufferAttribute;
    const burstTimeAttr = geometry.getAttribute(
      "aBurstTime"
    ) as THREE.BufferAttribute;
    const colorAttr = geometry.getAttribute("aColor") as THREE.BufferAttribute;
    const rotationAttr = geometry.getAttribute(
      "aRotation"
    ) as THREE.BufferAttribute;
    const lifetimeAttr = geometry.getAttribute(
      "aLifetime"
    ) as THREE.BufferAttribute;
    const fadeStartAttr = geometry.getAttribute(
      "aFadeStart"
    ) as THREE.BufferAttribute;
    const fadeLengthAttr = geometry.getAttribute(
      "aFadeLength"
    ) as THREE.BufferAttribute;
    const scaleAttr = geometry.getAttribute("aScale") as THREE.BufferAttribute;
    const turbulenceAttr = geometry.getAttribute(
      "aTurbulence"
    ) as THREE.BufferAttribute;
    const bandAttr = geometry.getAttribute("aBand") as THREE.BufferAttribute;

    // Find inactive particles to use
    let particlesActivated = 0;
    for (
      let i = 0;
      i < particleCount && particlesActivated < particlesToEmit;
      i++
    ) {
      if (activeAttr.getX(i) < 0.5) {
        // Activate this particle
        activeAttr.setX(i, 1.0);
        burstTimeAttr.setX(i, time);

        // Set initial position - random point on the emission plane
        const posX = (Math.random() - 0.5) * 6;
        const posZ = (Math.random() - 0.5) * 6;
        const posY = 0.05; // Slightly above the plane
        positionAttr.setXYZ(i, posX, posY, posZ);

        // Set velocity - upward with slight outward direction
        const upwardVelocity = 0.4 + Math.random() * 0.4;
        const outwardFactor = 0.1 + Math.random() * 0.2;

        // Calculate outward direction
        const dirX = posX === 0 ? Math.random() - 0.5 : Math.sign(posX);
        const dirZ = posZ === 0 ? Math.random() - 0.5 : Math.sign(posZ);

        // Set velocity
        const vx = dirX * outwardFactor;
        const vy = upwardVelocity;
        const vz = dirZ * outwardFactor;

        velocityAttr.setXYZ(i, vx, vy, vz);
        initialVelocityAttr.setXYZ(i, vx, vy, vz);

        // Set color based on frequency bands
        const bandType = ["low", "mid", "high"][
          Math.floor(Math.random() * 3)
        ] as "low" | "mid" | "high";
        const [r, g, b] = getColorFromFrequencyBands(bands, bandType);
        colorAttr.setXYZ(i, r, g, b);

        // Set random rotation
        rotationAttr.setX(i, Math.random() * Math.PI * 2);

        // Set lifetime
        const lifetime = 2.0 + Math.random() * 1.5;
        lifetimeAttr.setX(i, lifetime);

        // Set fade parameters
        fadeStartAttr.setX(i, 0.7);
        fadeLengthAttr.setX(i, 0.3);

        // Set turbulence
        turbulenceAttr.setX(i, 0.3 + Math.random() * 0.3);

        // Set band
        bandAttr.setX(i, Math.floor(Math.random() * 3));

        particlesActivated++;
      }
    }

    // Update buffers
    if (particlesActivated > 0) {
      positionAttr.needsUpdate = true;
      velocityAttr.needsUpdate = true;
      initialVelocityAttr.needsUpdate = true;
      activeAttr.needsUpdate = true;
      burstTimeAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
      rotationAttr.needsUpdate = true;
      lifetimeAttr.needsUpdate = true;
      fadeStartAttr.needsUpdate = true;
      fadeLengthAttr.needsUpdate = true;
      turbulenceAttr.needsUpdate = true;
      bandAttr.needsUpdate = true;

      // Update active particle count
      activeParticlesRef.current += particlesActivated;
    }
  };

  // Update the emitParticleBurst function to create a more dramatic plume
  const emitParticleBurst = (
    count: number,
    currentTime: number,
    frequencyBands: number[]
  ) => {
    if (
      !pointsRef.current ||
      !activeArray ||
      !burstTimeArray ||
      !colorArray ||
      !rotationArray ||
      !lifetimeArray ||
      !fadeStartArray ||
      !fadeLengthArray ||
      !turbulenceArray ||
      !bandArray ||
      !initialVelocityArray
    )
      return;

    const geometry = pointsRef.current.geometry;
    const activeAttr = geometry.getAttribute(
      "aActive"
    ) as THREE.BufferAttribute;
    const burstTimeAttr = geometry.getAttribute(
      "aBurstTime"
    ) as THREE.BufferAttribute;
    const colorAttr = geometry.getAttribute("aColor") as THREE.BufferAttribute;
    const rotationAttr = geometry.getAttribute(
      "aRotation"
    ) as THREE.BufferAttribute;
    const lifetimeAttr = geometry.getAttribute(
      "aLifetime"
    ) as THREE.BufferAttribute;
    const fadeStartAttr = geometry.getAttribute(
      "aFadeStart"
    ) as THREE.BufferAttribute;
    const fadeLengthAttr = geometry.getAttribute(
      "aFadeLength"
    ) as THREE.BufferAttribute;
    const turbulenceAttr = geometry.getAttribute(
      "aTurbulence"
    ) as THREE.BufferAttribute;
    const bandAttr = geometry.getAttribute("aBand") as THREE.BufferAttribute;
    const initialVelocityAttr = geometry.getAttribute(
      "aInitialVelocity"
    ) as THREE.BufferAttribute;

    // Find inactive particles to reuse
    let particlesActivated = 0;
    for (let i = 0; i < particleCount && particlesActivated < count; i++) {
      if (activeAttr.getX(i) < 0.5) {
        // Activate this particle
        activeAttr.setX(i, 1.0);
        burstTimeAttr.setX(i, currentTime);

        // Set initial position - concentrated more in the center for a plume effect
        // Use a tighter distribution for more focused plume
        const radius = Math.random() * 3; // Reduced from 6 to 3 for tighter plume
        const angle = Math.random() * Math.PI * 2;
        const posX = Math.cos(angle) * radius;
        const posZ = Math.sin(angle) * radius;
        const posY = 0.05; // Slightly above the plane to avoid z-fighting

        // Set position
        const positionAttr = geometry.getAttribute(
          "position"
        ) as THREE.BufferAttribute;
        positionAttr.setXYZ(i, posX, posY, posZ);

        // Set initial velocity - much stronger upward velocity for dramatic plume
        const velocityAttr = geometry.getAttribute(
          "aVelocity"
        ) as THREE.BufferAttribute;

        // Even stronger upward velocity for beat particles
        const upwardVelocity = 1.2 + Math.random() * 1.2; // Increased from 1.0-2.0 to 1.2-2.4

        // Less outward spread for a more focused column
        const outwardFactor = 0.1 + Math.random() * 0.2;

        // Calculate outward direction
        const dirX = posX === 0 ? Math.random() - 0.5 : Math.sign(posX);
        const dirZ = posZ === 0 ? Math.random() - 0.5 : Math.sign(posZ);

        // Create velocity vector
        const vx = dirX * outwardFactor;
        const vy = upwardVelocity;
        const vz = dirZ * outwardFactor;

        // Set both velocity and initial velocity
        velocityAttr.setXYZ(i, vx, vy, vz);
        initialVelocityAttr.setXYZ(i, vx, vy, vz);

        // Set color based on frequency bands - brighter colors for beat particles
        const bandType = ["low", "mid", "high"][
          Math.floor(Math.random() * 3)
        ] as "low" | "mid" | "high";
        const [r, g, b] = getColorFromFrequencyBands(frequencyBands, bandType);

        // Make beat particles brighter
        const brightness = 1.8; // Increased from 1.5 to 1.8 for even more visible beat particles
        colorAttr.setXYZ(i, r * brightness, g * brightness, b * brightness);

        // Set random rotation
        rotationAttr.setX(i, Math.random() * Math.PI * 2);

        // Longer lifetime for beat particles to create a lasting plume
        const lifetime = 3.0 + Math.random() * 2.0;
        lifetimeAttr.setX(i, lifetime);

        // Set fade parameters - slower fade for more visible plume
        const fadeStart = 0.8;
        const fadeLength = 0.2;
        fadeStartAttr.setX(i, fadeStart);
        fadeLengthAttr.setX(i, fadeLength);

        // Set turbulence factor - less turbulence for more coherent plume
        const turbulence = 0.2 + Math.random() * 0.3;
        turbulenceAttr.setX(i, turbulence);

        // Set frequency band influence
        const bandInfluence = Math.floor(Math.random() * 3); // 0=bass, 1=mid, 2=high
        bandAttr.setX(i, bandInfluence);

        particlesActivated++;
      }
    }

    // Mark attributes as needing update
    geometry.getAttribute("position").needsUpdate = true;
    geometry.getAttribute("aVelocity").needsUpdate = true;
    initialVelocityAttr.needsUpdate = true;
    activeAttr.needsUpdate = true;
    burstTimeAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    rotationAttr.needsUpdate = true;
    lifetimeAttr.needsUpdate = true;
    fadeStartAttr.needsUpdate = true;
    fadeLengthAttr.needsUpdate = true;
    turbulenceAttr.needsUpdate = true;
    bandAttr.needsUpdate = true;

    // Update active particle count
    activeParticlesRef.current += particlesActivated;
  };

  // Update useFrame to handle beat detection and particle emission
  useFrame(({ clock, camera, controls }) => {
    if (!pointsRef.current || !activeArray || !audioData) return;

    const currentTime = clock.getElapsedTime();
    const deltaTime = Math.min(clock.getDelta(), 0.1);

    // Update time uniform
    if (uniforms && uniforms.uTime) {
      uniforms.uTime.value = currentTime;
    }

    // Only proceed if audio is playing
    if (!isPlaying) return;

    // Process audio data
    const audioAmplitude = calculateAudioAmplitude(audioData);
    lastAudioAmplitudeRef.current = audioAmplitude;

    // Analyze frequency bands
    const bands = analyzeFrequencyBands(audioData);

    // Check for beat using the centralized beat detection from AudioContext
    if (onBeat && currentTime - lastBeatTimeRef.current > 0.1) {
      lastBeatTimeRef.current = currentTime;
      beatActiveRef.current = true;
      beatDecayRef.current = 1.0; // Full beat intensity

      // Emit a MUCH larger burst of particles on beat for obvious plume effect
      emitParticleBurst(
        Math.floor(100 + audioAmplitude * 150), // Dramatically increased from 50+70 to 100+150
        currentTime,
        bands
      );
    }

    // Update beat decay
    if (beatDecayRef.current > 0) {
      beatDecayRef.current = Math.max(
        0,
        beatDecayRef.current - beatDecayRateRef.current
      );
      if (beatDecayRef.current === 0) {
        beatActiveRef.current = false;
      }
    }

    // Continuous emission based on audio amplitude - minimal when not on beat
    // Force emission on the first few frames after playback starts
    const forceEmission = lastContinuousEmissionTimeRef.current === 0;

    if (
      isPlaying &&
      (forceEmission ||
        currentTime - lastContinuousEmissionTimeRef.current >
          continuousEmissionIntervalRef.current)
    ) {
      lastContinuousEmissionTimeRef.current = currentTime;

      // Emit particles continuously based on audio amplitude - even fewer particles when not on beat
      // Ensure at least 1 particle is emitted when audio is playing to maintain visual feedback
      const particlesToEmit = Math.max(1, Math.floor(audioAmplitude * 2));
      createContinuousEmission(currentTime, audioAmplitude, bands);
    }

    // Clean up old particles
    if (currentTime % 0.5 < 0.01) {
      // Every ~0.5 second
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
      for (let i = 0; i < particleCount; i++) {
        // Check if particle is too old (more than its lifetime)
        if (activeAttr.getX(i) > 0.5) {
          const lifetime = lifetimeAttr.getX(i);
          if (currentTime - burstTimeAttr.getX(i) > lifetime) {
            activeAttr.setX(i, 0); // Deactivate old particle
          } else {
            activeCount++;
          }
        }
      }

      activeAttr.needsUpdate = true;
      activeParticlesRef.current = activeCount;
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  // Reset state when audio track changes
  useEffect(() => {
    if (currentAudioFile) {
      // Reset beat detection state
      lastBeatTimeRef.current = 0;
      beatActiveRef.current = false;
      beatDecayRef.current = 0;

      // Reset audio processing state
      lastAudioAmplitudeRef.current = 0;
      frequencyBandsRef.current = [0, 0, 0];
      lastContinuousEmissionTimeRef.current = 0;

      // Reset all particles if the geometry exists
      if (pointsRef.current) {
        const geometry = pointsRef.current.geometry;
        const activeAttr = geometry.getAttribute(
          "aActive"
        ) as THREE.BufferAttribute;

        // Deactivate all particles
        for (let i = 0; i < particleCount; i++) {
          activeAttr.setX(i, 0);
        }

        activeAttr.needsUpdate = true;
        activeParticlesRef.current = 0;
      }
    }
  }, [currentAudioFile, particleCount]);

  // Update the useEffect for audio playback state changes
  useEffect(() => {
    if (isPlaying) {
      // Reset beat detection when playback starts/resumes
      lastBeatTimeRef.current = 0;
      beatActiveRef.current = false;
      beatDecayRef.current = 0;

      // Reset continuous emission timer to ensure particles start emitting immediately
      lastContinuousEmissionTimeRef.current = 0;

      // Force an immediate emission of some particles when playback resumes
      if (pointsRef.current && audioData) {
        const currentTime = performance.now() / 1000; // Current time in seconds
        const amplitude = calculateAudioAmplitude(audioData);
        const bands = analyzeFrequencyBands(audioData);

        // Emit a small burst of particles to show playback has resumed
        setTimeout(() => {
          emitParticleBurst(
            Math.floor(20 + amplitude * 30), // Smaller initial burst
            currentTime,
            bands
          );
        }, 100); // Small delay to ensure everything is initialized
      }
    } else {
      // Reset beat detection when playback stops
      beatActiveRef.current = false;
      beatDecayRef.current = 0;
    }
  }, [isPlaying, audioData]);

  // Don't render until arrays are initialized
  if (
    !activeArray ||
    !burstTimeArray ||
    !colorArray ||
    !rotationArray ||
    !lifetimeArray ||
    !fadeStartArray ||
    !fadeLengthArray ||
    !turbulenceArray ||
    !bandArray ||
    !initialVelocityArray ||
    !smokeTexture
  )
    return null;

  return (
    <>
      {/* Static and invisible emission plane */}
      <EmissionPlane />

      {/* Particle system */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particleCount}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aScale"
            count={particleCount}
            array={scales}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aOffset"
            count={particleCount}
            array={offsets}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aVelocity"
            count={particleCount}
            array={velocities}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aInitialVelocity"
            count={particleCount}
            array={initialVelocityArray}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aActive"
            count={particleCount}
            array={activeArray}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aBurstTime"
            count={particleCount}
            array={burstTimeArray}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aColor"
            count={particleCount}
            array={colorArray}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aRotation"
            count={particleCount}
            array={rotationArray}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aLifetime"
            count={particleCount}
            array={lifetimeArray}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aFadeStart"
            count={particleCount}
            array={fadeStartArray}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aFadeLength"
            count={particleCount}
            array={fadeLengthArray}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aTurbulence"
            count={particleCount}
            array={turbulenceArray}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aBand"
            count={particleCount}
            array={bandArray}
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
