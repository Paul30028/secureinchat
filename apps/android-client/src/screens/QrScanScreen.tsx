import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { colors, touchTarget } from "@secureinchat/ui";

export interface QrScanScreenProps {
  /** 扫到内容就回调，由调用方决定是不是有效邀请码 */
  onScanned: (text: string) => void;
  onBack: () => void;
}

/**
 * 内置扫码。
 *
 * 之前加群要「系统相机扫码 → 复制那串文本 → 回到应用粘贴」，三步里最别扭的
 * 一步。现在扫到就直接进邀请确认页。
 *
 * 用 jsQR 在本地逐帧解码，画面不离开设备，也不需要任何网络。
 */
export function QrScanScreen({ onScanned, onBack }: QrScanScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        tick();
      } catch {
        // 权限被拒、没有摄像头、或者非安全上下文——都说清楚并留一条退路
        setError("无法使用摄像头。请检查相机权限，或返回后手动粘贴邀请码。");
      }
    }

    function tick() {
      if (doneRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(image.data, image.width, image.height);
          if (result?.data) {
            doneRef.current = true;
            onScanned(result.data);
            return;
          }
        }
      }
      frame = requestAnimationFrame(tick);
    }

    void start();
    return () => {
      doneRef.current = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onScanned]);

  return (
    <div style={{ minHeight: "100%", background: colors.ivory, display: "flex", flexDirection: "column" }}>
      <button
        onClick={onBack}
        aria-label="返回"
        style={{
          alignSelf: "flex-start",
          background: "transparent",
          border: "none",
          boxShadow: "none",
          color: colors.deepInkGreen,
          fontSize: 14,
          padding: "12px 16px",
          cursor: "pointer",
          minHeight: touchTarget.minDp,
        }}
      >
        ← 返回
      </button>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px" }}>
        {error ? (
          <p role="alert" style={{ fontSize: 13, color: "#A33", textAlign: "center", lineHeight: 1.7, marginTop: 40 }}>
            {error}
          </p>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              aria-label="扫码取景框"
              style={{
                width: "100%",
                maxWidth: 320,
                aspectRatio: "1 / 1",
                objectFit: "cover",
                borderRadius: 20,
                background: "#000",
              }}
            />
            <p style={{ fontSize: 13, color: "#8A8A82", marginTop: 16, textAlign: "center" }}>
              对准对方的邀请二维码
            </p>
          </>
        )}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}
