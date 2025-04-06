"use client";

import { createContext, useState, useContext, ReactNode } from "react";

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

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  return (
    <FullScreenContext.Provider
      value={{ isFullScreen, setIsFullScreen, toggleFullScreen }}
    >
      {children}
    </FullScreenContext.Provider>
  );
};
