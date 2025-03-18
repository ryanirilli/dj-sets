import { useState, useCallback, useRef } from "react";
import { useAudio } from "@/contexts/AudioContext";
import { useSceneContext } from "@/contexts/SceneContext";
import AudioSelector from "./AudioSelector";
import ColorPaletteSelector from "./ColorPaletteSelector";
import EnvironmentSelector from "./EnvironmentSelector";
import { VisualizerType } from "@/types/visualizers";
import { getVisualizers } from "@/lib/visualizer-registry";
import { Progress } from "@/components/ui/progress";
import { FaPlay, FaPause, FaBars, FaTimes } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/custom-sheet";

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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Main Container */}
      <div className="relative">
        {/* Time and Duration Display - Now above the progress bar */}
        <div className="flex justify-between px-4 py-1 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm">
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
            className="h-1 rounded-none bg-muted"
          />
        </div>

        {/* Bottom Menu Bar - Horizontally aligned with play controls and menu toggle */}
        <div className="flex items-center justify-between p-3 bg-background/80 backdrop-blur-md border-t border-border">
          {/* Empty space on the left for balance */}
          <div className="flex-1"></div>

          {/* Play/Pause Button in center */}
          <div className="flex-1 flex justify-center">
            <Button
              onClick={() => {
                console.log("Play button clicked");
                togglePlayPause();
              }}
              size="icon"
              variant="default"
              className="w-12 h-12 rounded-full"
            >
              {isPlaying ? (
                <FaPause size={18} />
              ) : (
                <FaPlay size={18} className="ml-1" />
              )}
            </Button>
          </div>

          {/* Menu Toggle Button with Sheet */}
          <div className="flex-1 flex justify-end">
            <Button
              onClick={() => setIsOpen(true)}
              variant="secondary"
              size="icon"
            >
              <FaBars size={16} />
            </Button>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetContent
                side="right"
                className="w-full max-w-md p-0 flex flex-col h-full bg-sidebar/80 backdrop-blur-md border-l border-border"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Settings</SheetTitle>
                </SheetHeader>

                {/* Main content area with scrolling */}
                <div className="flex-1 overflow-y-auto pb-16 custom-scrollbar">
                  <div>
                    {/* Visualizers Section */}
                    <div>
                      <Button
                        onClick={() => handleSectionToggle("visualizers")}
                        variant="ghost"
                        className="w-full justify-between py-6 px-6 font-medium text-sidebar-foreground rounded-none hover:bg-transparent"
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
                      </Button>
                      <div
                        className={`overflow-hidden transition-all duration-300 ${
                          openSections.visualizers
                            ? "max-h-96 opacity-100 pb-4"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="flex flex-wrap gap-2 pt-2 px-4">
                          {visualizers.map((visualizer) => (
                            <Button
                              key={visualizer.id}
                              variant={
                                selectedVisualizer === visualizer.id
                                  ? "default"
                                  : "secondary"
                              }
                              size="sm"
                              onClick={() => {
                                onVisualizerChange(visualizer.id);
                              }}
                              title={visualizer.description}
                            >
                              {visualizer.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Environment Section */}
                    <div>
                      <Button
                        onClick={() => handleSectionToggle("environment")}
                        variant="ghost"
                        className="w-full justify-between py-6 px-6 font-medium text-sidebar-foreground rounded-none hover:bg-transparent"
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
                      </Button>
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
                    <div>
                      <Button
                        onClick={() => handleSectionToggle("colors")}
                        variant="ghost"
                        className="w-full justify-between py-6 px-6 font-medium text-sidebar-foreground rounded-none hover:bg-transparent"
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
                      </Button>
                      <div
                        className={`overflow-hidden transition-all duration-300 ${
                          openSections.colors
                            ? "max-h-[500px] opacity-100 pb-4"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="flex flex-col space-y-4 pt-2 px-4">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium leading-none text-sidebar-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              Auto-Cycle Colors
                            </label>
                            <Switch
                              checked={autoRotateColors}
                              onCheckedChange={setAutoRotateColors}
                            />
                          </div>
                          <div className="h-64">
                            <ColorPaletteSelector />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Camera Settings Section */}
                    <div>
                      <Button
                        onClick={() => handleSectionToggle("camera")}
                        variant="ghost"
                        className="w-full justify-between py-6 px-6 font-medium text-sidebar-foreground rounded-none hover:bg-transparent"
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
                      </Button>
                      <div
                        className={`overflow-hidden transition-all duration-300 ${
                          openSections.camera
                            ? "max-h-96 opacity-100 pb-4"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="flex flex-col space-y-4 pt-2 px-4">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium leading-none text-sidebar-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              Auto-Rotate
                            </label>
                            <Switch
                              checked={autoRotate}
                              onCheckedChange={setAutoRotate}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium leading-none text-sidebar-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              Show Grid
                            </label>
                            <Switch
                              checked={showGrid}
                              onCheckedChange={setShowGrid}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium leading-none text-sidebar-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              Show Performance Stats
                            </label>
                            <Switch
                              checked={showPerformanceStats}
                              onCheckedChange={togglePerformanceStats}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Audio Section */}
                    <div>
                      <Button
                        onClick={() => handleSectionToggle("audio")}
                        variant="ghost"
                        className="w-full justify-between py-6 px-6 font-medium text-sidebar-foreground rounded-none hover:bg-transparent"
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
                      </Button>
                      <div
                        className={`overflow-hidden transition-all duration-300 ${
                          openSections.audio
                            ? "max-h-96 opacity-100 pb-4"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="pt-2 px-4">
                          <AudioSelector
                            onSelect={setAudioFile}
                            selectedFile={currentAudioFile}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fixed footer with close button */}
                <div className="sticky bottom-0 left-0 right-0 p-3 backdrop-blur-md bg-sidebar/80 border-t border-border flex items-center justify-end">
                  <SheetClose asChild>
                    <Button variant="secondary" size="icon">
                      <FaTimes size={16} />
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </div>
  );
};

export type { VisualizerType };
