# DJ Sets Electron App

An Electron wrapper for the DJ Sets web application with system audio support.

## Development

To run the app in development mode:

```bash
# Navigate to the electron directory
cd electron

# Install dependencies
npm install

# Start the app
npm start
```

## Building

To build the application for distribution:

```bash
# Build for current platform
npm run package

# Build for macOS (Universal - Intel and Apple Silicon)
npm run package-mac-universal

# Build for specific platforms
npm run package-mac
npm run package-win
npm run package-linux
```

## System Audio Support

This Electron wrapper enhances the web application by adding system audio access capabilities that aren't available in regular browsers. The app:

1. Auto-approves necessary media permissions
2. Provides a custom protocol handler for system audio
3. Includes a preload script that enhances the web app's ability to access system audio

## Troubleshooting

If you encounter audio-related issues:

1. Check the DevTools console (View → Toggle Developer Tools)
2. Ensure you have granted the app the necessary permissions in your OS settings
3. On macOS, you may need to install [BlackHole](https://existential.audio/blackhole/) or similar audio routing tools
4. On Windows, consider using [Virtual Audio Cable](https://vac.muzychenko.net/en/)

## Notes

This Electron app loads the deployed web application from https://dj-sets-gamma.vercel.app/ while providing enhanced system audio capabilities.
