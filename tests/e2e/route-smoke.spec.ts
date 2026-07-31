import { expect, test } from "@playwright/test";

interface ToolRoute {
  path: string;
  title: string;
  action: RegExp;
}

const TOOL_ROUTES: ToolRoute[] = [
  // Image (11)
  { path: "/image/resize", title: "Resize Image", action: /resize image/i },
  { path: "/image/crop", title: "Crop Image", action: /crop image/i },
  { path: "/image/convert", title: "Convert Image Format", action: /convert image/i },
  { path: "/image/adjust", title: "Adjust Image", action: /adjust image/i },
  { path: "/image/compress", title: "Compress Image", action: /compress image/i },
  { path: "/image/rotate", title: "Rotate / Flip", action: /apply transform/i },
  { path: "/image/sharpen", title: "Sharpen Image", action: /sharpen image/i },
  { path: "/image/blur", title: "Blur Image", action: /blur image/i },
  { path: "/image/vector-trace", title: "Trace to SVG", action: /trace to svg/i },
  { path: "/image/remove-bg", title: "Remove Background", action: /model required|remove background/i },
  { path: "/image/upscale", title: "AI Upscale", action: /model required|upscale 4x/i },
  // Video (10)
  { path: "/video/trim", title: "Trim Video", action: /trim video/i },
  { path: "/video/convert", title: "Convert Video", action: /convert video/i },
  { path: "/video/resize", title: "Resize Video", action: /resize video/i },
  { path: "/video/gif", title: "Video to GIF", action: /convert to gif/i },
  { path: "/video/speed", title: "Change Speed", action: /change speed/i },
  { path: "/video/audio", title: "Extract Audio", action: /extract audio/i },
  { path: "/video/crop", title: "Crop Video", action: /crop video/i },
  { path: "/video/reverse", title: "Reverse Video", action: /reverse video/i },
  { path: "/video/mute", title: "Mute Video", action: /mute video/i },
  { path: "/video/merge", title: "Merge Videos", action: /merge videos/i },
  // PDF (5)
  { path: "/pdf/merge", title: "Merge PDFs", action: /merge pdfs/i },
  { path: "/pdf/image-to-pdf", title: "Images to PDF", action: /convert to pdf/i },
  { path: "/pdf/compress", title: "Compress PDF", action: /compress pdf/i },
  { path: "/pdf/split", title: "Split PDF", action: /extract pages/i },
  { path: "/pdf/organize", title: "Organize Pages", action: /save .* pdf/i },
  // Audio (5)
  { path: "/audio/trim", title: "Trim Audio", action: /trim audio/i },
  { path: "/audio/convert", title: "Convert Audio", action: /convert to/i },
  { path: "/audio/fade-in", title: "Fade In Audio", action: /apply fade in/i },
  { path: "/audio/fade-out", title: "Fade Out Audio", action: /apply fade out/i },
  { path: "/audio/volume", title: "Adjust Volume", action: /adjust volume/i },
];

test.describe("tool route smoke", () => {
  for (const tool of TOOL_ROUTES) {
    test(`${tool.title} renders workspace and disabled primary action`, async ({ page }) => {
      await page.goto(tool.path);

      await expect(page.getByRole("heading", { name: tool.title })).toBeVisible();
      await expect(page.getByRole("region", { name: /input/i })).toBeVisible();
      await expect(page.getByText(/01\s*Input/i)).toBeVisible();
      await expect(page.getByText(/02\s*Settings/i)).toBeVisible();
      await expect(page.getByText(/drop .*here|drop files here/i).first()).toBeVisible();
      await expect(page.getByText("Choose a file to continue")).toBeVisible();
      await expect(page.getByRole("button", { name: tool.action }).last()).toBeDisabled();
    });
  }
});

test("31 tool routes are covered", () => {
  expect(TOOL_ROUTES).toHaveLength(31);
});

test("home starts from a file and keeps the full tool catalog available", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /edit media/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Drop a file to see compatible tools" }),
  ).toBeVisible();
  await expect(page.getByText("All tools")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Image" })).toBeVisible();
});
