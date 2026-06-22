import { save } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "../stores/appStore";
import { addSuffix, getDirName, getFileName, joinPath, replaceExtension } from "./utils";

interface SaveFilter {
  name: string;
  extensions: string[];
}

interface ResolveOptions {
  /** Suggested filename or path; the basename is used. */
  suggested: string;
  /** File-type filters for the save dialog fallback. */
  filters?: SaveFilter[];
}

/**
 * Resolves an output path according to the user's Settings preference.
 *
 * - If a default output directory is set, drops the basename of `suggested`
 *   into it without prompting.
 * - Otherwise opens a Save dialog seeded with `suggested`.
 *
 * Returns `null` if the user cancels the dialog.
 */
export async function resolveOutputPath({
  suggested,
  filters,
}: ResolveOptions): Promise<string | null> {
  const outputDir = useAppStore.getState().outputDir;
  if (outputDir && outputDir.trim().length > 0) {
    return joinPath(outputDir, getFileName(suggested));
  }
  const result = await save({ defaultPath: suggested, filters });
  return result ?? null;
}

interface BatchOptions {
  /** Suffix added to each input's basename when deriving same-folder output. */
  suffix: string;
  /** Override the input's extension (e.g. "png" → "jpg" for format converters). */
  targetExtension?: string;
}

/**
 * Derives an output path for one item in a batch — never prompts. Honors
 * Settings → Default Output Folder when set; otherwise drops the result
 * next to the input with `<basename>_<suffix>.<ext>`.
 */
export function resolveBatchOutputPath(
  inputPath: string,
  { suffix, targetExtension }: BatchOptions,
): string {
  const outputDir = useAppStore.getState().outputDir;
  const withSuffix = addSuffix(inputPath, suffix);
  const withExt = targetExtension ? replaceExtension(withSuffix, targetExtension) : withSuffix;

  if (outputDir && outputDir.trim().length > 0) {
    return joinPath(outputDir, getFileName(withExt));
  }
  // Same folder as input; getDirName + filename to avoid carrying the
  // outputDir state from a prior single-file run.
  return joinPath(getDirName(inputPath), getFileName(withExt));
}
