import { useState, useCallback, useRef } from "react";
import { useAudio } from "@/contexts/AudioContext";
import { useSceneContext } from "@/contexts/SceneContext";
import { useSettings } from "@/contexts/SettingsContext";
import AudioSelector from "./AudioSelector";
import ColorPaletteSelector from "./ColorPaletteSelector";
import EnvironmentSelector from "./EnvironmentSelector";
import { VisualizerType, VisualizerInfo } from "@/types/visualizers";
import { Progress } from "@/components/ui/progress";
import {
  FaPlay,
  FaPause,
  FaTimes,
  FaChevronDown,
  FaSlidersH,
  FaSync,
  FaStepForward,
  FaStepBackward,
} from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/custom-sheet";
import { Vector3 } from "three";

interface ToolbarProps {
  selectedVisualizer: VisualizerType;
  onVisualizerChange: (type: VisualizerType) => void;
  visualizersInfo: VisualizerInfo[];
}

export const Toolbar = ({
  selectedVisualizer,
  onVisualizerChange,
  visualizersInfo,
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
    previousTrack,
    nextTrack,
  } = useAudio();

  // Use scene context as a bridge to settings context
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

  // Access settings context for persistent UI state
  const { settings, toggleSectionOpen, updateSettings, updateCameraPosition } =
    useSettings();
  const { openSections } = settings;

  const progressRef = useRef<HTMLDivElement>(null);

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

  // Reset camera to default position
  const resetCamera = useCallback(() => {
    // Default camera position from SettingsContext default values
    const defaultPosition = new Vector3(0, 2, 10);
    const defaultTarget = new Vector3(0, 0, 0);
    updateCameraPosition(defaultPosition, defaultTarget);
  }, [updateCameraPosition]);

  // Use the toggleSectionOpen from settings context
  const handleSectionToggle = (sectionKey: string) => {
    toggleSectionOpen(sectionKey);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 px-4 pb-4">
      {/* Main Container */}
      <div className="relative mx-auto max-w-3xl">
        {/* Bottom Menu Bar with Progress overlay */}
        <div className="relative flex items-center justify-between py-3 bg-background/80 backdrop-blur-xl border border-border/50 pt-5 rounded-xl shadow-lg">
          {/* Time and Duration Display - Floating above the toolbar */}
          <div className="absolute -top-10 left-0 right-0 flex justify-between text-xs font-medium mx-2 z-10">
            <span className="bg-background/90 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-lg">
              {formatTime(currentTime)}
            </span>
            <span className="bg-background/90 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-lg">
              {formatTime(duration)}
            </span>
          </div>

          {/* Progress Bar - Now on top of the bottom bar and full bleed */}
          <div
            className="absolute top-0 left-0 right-0 cursor-pointer"
            onClick={handleProgressClick}
            ref={progressRef}
          >
            <Progress
              value={progressPercentage}
              className="h-1.5 rounded-none bg-muted/50"
            />
          </div>

          {/* Empty space on the left for balance */}
          <div className="flex-1"></div>

          {/* Play/Pause Button in center with next/prev controls, more spread out */}
          <div className="flex-1 flex justify-center items-center space-x-6">
            <Button
              onClick={previousTrack}
              size="icon"
              variant="ghost"
              className="rounded-full w-8 h-8"
            >
              <FaStepBackward size={14} />
            </Button>

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

            <Button
              onClick={nextTrack}
              size="icon"
              variant="ghost"
              className="rounded-full w-8 h-8"
            >
              <FaStepForward size={14} />
            </Button>
          </div>

          {/* Menu Toggle Button with Sheet */}
          <div className="flex-1 flex justify-end">
            <Button
              onClick={() => setIsOpen(true)}
              variant="ghost"
              className="rounded-full"
            >
              <FaSlidersH size={16} />
            </Button>
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetContent
                side="right"
                className="w-full max-w-md p-0 flex flex-col h-full bg-sidebar/80 backdrop-blur-md border-l border-border rounded-l-xl"
              >
                <div className="p-4 flex justify-between items-center border-b border-border">
                  <h2 className="text-sidebar-foreground font-medium">
                    Settings
                  </h2>
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full"
                    >
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
                        className="w-full justify-between py-6 px-6 font-medium text-sidebar-foreground hover:bg-background/10 rounded-lg border-b border-border/50"
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
                            ? "max-h-96 opacity-100 pb-4 mt-2"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="flex flex-wrap gap-2 pt-2 px-6 bg-background/10 rounded-lg mx-2 p-3">
                          {visualizersInfo.map((visualizer) => (
                            <Button
                              key={visualizer.id}
                              variant={
                                selectedVisualizer === visualizer.id
                                  ? "default"
                                  : "secondary"
                              }
                              size="sm"
                              className="rounded-full"
                              onClick={() => {
                                console.log(
                                  "[DEBUG] Toolbar visualizer button clicked:",
                                  visualizer.id
                                );
                                console.log(
                                  "[DEBUG] Current selected visualizer:",
                                  selectedVisualizer
                                );
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
                        className="w-full justify-between py-6 px-6 font-medium text-sidebar-foreground hover:bg-background/10 rounded-lg border-b border-border/50"
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
                            ? "max-h-96 opacity-100 pb-4 mt-2"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="pt-2 px-2 bg-background/10 rounded-lg mx-2 p-3">
                          <EnvironmentSelector />
                        </div>
                      </div>
                    </div>

                    {/* Color Palette Section */}
                    <div>
                      <Button
                        onClick={() => handleSectionToggle("colors")}
                        variant="ghost"
                        className="w-full justify-between py-6 px-6 font-medium text-sidebar-foreground hover:bg-background/10 rounded-lg border-b border-border/50"
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
                            ? "max-h-[500px] opacity-100 pb-4 mt-2"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="flex flex-col space-y-4 pt-2 px-4 bg-background/10 rounded-lg mx-2 p-3">
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
                        className="w-full justify-between py-6 px-6 font-medium text-sidebar-foreground hover:bg-background/10 rounded-lg border-b border-border/50"
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
                            ? "max-h-96 opacity-100 pb-4 mt-2"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="flex flex-col space-y-4 pt-2 px-4 bg-background/10 rounded-lg mx-2 p-3">
                          <div className="flex justify-start mb-2">
                            <Button
                              onClick={resetCamera}
                              className="flex items-center justify-center gap-2 text-xs rounded-full"
                              variant="outline"
                              size="sm"
                            >
                              <FaSync size={12} />
                              Reset Camera Position
                            </Button>
                          </div>

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
                        className="w-full justify-between py-6 px-6 font-medium text-sidebar-foreground hover:bg-background/10 rounded-lg border-b border-border/50"
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
                            ? "max-h-96 opacity-100 pb-4 mt-2"
                            : "max-h-0 opacity-0"
                        }`}
                      >
                        <div className="pt-2 px-2 bg-background/10 rounded-lg mx-2 p-3">
                          <AudioSelector
                            onSelect={(file) => {
                              console.log(
                                "[DEBUG] Audio file selected in toolbar:",
                                file
                              );
                              setAudioFile(file);
                              // Also update the settings to persist the selection in URL
                              updateSettings("selectedAudioFile", file);
                            }}
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
