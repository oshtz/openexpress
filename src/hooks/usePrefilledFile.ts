import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { allowAssetPaths } from "../lib/assets";

/**
 * Delivers all `?file=...` URL params to the mounted tool page once.
 *
 * The launch-action listener can navigate to the same route repeatedly, so
 * delivery follows the current query value instead of component mount.
 */
export function usePrefilledFile(onFile: (paths: string[]) => void) {
  const [params, setParams] = useSearchParams();
  const onFileRef = useRef(onFile);
  const query = params.toString();

  useEffect(() => {
    onFileRef.current = onFile;
  }, [onFile]);

  useEffect(() => {
    const files = new URLSearchParams(query).getAll("file");
    if (files.length === 0) return;
    void allowAssetPaths(files).catch(() => {}).then(() => {
      onFileRef.current(files);
      setParams({}, { replace: true });
    });
  }, [query, setParams]);
}
