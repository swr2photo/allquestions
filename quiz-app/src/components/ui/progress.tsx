import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full bg-primary transition-all duration-500 ease-out rounded-full",
            percentage === 0 && "w-0",
            percentage > 0 && percentage <= 10 && "w-[10%]",
            percentage > 10 && percentage <= 20 && "w-[20%]",
            percentage > 20 && percentage <= 30 && "w-[30%]",
            percentage > 30 && percentage <= 40 && "w-[40%]",
            percentage > 40 && percentage <= 50 && "w-1/2",
            percentage > 50 && percentage <= 60 && "w-[60%]",
            percentage > 60 && percentage <= 70 && "w-[70%]",
            percentage > 70 && percentage <= 80 && "w-4/5",
            percentage > 80 && percentage <= 90 && "w-[90%]",
            percentage > 90 && "w-full"
          )}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
