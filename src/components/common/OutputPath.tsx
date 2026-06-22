import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen } from "lucide-react";
import { Input } from "../ui/Input";
import { Label } from "../ui/Label";

interface OutputPathProps {
  value: string;
  onChange: (path: string) => void;
  label?: string;
}

export function OutputPath({ value, onChange, label = "Output" }: OutputPathProps) {
  const browse = async () => {
    const dir = await open({ directory: true });
    if (dir) onChange(dir as string);
  };

  return (
    <div>
      <Label className="mb-1.5">{label}</Label>
      <div className="flex gap-2">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Select output folder..."
          className="flex-1"
        />
        <button
          onClick={browse}
          className="px-3 py-2.5 bg-bg-secondary border border-border hover:border-text transition-colors group"
        >
          <FolderOpen size={16} className="text-text-muted group-hover:text-text transition-colors" />
        </button>
      </div>
    </div>
  );
}
