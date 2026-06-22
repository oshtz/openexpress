import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Once-per-mount delivery of a `?file=...` URL param to the tool page.
 *
 * The launch-action listener navigates to `/image/resize?file=C:\photo.jpg`;
 * each tool page calls `usePrefilledFile(handleFiles)` to receive the path
 * the same way a drop or dialog selection arrives. The param is removed
 * after delivery so navigating back to the page later doesn't re-trigger.
 */
export function usePrefilledFile(onFile: (paths: string[]) => void) {
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    const file = params.get("file");
    if (!file) return;
    onFile([file]);
    // Clear the param so it fires exactly once per launch.
    const next = new URLSearchParams(params);
    next.delete("file");
    setParams(next, { replace: true });
    // params and setParams are stable per react-router-dom; only onFile
    // changes if the consumer doesn't memoize, which is fine — we early-
    // return after the first delivery clears the param.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
