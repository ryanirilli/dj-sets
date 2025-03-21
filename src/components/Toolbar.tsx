import { useState, useCallback, useRef } from "react";
import { useAudio } from "@/contexts/AudioContext";
import { useSceneContext } from "@/contexts/SceneContext";
import AudioSelector from "./AudioSelector";
import ColorPaletteSelector from "./ColorPaletteSelector";
import EnvironmentSelector from "./EnvironmentSelector";
import { VisualizerType } from "@/types/visualizers";
import { getVisualizers } from "@/lib/visualizer-registry";
import { Progress } from "@/components/ui/progress";
import {
  FaPlay,
  FaPause,
  FaBars,
  FaTimes,
  FaChevronDown,
} from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/custom-sheet";

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
        {/* Bottom Menu Bar with Progress overlay */}
        <div className="relative flex items-center justify-between p-3 bg-background/80 backdrop-blur-md border-t border-border pt-5">
          {/* Progress Bar - Now on top of the bottom bar */}
          <div
            className="absolute top-0 left-0 right-0 cursor-pointer"
            onClick={handleProgressClick}
            ref={progressRef}
          >
            <Progress
              value={progressPercentage}
              className="h-1 rounded-none bg-muted"
            />
          </div>

          {/* Time and Duration Display - Floating on top of the toolbar */}
          <div className="absolute -top-8 left-0 right-0 flex justify-between text-xs text-white font-medium py-1 rounded-t-md mx-4 backdrop-blur-sm">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

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
              variant="ghost"
              size="icon"
              className="h-9 w-9"
            >
              <FaBars size={16} />
            </Button>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetContent
                side="right"
                className="w-full max-w-md p-0 flex flex-col h-full bg-sidebar/80 backdrop-blur-md border-l border-border"
              >
                <div className="p-4 flex justify-between items-center border-b border-border">
                  <h2 className="text-sidebar-foreground font-medium">
                    Settings
                  </h2>
                  <SheetClose asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <FaTimes size={16} />
                    </Button>
                  </SheetClose>
                </div>

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
                        <FaChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${
                            openSections.visualizers ? "rotate-180" : ""
                          }`}
                        />
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
                        <FaChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${
                            openSections.environment ? "rotate-180" : ""
                          }`}
                        />
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
                        <FaChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${
                            openSections.colors ? "rotate-180" : ""
                          }`}
                        />
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
                        <FaChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${
                            openSections.camera ? "rotate-180" : ""
                          }`}
                        />
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
                        <FaChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${
                            openSections.audio ? "rotate-180" : ""
                          }`}
                        />
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
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </div>
  );
};

export type { VisualizerType };
