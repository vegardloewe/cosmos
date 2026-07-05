import { Check } from "lucide-react";

// Rounded-square checkbox matching the .prose-card editor checkboxes
export function Checkbox({
  checked,
  onToggle,
  size = 18,
}: {
  checked: boolean;
  onToggle: () => void;
  size?: number;
}) {
  return (
    <button
      onClick={onToggle}
      style={{ width: size, height: size }}
      className={`shrink-0 flex items-center justify-center rounded-[5px] border-[1.5px] transition-colors cursor-pointer ${
        checked
          ? "bg-[#E8EAED] border-[#E8EAED]"
          : "bg-[#1A1B1D] border-[#4A4D52] hover:border-[#6B7078]"
      }`}
    >
      {checked && (
        <Check size={size - 6} strokeWidth={3.5} className="text-[#141517]" />
      )}
    </button>
  );
}
