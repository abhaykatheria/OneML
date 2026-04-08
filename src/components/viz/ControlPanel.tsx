import type { ReactNode } from "react";

interface ControlPanelProps {
  children: ReactNode;
  title?: string;
}

export default function ControlPanel({ children, title }: ControlPanelProps) {
  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      {title && (
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">
          {title}
        </h3>
      )}
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
