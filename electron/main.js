const {
  app,
  BrowserWindow,
  ipcMain,
  session,
  powerSaveBlocker,
} = require("electron");
const path = require("path");
const MacPermissions = require("node-mac-permissions");

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;
// Store the ID of the power save blocker
let powerSaveBlockerId = null;

// Add simple error logging
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

// Request microphone access on macOS
const requestMicrophoneAccess = async () => {
  try {
    if (process.platform === "darwin") {
      console.log("Requesting microphone access...");
      const status = await MacPermissions.getMicrophoneAccess();

      if (status !== "authorized") {
        console.log("Microphone access not authorized, requesting...");
        await MacPermissions.requestMicrophoneAccess();
      } else {
        console.log("Microphone access already authorized");
      }
    }
  } catch (error) {
    console.error("Error requesting microphone access:", error);
  }
};

function createWindow() {
  console.log("Creating main window...");

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      autoplayPolicy: "no-user-gesture-required",
      backgroundThrottling: false, // Prevent throttling when in background
    },
    // Prevent the app from being suspended when in background
    backgroundColor: "#000000",
  });

  // Prevent window from being suspended when not focused
  mainWindow.setBackgroundThrottling(false);

  // Start the power save blocker to prevent display sleep and system suspension
  powerSaveBlockerId = powerSaveBlocker.start("prevent-app-suspension");
  console.log("Power save blocker started with ID:", powerSaveBlockerId);

  // Set permissions for media
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      if (
        permission === "media" ||
        permission === "mediaKeySystem" ||
        permission === "microphone" ||
        permission === "camera"
      ) {
        console.log(`Auto-approving permission request: ${permission}`);
        return callback(true);
      }
      callback(false);
    }
  );

  // Load the deployed website
  console.log("Loading website...");
  mainWindow.loadURL("https://dj-sets-gamma.vercel.app/");

  // Open the DevTools for debugging
  mainWindow.webContents.openDevTools();

  // Prevent throttling when blurred/minimized
  mainWindow.on("blur", () => {
    console.log("Window blurred, preventing throttling");
    if (!powerSaveBlockerId) {
      powerSaveBlockerId = powerSaveBlocker.start("prevent-app-suspension");
    }
  });

  // Emitted when the window is closed
  mainWindow.on("closed", function () {
    // Release the power save blocker when the window is closed
    if (powerSaveBlockerId !== null) {
      powerSaveBlocker.stop(powerSaveBlockerId);
      powerSaveBlockerId = null;
    }
    mainWindow = null;
  });

  console.log("Window created successfully");
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows
app.whenReady().then(async () => {
  console.log("App is ready, requesting permissions...");

  // Disable app suspension and background throttling
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("disable-background-timer-throttling");
  app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

  // Request microphone permissions first
  await requestMicrophoneAccess();

  // Create the window after permissions are handled
  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window when the dock icon is clicked
    if (mainWindow === null) createWindow();
  });
});

// Handle IPC events from renderer
ipcMain.handle("get-system-audio-status", async () => {
  try {
    if (process.platform === "darwin") {
      const status = await MacPermissions.getMicrophoneAccess();
      return status;
    }
    return "unknown";
  } catch (error) {
    console.error("Error getting microphone status:", error);
    return "error";
  }
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", function () {
  // Release the power save blocker when all windows are closed
  if (powerSaveBlockerId !== null) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = null;
  }

  if (process.platform !== "darwin") app.quit();
});
