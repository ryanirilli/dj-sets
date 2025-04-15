"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const shortcuts = [
    { key: "Double Click Scene", action: "Enter Edit Mode" },
    { key: "Enter", action: "Exit Edit Mode" },
    { key: "s", action: "Toggle Settings Toolbar" },
    { key: "Cmd/Ctrl + F", action: "Toggle Fullscreen" },
    { key: "?", action: "Show this Shortcuts panel" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* DialogTrigger is usually needed, but we'll trigger this via state/keyboard shortcut */}
      {/* <DialogTrigger>Open</DialogTrigger> */}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key(s)</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shortcuts.map((shortcut) => (
                <TableRow key={shortcut.key}>
                  <TableCell className="font-medium">{shortcut.key}</TableCell>
                  <TableCell>{shortcut.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
