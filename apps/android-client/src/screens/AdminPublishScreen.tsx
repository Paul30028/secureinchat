import { useState } from "react";
import { colors, touchTarget, Button } from "@secureinchat/ui";
import { CATEGORY_ORDER, CATEGORY_META, type AnnouncementCategory } from "@secureinchat/chat-core";
import { useT } from "../i18n";
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
  /** 轮换群密钥，返回新的邀请码 */
  onRotateKey: () => Promise<string>;
  onLockAdmin: () => void;
  onBack: () => void;
}

// 栏目名的翻译键，组件内用 t() 取文案
const CATEGORY_LABEL_KEYS: Record<AnnouncementCategory, string> = {
  scripture: "adminPublish.category.scripture",
  hymn: "adminPublish.category.hymn",
  devotional: "adminPublish.category.devotional",
  notice: "adminPublish.category.notice",
};

// 标题输入框占位文案的翻译键
const CATEGORY_PLACEHOLDER_KEYS: Record<AnnouncementCategory, string> = {
  scripture: "adminPublish.placeholder.scripture",
  hymn: "adminPublish.placeholder.hymn",
  devotional: "adminPublish.placeholder.devotional",
  notice: "adminPublish.placeholder.notice",
};

/** 音频文件名过长时截断，避免撑破布局 */
function truncateAudioName(name: string): string {
  return name.length > 24 ? name.slice(0, 24) + "…" : name;
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
  const t = useT();
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
      setPublishedNotice(
        t("adminPublish.published", { category: t(CATEGORY_LABEL_KEYS[category]) })
      );
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
        aria-label={t("adminPublish.back")}
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
        {t("adminPublish.backArrow")}
      </button>

      <h1 style={{ fontSize: 17, fontWeight: 500, color: colors.textPrimary, margin: "0 0 4px" }}>
        {t("adminPublish.title")}
      </h1>
      <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: "0 0 16px" }}>
        {t("adminPublish.subtitle")}
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
            {t(CATEGORY_LABEL_KEYS[key])}
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
          placeholder={t(CATEGORY_PLACEHOLDER_KEYS[category])}
          aria-label={t("adminPublish.titlePlaceholder")}
          style={inputStyle}
        />
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setPublishedNotice(null);
          }}
          placeholder={t("adminPublish.bodyPlaceholder")}
          aria-label={t("adminPublish.bodyAriaLabel")}
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
                aria-label={t("adminPublish.audioAriaLabel")}
                style={{ display: "none" }}
                onChange={(e) => {
                  setAudioFile(e.target.files?.[0] ?? null);
                  setPublishedNotice(null);
                }}
              />
              {audioFile
                ? t("adminPublish.audioSelected", { name: truncateAudioName(audioFile.name) })
                : t("adminPublish.audioAdd")}
            </label>
            {audioFile ? (
              <div style={{ fontSize: 11, color: "#9A9A94", marginTop: 4 }}>
                {t("adminPublish.audioEncryptedNote")}
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
          {isPublishing
            ? t("adminPublish.publishing")
            : t("adminPublish.publishTo", { category: t(CATEGORY_LABEL_KEYS[category]) })}
        </Button>
      </div>

      <div style={{ borderTop: `0.5px solid ${colors.sageMint}`, marginTop: 24, paddingTop: 16 }}>
        <div style={{ fontSize: 14, color: colors.textPrimary, marginBottom: 4 }}>
          {t("adminPublish.rotateSectionTitle")}
        </div>
        <p style={{ fontSize: 11, color: "#9A9A94", lineHeight: 1.7, margin: "0 0 10px" }}>
          {t("adminPublish.rotateExplanation")}
          <strong style={{ fontWeight: 500 }}>{t("adminPublish.rotateExplanationStrong")}</strong>
          {t("adminPublish.rotateExplanationTail")}
        </p>

        {rotateError ? (
          <p role="alert" style={{ fontSize: 12, color: "#A33", margin: "0 0 8px" }}>
            {rotateError}
          </p>
        ) : null}

        {rotatedCode ? (
          <div style={{ marginBottom: 12 }}>
            <p role="status" style={{ fontSize: 12, color: colors.deepInkGreen, margin: "0 0 8px" }}>
              {t("adminPublish.rotateSuccess")}
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
            {t("adminPublish.rotateButton")}
          </Button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" onClick={() => setRotateConfirm(false)} style={{ flex: 1 }}>
              {t("adminPublish.cancel")}
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
                    setRotateError(err instanceof Error ? err.message : t("adminPublish.rotateFailed"));
                  })
                  .finally(() => setIsRotating(false));
              }}
              style={{ flex: 1 }}
            >
              {isRotating ? t("adminPublish.rotating") : t("adminPublish.confirmRotate")}
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
          {t("adminPublish.lockAdmin")}
        </button>
        <p style={{ fontSize: 10, color: "#9A9A94", lineHeight: 1.6, margin: "4px 0 0" }}>
          {t("adminPublish.lockAdminNote")}
        </p>
      </div>
    </div>
  );
}
