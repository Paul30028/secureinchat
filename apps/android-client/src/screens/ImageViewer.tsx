import { colors, touchTarget } from "@secureinchat/ui";

export interface ImageViewerProps {
  src: string;
  fileName: string;
  onClose: () => void;
}

/**
 * 图片全屏查看。
 *
 * 之前点图片只能下载——群里发张照片得先存到手机才能看清，这在聊天里是反的。
 * 现在点开就是全屏，需要保存再单独点下载。
 *
 * 图片本身是解密后的本地 blob，全屏只是换个尺寸显示，没有任何额外的网络请求。
 */
export function ImageViewer({ src, fileName, onClose }: ImageViewerProps) {
  return (
    <div
      role="dialog"
      aria-label={`查看图片 ${fileName}`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        flexDirection: "column",
        zIndex: 100,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="关闭"
          style={{
            minHeight: touchTarget.minDp,
            minWidth: touchTarget.minDp,
            background: "transparent",
            border: "none",
            boxShadow: "none",
            color: colors.ivory,
            fontSize: 20,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
        <span
          style={{
            flex: 1,
            fontSize: 13,
            color: colors.ivory,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {fileName}
        </span>
        <a
          href={src}
          download={fileName}
          aria-label="保存图片"
          style={{
            minHeight: touchTarget.minDp,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            color: colors.ivory,
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          保存
        </a>
      </div>

      {/* 点图片本身不关闭——想放大细看的时候误触退出很烦 */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
        <img
          src={src}
          alt={fileName}
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
        />
      </div>

      <div style={{ textAlign: "center", padding: "0 0 16px", fontSize: 11, color: "rgba(235,236,229,0.5)" }}>
        点击空白处关闭
      </div>
    </div>
  );
}
