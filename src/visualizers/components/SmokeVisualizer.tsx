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

  // Create a radial gradient for more defined particles with less smoke effect
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );

  // Sharper gradient with higher opacity for more defined particles
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.95)"); // Increased from 0.7 to 0.95
  gradient.addColorStop(0.2, "rgba(255, 255, 255, 0.8)"); // Increased from 0.65 to 0.8
  gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.3)"); // Adjusted from 0.45 to 0.3
  gradient.addColorStop(0.7, "rgba(255, 255, 255, 0.1)"); // Adjusted from 0.25 to 0.1
  gradient.addColorStop(0.9, "rgba(255, 255, 255, 0.0)"); // Sharp cutoff for defined edge
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Add minimal noise for texture - reduced for cleaner appearance
  ctx.globalAlpha = 0.02; // Reduced from 0.03 to 0.02
  for (let i = 0; i < 2000; i++) {
    // Reduced from 4000 to 2000
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = Math.random() * 1.5; // Reduced from 2 to 1.5
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
  }

  // Apply minimal blur for sharper edges
  try {
    // @ts-ignore - filter is available in most browsers
    ctx.filter = "blur(4px)"; // Reduced from 10px to 4px for sharper particles
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
  uniform vec3 uAudioData; // New uniform for audio data [bass, mid, high]
  
  attribute float aScale;
  attribute float aOffset;
  attribute vec3 aVelocity;
  attribute float aActive;
  attribute float aBurstTime;
  attribute vec3 aColor;
  attribute float aRotation;
  attribute float aLifetime;
  attribute float aFadeStart;
  attribute float aFadeLength;
  attribute float aTurbulence;
  attribute float aBand; // New attribute to identify which frequency band the particle belongs to (0=low, 1=mid, 2=high)
  
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
    float lifetime = aLifetime; // Variable lifetime per particle
    float normalizedAge = clamp(age / lifetime, 0.0, 1.0);
    
    // Get the appropriate audio data based on the particle's band
    float bandValue = 0.0;
    if (aBand < 0.5) {
      bandValue = uAudioData.x; // Low frequency (bass)
    } else if (aBand < 1.5) {
      bandValue = uAudioData.y; // Mid frequency
    } else {
      bandValue = uAudioData.z; // High frequency
    }
    
    // Audio reactivity factor - stronger for newer particles
    float audioReactivity = max(0.0, bandValue * (1.0 - normalizedAge * 0.7));
    
    // Start with the original position
    vec3 pos = position;
    
    // Calculate noise for horizontal movement - increased frequency and amplitude
    float noiseScale = 2.0; // Increased from 1.5 to 2.0 for more variation
    float noiseTime = uTime * 0.3; // Increased from 0.2 to 0.3 for faster movement
    
    // Add particle-specific variation with more randomness
    vec3 noisePos = vec3(
      position.x * noiseScale + noiseTime + aOffset * 15.0,
      position.y * noiseScale * 0.5 + noiseTime + aOffset * 8.0,
      position.z * noiseScale + noiseTime * 0.7 + aOffset * 12.0
    );
    
    // Get noise values with more variation
    float noiseX = snoise(noisePos);
    float noiseZ = snoise(noisePos + vec3(12.34, 56.78, 90.12));
    
    // Secondary noise for more complex movement
    float noiseX2 = snoise(noisePos * 2.0 + vec3(45.67, 89.01, 23.45));
    float noiseZ2 = snoise(noisePos * 2.0 + vec3(67.89, 12.34, 56.78));
    
    // Calculate strictly upward movement - slightly slower
    // 1. Base upward velocity - always positive but slower
    float baseUpwardVelocity = 0.3 + audioReactivity * 0.6; // Reduced from 0.5 to 0.3
    
    // 2. Age-based acceleration - particles move faster as they age
    float ageAcceleration = 0.15 * normalizedAge; // Reduced from 0.2 to 0.15
    
    // 3. Audio-reactive boost - stronger upward movement during loud passages
    float audioBoost = audioReactivity * 0.4; // Reduced from 0.5 to 0.4
    
    // Combine for total upward movement - guaranteed to be positive but slower
    float totalUpwardMovement = (baseUpwardVelocity + ageAcceleration + audioBoost) * age;
    
    // Apply strictly upward movement
    pos.y += totalUpwardMovement;
    
    // Apply enhanced horizontal movement - much more pronounced
    // Combine primary and secondary noise for more complex movement
    // Significantly increased turbulence strength
    float turbulenceStrength = aTurbulence * (1.2 + audioReactivity * 1.0); // Increased from 0.5 to 1.2
    
    // Apply primary noise movement
    pos.x += noiseX * turbulenceStrength * age * 1.5; // Increased by 50%
    pos.z += noiseZ * turbulenceStrength * age * 1.5; // Increased by 50%
    
    // Apply secondary noise for more complex movement
    pos.x += noiseX2 * turbulenceStrength * age * 0.8;
    pos.z += noiseZ2 * turbulenceStrength * age * 0.8;
    
    // Add slight sinusoidal movement for more floating effect
    pos.x += sin(age * (0.5 + aOffset * 0.3)) * (0.2 + audioReactivity * 0.2) * age;
    pos.z += cos(age * (0.4 + aOffset * 0.2)) * (0.2 + audioReactivity * 0.2) * age;
    
    // Individualized fade-out for each particle
    float fadeStart = aFadeStart;
    float fadeLength = aFadeLength;
    
    float fadeAlpha = 1.0;
    if (normalizedAge > fadeStart) {
      float fadeProgress = (normalizedAge - fadeStart) / fadeLength;
      fadeAlpha = 1.0 - pow(min(fadeProgress, 1.0), 2.5);
    }
    vAlpha = max(0.0, fadeAlpha);
    
    float endFade = smoothstep(1.0, 0.9, normalizedAge);
    vAlpha *= endFade;
    
    // Calculate position
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    // Size based on scale and distance - particles grow as they rise
    float sizeModifier = 1.0 + pow(normalizedAge, 0.7) * 2.5 + audioReactivity * 1.0;
    gl_PointSize = uSize * aScale * sizeModifier * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
    
    // Pass the particle color to fragment shader
    vColor = aColor * (1.0 + audioReactivity * 0.3);
    
    // Pass rotation to fragment shader - faster rotation
    vRotation = aRotation + age * (0.5 + aOffset * 0.6 + audioReactivity * 0.7); // Increased rotation speed
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
    
    // Apply color and alpha with less blending for sharper particles
    // Multiply color by texture but maintain more of the original color
    vec3 color = vColor * texColor.rgb * 0.8; // Increased from 0.4 to 0.8 for more vibrant color
    
    // Adjust alpha for more defined particles
    float alpha = texColor.a * vAlpha * 0.7; // Increased from 0.35 to 0.7 for more opacity
    
    // Discard more transparent pixels for sharper edges
    if (alpha < 0.05) discard; // Increased threshold from 0.01 to 0.05
    
    // Output color with alpha
    gl_FragColor = vec4(color, alpha);
  }
`;

// Plane mesh to visualize the emission surface
const EmissionPlane = () => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[8, 8]} />
      <meshStandardMaterial
        color="#333"
        transparent
        opacity={0.3}
        roughness={0.8}
        metalness={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const SmokeVisualizer = ({ audioData }: VisualizerProps) => {
  const { isPlaying } = useAudio();
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 800; // Further reduced from 1500 to 800
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

  // Use refs instead of state for these values to reduce re-renders
  const lastAudioAmplitudeRef = useRef(0);
  const frequencyBandsRef = useRef<number[]>([0, 0, 0]); // [bass, mid, high]
  const lastContinuousEmissionTimeRef = useRef(0);
  // Reduce emission frequency to improve performance
  const continuousEmissionIntervalRef = useRef(0.1); // Increased from 0.05 to 0.1 (10 times per second)

  // Beat detection references
  const lastBeatTimeRef = useRef(0);
  const beatCooldownRef = useRef(0.2);
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
      // Initial positions on the grid plane (y=0)
      positions[i * 3] = 0; // x
      positions[i * 3 + 1] = 0; // y (on the grid)
      positions[i * 3 + 2] = 0; // z

      // Random scale for each particle
      scales[i] = Math.random() * 0.5 + 0.5;

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
    const bands = new Float32Array(particleCount).fill(0); // New array to track which band each particle belongs to

    setActiveArray(active);
    setBurstTimeArray(burstTime);
    setColorArray(colors);
    setRotationArray(rotations);
    setLifetimeArray(lifetimes);
    setFadeStartArray(fadeStarts);
    setFadeLengthArray(fadeLengths);
    setTurbulenceArray(turbulence);
    setBandArray(bands);
  }, [particleCount]);

  // Create uniforms for the shader
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 300 }, // Reduced from 450 to 300 for smaller, more defined particles
      uTexture: { value: smokeTexture },
      uAudioData: { value: new THREE.Vector3(0, 0, 0) }, // New uniform for audio data [bass, mid, high]
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

  // Analyze audio data into frequency bands
  const analyzeFrequencyBands = (audioData: Uint8Array) => {
    if (!audioData || audioData.length === 0) return [0, 0, 0];

    // Define frequency band ranges (assuming 128 frequency bins)
    const bandRanges = [
      [0, 8], // Bass: 0-8
      [9, 32], // Mid: 9-32
      [33, 64], // High: 33-64
    ];

    // Calculate average for each band
    const bands = bandRanges.map(([start, end]) => {
      let sum = 0;
      const count = Math.min(end, audioData.length) - start;
      if (count <= 0) return 0;

      for (let i = start; i < Math.min(end, audioData.length); i++) {
        sum += audioData[i] / 255;
      }
      return sum / count;
    });

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

  // Detect beats (particularly snare hits) in the mid-high frequency range
  const detectBeat = (audioData: Uint8Array, currentTime: number): boolean => {
    if (!audioData || audioData.length === 0) return false;

    // Focus on mid-high frequency range where snare hits are typically found
    // Snares usually have significant energy in the 200Hz-12kHz range
    // This roughly corresponds to bins 20-60 in a 128-bin FFT
    const snareRangeStart = 20;
    const snareRangeEnd = Math.min(60, audioData.length);

    // Calculate current energy in the snare frequency range
    let currentEnergy = 0;
    for (let i = snareRangeStart; i < snareRangeEnd; i++) {
      currentEnergy += audioData[i] / 255;
    }
    currentEnergy /= snareRangeEnd - snareRangeStart;

    // Threshold for beat detection - adjust based on testing
    const beatThreshold = 0.5;

    // Check if enough time has passed since the last beat
    const timeSinceLastBeat = currentTime - lastBeatTimeRef.current;

    // Detect beat if energy exceeds threshold and cooldown has passed
    if (
      currentEnergy > beatThreshold &&
      timeSinceLastBeat > beatCooldownRef.current
    ) {
      lastBeatTimeRef.current = currentTime;
      beatDecayRef.current = 1.0; // Full beat intensity
      return true;
    }

    return false;
  };

  // Create continuous emission of particles based on audio data
  const createContinuousEmission = (
    time: number,
    amplitude: number,
    bands: number[],
    isBeat: boolean
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
      !bandArray
    )
      return;

    const [bass, mid, high] = bands;

    // Number of points in the waveform - reduced for fewer emission points
    const waveformPoints = 15; // Reduced from 35 to 15

    // Get symmetrical waveform data for each frequency band
    // We'll use different parts of the audio data for each band
    const lowBandData = createSymmetricalWaveform(
      audioData.slice(0, 8), // Bass frequencies (0-8)
      waveformPoints
    );

    const midBandData = createSymmetricalWaveform(
      audioData.slice(9, 32), // Mid frequencies (9-32)
      waveformPoints
    );

    const highBandData = createSymmetricalWaveform(
      audioData.slice(33, 64), // High frequencies (33-64)
      waveformPoints
    );

    // Z-positions for each band - all bands on the grid plane (y=0)
    // but separated along the z-axis
    // Reversed order: high frequencies in front, low frequencies in back
    const bandPositions = {
      high: 1.5, // High in front
      mid: 0.0, // Mid in the middle
      low: -1.5, // Bass in back
    };

    // Rectangular emission area dimensions for each band
    const rectangleWidth = 6.0; // Width of the emission rectangle (x-axis)
    const rectangleDepth = {
      // Depth of the emission rectangle (z-axis) for each band
      high: 1.0, // High frequencies get a 1.0 unit deep rectangle
      mid: 1.5, // Mid frequencies get a 1.5 unit deep rectangle
      low: 2.0, // Low frequencies get a 2.0 unit deep rectangle (wider spread)
    };

    // Determine which band has the shortest average value to place it in front
    const avgLow =
      lowBandData.reduce((sum, point) => sum + point.value, 0) / waveformPoints;
    const avgMid =
      midBandData.reduce((sum, point) => sum + point.value, 0) / waveformPoints;
    const avgHigh =
      highBandData.reduce((sum, point) => sum + point.value, 0) /
      waveformPoints;

    // Sort bands by average value (ascending)
    const bandOrder = [
      { type: "low", data: lowBandData, avg: avgLow },
      { type: "mid", data: midBandData, avg: avgMid },
      { type: "high", data: highBandData, avg: avgHigh },
    ].sort((a, b) => a.avg - b.avg);

    // Update particle attributes
    const positionAttr = pointsRef.current.geometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    const velocityAttr = pointsRef.current.geometry.getAttribute(
      "aVelocity"
    ) as THREE.BufferAttribute;
    const activeAttr = pointsRef.current.geometry.getAttribute(
      "aActive"
    ) as THREE.BufferAttribute;
    const burstTimeAttr = pointsRef.current.geometry.getAttribute(
      "aBurstTime"
    ) as THREE.BufferAttribute;
    const colorAttr = pointsRef.current.geometry.getAttribute(
      "aColor"
    ) as THREE.BufferAttribute;
    const rotationAttr = pointsRef.current.geometry.getAttribute(
      "aRotation"
    ) as THREE.BufferAttribute;
    const lifetimeAttr = pointsRef.current.geometry.getAttribute(
      "aLifetime"
    ) as THREE.BufferAttribute;
    const fadeStartAttr = pointsRef.current.geometry.getAttribute(
      "aFadeStart"
    ) as THREE.BufferAttribute;
    const fadeLengthAttr = pointsRef.current.geometry.getAttribute(
      "aFadeLength"
    ) as THREE.BufferAttribute;
    const scaleAttr = pointsRef.current.geometry.getAttribute(
      "aScale"
    ) as THREE.BufferAttribute;
    const turbulenceAttr = pointsRef.current.geometry.getAttribute(
      "aTurbulence"
    ) as THREE.BufferAttribute;
    const bandAttr = pointsRef.current.geometry.getAttribute(
      "aBand"
    ) as THREE.BufferAttribute;

    // Process each band
    for (const band of bandOrder) {
      // Calculate base particles per point - significantly reduced
      const baseParticlesPerPoint = Math.max(1, Math.floor(1 + amplitude * 3)); // Reduced from 2/8 to 1/3

      // Adjust particles per point based on frequency bands - reduced boost
      const bassBoost = Math.floor(bass * 1); // Reduced from 4 to 1
      const midBoost = Math.floor(mid * 1); // Reduced from 3 to 1
      const highBoost = Math.floor(high * 1); // Reduced from 2 to 1

      // Get color for this band
      const [r, g, b] = getColorFromFrequencyBands(
        bands,
        band.type as "low" | "mid" | "high"
      );

      // Calculate velocity scale - responsive to audio characteristics
      // Higher amplitude = faster upward movement
      // Boost velocity for high frequencies during beats
      let velocityScale;
      if (band.type === "high" && isBeat) {
        velocityScale = 0.6 + amplitude * 1.8; // Higher velocity during beats
      } else {
        velocityScale = 0.4 + amplitude * 1.2;
      }

      // Get z-position for this band
      const zPos = bandPositions[band.type as keyof typeof bandPositions];

      // Get rectangle depth for this band
      const rectDepth =
        rectangleDepth[band.type as keyof typeof rectangleDepth];

      // Create particles for each point in the waveform
      for (let pointIndex = 0; pointIndex < waveformPoints; pointIndex++) {
        // Get the waveform data for this point
        const { position: xPos, value: freqValue } = band.data[pointIndex];

        // Use a very low threshold to ensure continuous emission
        // Only skip points with essentially no energy
        if (freqValue < 0.01) continue;

        // Create particles for this waveform point
        for (let i = 0; i < baseParticlesPerPoint; i++) {
          // Reuse inactive particles or use new ones
          const index = activeParticlesRef.current % particleCount;

          // Calculate position with rectangular distribution
          // Instead of just spreading around a point, create a rectangular area

          // For x-position: Use the waveform data as a weight for the center of the rectangle
          // but allow particles to spread across the entire width
          // This creates a rectangular emission area that's still influenced by the waveform
          const xWeight = 0.7; // How much the waveform influences x position (0-1)
          const xRandom = (Math.random() - 0.5) * rectangleWidth; // Random position across full width
          const xFinal = xPos * xWeight + xRandom * (1 - xWeight);

          // For z-position: Create a rectangular depth based on the band type
          // with the center at the band's z-position
          const zRandom = (Math.random() - 0.5) * rectDepth;
          const zFinal = zPos + zRandom;

          // Position particles in a rectangular area on the grid plane (y=0)
          positionAttr.setXYZ(
            index,
            xFinal, // X position influenced by waveform but spread across rectangle width
            0, // All bands on the grid plane (y=0)
            zFinal // Z position based on band with rectangular spread
          );

          // Set velocity - upward movement scaled by frequency value and audio characteristics
          // Higher frequency = faster upward movement
          // Add some randomness to create more natural flow
          const upwardVelocity =
            (0.3 + freqValue * 0.5 + Math.random() * 0.2) * velocityScale;

          // Horizontal drift varies with frequency - higher frequencies get more drift
          // Bass frequencies stay more centered
          // Reduced horizontal drift for straighter upward movement
          // Increase drift for high frequencies during beats
          let horizontalDrift;
          if (band.type === "high" && isBeat) {
            horizontalDrift = velocityScale * 0.05; // More drift during beats
          } else {
            horizontalDrift = velocityScale * 0.02;
          }

          velocityAttr.setXYZ(
            index,
            (Math.random() - 0.5) * horizontalDrift, // Reduced horizontal drift
            upwardVelocity, // Always positive upward velocity
            (Math.random() - 0.5) * horizontalDrift // Reduced horizontal drift
          );

          // Set particle color with vaporwave style for this band
          // Add slight variation for more natural look
          // Brighten high frequency colors during beats
          let colorVariation = 0.05;
          let colorIntensity = 1.0;

          if (band.type === "high" && isBeat) {
            colorVariation = 0.1; // More variation during beats
            colorIntensity = 1.3; // Brighter during beats
          }

          colorAttr.setXYZ(
            index,
            Math.min(
              1.0,
              r * colorIntensity + (Math.random() - 0.5) * colorVariation
            ),
            Math.min(
              1.0,
              g * colorIntensity + (Math.random() - 0.5) * colorVariation
            ),
            Math.min(
              1.0,
              b * colorIntensity + (Math.random() - 0.5) * colorVariation
            )
          );

          // Set random rotation
          // Faster rotation for high frequencies during beats
          if (band.type === "high" && isBeat) {
            rotationAttr.setX(index, Math.random() * Math.PI * 4); // Faster rotation during beats
          } else {
            rotationAttr.setX(index, Math.random() * Math.PI * 2);
          }

          // Set variable lifetime based on amplitude and frequency
          // Higher amplitudes get longer lifetimes for more dramatic effect
          // Longer lifetime for high frequencies during beats
          let lifetimeBase;
          if (band.type === "high" && isBeat) {
            lifetimeBase = 3.0 + amplitude * 2.5; // Longer lifetime during beats
          } else {
            lifetimeBase = 2.5 + amplitude * 2.0;
          }
          const lifetime = lifetimeBase + Math.random() * 1.5;
          lifetimeAttr.setX(index, lifetime);

          // Randomize fade start and length for each particle
          const fadeStart = 0.3 + amplitude * 0.2 + Math.random() * 0.2;
          fadeStartAttr.setX(index, fadeStart);

          const fadeLengthMax = 0.95 - fadeStart;
          const fadeLength = Math.max(
            0.3,
            Math.min(fadeLengthMax, 0.3 + Math.random() * 0.4)
          );
          fadeLengthAttr.setX(index, fadeLength);

          // Set particle scale - varies with frequency and amplitude
          // Smaller particles for more defined appearance
          let scale;
          if (band.type === "high" && isBeat) {
            scale = 0.4 + (1.0 - freqValue) * 0.4 + Math.random() * 0.3; // Reduced from 0.6/0.6/0.5 to 0.4/0.4/0.3
          } else {
            scale = 0.3 + (1.0 - freqValue) * 0.3 + Math.random() * 0.2; // Reduced from 0.5/0.5/0.4 to 0.3/0.3/0.2
          }
          scaleAttr.setX(index, scale);

          // Set turbulence factor - increased for more floating movement
          let turbulenceFactor;
          if (band.type === "high" && isBeat) {
            turbulenceFactor = 0.3 + Math.random() * 0.4; // Increased from 0.1/0.15 to 0.3/0.4
          } else {
            turbulenceFactor = 0.2 + Math.random() * 0.3; // Increased from 0.05/0.1 to 0.2/0.3
          }
          turbulenceAttr.setX(index, turbulenceFactor);

          // Set band identifier (0=low, 1=mid, 2=high)
          let bandValue;
          switch (band.type) {
            case "low":
              bandValue = 0.0;
              break;
            case "mid":
              bandValue = 1.0;
              break;
            case "high":
              bandValue = 2.0;
              break;
            default:
              bandValue = 0.0;
          }

          bandAttr.setX(index, bandValue);

          // Set particle to active and record burst time
          activeAttr.setX(index, 1);
          burstTimeAttr.setX(index, time);

          activeParticlesRef.current++;
        }
      }
    }

    // Update buffers
    positionAttr.needsUpdate = true;
    velocityAttr.needsUpdate = true;
    activeAttr.needsUpdate = true;
    burstTimeAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    rotationAttr.needsUpdate = true;
    lifetimeAttr.needsUpdate = true;
    fadeStartAttr.needsUpdate = true;
    fadeLengthAttr.needsUpdate = true;
    scaleAttr.needsUpdate = true;
    turbulenceAttr.needsUpdate = true;
    bandAttr.needsUpdate = true;
  };

  // Update animation and audio reactivity with optimizations
  useFrame((state) => {
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
      !turbulenceArray
    )
      return;

    // Update time uniform
    const currentTime = state.clock.elapsedTime;
    uniforms.uTime.value = currentTime;

    // Only proceed if audio is playing
    if (!isPlaying) return;

    // Calculate average audio intensity from all frequencies for overall amplitude
    let totalSum = 0;
    const totalSamples = Math.min(64, audioData.length);

    // Safely access audioData
    if (audioData && audioData.length > 0) {
      for (let i = 0; i < totalSamples; i++) {
        totalSum += audioData[i] / 255;
      }
      const audioAmplitude = totalSum / totalSamples;

      // Analyze frequency bands
      const bands = analyzeFrequencyBands(audioData);
      frequencyBandsRef.current = bands;

      // Update audio data uniform for all particles to react to
      uniforms.uAudioData.value.set(bands[0], bands[1], bands[2]);

      // Detect beats (particularly snare hits)
      const isBeat = detectBeat(audioData, currentTime);
      if (isBeat) {
        beatActiveRef.current = true;
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

      // Continuous emission logic - emit particles at regular intervals
      // Reduced emission frequency for fewer particles
      const dynamicInterval = Math.max(0.1, 0.2 - audioAmplitude * 0.1); // Increased from 0.05/0.15 to 0.1/0.2

      if (
        currentTime - lastContinuousEmissionTimeRef.current >=
          dynamicInterval &&
        audioAmplitude > 0.01
      ) {
        // Create continuous emission with any detectable audio
        createContinuousEmission(
          currentTime,
          audioAmplitude,
          bands,
          beatActiveRef.current || beatDecayRef.current > 0
        );

        // Update last emission time
        lastContinuousEmissionTimeRef.current = currentTime;
      }

      // Update last amplitude
      lastAudioAmplitudeRef.current = audioAmplitude;
    }

    // Clean up old particles more frequently
    if (currentTime % 0.5 < 0.01) {
      // Every ~0.5 second instead of 1 second
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
    !smokeTexture
  )
    return null;

  return (
    <>
      {/* Emission plane */}
      <EmissionPlane />

      {/* Particle system */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particleCount}
            array={positions}
            itemSize={3}
            args={[positions, 3]}
          />
          <bufferAttribute
            attach="attributes-aScale"
            count={particleCount}
            array={scales}
            itemSize={1}
            args={[scales, 1]}
          />
          <bufferAttribute
            attach="attributes-aOffset"
            count={particleCount}
            array={offsets}
            itemSize={1}
            args={[offsets, 1]}
          />
          <bufferAttribute
            attach="attributes-aVelocity"
            count={particleCount}
            array={velocities}
            itemSize={3}
            args={[velocities, 3]}
          />
          <bufferAttribute
            attach="attributes-aActive"
            count={particleCount}
            array={activeArray}
            itemSize={1}
            args={[activeArray, 1]}
          />
          <bufferAttribute
            attach="attributes-aBurstTime"
            count={particleCount}
            array={burstTimeArray}
            itemSize={1}
            args={[burstTimeArray, 1]}
          />
          <bufferAttribute
            attach="attributes-aColor"
            count={particleCount}
            array={colorArray}
            itemSize={3}
            args={[colorArray, 3]}
          />
          <bufferAttribute
            attach="attributes-aRotation"
            count={particleCount}
            array={rotationArray}
            itemSize={1}
            args={[rotationArray, 1]}
          />
          <bufferAttribute
            attach="attributes-aLifetime"
            count={particleCount}
            array={lifetimeArray}
            itemSize={1}
            args={[lifetimeArray, 1]}
          />
          <bufferAttribute
            attach="attributes-aFadeStart"
            count={particleCount}
            array={fadeStartArray}
            itemSize={1}
            args={[fadeStartArray, 1]}
          />
          <bufferAttribute
            attach="attributes-aFadeLength"
            count={particleCount}
            array={fadeLengthArray}
            itemSize={1}
            args={[fadeLengthArray, 1]}
          />
          <bufferAttribute
            attach="attributes-aTurbulence"
            count={particleCount}
            array={turbulenceArray}
            itemSize={1}
            args={[turbulenceArray, 1]}
          />
          <bufferAttribute
            attach="attributes-aBand"
            count={particleCount}
            array={bandArray}
            itemSize={1}
            args={[bandArray, 1]}
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
