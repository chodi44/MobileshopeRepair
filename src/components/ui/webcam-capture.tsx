import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WebcamCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export function WebcamCapture({ onCapture, onClose }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const startStream = useCallback(async (mode: "user" | "environment") => {
    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setLoading(true);
    setError(null);
    setSnapshot(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setError("Cannot access camera. Please allow camera permission and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startStream(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flipCamera() {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    startStream(next);
  }

  function takeSnapshot() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setSnapshot(canvas.toDataURL("image/jpeg", 0.92));
  }

  function retake() {
    setSnapshot(null);
  }

  function confirm() {
    if (!snapshot || !canvasRef.current) return;
    canvasRef.current.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
        onClose();
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Camera className="h-4 w-4" /> Take Photo
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Viewfinder / snapshot */}
        <div className="relative aspect-video bg-black">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
              <Camera className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button size="sm" variant="outline" onClick={() => startStream(facingMode)}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              {/* Live feed — hidden once snapshot is taken */}
              <video
                ref={videoRef}
                className={`absolute inset-0 h-full w-full object-cover ${snapshot ? "opacity-0" : "opacity-100"}`}
                playsInline
                muted
              />
              {/* Snapshot preview */}
              {snapshot && (
                <img
                  src={snapshot}
                  alt="Snapshot"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              {loading && !error && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 p-4">
          {!snapshot ? (
            <>
              <Button size="sm" variant="outline" onClick={flipCamera} disabled={!!error || loading}>
                <RotateCcw className="h-4 w-4 mr-1" /> Flip
              </Button>
              <Button
                size="lg"
                className="rounded-full h-14 w-14 p-0"
                onClick={takeSnapshot}
                disabled={!!error || loading}
                title="Take photo"
              >
                <Camera className="h-6 w-6" />
              </Button>
              <div className="w-[72px]" /> {/* spacer to center the shutter button */}
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={retake}>
                <RotateCcw className="h-4 w-4 mr-1" /> Retake
              </Button>
              <Button size="sm" onClick={confirm}>
                <Check className="h-4 w-4 mr-1" /> Use photo
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
