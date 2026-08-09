import { useState } from "react";
import { colors, touchTarget, Button } from "@secureinchat/ui";
import { CATEGORY_ORDER, CATEGORY_META, type AnnouncementCategory } from "@secureinchat/chat-core";
import type { TodayContent } from "./TodayScreen";

export interface AdminPublishScreenProps {
  /** 当前已发布的内容，用来预填——改一条不用重打其他几条 */
  content: TodayContent;
  onPublish: (
    category: AnnouncementCategory,
    title: string,
    body: string,
    audioFile?: File | undefined
  ) => Promise<void>;
  /** 音频发送进度文案，没有就是没在发 */
  progress?: string | null | undefined;
  onLockAdmin: () => void;
  onBack: () => void;
}

/**
 * 管理员发布页。
 *
 * ⚠️ 必须说清楚：这里只是把发布入口**藏起来**（版本号连点 7 次才出现），
 * 不是权限校验。服务端目前不验证谁有资格发公告——任何人自己解锁之后发出去的
 * 公告，群里所有客户端都会照单接收。真正的管理员体系（服务端校验、成员审批、
 * 权限撤销）还没有实现。
 */
export function AdminPublishScreen({ content, onPublish, progress, onLockAdmin, onBack }: AdminPublishScreenProps) {
  const [category, setCategory] = useState<AnnouncementCategory>("scripture");
  const [title, setTitle] = useState(content.scripture?.title ?? "");
  const [body, setBody] = useState(content.scripture?.body ?? "");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedNotice, setPublishedNotice] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  function switchCategory(next: AnnouncementCategory) {
    setCategory(next);
    setTitle(content[next]?.title ?? "");
    setBody(content[next]?.body ?? "");
    setPublishedNotice(null);
    setAudioFile(null);
  }

  async function handlePublish() {
    setIsPublishing(true);
    try {
      await onPublish(category, title.trim(), body.trim(), audioFile ?? undefined);
      setAudioFile(null);
      setPublishedNotice(`${CATEGORY_META[category].label} 已发布`);
    } finally {
      setIsPublishing(false);
    }
  }

  const inputStyle = {
    minHeight: touchTarget.minDp,
    border: `0.5px solid ${colors.sageMint}`,
    borderRadius: 14,
    padding: "8px 16px",
    fontSize: 14,
    background: colors.ivory,
    color: colors.textPrimary,
    boxShadow: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{ minHeight: "100%", background: colors.ivory, padding: 24, overflowY: "auto" }}>
      <button
        onClick={onBack}
        aria-label="返回"
        style={{
          background: "transparent",
          border: "none",
          boxShadow: "none",
          color: colors.deepInkGreen,
          fontSize: 14,
          marginBottom: 16,
          cursor: "pointer",
          minHeight: touchTarget.minDp,
        }}
      >
        ← 返回
      </button>

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 4px" }}>发布今日内容</h1>
      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: "0 0 16px" }}>
        发布后会立刻加密发送给群里所有人，覆盖该栏目当天的旧内容。
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {CATEGORY_ORDER.map((key) => (
          <button
            key={key}
            onClick={() => switchCategory(key)}
            style={{
              minHeight: touchTarget.minDp,
              padding: "0 14px",
              borderRadius: 20,
              border: `0.5px solid ${category === key ? colors.deepInkGreen : colors.sageMint}`,
              background: category === key ? colors.deepInkGreen : "transparent",
              color: category === key ? colors.ivory : colors.textPrimary,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "none",
            }}
          >
            {CATEGORY_META[key].label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setPublishedNotice(null);
          }}
          placeholder={CATEGORY_META[category].placeholder}
          aria-label="公告标题输入框"
          style={inputStyle}
        />
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setPublishedNotice(null);
          }}
          placeholder="内容"
          aria-label="公告内容输入框"
          rows={6}
          style={{ ...inputStyle, resize: "vertical" }}
        />

        {/* 只有赞美圣诗需要配音频——其他栏目放这个输入会是干扰 */}
        {category === "hymn" ? (
          <div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minHeight: touchTarget.minDp,
                border: `0.5px dashed ${colors.sageMint}`,
                borderRadius: 12,
                padding: "0 14px",
                fontSize: 13,
                color: colors.deepInkGreen,
                cursor: "pointer",
              }}
            >
              <input
                type="file"
                accept="audio/*"
                aria-label="选择圣诗音频"
                style={{ display: "none" }}
                onChange={(e) => {
                  setAudioFile(e.target.files?.[0] ?? null);
                  setPublishedNotice(null);
                }}
              />
              {audioFile ? `已选择：${audioFile.name}` : "添加音频（可选）"}
            </label>
            {audioFile ? (
              <div style={{ fontSize: 11, color: "#9A9A94", marginTop: 4 }}>
                音频会和消息一样加密后发送，中继看不到内容
              </div>
            ) : null}
          </div>
        ) : null}

        {progress ? (
          <p role="status" style={{ fontSize: 12, color: colors.wheatGold, margin: 0 }}>
            {progress}
          </p>
        ) : null}

        {publishedNotice ? (
          <p role="status" style={{ fontSize: 12, color: colors.deepInkGreen, margin: 0 }}>
            {publishedNotice}
          </p>
        ) : null}

        <Button variant="primary" onClick={handlePublish} disabled={isPublishing || body.trim().length === 0}>
          {isPublishing ? "发布中..." : `发布到「${CATEGORY_META[category].label}」`}
        </Button>
      </div>

      <div style={{ borderTop: `0.5px solid ${colors.sageMint}`, marginTop: 24, paddingTop: 12 }}>
        <button
          onClick={onLockAdmin}
          style={{
            minHeight: touchTarget.minDp,
            background: "transparent",
            border: "none",
            boxShadow: "none",
            color: "#8A8A82",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          退出管理员模式
        </button>
        <p style={{ fontSize: 10, color: "#9A9A94", lineHeight: 1.6, margin: "4px 0 0" }}>
          说明：管理员入口只是把发布功能隐藏起来，服务端目前不校验发布权限。
        </p>
      </div>
    </div>
  );
}
