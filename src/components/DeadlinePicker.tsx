import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DeadlinePickerProps {
  value?: string; // millis at local midnight, matching Task.deadline
  onChange: (millis: string | null) => void;
  overdue?: boolean;
  placeholder?: string;
  align?: "start" | "center" | "end";
  className?: string; // trigger button styling
}

export function DeadlinePicker({
  value,
  onChange,
  overdue = false,
  placeholder = "Set deadline",
  align = "start",
  className,
}: DeadlinePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(Number(value)) : undefined;
  const label = selected?.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(selected.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
  });

  return (
    // modal: the first outside click closes the calendar itself instead of
    // falling through to the surrounding task dialog (or its backdrop)
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button className={cn("flex items-center gap-2 cursor-pointer", className)}>
          <CalendarClock
            size={14}
            className={cn("shrink-0", overdue ? "text-red-400" : "text-text-muted")}
          />
          <span
            className={cn(
              "truncate",
              value ? (overdue ? "text-red-400" : "text-[#D7DCE5]") : "text-text-muted",
            )}
          >
            {label ?? placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto p-0 overflow-hidden"
        // Escape should only close the popover, not a modal hosting it
        onEscapeKeyDown={(e) => e.stopPropagation()}
      >
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            onChange(
              date
                ? String(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime())
                : null,
            );
            setOpen(false);
          }}
        />
        {value && (
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="w-full border-t border-border px-3 py-2.5 text-xs text-text-muted hover:text-text hover:bg-[#18191A] transition-colors cursor-pointer"
          >
            Clear deadline
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
