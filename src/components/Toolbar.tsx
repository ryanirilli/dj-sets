import { useState } from "react";
import { useAudio } from "@/contexts/AudioContext";
import AudioSelector from "./AudioSelector";

export type VisualizerType = "circular" | "waveform";

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

  return (
    <div className="fixed right-4 bottom-4 md:right-6 md:bottom-6 z-50">
      {/* Main Container */}
      <div className="relative flex flex-col items-end">
        {/* Toolbar Panel */}
        <div
          className={`
            mb-4 origin-bottom-right
            bg-black/90 backdrop-blur-md
            rounded-2xl ring-1 ring-white/10
            shadow-2xl
            transition-all duration-300 ease-out
            ${
              isExpanded
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-95 translate-y-4 pointer-events-none"
            }
            w-72 sm:w-80 p-4 space-y-4
          `}
        >
          {/* Visualizer Selection */}
          <div className="space-y-2.5">
            <label className="text-sm font-medium text-white/80">
              Visualization Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onVisualizerChange("circular")}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ring-1 ring-inset
                  ${
                    selectedVisualizer === "circular"
                      ? "bg-white/10 text-white ring-white/20"
                      : "bg-black/40 text-white/60 ring-white/5 hover:bg-black/60 hover:text-white/80"
                  }
                `}
              >
                Circular
              </button>
              <button
                onClick={() => onVisualizerChange("waveform")}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ring-1 ring-inset
                  ${
                    selectedVisualizer === "waveform"
                      ? "bg-white/10 text-white ring-white/20"
                      : "bg-black/40 text-white/60 ring-white/5 hover:bg-black/60 hover:text-white/80"
                  }
                `}
              >
                Waveform
              </button>
            </div>
          </div>

          {/* Audio File Selection */}
          <div className="space-y-2.5">
            <label className="text-sm font-medium text-white/80">
              Audio Track
            </label>
            <AudioSelector
              onSelect={setAudioFile}
              selectedFile={currentAudioFile}
            />
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            w-12 h-12 md:w-14 md:h-14
            rounded-full 
            bg-black/90 backdrop-blur-md
            ring-1 ring-white/10
            shadow-lg
            text-white/80 hover:text-white
            transition-all duration-200
            flex items-center justify-center
          `}
        >
          <svg
            className={`w-5 h-5 transform transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
