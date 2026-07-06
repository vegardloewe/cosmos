import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col gap-4",
        month: "flex flex-col gap-3",
        month_caption: "flex h-7 items-center justify-center",
        caption_label: "text-[13px] font-medium text-text",
        nav: "absolute inset-x-0 top-0 z-10 flex items-center justify-between",
        button_previous:
          "flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-[#18191A] hover:text-text cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
        button_next:
          "flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-[#18191A] hover:text-text cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
        month_grid: "border-collapse",
        weekdays: "flex",
        weekday:
          "flex h-8 w-8 items-center justify-center text-[11px] font-normal text-text-muted",
        week: "mt-0.5 flex",
        day: "p-0",
        day_button:
          "flex h-8 w-8 items-center justify-center rounded-md text-[13px] text-[#D7DCE5] transition-colors hover:bg-[#18191A] cursor-pointer",
        selected:
          "[&>button]:!bg-white [&>button]:!text-bg [&>button]:font-semibold",
        today: "[&>button]:text-primary [&>button]:font-semibold",
        outside: "[&>button]:text-[#5C626B]",
        disabled: "[&>button]:opacity-40 [&>button]:cursor-not-allowed",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className }) =>
          orientation === "left" ? (
            <ChevronLeft size={16} className={className} />
          ) : (
            <ChevronRight size={16} className={className} />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
