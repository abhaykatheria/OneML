interface InteractiveSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
}

export default function InteractiveSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  unit = "",
}: InteractiveSliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <label className="font-medium text-gray-700">{label}</label>
        <span className="tabular-nums text-gray-500">
          {value}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
      />
    </div>
  );
}
