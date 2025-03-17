import React from "react";

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
  // Determine performance level based on FPS
  const getFpsStatus = (fps: number): { color: string; label: string } => {
    if (fps >= 55) return { color: "text-green-400", label: "Excellent" };
    if (fps >= 45) return { color: "text-green-300", label: "Good" };
    if (fps >= 30) return { color: "text-yellow-300", label: "Fair" };
    if (fps >= 20) return { color: "text-orange-400", label: "Poor" };
    return { color: "text-red-500", label: "Critical" };
  };

  const fpsStatus = getFpsStatus(fps);

  // Format large numbers with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white p-3 text-xs font-mono z-50 rounded-md border border-gray-700 shadow-lg max-w-[200px]">
      <div className="text-center font-semibold border-b border-gray-700 pb-1 mb-2">
        Performance Monitor
      </div>

      <div className="flex items-center justify-between mb-1">
        <span
          className="text-gray-400"
          title="Frames Per Second - Higher is better"
        >
          FPS:
        </span>
        <span className={`font-bold ${fpsStatus.color}`}>
          {fps}{" "}
          <span className="text-[10px] opacity-80">({fpsStatus.label})</span>
        </span>
      </div>

      <div className="flex items-center justify-between mb-1">
        <span
          className="text-gray-400"
          title="Number of geometry objects in memory"
        >
          Geometries:
        </span>
        <span
          className={geometries > 1000 ? "text-yellow-300" : "text-gray-200"}
        >
          {formatNumber(geometries)}
        </span>
      </div>

      <div className="flex items-center justify-between mb-1">
        <span
          className="text-gray-400"
          title="Number of texture objects in memory"
        >
          Textures:
        </span>
        <span className={textures > 50 ? "text-yellow-300" : "text-gray-200"}>
          {formatNumber(textures)}
        </span>
      </div>

      {triangles > 0 && (
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-gray-400"
            title="Number of triangles being rendered"
          >
            Triangles:
          </span>
          <span
            className={
              triangles > 1000000 ? "text-yellow-300" : "text-gray-200"
            }
          >
            {formatNumber(triangles)}
          </span>
        </div>
      )}

      {calls > 0 && (
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-gray-400"
            title="Number of draw calls per frame"
          >
            Draw Calls:
          </span>
          <span className={calls > 100 ? "text-yellow-300" : "text-gray-200"}>
            {formatNumber(calls)}
          </span>
        </div>
      )}

      <div className="mt-2 pt-1 border-t border-gray-700 text-[9px] text-gray-500">
        <div className="mb-1">
          Higher values for geometries and textures may indicate memory leaks
        </div>
        <div>Many draw calls can impact performance</div>
      </div>
    </div>
  );
};

export default StatsDisplay;
