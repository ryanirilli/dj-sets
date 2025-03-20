import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VisualizerProps } from "@/types/visualizers";
import { useColorPalette } from "@/hooks/useColorPalette";
import { useAudio } from "@/contexts/AudioContext";

const IcosahedronVisualizer = ({ audioData }: VisualizerProps) => {
  const { isPlaying, onBeat, bpm, beatTime, currentAudioFile } = useAudio();
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const { threeColors } = useColorPalette();

  // Animation state
  const [faceCount, setFaceCount] = useState(7); // Default to 7 faces
  const nextDetailChangeRef = useRef(0);
  const timeRef = useRef(0);
  const lastFaceCountRef = useRef(7); // Track the last face count to ensure variation
  const lastBeatTimeRef = useRef(0); // Track the last beat time to avoid duplicate responses
  const currentAudioFileRef = useRef<string | null>(currentAudioFile);
  const onBeatRef = useRef(false); // Track onBeat state to detect changes
  const beatDetectedRef = useRef(false); // Track if we've detected a beat since track change

  // Base size - increased for better visibility
  const BASE_SIZE = 2.0; // Increased from default 1.0

  // Min and max face counts
  const MIN_FACES = 3;
  const MAX_FACES = 15;

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
    } else if (targetFaces <= 12) {
      // Use icosahedron (20 faces)
      geometry = new THREE.IcosahedronGeometry(radius);
    } else if (targetFaces <= 20) {
      // Use dodecahedron (12 faces)
      geometry = new THREE.DodecahedronGeometry(radius);
    } else {
      // Use sphere with more detail for higher face counts
      const detail = Math.floor((targetFaces - 20) / 10) + 1;
      geometry = new THREE.SphereGeometry(
        radius,
        8 + detail * 2,
        6 + detail * 2
      );
    }

    // All geometries in Three.js are already BufferGeometry in newer versions
    return geometry;
  }

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

  // Reset state when audio track changes
  useEffect(() => {
    if (currentAudioFile !== currentAudioFileRef.current) {
      console.log(
        "IcosahedronVisualizer: Audio track changed from",
        currentAudioFileRef.current,
        "to",
        currentAudioFile
      );

      // Update the reference to the current audio file
      currentAudioFileRef.current = currentAudioFile;

      // Reset beat tracking
      lastBeatTimeRef.current = 0;
      onBeatRef.current = false;
      beatDetectedRef.current = false;

      // Reset to default face count
      const defaultFaceCount = 7;
      setFaceCount(defaultFaceCount);
      lastFaceCountRef.current = defaultFaceCount;

      // Force update the mesh geometry if it exists
      if (meshRef.current && geometries[defaultFaceCount - MIN_FACES]) {
        meshRef.current.geometry = geometries[defaultFaceCount - MIN_FACES];
        console.log("IcosahedronVisualizer: Mesh geometry reset to default");
      }

      // Reset next detail change time
      nextDetailChangeRef.current = 0;

      console.log("IcosahedronVisualizer: State fully reset for new track");
    }
  }, [currentAudioFile, geometries]);

  // Track onBeat changes
  useEffect(() => {
    // Only update if there's a change to avoid unnecessary processing
    if (onBeatRef.current !== onBeat) {
      onBeatRef.current = onBeat;

      // If we detect a beat, log it for debugging
      if (onBeat) {
        console.log("IcosahedronVisualizer: Beat detected at time:", beatTime);
        beatDetectedRef.current = true;
      }
    }
  }, [onBeat, beatTime]);

  // Monitor isPlaying changes
  useEffect(() => {
    if (isPlaying) {
      console.log("IcosahedronVisualizer: Audio playback started/resumed");
    } else {
      console.log("IcosahedronVisualizer: Audio playback stopped/paused");
      // Reset beat tracking when playback stops
      lastBeatTimeRef.current = 0;
      beatDetectedRef.current = false;
    }
  }, [isPlaying]);

  // Get a random face count within our defined range
  const getRandomFaceCount = () => {
    // Get current face count
    const currentFaceCount = lastFaceCountRef.current;

    // Calculate how many options we have
    const range = MAX_FACES - MIN_FACES + 1;

    // Ensure we get a significantly different face count (at least 25% different)
    let newFaceCount;
    do {
      newFaceCount = MIN_FACES + Math.floor(Math.random() * range);
    } while (
      Math.abs(newFaceCount - currentFaceCount) < range * 0.25 ||
      newFaceCount === currentFaceCount
    );

    // Update the last face count reference
    lastFaceCountRef.current = newFaceCount;

    return newFaceCount;
  };

  // Update animation and audio reactivity
  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;

    const currentTime = state.clock.elapsedTime;
    timeRef.current = currentTime;

    // Update shader time uniform
    if (materialRef.current.uniforms) {
      materialRef.current.uniforms.uTime.value = currentTime;
    }

    // Only process audio if playing
    if (isPlaying && audioData && audioData.length > 0) {
      // Check if we have a new beat from the AudioContext
      if (onBeat && beatTime > lastBeatTimeRef.current) {
        // Update last beat time to avoid duplicate responses
        lastBeatTimeRef.current = beatTime;

        // Change face count on beat
        const newFaceCount = getRandomFaceCount();

        // Force update the mesh geometry directly
        if (meshRef.current && geometries[newFaceCount - MIN_FACES]) {
          meshRef.current.geometry = geometries[newFaceCount - MIN_FACES];

          // Update state for React
          setFaceCount(newFaceCount);

          console.log(
            "BEAT DETECTED! New face count:",
            newFaceCount,
            "BPM:",
            bpm
          );
        }
      }

      // Calculate overall energy (for rotation and shader effects)
      const totalEnergy =
        Array.from(audioData.slice(0, 16)).reduce((sum, val) => sum + val, 0) /
        (16 * 255);

      // Update audio intensity uniform
      if (materialRef.current.uniforms) {
        materialRef.current.uniforms.uAudioIntensity.value = totalEnergy;
      }

      // Apply rotation
      meshRef.current.rotation.x += 0.002 + totalEnergy * 0.005;
      meshRef.current.rotation.y += 0.003 + totalEnergy * 0.005;
    } else {
      // Default animation when not playing
      meshRef.current.rotation.y += 0.002;
      meshRef.current.rotation.x += 0.001;

      // Reset audio intensity uniform
      if (materialRef.current.uniforms) {
        materialRef.current.uniforms.uAudioIntensity.value = 0.0;
      }

      // Reset beat tracking
      lastBeatTimeRef.current = 0;

      // Occasionally change face count when not playing
      if (currentTime > nextDetailChangeRef.current) {
        nextDetailChangeRef.current = currentTime + 2.0;
        const newFaceCount =
          MIN_FACES + Math.floor(Math.random() * (MAX_FACES - MIN_FACES));

        // Force update the mesh geometry directly
        if (meshRef.current && geometries[newFaceCount - MIN_FACES]) {
          meshRef.current.geometry = geometries[newFaceCount - MIN_FACES];
          setFaceCount(newFaceCount);
        }
      }
    }
  });

  // Manually trigger a face change every few seconds if no beats are detected
  // This ensures the visualizer still changes even if beat detection fails
  useEffect(() => {
    if (!isPlaying) return;

    let timeoutId: NodeJS.Timeout;

    const checkForBeats = () => {
      // If we haven't detected any beats in 5 seconds of playback, force a face change
      if (isPlaying && !beatDetectedRef.current) {
        console.log("No beats detected, forcing face change");
        const newFaceCount = getRandomFaceCount();

        if (meshRef.current && geometries[newFaceCount - MIN_FACES]) {
          meshRef.current.geometry = geometries[newFaceCount - MIN_FACES];
          setFaceCount(newFaceCount);
        }
      }

      // Reset beat detection flag and check again in 5 seconds
      beatDetectedRef.current = false;
      timeoutId = setTimeout(checkForBeats, 5000);
    };

    // Start checking after 5 seconds
    timeoutId = setTimeout(checkForBeats, 5000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isPlaying, geometries]);

  // Frosted glass shader with subsurface scattering and noise
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying vec3 vViewPosition;
        
        void main() {
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          
          vec4 modelPosition = modelMatrix * vec4(position, 1.0);
          vec4 viewPosition = viewMatrix * modelPosition;
          vViewPosition = -viewPosition.xyz;
          
          vec4 projectedPosition = projectionMatrix * viewPosition;
          gl_Position = projectedPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying vec3 vViewPosition;
        
        uniform vec3 uColors[${threeColors.length}];
        uniform float uTime;
        uniform float uAudioIntensity;
        
        // Simplex 3D Noise 
        // by Ian McEwan, Ashima Arts
        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
        
        float snoise(vec3 v){ 
          const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
          const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
          
          // First corner
          vec3 i  = floor(v + dot(v, C.yyy) );
          vec3 x0 =   v - i + dot(i, C.xxx) ;
          
          // Other corners
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min( g.xyz, l.zxy );
          vec3 i2 = max( g.xyz, l.zxy );
          
          vec3 x1 = x0 - i1 + 1.0 * C.xxx;
          vec3 x2 = x0 - i2 + 2.0 * C.xxx;
          vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
          
          // Permutations
          i = mod(i, 289.0 ); 
          vec4 p = permute( permute( permute( 
                    i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
                  
          // Gradients
          float n_ = 1.0/7.0; // N=7
          vec3  ns = n_ * D.wyz - D.xzx;
          
          vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)
          
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
          
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          
          vec4 b0 = vec4( x.xy, y.xy );
          vec4 b1 = vec4( x.zw, y.zw );
          
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
          
          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);
          
          // Normalise gradients
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
          
          // Mix final noise value
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                        dot(p2,x2), dot(p3,x3) ) );
        }
        
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
          // View direction for fresnel effect
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 3.0);
          
          // Noise for the frosted glass effect
          float noiseScale = 2.0;
          float noiseTime = uTime * 0.1;
          
          // Create layered noise for a more complex frosted effect
          float noise1 = snoise(vPosition * noiseScale + vec3(noiseTime)) * 0.5 + 0.5;
          float noise2 = snoise(vPosition * noiseScale * 2.0 - vec3(noiseTime * 0.7)) * 0.25 + 0.5;
          float noise3 = snoise(vPosition * noiseScale * 4.0 + vec3(noiseTime * 0.3)) * 0.125 + 0.5;
          
          // Combine noise layers
          float combinedNoise = (noise1 + noise2 + noise3) / 1.875;
          
          // Audio reactivity - make the glass "pulse" with the audio
          float pulseFactor = 1.0 + uAudioIntensity * 0.3;
          combinedNoise *= pulseFactor;
          
          // Base color from gradient
          float gradientFactor = (vPosition.y + ${BASE_SIZE.toFixed(1)}) * ${(
        1.0 /
        (2.0 * BASE_SIZE)
      ).toFixed(6)};
          vec3 baseColor = getGradientColor(gradientFactor);
          
          // Subsurface scattering effect - brighter in the center, reduced intensity
          float sss = 1.0 - length(vPosition) / (${BASE_SIZE.toFixed(1)} * 1.5);
          sss = max(0.0, sss * 1.5) * (0.7 + uAudioIntensity * 0.5); // Reduced base intensity
          
          // Enhanced edge detection for better definition
          float edgeFactor = pow(abs(dot(normalize(vNormal), viewDir)), 1.5);
          
          // Calculate curvature approximation for corners and edges
          float curvature = 1.0 - abs(dot(normalize(vNormal), viewDir));
          curvature = pow(curvature, 3.0); // Enhance the effect at corners
          
          // Combine all effects
          vec3 finalColor = mix(baseColor * 0.4, baseColor * 0.7, combinedNoise);
          
          // Add subsurface scattering glow with reduced intensity
          finalColor += baseColor * sss * 0.6;
          
          // Add fresnel rim effect
          finalColor += baseColor * fresnel * 0.4;
          
          // Adjust brightness based on audio with reduced intensity
          finalColor *= 0.8 + uAudioIntensity * 0.3;
          
          // Enhanced occlusion at edges and corners
          float occlusion = smoothstep(0.0, 0.5, combinedNoise);
          occlusion *= (1.0 - curvature * 0.7); // Darken at corners and edges
          
          // Apply stronger occlusion effect
          finalColor *= mix(0.5, 1.0, occlusion * edgeFactor);
          
          // Add subtle edge highlighting to define shape
          finalColor += baseColor * curvature * 0.15;
          
          // Reduced transparency - increased from 0.9 to 0.95
          gl_FragColor = vec4(finalColor, 0.95);
        }
      `,
      uniforms: {
        uColors: {
          value: threeColors.map((c) => new THREE.Vector3(c.r, c.g, c.b)),
        },
        uTime: { value: 0.0 },
        uAudioIntensity: { value: 0.0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, [threeColors]);

  // Cleanup function
  useEffect(() => {
    // Copy materialRef.current to a variable inside the effect
    const material = materialRef.current;

    return () => {
      geometries.forEach((geo) => geo.dispose());
      if (material) material.dispose();
    };
  }, [geometries]);

  // Initialize
  useEffect(() => {
    setFaceCount(7); // Start with 7 faces
    nextDetailChangeRef.current = 0;
  }, []);

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
