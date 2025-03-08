import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const audioDir = path.join(process.cwd(), "public", "audio");

    // Check if directory exists
    if (!fs.existsSync(audioDir)) {
      // Create the directory if it doesn't exist
      fs.mkdirSync(audioDir, { recursive: true });
      return NextResponse.json({ files: [] });
    }

    // Read directory contents
    const files = fs
      .readdirSync(audioDir)
      .filter((file) => file.toLowerCase().endsWith(".mp3"));

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error reading audio directory:", error);
    return NextResponse.json(
      { error: "Failed to read audio files" },
      { status: 500 }
    );
  }
}
