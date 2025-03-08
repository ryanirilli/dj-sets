# DJ Sets Audio Visualizer

A Next.js application that visualizes audio frequencies from MP3 files using React Three Fiber.

## Features

- 3D visualization of audio frequencies
- MP3 file selection from your collection
- Responsive design for desktop and mobile
- Interactive 3D controls (zoom, rotate, pan)

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Add your MP3 files to the `/public/audio` directory

### Running the Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## How to Use

1. Place your MP3 files in the `/public/audio` directory
2. Start the development server
3. Select an audio file from the list
4. Press the Play button to start the visualization
5. Use your mouse to interact with the 3D visualization:
   - Left-click and drag to rotate
   - Right-click and drag to pan
   - Scroll to zoom in/out

## Technologies Used

- Next.js
- React
- TypeScript
- Tailwind CSS
- React Three Fiber
- Three.js
- Web Audio API

## License

This project is licensed under the MIT License.
