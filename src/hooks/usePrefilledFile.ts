import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { allowAssetPaths } from "../lib/assets";

/**
 * Delivers each `?file=...` URL param to the mounted tool page once.
 *
 * The launch-action listener can navigate to the same route repeatedly, so
 * delivery follows the current query value instead of component mount.
 */
export function usePrefilledFile(onFile: (paths: string[]) => void) {
  const [params, setParams] = useSearchParams();
  const onFileRef = useRef(onFile);
  const file = params.get("file");

  useEffect(() => {
    onFileRef.current = onFile;
  }, [onFile]);

  useEffect(() => {
    if (!file) return;
    void allowAssetPaths([file]).catch(() => {}).then(() => {
      onFileRef.current([file]);
      setParams({}, { replace: true });
    });
  }, [file, setParams]);
}
