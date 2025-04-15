import { useState, useEffect } from "react";

// Make the global Window interface consistent across files
declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
    };
  }
}

export const useIsElectron = () => {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if the electronAPI is exposed on the window object
    const checkElectron = () => {
      // Ensure window.electronAPI exists before accessing isElectron
      setIsElectron(
        typeof window !== "undefined" && !!window.electronAPI?.isElectron
      );
    };

    // Initial check
    checkElectron();

    // Optional: Listen for an event if the API could be loaded asynchronously
    // window.addEventListener("electronApiReady", checkElectron);
    // return () => window.removeEventListener("electronApiReady", checkElectron);
  }, []);

  return isElectron;
};
