import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useColorPalette } from "@/hooks/useColorPalette";
import { useAudio } from "@/contexts/AudioContext";

const BASE_GEOMETRY_SIZE = 2.0;
const MIN_FACES = 3;
const MAX_FACES = 15;
const DEFAULT_FACES = 7;
const AVG_AUDIO_DATA_THRESHOLD = 25;

function createPolyhedronWithFaces(
  targetFaces: number,
  radius: number
): THREE.BufferGeometry {
  let geometry;

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
    geometry = new THREE.SphereGeometry(radius, 8 + detail * 2, 6 + detail * 2);
  }

  return geometry;
}

const IcosahedronVisualizer = () => {
  const {
    isPlaying,
    onBeat,
    beatTime,
    currentAudioFile,
    audioData,
    avgAudioLevel,
  } = useAudio();
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const { threeColors } = useColorPalette();

  const [faceCount, setFaceCount] = useState(DEFAULT_FACES);
  const nextDetailChangeRef = useRef(0);
  const timeRef = useRef(0);

  const lastBeatTimeRef = useRef(0);
  const beatDetectedRef = useRef(false);

  const geometries = useMemo(() => {
    const geos = [];

    for (let faceCount = MIN_FACES; faceCount <= MAX_FACES; faceCount++) {
      const geometry = createPolyhedronWithFaces(faceCount, BASE_GEOMETRY_SIZE);
      geos.push(geometry);
    }

    return geos;
  }, []);

  // Reset state when audio track changes
  useEffect(() => {
    lastBeatTimeRef.current = 0;
    beatDetectedRef.current = false;

    if (meshRef.current && geometries[DEFAULT_FACES - MIN_FACES]) {
      meshRef.current.geometry = geometries[DEFAULT_FACES - MIN_FACES];
    }

    nextDetailChangeRef.current = 0;
  }, [currentAudioFile, geometries]);

  const getRandomFaceCount = () => {
    // Get current face count
    const currentFaceCount = faceCount;

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

        const newFaceCount = getRandomFaceCount();

        // Force update the mesh geometry directly
        if (
          meshRef.current &&
          geometries[newFaceCount - MIN_FACES] &&
          avgAudioLevel > AVG_AUDIO_DATA_THRESHOLD
        ) {
          meshRef.current.geometry = geometries[newFaceCount - MIN_FACES];
          setFaceCount(newFaceCount);
        }
      }

      const totalEnergy = Math.pow(
        Array.from(audioData.slice(0, 64)).reduce((sum, val) => sum + val, 0) /
          (32 * 255),
        0.5
      );

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
    }
  });

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
          float gradientFactor = (vPosition.y + ${BASE_GEOMETRY_SIZE.toFixed(
            1
          )}) * ${(1.0 / (2.0 * BASE_GEOMETRY_SIZE)).toFixed(6)};
          vec3 baseColor = getGradientColor(gradientFactor);
          
          // Subsurface scattering effect - brighter in the center, reduced intensity
          float sss = 1.0 - length(vPosition) / (${BASE_GEOMETRY_SIZE.toFixed(
            1
          )} * 1.5);
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
