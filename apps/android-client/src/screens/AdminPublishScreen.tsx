import { useState } from "react";
import { colors, touchTarget, Button } from "@secureinchat/ui";
import { CATEGORY_ORDER, type AnnouncementCategory } from "@secureinchat/chat-core";
import type { TodayContent } from "./TodayScreen";
import { t } from "../i18n";
import { categoryLabel, categoryPlaceholder } from "../i18n/labels";

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
  /** 轮换群密钥，返回新的邀请码 */
  onRotateKey: () => Promise<string>;
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
export function AdminPublishScreen({
  content,
  onPublish,
  progress,
  onRotateKey,
  onLockAdmin,
  onBack,
}: AdminPublishScreenProps) {
  const [category, setCategory] = useState<AnnouncementCategory>("scripture");
  const [title, setTitle] = useState(content.scripture?.title ?? "");
  const [body, setBody] = useState(content.scripture?.body ?? "");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedNotice, setPublishedNotice] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [rotateConfirm, setRotateConfirm] = useState(false);
  const [rotatedCode, setRotatedCode] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);

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
      setPublishedNotice(t("publish.done", { category: categoryLabel(category) }));
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
        aria-label={t("common.back")}
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
        {t("common.backArrow")}
      </button>

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 4px" }}>{t("publish.title")}</h1>
      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: "0 0 16px" }}>
        {t("publish.intro")}
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
            {categoryLabel(key)}
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
          placeholder={categoryPlaceholder(category)}
          aria-label={t("publish.titleInput")}
          style={inputStyle}
        />
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setPublishedNotice(null);
          }}
          placeholder={t("publish.bodyPlaceholder")}
          aria-label={t("publish.bodyInput")}
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
              {audioFile ? `已选择：${audioFile.name.length > 24 ? audioFile.name.slice(0, 24) + "…" : audioFile.name}` : "添加音频（可选）"}
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

        {/* 一首诗歌常常只有标题和音频，正文本来就是空的——
            要求正文非空会让"选了音频却发不出去"，那正是 Paul 遇到的。 */}
        <Button
          variant="primary"
          onClick={handlePublish}
          disabled={isPublishing || (body.trim().length === 0 && !audioFile && title.trim().length === 0)}
        >
          {isPublishing ? t("publish.publishing") : t("publish.publishTo", { category: categoryLabel(category) })}
        </Button>
      </div>

      <div style={{ borderTop: `0.5px solid ${colors.sageMint}`, marginTop: 24, paddingTop: 16 }}>
        <div style={{ fontSize: 14, color: colors.textPrimary, marginBottom: 4 }}>{t("rotate.title")}</div>
        <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: "0 0 10px" }}>
          {t("rotate.noteBefore")}
          <strong style={{ fontWeight: 500 }}>{t("rotate.noteStrong")}</strong>
          {t("rotate.noteAfter")}
        </p>

        {rotateError ? (
          <p role="alert" style={{ fontSize: 12, color: "#A33", margin: "0 0 8px" }}>
            {rotateError}
          </p>
        ) : null}

        {rotatedCode ? (
          <div style={{ marginBottom: 12 }}>
            <p role="status" style={{ fontSize: 12, color: colors.deepInkGreen, margin: "0 0 8px" }}>
              {t("rotate.done")}
            </p>
            <code
              style={{
                display: "block",
                fontSize: 10,
                fontFamily: "monospace",
                color: colors.textPrimary,
                wordBreak: "break-all",
                background: colors.ivory,
                border: `0.5px solid ${colors.sageMint}`,
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              {rotatedCode}
            </code>
          </div>
        ) : !rotateConfirm ? (
          <Button variant="secondary" onClick={() => setRotateConfirm(true)}>
            {t("rotate.button")}
          </Button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" onClick={() => setRotateConfirm(false)} style={{ flex: 1 }}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={isRotating}
              onClick={() => {
                setIsRotating(true);
                setRotateError(null);
                void onRotateKey()
                  .then((code) => {
                    setRotatedCode(code);
                    setRotateConfirm(false);
                  })
                  .catch((err: unknown) => {
                    // 轮换失败必须说出来——静默失败会让管理员以为已经换过了，
                    // 而实际上被移除的人还能读到新消息
                    setRotateError(err instanceof Error ? err.message : t("rotate.failed"));
                  })
                  .finally(() => setIsRotating(false));
              }}
              style={{ flex: 1 }}
            >
              {isRotating ? t("rotate.rotating") : t("rotate.confirm")}
            </Button>
          </div>
        )}
      </div>

      <div style={{ borderTop: `0.5px solid ${colors.sageMint}`, marginTop: 20, paddingTop: 12 }}>
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
          {t("publish.exitAdmin")}
        </button>
        <p style={{ fontSize: 10, color: "#9A9A94", lineHeight: 1.6, margin: "4px 0 0" }}>
          {t("publish.adminNote")}
        </p>
      </div>
    </div>
  );
}
