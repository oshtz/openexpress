export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

export function getFileExtension(path: string): string {
  const name = getFileName(path);
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.substring(dot + 1).toLowerCase() : "";
}

export function replaceExtension(path: string, newExt: string): string {
  const dot = path.lastIndexOf(".");
  const base = dot >= 0 ? path.substring(0, dot) : path;
  return `${base}.${newExt}`;
}

export function addSuffix(path: string, suffix: string): string {
  const dot = path.lastIndexOf(".");
  if (dot >= 0) {
    return `${path.substring(0, dot)}_${suffix}${path.substring(dot)}`;
  }
  return `${path}_${suffix}`;
}

export function getDirName(path: string): string {
  const sep = path.includes("\\") ? "\\" : "/";
  const parts = path.split(sep);
  parts.pop();
  return parts.join(sep);
}

export function joinPath(dir: string, name: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  return dir.endsWith(sep) ? `${dir}${name}` : `${dir}${sep}${name}`;
}
