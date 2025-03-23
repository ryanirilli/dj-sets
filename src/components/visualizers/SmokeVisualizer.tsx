import { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAudio } from "@/contexts/AudioContext";
import { VisualizerProps } from "@/types/visualizers";
import { useColorPalette } from "@/hooks/useColorPalette";

// Cache for smoke texture to avoid recreating it
let smokeTextureCache: THREE.Texture | null = null;

const SIZE = 512;
const PARTICLE_COUNT = 500;
const AVG_AUDIO_DATA_THRESHOLD = 25;
const PARTICLE_LIFETIME = 0.5;

// Create a smoke texture
const createSmokeTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");

  if (!ctx) return null;

  // Create a radial gradient for softer particles with gentle fade
  const gradient = ctx.createRadialGradient(
    SIZE / 2,
    SIZE / 2,
    0,
    SIZE / 2,
    SIZE / 2,
    SIZE / 2
  );

  // Softer gradient with gentler fade for more graceful particles
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)"); // Reduced from 0.95 to 0.8
  gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.5)"); // Adjusted from 0.2/0.8 to 0.3/0.5
  gradient.addColorStop(0.6, "rgba(255, 255, 255, 0.2)"); // Adjusted from 0.5/0.3 to 0.6/0.2
  gradient.addColorStop(0.8, "rgba(255, 255, 255, 0.05)"); // Adjusted from 0.7/0.1 to 0.8/0.05
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.globalAlpha = 0.01; // Reduced from 0.02 to 0.01
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * SIZE;
    const y = Math.random() * SIZE;
    const radius = Math.random() * 1.2; // Reduced from 1.5 to 1.2
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.fill();
  }

  // Apply minimal blur for softer edges
  try {
    const ctxWithFilter = ctx as CanvasRenderingContext2D & { filter: string };
    ctxWithFilter.filter = "blur(0px)"; // Reduced from 4px to 3px for sharper particles
    ctx.drawImage(canvas, 0, 0);
    ctxWithFilter.filter = "none";
  } catch {
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
    
    // Calculate upward movement - enhanced shooting motion in early life
    // 1. Base upward velocity from initial velocity - REDUCED for more horizontal spread
    float baseUpwardVelocity = aVelocity.y * 0.7; // Reduced from 1.0 to 0.7 to allow more horizontal movement
    
    // 2. Age-based acceleration - particles shoot up quickly then slow down
    // Enhanced early acceleration for more dramatic shooting effect
    float ageAcceleration;
    if (normalizedAge < 0.15) { // Reduced from 0.2 to 0.15 for faster initial acceleration
      // Strong initial acceleration for shooting effect
      ageAcceleration = 0.85 - normalizedAge * 0.5; // Reduced from 1.0 to 0.85
    } else {
      // Normal deceleration after initial burst
      ageAcceleration = 0.6 * (1.0 - (normalizedAge - 0.15) * 0.5); // Reduced from 0.8 to 0.6
    }
    
    // 3. Early-age boost for initial shooting effect (not audio reactive)
    float earlyAgeBoost = max(0.0, 0.3 - normalizedAge) * 1.2; // Reduced from 1.5 to 1.2
    
    // Combine for total upward movement - enhanced shooting effect
    float totalUpwardMovement = (baseUpwardVelocity * ageAcceleration + earlyAgeBoost) * age;
    
    // SCALE DOWN the total upward movement to keep particles in view
    totalUpwardMovement *= 0.5; // Further reduced from 0.6 to 0.5
    
    // Apply upward movement from initial velocity and calculated movement
    pos.y += totalUpwardMovement;
    
    // Add a height limit to keep particles in view
    pos.y = min(pos.y, 3.0); // Limit maximum height to 3.0 units
    
    // Apply horizontal movement from initial velocity - INCREASED for more spread
    float horizontalFactor = min(1.0, normalizedAge * 3.0); // Increased from 5.0 to 3.0 for earlier horizontal movement
    pos.x += aVelocity.x * age * horizontalFactor * 1.5; // Increased from 0.7 to 1.5 for more spread
    pos.z += aVelocity.z * age * horizontalFactor * 1.5; // Increased from 0.7 to 1.5 for more spread
    
    // Apply natural horizontal movement from noise - INCREASED for more dynamic floating
    float turbulenceStrength = aTurbulence * 1.2 * horizontalFactor; // Increased from 0.5 to 1.2
    
    // Apply noise-based movement for natural floating - INCREASED for more dynamic motion
    pos.x += noiseX * turbulenceStrength * age * 1.0; // Increased from 0.5 to 1.0
    pos.z += noiseZ * turbulenceStrength * age * 1.0; // Increased from 0.5 to 1.0
    
    // Apply secondary noise for more complex movement - INCREASED for more complexity
    pos.x += noiseX2 * turbulenceStrength * age * 0.6; // Increased from 0.25 to 0.6
    pos.z += noiseZ2 * turbulenceStrength * age * 0.6; // Increased from 0.25 to 0.6
    
    // Add enhanced sinusoidal movement for more floating effect - INCREASED amplitude
    pos.x += sin(age * (0.4 + aOffset * 0.2)) * 0.15 * age * horizontalFactor; // Increased from 0.06 to 0.15 and changed frequency
    pos.z += cos(age * (0.3 + aOffset * 0.15)) * 0.15 * age * horizontalFactor; // Increased from 0.06 to 0.15 and changed frequency
    
    // Add NEW figure-8 pattern movement for more interesting floating
    float figure8Strength = 0.08 * age * horizontalFactor;
    pos.x += sin(age * (0.2 + aOffset * 0.05)) * cos(age * (0.3 + aOffset * 0.1)) * figure8Strength;
    pos.z += cos(age * (0.2 + aOffset * 0.05)) * sin(age * (0.3 + aOffset * 0.1)) * figure8Strength;
    
    // Add NEW vortex swirl effect for more interesting particle behavior
    float swirl = smoothstep(0.0, 0.3, normalizedAge) * (1.0 - smoothstep(0.7, 1.0, normalizedAge));
    float swirlStrength = 0.3 * swirl;
    float swirlRadius = length(vec2(pos.x, pos.z));
    float swirlAngle = atan(pos.z, pos.x) + (0.2 + aOffset * 0.1) * age;
    vec2 swirlVector = vec2(cos(swirlAngle), sin(swirlAngle)) * swirlStrength * swirlRadius;
    pos.x += swirlVector.x * age;
    pos.z += swirlVector.y * age;
    
    // Add NEW gravity effect to make particles float down after peak
    float gravityEffect = max(0.0, normalizedAge - 0.6) * 0.04;
    pos.y -= gravityEffect * age * age;
    
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
    
    // Size based on scale and distance - enhanced growth for shooting effect
    float sizeModifier;
    if (normalizedAge < 0.1) {
      // Start smaller for shooting effect
      sizeModifier = 0.7 + normalizedAge * 5.0; // Quick initial growth
    } else {
      // Normal growth after initial shooting
      sizeModifier = 1.2 + pow((normalizedAge - 0.1) * 1.1, 0.3) * 1.5; // Reduced from 2.0 to 1.5
    }
    
    // No audio-reactive size boost, just use the initial scale with enhanced modifier
    float size = uSize * aScale * sizeModifier * (1.0 / -mvPosition.z);
    
    gl_PointSize = size;
    gl_Position = projectionMatrix * mvPosition;
    
    // Pass the particle color to fragment shader
    vColor = aColor;
    
    // Pass rotation to fragment shader - faster rotation for shooting effect, then slowing
    float rotationSpeed = 0.2 + aOffset * 0.3;
    if (normalizedAge < 0.2) {
      rotationSpeed *= 1.5; // Faster initial rotation for shooting effect
    }
    vRotation = aRotation + age * rotationSpeed;
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
  const beatActiveRef = useRef(false);
  const beatDecayRef = useRef(0);
  const beatDecayRateRef = useRef(0.05);

  // Create smoke texture with caching
  const smokeTexture = useMemo(() => {
    // Use cached texture if available
    if (smokeTextureCache) {
      return smokeTextureCache;
    }

    const canvas = createSmokeTexture();
    if (!canvas) return null;

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    smokeTextureCache = texture;

    return texture;
  }, []);

  // Create particles with initial attributes
  const { positions, scales, offsets, velocities } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const scales = new Float32Array(PARTICLE_COUNT);
    const offsets = new Float32Array(PARTICLE_COUNT);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);

    // Initialize all particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Initial positions - all at y=0 for emission from plane
      positions[i * 3] = 0; // x
      positions[i * 3 + 1] = 0; // y (at the plane level)
      positions[i * 3 + 2] = 0; // z

      // Random scale for each particle - smaller for more natural look
      scales[i] = Math.random() * 0.4 + 0.2; // Reduced from 0.5+0.3 to 0.4+0.2

      // Random offset for staggered animation
      offsets[i] = Math.random() * 5;

      // Initial velocity vector (mostly upward)
      velocities[i * 3] = 0; // x
      velocities[i * 3 + 1] = 0; // y (upward)
      velocities[i * 3 + 2] = 0; // z
    }

    return { positions, scales, offsets, velocities };
  }, [PARTICLE_COUNT]);

  // Create active state array, burst time array, color array, rotation array, and lifetime array
  useEffect(() => {
    const active = new Float32Array(PARTICLE_COUNT).fill(0);
    const burstTime = new Float32Array(PARTICLE_COUNT).fill(0);
    const colors = new Float32Array(PARTICLE_COUNT * 3).fill(0);
    const rotations = new Float32Array(PARTICLE_COUNT).fill(0);
    const lifetimes = new Float32Array(PARTICLE_COUNT).fill(0);
    const fadeStarts = new Float32Array(PARTICLE_COUNT).fill(0);
    const fadeLengths = new Float32Array(PARTICLE_COUNT).fill(0);
    const turbulence = new Float32Array(PARTICLE_COUNT).fill(0);
    const bands = new Float32Array(PARTICLE_COUNT).fill(0);
    const initialVelocities = new Float32Array(PARTICLE_COUNT * 3).fill(0);

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
  }, [PARTICLE_COUNT]);

  // Create uniforms for the shader
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 200 }, // Reduced from 300 to 200 for better scale
      uTexture: { value: smokeTexture },
      uAudioData: { value: new THREE.Vector3(0, 0, 0) },
    }),
    [smokeTexture]
  );

  // Reset state when audio track changes
  useEffect(() => {
    if (currentAudioFile) {
      // Reset beat detection state
      beatActiveRef.current = false;
      beatDecayRef.current = 0;

      // Reset audio processing state
      lastAudioAmplitudeRef.current = 0;
      frequencyBandsRef.current = [0, 0, 0];

      // Reset all particles if the geometry exists
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
    }
  }, [currentAudioFile, PARTICLE_COUNT]);

  // Update the useEffect for audio playback state changes
  useEffect(() => {
    if (isPlaying) {
      // Reset beat detection when playback starts/resumes
      beatActiveRef.current = false;
      beatDecayRef.current = 0;
    } else {
      // Reset beat detection when playback stops
      beatActiveRef.current = false;
      beatDecayRef.current = 0;

      // Deactivate all particles when audio stops
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
    }
  }, [isPlaying, PARTICLE_COUNT]);

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

    let particlesActivated = 0;
    for (let i = 0; i < PARTICLE_COUNT && particlesActivated < count; i++) {
      if (activeAttr.getX(i) < 0.5) {
        // Activate this particle
        activeAttr.setX(i, 1.0);
        burstTimeAttr.setX(i, currentTime);

        // Set initial position - random position on the circular emission plane
        // Generate points in a circle rather than a square
        const radius = 4; // Circular emission radius
        const angle = Math.random() * Math.PI * 2;

        // NEW: Add multiple emission points and patterns
        let posX, posZ;
        const emissionPattern = Math.random();

        if (emissionPattern < 0.4) {
          // Standard circular emission - use square root for radius to ensure uniform distribution
          const pointRadius = Math.sqrt(Math.random()) * radius * 0.8;
          posX = Math.cos(angle) * pointRadius;
          posZ = Math.sin(angle) * pointRadius;
        } else if (emissionPattern < 0.7) {
          // Ring emission - particles start from outer ring
          const ringWidth = 0.2 + Math.random() * 0.3;
          const pointRadius = radius * (0.7 + ringWidth * Math.random());
          posX = Math.cos(angle) * pointRadius;
          posZ = Math.sin(angle) * pointRadius;
        } else if (emissionPattern < 0.9) {
          // Scattered points - creates small clusters of particles
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
          // Center emission - more particles from center
          const pointRadius = Math.pow(Math.random(), 2) * radius * 0.5;
          posX = Math.cos(angle) * pointRadius;
          posZ = Math.sin(angle) * pointRadius;
        }

        // Position exactly at the plane level (y = 0)
        const posY = 0;

        // Set position
        const positionAttr = geometry.getAttribute(
          "position"
        ) as THREE.BufferAttribute;
        positionAttr.setXYZ(i, posX, posY, posZ);

        // Set initial velocity - MODIFIED for more varied behavior
        const velocityAttr = geometry.getAttribute(
          "aVelocity"
        ) as THREE.BufferAttribute;

        // More varied upward velocity
        const upwardVelocity = avgAudioLevel / 3; // Modified from 1.5+1.0 to 1.2+1.5

        // Calculate outward direction - INCREASED outward movement
        const distanceFromCenter = Math.sqrt(posX * posX + posZ * posZ);
        const centerBias = Math.min(1.0, distanceFromCenter / radius);

        // MORE outward velocity for particles, less inward bias
        const dirFactor = centerBias * (0.2 + Math.random() * 0.3);
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

        // Outward factor INCREASED for more horizontal spread
        const outwardFactor = 0.05 + Math.random() * 0.1; // Increased from 0.05+0.1 to 0.15+0.2

        const swirling = 0.5;

        const swirlStrength = swirling * (0.3 + Math.random() * 0.1);
        const swirlTime = currentTime * (0.2 + Math.random() * 0.1) + i * 0.01; // Using particle index instead of aOffset
        const dirVx = Math.cos(swirlTime) * swirlStrength;
        const dirVz = Math.sin(swirlTime) * swirlStrength;

        // Create initial velocity vector - MORE SPREAD and directional variety
        const vx = dirX * outwardFactor + dirVx + (Math.random() - 0.5) * 0.5;
        const vy = upwardVelocity * (0.8 + Math.random() * 0.4); // Varied upward velocity
        const vz = dirZ * outwardFactor + dirVz + (Math.random() - 0.5) * 0.5;

        // Set both velocity and initial velocity
        velocityAttr.setXYZ(i, vx, vy, vz);
        initialVelocityAttr.setXYZ(i, vx, vy, vz);

        // Set color based on frequency bands - NEW: more varied color strategies
        const bandType = ["low", "mid", "high"][
          Math.floor(Math.random() * 3)
        ] as "low" | "mid" | "high";

        // Add color variation and intensity based on emission pattern
        let colorBrightness = 5; // Base brightness
        let colorVariation = 0;

        // Vary colors based on emission pattern
        if (emissionPattern < 0.4) {
          // Standard pattern - normal brightness
          colorBrightness = 2.0 + Math.random() * 0.4;
        } else if (emissionPattern < 0.7) {
          // Ring pattern - brighter colors
          colorBrightness = 2.3 + Math.random() * 0.5;
          colorVariation = 0.1;
        } else if (emissionPattern < 0.9) {
          // Cluster pattern - most intense colors
          colorBrightness = 2.5 + Math.random() * 0.5;
          colorVariation = 0.2;
        } else {
          // Center pattern - softer colors
          colorBrightness = 1.8 + Math.random() * 0.4;
          colorVariation = -0.1;
        }

        const [r, g, b] = getColorFromFrequencyBands(frequencyBands, bandType);

        // Apply color variation
        const finalR = r * colorBrightness + colorVariation;
        const finalG = g * colorBrightness + colorVariation;
        const finalB = b * colorBrightness + colorVariation;

        colorAttr.setXYZ(i, finalR, finalG, finalB);

        // Set random rotation
        rotationAttr.setX(i, Math.random() * Math.PI * 2);

        // More varied lifetime for particles
        const lifetime = PARTICLE_LIFETIME + Math.random();
        lifetimeAttr.setX(i, lifetime);

        // Set fade parameters - MORE varied for different particles
        const fadeStart = 0.7 + Math.random() * 0.15; // Changed from fixed 0.8 to 0.7-0.85 range
        const fadeLength = 0.15 + Math.random() * 0.15; // Changed from fixed 0.2 to 0.15-0.3 range
        fadeStartAttr.setX(i, fadeStart);
        fadeLengthAttr.setX(i, fadeLength);

        // Set turbulence factor - INCREASED for more varied movement
        const turbulence = Math.random() * 0.4;
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

  // Update animation and audio reactivity
  useFrame(({ clock }) => {
    if (!pointsRef.current || !activeArray || !audioData) return;

    const currentTime = clock.getElapsedTime();

    // Update time uniform
    if (uniforms && uniforms.uTime) {
      uniforms.uTime.value = currentTime;
    }

    // Only proceed if audio is playing
    if (!isPlaying) return;

    const audioAmplitude = calculateAudioAmplitude(audioData);
    lastAudioAmplitudeRef.current = audioAmplitude;

    // Analyze frequency bands - needed for particle colors and shader effects
    const bands = analyzeFrequencyBands(audioData);

    // Use onBeat directly from AudioContext for beat detection
    if (onBeat) {
      beatActiveRef.current = true;
      beatDecayRef.current = 1.0; // Full beat intensity

      // Pulse the particle size on beat
      if (
        uniforms &&
        uniforms.uSize &&
        avgAudioLevel > AVG_AUDIO_DATA_THRESHOLD
      ) {
        uniforms.uSize.value = 300;
        setTimeout(() => {
          if (uniforms && uniforms.uSize && uniforms.uSize.value > 200) {
            uniforms.uSize.value = 200;
          }
        }, 100);
      }

      // Emit particles on beat - using audio data for particle count and properties
      emitParticleBurst(
        Math.floor(150 + audioAmplitude * 200),
        currentTime,
        bands
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

    // Clean up old particles periodically
    if (currentTime % 0.25 < 0.01) {
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

  // Add cleanup for resources when component unmounts
  useEffect(() => {
    return () => {
      // Force garbage collection
      if (typeof window !== "undefined") {
        THREE.Cache.clear();
      }

      // Let the ResourceCleaner component handle the detailed cleanup
    };
  }, []);

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
            count={PARTICLE_COUNT}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aScale"
            count={PARTICLE_COUNT}
            array={scales}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aOffset"
            count={PARTICLE_COUNT}
            array={offsets}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aVelocity"
            count={PARTICLE_COUNT}
            array={velocities}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aInitialVelocity"
            count={PARTICLE_COUNT}
            array={initialVelocityArray}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aActive"
            count={PARTICLE_COUNT}
            array={activeArray}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aBurstTime"
            count={PARTICLE_COUNT}
            array={burstTimeArray}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aColor"
            count={PARTICLE_COUNT}
            array={colorArray}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aRotation"
            count={PARTICLE_COUNT}
            array={rotationArray}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aLifetime"
            count={PARTICLE_COUNT}
            array={lifetimeArray}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aFadeStart"
            count={PARTICLE_COUNT}
            array={fadeStartArray}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aFadeLength"
            count={PARTICLE_COUNT}
            array={fadeLengthArray}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aTurbulence"
            count={PARTICLE_COUNT}
            array={turbulenceArray}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-aBand"
            count={PARTICLE_COUNT}
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

// Add a cleanup function for the module
export const cleanupSmokeVisualizer = () => {
  // Dispose of cached texture when no longer needed
  if (smokeTextureCache) {
    smokeTextureCache.dispose();
    smokeTextureCache = null;
  }
};

export default SmokeVisualizer;
