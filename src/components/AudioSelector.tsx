import { memo } from "react";
import { useAudio } from "@/contexts/AudioContext";
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

const AudioSelector = memo(({ onSelect, selectedFile }: AudioSelectorProps) => {
  const { availableTracks, loadingTracks } = useAudio();

  if (loadingTracks) {
    return (
      <div className="text-white/40 text-sm font-medium animate-pulse">
        Loading tracks...
      </div>
    );
  }

  if (availableTracks.length === 0) {
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
        {availableTracks.map((file) => (
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
});

AudioSelector.displayName = "AudioSelector";

export default AudioSelector;
