import { useState, useEffect } from "react";

/**
 * Custom hook to determine if the application is running within an Electron environment.
 *
 * It checks for the `electronAPI` object exposed on the `window` object by the preload script.
 *
 * @returns {boolean} True if running in Electron, false otherwise.
 */
export function useIsElectron(): boolean {
  const [isElectronEnv, setIsElectronEnv] = useState<boolean>(false);

  useEffect(() => {
    // Check if running in a browser environment first
    if (typeof window !== "undefined") {
      // The electronAPI is exposed globally by the preload script (electron/preload.js)
      const isRunningInElectron = !!(window as any).electronAPI?.isElectron;
      setIsElectronEnv(isRunningInElectron);
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  return isElectronEnv;
}
