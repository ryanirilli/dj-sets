"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils"; // Assuming cn is available for merging class names
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Import Tooltip components

interface CodeBlockWithCopyProps extends React.HTMLAttributes<HTMLDivElement> {
  codeString: string;
}

const CodeBlockWithCopy: React.FC<CodeBlockWithCopyProps> = ({
  codeString,
  className,
  ...props
}) => {
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(codeString)
      .then(() => {
        setHasCopied(true);
        setTimeout(() => {
          setHasCopied(false);
        }, 2000); // Reset after 2 seconds
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
        // Optionally show an error state
      });
  };

  return (
    <div
      className={cn(
        "mt-2 flex items-center gap-2 rounded bg-muted p-2 font-mono text-xs",
        className
      )}
      {...props}
    >
      <span className="flex-1 break-all">{codeString}</span>
      <TooltipProvider delayDuration={100}>
        {" "}
        {/* Optional: Adjust delay */}
        <Tooltip open={hasCopied}>
          {" "}
          {/* Control tooltip visibility with state */}
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 w-7 p-0"
            >
              {hasCopied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="sr-only">{hasCopied ? "Copied" : "Copy"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copied!</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export { CodeBlockWithCopy };
