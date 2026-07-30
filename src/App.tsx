import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { Home } from "./pages/Home";
import { ImageResize } from "./pages/image/ImageResize";
import { ImageCrop } from "./pages/image/ImageCrop";
import { ImageConvert } from "./pages/image/ImageConvert";
import { ImageAdjust } from "./pages/image/ImageAdjust";
import { ImageCompress } from "./pages/image/ImageCompress";
import { ImageRotate } from "./pages/image/ImageRotate";
import { ImageSharpen } from "./pages/image/ImageSharpen";
import { ImageBlur } from "./pages/image/ImageBlur";
import { ImageVectorTrace } from "./pages/image/ImageVectorTrace";
import { ImageRemoveBg } from "./pages/image/ImageRemoveBg";
import { ImageUpscale } from "./pages/image/ImageUpscale";
import { VideoTrim } from "./pages/video/VideoTrim";
import { VideoConvert } from "./pages/video/VideoConvert";
import { VideoResize } from "./pages/video/VideoResize";
import { VideoToGif } from "./pages/video/VideoToGif";
import { VideoSpeed } from "./pages/video/VideoSpeed";
import { AudioExtract } from "./pages/video/AudioExtract";
import { VideoCrop } from "./pages/video/VideoCrop";
import { VideoReverse } from "./pages/video/VideoReverse";
import { VideoMute } from "./pages/video/VideoMute";
import { VideoMerge } from "./pages/video/VideoMerge";
import { PdfMerge } from "./pages/pdf/PdfMerge";
import { ImageToPdf } from "./pages/pdf/ImageToPdf";
import { PdfCompress } from "./pages/pdf/PdfCompress";
import { PdfSplit } from "./pages/pdf/PdfSplit";
import { PdfOrganize } from "./pages/pdf/PdfOrganize";
import { AudioTrim } from "./pages/audio/AudioTrim";
import { AudioConvert } from "./pages/audio/AudioConvert";
import { AudioFadeIn } from "./pages/audio/AudioFadeIn";
import { AudioFadeOut } from "./pages/audio/AudioFadeOut";
import { AudioVolume } from "./pages/audio/AudioVolume";
import { Settings } from "./pages/Settings";
import { PickTool } from "./pages/PickTool";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/image/resize" element={<ImageResize />} />
        <Route path="/image/crop" element={<ImageCrop />} />
        <Route path="/image/convert" element={<ImageConvert />} />
        <Route path="/image/adjust" element={<ImageAdjust />} />
        <Route path="/image/compress" element={<ImageCompress />} />
        <Route path="/image/rotate" element={<ImageRotate />} />
        <Route path="/image/sharpen" element={<ImageSharpen />} />
        <Route path="/image/blur" element={<ImageBlur />} />
        <Route path="/image/vector-trace" element={<ImageVectorTrace />} />
        <Route path="/image/remove-bg" element={<ImageRemoveBg />} />
        <Route path="/image/upscale" element={<ImageUpscale />} />
        <Route path="/video/trim" element={<VideoTrim />} />
        <Route path="/video/convert" element={<VideoConvert />} />
        <Route path="/video/resize" element={<VideoResize />} />
        <Route path="/video/gif" element={<VideoToGif />} />
        <Route path="/video/speed" element={<VideoSpeed />} />
        <Route path="/video/audio" element={<AudioExtract />} />
        <Route path="/video/crop" element={<VideoCrop />} />
        <Route path="/video/reverse" element={<VideoReverse />} />
        <Route path="/video/mute" element={<VideoMute />} />
        <Route path="/video/merge" element={<VideoMerge />} />
        <Route path="/pdf/merge" element={<PdfMerge />} />
        <Route path="/pdf/image-to-pdf" element={<ImageToPdf />} />
        <Route path="/pdf/compress" element={<PdfCompress />} />
        <Route path="/pdf/split" element={<PdfSplit />} />
        <Route path="/pdf/organize" element={<PdfOrganize />} />
        <Route path="/audio/trim" element={<AudioTrim />} />
        <Route path="/audio/convert" element={<AudioConvert />} />
        <Route path="/audio/fade-in" element={<AudioFadeIn />} />
        <Route path="/audio/fade-out" element={<AudioFadeOut />} />
        <Route path="/audio/volume" element={<AudioVolume />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/pick" element={<PickTool />} />
      </Route>
    </Routes>
  );
}
