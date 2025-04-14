import { useState, useCallback, useRef, useEffect } from "react";
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
  FaExpand,
  FaCompress,
} from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/custom-sheet";
import { Vector3 } from "three";
import type { MediaDeviceInfo } from "../types/audio";
import { useIsElectron } from "../../hooks/useIsElectron";

interface ToolbarProps {
  selectedVisualizer: VisualizerType;
  onVisualizerChange: (type: VisualizerType) => void;
  visualizersInfo: VisualizerInfo[];
  isFullScreen?: boolean;
  toggleFullScreen?: () => void;
}

export const Toolbar = ({
  selectedVisualizer,
  onVisualizerChange,
  visualizersInfo,
  isFullScreen = false,
  toggleFullScreen,
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
    setInputType,
    availableInputs,
    selectedInput,
    setSelectedInput,
  } = useAudio();
  const isElectron = useIsElectron();

  // Automatically set input type based on environment
  useEffect(() => {
    if (isElectron) {
      setInputType("system");
    } else {
      setInputType("file");
    }
  }, [isElectron, setInputType]);

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
    editMode,
    toggleEditMode,
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

  // Define reusable buttons
  const settingsButton = (
    <Button
      onClick={() => setIsOpen(true)}
      variant="ghost"
      className="rounded-full"
      title="Settings"
    >
      <FaSlidersH size={16} />
    </Button>
  );

  const fullScreenButton = toggleFullScreen && (
    <Button
      onClick={toggleFullScreen}
      variant="ghost"
      className="rounded-full"
      title={
        isFullScreen ? "Press ESC to exit" : "Enter Full Screen (ESC to exit)"
      }
    >
      {isFullScreen ? <FaCompress size={16} /> : <FaExpand size={16} />}
    </Button>
  );

  return (
    // Use fragment to hold Sheet outside conditional rendering
    <>
      {isElectron ? (
        // Electron: Floating buttons bottom-right
        <div className="absolute bottom-4 right-4 z-50 flex space-x-2">
          {fullScreenButton}
          {settingsButton}
        </div>
      ) : (
        // Non-Electron: Full centered toolbar
        <div className="absolute bottom-0 left-0 right-0 z-50 px-4 pb-4">
          <div className="relative mx-auto max-w-3xl">
            {/* Bottom Menu Bar with Progress overlay */}
            <div className="relative flex items-center justify-between py-3 bg-background/40 backdrop-blur-xl pt-5 rounded-xl">
              {/* Time and Duration Display - Floating above the toolbar */}
              <div className="absolute -top-10 left-0 right-0 flex justify-between text-xs font-medium mx-2 z-10">
                <span className="bg-background/40 backdrop-blur-md text-white px-4 py-2 rounded-full pointer-events-none">
                  {formatTime(currentTime)}
                </span>
                <span className="bg-background/40 backdrop-blur-md text-white px-4 py-2 rounded-full pointer-events-none">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Progress Bar - Now on top of the bottom bar with rounded top corners */}
              <div
                className="absolute top-0 left-0 right-0 cursor-pointer rounded-t-sm bg-muted/50"
                onClick={handleProgressClick}
                ref={progressRef}
              >
                <Progress
                  value={progressPercentage}
                  className="h-1.5 rounded-b-none"
                />
              </div>

              {/* Empty space on the left for balance */}
              <div className="flex-1"></div>

              {/* Center controls container with play/pause and previous/next */}
              <div className="flex space-x-2 items-center px-4">
                <Button
                  onClick={previousTrack}
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  disabled={!currentAudioFile}
                  title="Previous Track"
                >
                  <FaStepBackward size={12} />
                </Button>

                <Button
                  onClick={togglePlayPause}
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-12 w-12 flex items-center justify-center"
                  disabled={!currentAudioFile}
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <FaPause size={18} /> : <FaPlay size={18} />}
                </Button>

                <Button
                  onClick={nextTrack}
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  disabled={!currentAudioFile}
                  title="Next Track"
                >
                  <FaStepForward size={12} />
                </Button>
              </div>

              {/* Right side container with settings button - Use reusable buttons */}
              <div className="flex-1 flex justify-end space-x-2 pr-2">
                {fullScreenButton}
                {settingsButton}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Sheet - Always rendered, controlled by isOpen state */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-md p-0 flex flex-col h-full bg-sidebar/80 backdrop-blur-md border-l border-border rounded-l-xl"
        >
          <div className="p-4 flex justify-between items-center border-b border-border">
            <h2 className="text-sidebar-foreground font-medium">Settings</h2>
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

                    {/* Conditionally render Edit Mode toggle */}
                    {isElectron && (
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium leading-none text-sidebar-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Edit Mode
                        </label>
                        <Switch
                          checked={editMode}
                          onCheckedChange={toggleEditMode}
                        />
                      </div>
                    )}
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
                  <div className="pt-2 px-6 bg-background/10 rounded-lg">
                    <div className="flex flex-col space-y-4">
                      {/* Show file selector ONLY if NOT in Electron */}
                      {!isElectron && (
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
                      )}

                      {/* Show system input selector ONLY if IN Electron */}
                      {isElectron && (
                        <div className="flex flex-col space-y-2">
                          <label className="text-sm font-medium leading-none text-sidebar-foreground">
                            System Audio Input Device
                          </label>
                          <select
                            className="w-full p-2 rounded-md bg-background/50 border border-border text-sm"
                            value={selectedInput?.deviceId || ""}
                            onChange={(e) => {
                              const device = availableInputs.find(
                                (d: MediaDeviceInfo) =>
                                  d.deviceId === e.target.value
                              );
                              if (device) {
                                setSelectedInput(device);
                              }
                            }}
                          >
                            {availableInputs.length > 0 ? (
                              availableInputs.map((device: MediaDeviceInfo) => (
                                <option
                                  key={device.deviceId}
                                  value={device.deviceId}
                                >
                                  {device.label ||
                                    `Input ${device.deviceId.slice(0, 5)}`}
                                </option>
                              ))
                            ) : (
                              <option disabled>No input devices found</option>
                            )}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
