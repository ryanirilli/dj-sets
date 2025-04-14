const { contextBridge } = require("electron");

// Expose a simple flag to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
});
