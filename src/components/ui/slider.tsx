"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, disabled, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    disabled={disabled}
    {...props}
  >
    <SliderPrimitive.Track
      className={cn(
        "relative h-3 w-full grow overflow-hidden rounded-full",
        disabled
          ? "bg-[hsl(var(--control-track-disabled))]"
          : "bg-control-track"
      )}
    >
      <SliderPrimitive.Range
        className={cn(
          "absolute h-full",
          disabled
            ? "bg-[hsl(var(--control-active-disabled))]"
            : "bg-control-active"
        )}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        "block h-4 w-4 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none",
        disabled
          ? "border-[hsl(var(--control-thumb-border-disabled))] bg-[hsl(var(--control-thumb-disabled))]"
          : "border-control-border bg-control-thumb"
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
