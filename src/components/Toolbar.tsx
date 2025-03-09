import { useState } from "react";
import { useAudio } from "@/contexts/AudioContext";
import { useSceneContext } from "@/contexts/SceneContext";
import AudioSelector from "./AudioSelector";

export type VisualizerType = "circular" | "waveform" | "smoke";

interface ToolbarProps {
  selectedVisualizer: VisualizerType;
  onVisualizerChange: (type: VisualizerType) => void;
}

export const Toolbar = ({
  selectedVisualizer,
  onVisualizerChange,
}: ToolbarProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { setAudioFile, currentAudioFile } = useAudio();
  const { autoRotate, setAutoRotate } = useSceneContext();

  return (
    <div className="fixed right-4 bottom-4 md:right-6 md:bottom-6 z-50">
      {/* Main Container */}
      <div className="relative flex flex-col items-end">
        {/* Toolbar Panel */}
        <div
          className={`bg-black/80 backdrop-blur-md rounded-lg p-4 mb-4 transition-all duration-300 ease-in-out ${
            isExpanded
              ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
              : "opacity-0 scale-95 translate-y-4 pointer-events-none"
          }`}
        >
          <div className="flex flex-col space-y-4">
            <div className="text-white font-medium mb-2">Visualizer</div>
            <div className="flex space-x-2">
              <button
                className={`px-3 py-1.5 rounded-md text-sm ${
                  selectedVisualizer === "circular"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
                onClick={() => onVisualizerChange("circular")}
              >
                Circular
              </button>
              <button
                className={`px-3 py-1.5 rounded-md text-sm ${
                  selectedVisualizer === "waveform"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
                onClick={() => onVisualizerChange("waveform")}
              >
                Waveform
              </button>
              <button
                className={`px-3 py-1.5 rounded-md text-sm ${
                  selectedVisualizer === "smoke"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
                onClick={() => onVisualizerChange("smoke")}
              >
                Smoke
              </button>
            </div>

            {/* Auto-Rotation Toggle */}
            <div className="flex flex-col space-y-2">
              <div className="text-white font-medium">Camera</div>
              <div className="flex items-center">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={autoRotate}
                    onChange={(e) => setAutoRotate(e.target.checked)}
                  />
                  <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                  <span className="ms-3 text-sm font-medium text-gray-300">
                    Auto-Rotate
                  </span>
                </label>
              </div>
            </div>

            <div className="text-white font-medium mb-2">Audio</div>
            <AudioSelector
              onSelect={setAudioFile}
              selectedFile={currentAudioFile}
            />
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="bg-black/80 backdrop-blur-md text-white p-3 rounded-full shadow-lg hover:bg-black/90 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={
                isExpanded ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"
              }
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
