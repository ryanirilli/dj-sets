const { app, BrowserWindow } = require("electron");
const path = require("path");
const isDev = process.env.NODE_ENV !== "production";

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Disable background throttling
    },
  });

  const loadURL = isDev ? "http://localhost:3000" : "YOUR_PRODUCTION_URL"; // Replace with your production URL

  // Validate URL before loading
  try {
    new URL(loadURL); // Check if it's a valid URL
    mainWindow.loadURL(loadURL);
  } catch (error) {
    if (loadURL === "YOUR_PRODUCTION_URL") {
      console.error(
        'Error: Production URL is not set. Please replace "YOUR_PRODUCTION_URL" in electron/main.js with your actual production deployment URL.'
      );
      // Optionally, load a local error page or quit the app
      // mainWindow.loadFile('path/to/error.html');
      app.quit();
      return; // Stop further execution
    } else {
      console.error("Error loading URL:", error);
      // Handle other URL errors if necessary
      app.quit();
      return;
    }
  }

  // Open DevTools automatically if in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
