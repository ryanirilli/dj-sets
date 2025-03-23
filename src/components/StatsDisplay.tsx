import React, { useEffect, useState } from "react";

interface StatsDisplayProps {
  fps: number;
  geometries: number;
  textures: number;
  triangles?: number;
  calls?: number;
}

/**
 * Component to display performance statistics outside the Three.js canvas
 */
const StatsDisplay: React.FC<StatsDisplayProps> = ({
  fps,
  geometries,
  textures,
  triangles = 0,
  calls = 0,
}) => {
  // Keep a small history of FPS values to smooth out the display
  const [smoothedFps, setSmoothedFps] = useState(fps);

  useEffect(() => {
    // Smooth FPS updates
    if (fps > 0) {
      setSmoothedFps((prev) => Math.round((prev * 2 + fps) / 3));
    }
  }, [fps]);

  // Format large numbers with commas
  const formatNumber = (num: number): string => num.toLocaleString();

  // Determine color based on performance
  const getFpsColor = (fps: number): string => {
    if (fps >= 55) return "text-green-400";
    if (fps >= 45) return "text-green-300";
    if (fps >= 30) return "text-yellow-300";
    if (fps >= 20) return "text-orange-400";
    return "text-red-500";
  };

  return (
    <div className="fixed top-2 right-2 bg-black/80 text-white p-2 text-xs font-mono z-50 rounded-md border border-gray-700 shadow-lg">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <span className="text-gray-400">FPS:</span>
        <span className={`${getFpsColor(smoothedFps)} text-right font-bold`}>
          {smoothedFps}
        </span>

        <span className="text-gray-400">GEO:</span>
        <span className="text-right">{formatNumber(geometries)}</span>

        <span className="text-gray-400">TEX:</span>
        <span className="text-right">{formatNumber(textures)}</span>

        {triangles > 0 && (
          <>
            <span className="text-gray-400">TRI:</span>
            <span className="text-right">{formatNumber(triangles)}</span>
          </>
        )}

        {calls > 0 && (
          <>
            <span className="text-gray-400">CALLS:</span>
            <span className="text-right">{formatNumber(calls)}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default StatsDisplay;
