import { useState, useEffect, useCallback, useRef } from "react";
import { useAudio } from "@/contexts/AudioContext";
import { useSceneContext } from "@/contexts/SceneContext";
import AudioSelector from "./AudioSelector";
import ColorPaletteSelector from "./ColorPaletteSelector";
import EnvironmentSelector from "./EnvironmentSelector";
import { VisualizerType } from "@/types/visualizers";
import { getVisualizers } from "@/lib/visualizer-registry";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { FaPlay, FaPause, FaBars, FaTimes } from "react-icons/fa";

interface ToolbarProps {
  selectedVisualizer: VisualizerType;
  onVisualizerChange: (type: VisualizerType) => void;
}

export const Toolbar = ({
  selectedVisualizer,
  onVisualizerChange,
}: ToolbarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    setAudioFile,
    currentAudioFile,
    isPlaying,
    togglePlayPause,
    currentTime,
    duration,
    audioRef,
  } = useAudio();
  const {
    autoRotate,
    setAutoRotate,
    showGrid,
    setShowGrid,
    autoRotateColors,
    setAutoRotateColors,
    environment,
    backgroundBlurriness,
    backgroundIntensity,
    showPerformanceStats,
    togglePerformanceStats,
  } = useSceneContext();
  const visualizers = getVisualizers();
  const progressRef = useRef<HTMLDivElement>(null);

  // Track which sections are open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    visualizers: true,
    camera: false,
    colors: false,
    audio: false,
    environment: false,
  });

  // Format time in minutes:seconds
  const formatTime = useCallback((time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  // Calculate progress percentage
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Handle click on progress bar to seek
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !audioRef.current || duration <= 0) return;

      const rect = progressRef.current.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      const newTime = clickPosition * duration;

      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
      }
    },
    [audioRef, duration]
  );

  const handleSectionToggle = (value: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [value]: !prev[value],
    }));
  };

  // Log audio state for debugging
  useEffect(() => {
    console.log("Audio state:", {
      currentAudioFile,
      isPlaying,
      currentTime,
      duration,
      audioElement: audioRef.current,
    });
  }, [currentAudioFile, isPlaying, currentTime, duration, audioRef]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Main Container */}
      <div className="relative">
        {/* Time and Duration Display - Now above the progress bar */}
        <div className="flex justify-between px-4 py-1 text-xs text-gray-400 bg-black/80">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Progress Bar - Now flush with the bottom toolbar */}
        <div
          className="w-full cursor-pointer"
          onClick={handleProgressClick}
          ref={progressRef}
        >
          <Progress
            value={progressPercentage}
            className="h-1 rounded-none bg-gray-800"
          />
        </div>

        {/* Bottom Menu Bar - Horizontally aligned with play controls and menu toggle */}
        <div className="flex items-center justify-between p-3 bg-black/80 backdrop-blur-md border-t border-gray-800">
          {/* Empty space on the left for balance */}
          <div className="flex-1"></div>

          {/* Play/Pause Button in center */}
          <div className="flex-1 flex justify-center">
            <button
              onClick={() => {
                console.log("Play button clicked");
                togglePlayPause();
              }}
              className="flex items-center justify-center w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full ring-1 ring-inset ring-white/10 transition-all duration-200"
            >
              {isPlaying ? (
                <FaPause size={18} />
              ) : (
                <FaPlay size={18} className="ml-1" />
              )}
            </button>
          </div>

          {/* Menu Toggle Button with Popover */}
          <div className="flex-1 flex justify-end">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                <button className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg ring-1 ring-inset ring-white/10 transition-all duration-200">
                  {isOpen ? <FaTimes size={16} /> : <FaBars size={16} />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="end" sideOffset={16}>
                <div className="w-full">
                  {/* Visualizers Section */}
                  <div className="border-b border-gray-700">
                    <button
                      onClick={() => handleSectionToggle("visualizers")}
                      className="flex justify-between items-center w-full py-4 px-4 font-medium text-white"
                    >
                      Visualizers
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 transition-transform duration-200 ${
                          openSections.visualizers ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-300 ${
                        openSections.visualizers
                          ? "max-h-96 opacity-100 pb-4"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="flex flex-wrap gap-2 pt-2 px-4">
                        {visualizers.map((visualizer) => (
                          <button
                            key={visualizer.id}
                            className={`px-3 py-1.5 rounded-md text-sm ${
                              selectedVisualizer === visualizer.id
                                ? "bg-blue-500 text-white"
                                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            }`}
                            onClick={() => {
                              onVisualizerChange(visualizer.id);
                              // Optionally close the popover after selection
                              // setIsOpen(false);
                            }}
                            title={visualizer.description}
                          >
                            {visualizer.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Environment Section - NEW */}
                  <div className="border-b border-gray-700">
                    <button
                      onClick={() => handleSectionToggle("environment")}
                      className="flex justify-between items-center w-full py-4 px-4 font-medium text-white"
                    >
                      Environment
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 transition-transform duration-200 ${
                          openSections.environment ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-300 ${
                        openSections.environment
                          ? "max-h-96 opacity-100 pb-4"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="pt-2 px-4">
                        <EnvironmentSelector />
                      </div>
                    </div>
                  </div>

                  {/* Color Palette Section */}
                  <div className="border-b border-gray-700">
                    <button
                      onClick={() => handleSectionToggle("colors")}
                      className="flex justify-between items-center w-full py-4 px-4 font-medium text-white"
                    >
                      Color Palette
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 transition-transform duration-200 ${
                          openSections.colors ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-300 ${
                        openSections.colors
                          ? "max-h-96 opacity-100 pb-4"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="flex flex-col space-y-4 pt-2 px-4">
                        <div className="flex items-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={autoRotateColors}
                              onChange={(e) =>
                                setAutoRotateColors(e.target.checked)
                              }
                            />
                            <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                            <span className="ms-3 text-sm font-medium text-gray-300">
                              Auto-Cycle Colors
                            </span>
                          </label>
                        </div>
                        <div className="h-64">
                          <ColorPaletteSelector />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Camera Settings Section */}
                  <div className="border-b border-gray-700">
                    <button
                      onClick={() => handleSectionToggle("camera")}
                      className="flex justify-between items-center w-full py-4 px-4 font-medium text-white"
                    >
                      Camera Settings
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 transition-transform duration-200 ${
                          openSections.camera ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-300 ${
                        openSections.camera
                          ? "max-h-96 opacity-100 pb-4"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="flex flex-col space-y-4 pt-2 px-4">
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

                        <div className="flex items-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={showGrid}
                              onChange={(e) => setShowGrid(e.target.checked)}
                            />
                            <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                            <span className="ms-3 text-sm font-medium text-gray-300">
                              Show Grid
                            </span>
                          </label>
                        </div>

                        <div className="flex items-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={showPerformanceStats}
                              onChange={togglePerformanceStats}
                            />
                            <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                            <span className="ms-3 text-sm font-medium text-gray-300">
                              Show Performance Stats
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Audio Section */}
                  <div>
                    <button
                      onClick={() => handleSectionToggle("audio")}
                      className="flex justify-between items-center w-full py-4 px-4 font-medium text-white"
                    >
                      Audio
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 transition-transform duration-200 ${
                          openSections.audio ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-300 ${
                        openSections.audio
                          ? "max-h-96 opacity-100 pb-4"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <div
                        className={`pt-2 px-4 ${
                          openSections.audio ? "" : "pointer-events-none"
                        }`}
                      >
                        <AudioSelector
                          onSelect={setAudioFile}
                          selectedFile={currentAudioFile}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </div>
  );
};

export type { VisualizerType };
