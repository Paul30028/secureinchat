/**
 * 启动阶段的两个小页面（从 App.tsx 拆出，K6）。
 */

/** 还在读本机状态（应用锁、昵称）时的占位，几十毫秒，不显示文字 */
export function BusyScreen() {
  return <div style={{ minHeight: "100%", background: "#EBECE5" }} aria-busy="true" />;
}

/** 能力自检没通过：地基不行的话，后面每一步都会以看不懂的方式失败，所以第一屏就说清楚 */
export function CapabilityProblemScreen({ reason, detail }: { reason: string; detail?: string | undefined }) {
  return (
    <div
      style={{
        minHeight: "100%",
        background: "#EBECE5",
        padding: 32,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 500, color: "#2B2B28" }}>{reason}</div>
      {detail ? <div style={{ fontSize: 13, color: "#8A8A82", lineHeight: 1.8 }}>{detail}</div> : null}
    </div>
  );
}
