import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AudioSelectorProps {
  onSelect: (audioFile: string) => void;
  selectedFile: string | null;
}

const AudioSelector = ({ onSelect, selectedFile }: AudioSelectorProps) => {
  const [audioFiles, setAudioFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchAudioFiles = async () => {
      try {
        const response = await fetch("/api/audio-files");
        if (!response.ok) {
          throw new Error("Failed to fetch audio files");
        }
        const data = await response.json();

        if (isMounted) {
          setAudioFiles(data.files);

          // If we have files and none is selected, select the first one
          if (data.files.length > 0 && !selectedFile) {
            onSelect(`/audio/${data.files[0]}`);
          }
        }
      } catch (err) {
        console.error("Error fetching audio files:", err);
        if (isMounted) {
          setError("Failed to load audio files. Please try again later.");

          // Fallback to a static list for demo purposes
          const fallbackFiles = ["demo1.mp3", "demo2.mp3"];
          setAudioFiles(fallbackFiles);

          if (fallbackFiles.length > 0 && !selectedFile) {
            onSelect(`/audio/${fallbackFiles[0]}`);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAudioFiles();

    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array since we only want to fetch once on mount

  if (loading) {
    return (
      <div className="text-white/40 text-sm font-medium animate-pulse">
        Loading tracks...
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400/80 text-sm font-medium">{error}</div>;
  }

  if (audioFiles.length === 0) {
    return (
      <div className="text-white/40 text-sm font-medium">
        No audio files found in /public/audio
      </div>
    );
  }

  const selectedFileName = selectedFile?.split("/").pop() || "";

  return (
    <Select
      value={selectedFileName || undefined}
      onValueChange={(value) => onSelect(`/audio/${value}`)}
    >
      <SelectTrigger className="w-full bg-black/40 text-white/80 border-white/10 hover:bg-black/60 hover:text-white focus:ring-blue-500/20 focus:ring-offset-0">
        <SelectValue placeholder="Select a track" />
      </SelectTrigger>
      <SelectContent
        className="bg-black/90 backdrop-blur-md text-white border-white/10 rounded-md shadow-lg"
        position="popper"
        sideOffset={5}
        align="center"
      >
        {audioFiles.map((file) => (
          <SelectItem
            key={file}
            value={file}
            className="text-white/80 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white data-[selected]:bg-white/10 data-[selected]:text-white"
          >
            {file}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default AudioSelector;
