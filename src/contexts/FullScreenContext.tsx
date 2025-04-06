"use client";

import {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";

interface FullScreenContextType {
  isFullScreen: boolean;
  setIsFullScreen: (value: boolean) => void;
  toggleFullScreen: () => void;
}

const FullScreenContext = createContext<FullScreenContextType | undefined>(
  undefined
);

export const useFullScreen = () => {
  const context = useContext(FullScreenContext);
  if (!context) {
    throw new Error("useFullScreen must be used within a FullScreenProvider");
  }
  return context;
};

interface FullScreenProviderProps {
  children: ReactNode;
}

export const FullScreenProvider = ({ children }: FullScreenProviderProps) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Toggle full screen
  const toggleFullScreen = () => {
    const newValue = !isFullScreen;
    setIsFullScreen(newValue);

    if (newValue) {
      // Enter browser fullscreen mode
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.error(
            `Error attempting to enable full-screen mode: ${err.message}`
          );
        });
      }
    } else {
      // Exit browser fullscreen mode
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.error(
            `Error attempting to exit full-screen mode: ${err.message}`
          );
        });
      }
    }
  };

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isFullScreen) {
        setIsFullScreen(false);
      }
    };

    // Handle browser's built-in fullscreen change events
    const handleFullscreenChange = () => {
      // If browser fullscreen was exited, update our state
      if (!document.fullscreenElement && isFullScreen) {
        setIsFullScreen(false);
      }
    };

    // Add event listeners
    document.addEventListener("keydown", handleEscKey);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // Cleanup function
    return () => {
      document.removeEventListener("keydown", handleEscKey);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isFullScreen]);

  return (
    <FullScreenContext.Provider
      value={{ isFullScreen, setIsFullScreen, toggleFullScreen }}
    >
      {children}
    </FullScreenContext.Provider>
  );
};
