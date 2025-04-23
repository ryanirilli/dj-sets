"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"; // Assuming @ resolves to src/
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react"; // Import Download icon
import { CodeBlockWithCopy } from "@/components/ui/CodeBlockWithCopy"; // Import the new component

interface InstallationInstructionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  downloadUrl: string; // Add download URL prop
}

const InstallationInstructionsDialog = ({
  isOpen,
  onClose,
  downloadUrl,
}: InstallationInstructionsDialogProps): JSX.Element => {
  // Update commands for the new filename (no spaces, no quotes needed)
  const commandToCopy = "xattr -cr /Applications/TheFullSet.app"; // For clipboard

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-[525px]"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>macOS Installation Instructions</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <ol className="list-none space-y-4 pl-5 text-sm">
            <li className="relative pl-6 before:content-[counter(step)] before:absolute before:-left-1 before:top-0 before:w-5 before:h-5 before:rounded-full before:bg-gray-100 dark:before:bg-gray-800 before:text-center before:text-xs before:font-semibold before:leading-5">
              Click <strong>Download Now</strong> below and download the file
              named <code>TheFullSet-0.1.0.dmg</code> from the GitHub Releases
              page.
            </li>
            <li className="relative pl-6 before:content-[counter(step)] before:absolute before:-left-1 before:top-0 before:w-5 before:h-5 before:rounded-full before:bg-gray-100 dark:before:bg-gray-800 before:text-center before:text-xs before:font-semibold before:leading-5">
              Open the downloaded <code>.dmg</code> file.
            </li>
            <li className="relative pl-6 before:content-[counter(step)] before:absolute before:-left-1 before:top-0 before:w-5 before:h-5 before:rounded-full before:bg-gray-100 dark:before:bg-gray-800 before:text-center before:text-xs before:font-semibold before:leading-5">
              Drag <strong>TheFullSet.app</strong> to your{" "}
              <strong>Applications</strong> folder.
            </li>
            <li className="relative pl-6 before:content-[counter(step)] before:absolute before:-left-1 before:top-0 before:w-5 before:h-5 before:rounded-full before:bg-gray-100 dark:before:bg-gray-800 before:text-center before:text-xs before:font-semibold before:leading-5">
              <strong>Important Security Step:</strong> Because this app isn't
              from the App Store, macOS Gatekeeper may block it initially,
              showing a "damaged" error. To fix this, open the{" "}
              <strong>Terminal</strong> app (found in /Applications/Utilities).
            </li>
            <li className="relative pl-6 before:content-[counter(step)] before:absolute before:-left-1 before:top-0 before:w-5 before:h-5 before:rounded-full before:bg-gray-100 dark:before:bg-gray-800 before:text-center before:text-xs before:font-semibold before:leading-5">
              Paste the following command into the Terminal and press Enter:
              <CodeBlockWithCopy codeString={commandToCopy} />
            </li>
            <li className="relative pl-6 before:content-[counter(step)] before:absolute before:-left-1 before:top-0 before:w-5 before:h-5 before:rounded-full before:bg-gray-100 dark:before:bg-gray-800 before:text-center before:text-xs before:font-semibold before:leading-5">
              You should now be able to open <strong>TheFullSet</strong> from
              your Applications folder.
            </li>
          </ol>
        </div>
        <DialogFooter className="sm:justify-between gap-2">
          <Button variant="ghost" className="rounded-full" onClick={onClose}>
            Cancel
          </Button>
          <Button asChild className="rounded-full">
            <a
              href={downloadUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="mr-2 h-4 w-4" /> Download Now
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
      <style jsx>{`
        ol {
          counter-reset: step;
        }
        li::before {
          counter-increment: step;
        }
      `}</style>
    </Dialog>
  );
};

export default InstallationInstructionsDialog;
