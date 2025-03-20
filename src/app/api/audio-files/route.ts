import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const audioDir = path.join(process.cwd(), "public", "audio");

    const mp3Files = fs
      .readdirSync(audioDir)
      .filter((file) => file.toLowerCase().endsWith(".mp3"));

    return NextResponse.json({ files: mp3Files });
  } catch (error) {
    console.error("Error reading audio directory:", error);
    return NextResponse.json(
      { error: "Failed to read audio files" },
      { status: 500 }
    );
  }
}
