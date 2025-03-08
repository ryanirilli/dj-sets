import { useState, useEffect } from "react";

interface AudioSelectorProps {
  onSelect: (audioFile: string) => void;
  selectedFile: string | null;
}

const AudioSelector = ({ onSelect, selectedFile }: AudioSelectorProps) => {
  const [audioFiles, setAudioFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // In a real app, you would fetch this list from an API
    // For now, we'll simulate it with a static list
    const fetchAudioFiles = async () => {
      try {
        // This is a placeholder. In a real app, you would fetch this from an API endpoint
        // that scans your /public/audio directory
        const response = await fetch("/api/audio-files");
        if (!response.ok) {
          throw new Error("Failed to fetch audio files");
        }
        const data = await response.json();
        setAudioFiles(data.files);

        // If we have files and none is selected, select the first one
        if (data.files.length > 0 && !selectedFile) {
          onSelect(`/audio/${data.files[0]}`);
        }
      } catch (err) {
        console.error("Error fetching audio files:", err);
        setError("Failed to load audio files. Please try again later.");

        // Fallback to a static list for demo purposes
        const fallbackFiles = ["demo1.mp3", "demo2.mp3"];
        setAudioFiles(fallbackFiles);

        if (fallbackFiles.length > 0 && !selectedFile) {
          onSelect(`/audio/${fallbackFiles[0]}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAudioFiles();
  }, [onSelect, selectedFile]);

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

  const selectedFileName = selectedFile?.split("/").pop() || "Select a track";

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full px-3 py-2 
          text-left text-sm font-medium
          bg-black/40 hover:bg-black/60
          text-white/80 hover:text-white
          rounded-lg
          ring-1 ring-inset ring-white/5
          transition-all duration-200
          flex items-center justify-between
          group
        `}
      >
        <span className="truncate">{selectedFileName}</span>
        <svg
          className={`
            w-4 h-4 
            transform transition-transform duration-200 
            text-white/40 group-hover:text-white/80
            ${isOpen ? "rotate-180" : ""}
          `}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="
          absolute z-50 w-full mt-2
          bg-black/90 backdrop-blur-md
          rounded-lg ring-1 ring-white/10
          shadow-2xl
          max-h-48 overflow-y-auto
        "
        >
          {audioFiles.map((file) => (
            <button
              key={file}
              className={`
                w-full px-3 py-2 
                text-left text-sm font-medium
                transition-all duration-200
                ${
                  selectedFile === `/audio/${file}`
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-black/60 hover:text-white/80"
                }
                first:rounded-t-lg last:rounded-b-lg
              `}
              onClick={() => {
                onSelect(`/audio/${file}`);
                setIsOpen(false);
              }}
            >
              {file}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AudioSelector;
