# 设计取样来源

这个目录存放实际的设计稿裁切件，是 `packages/ui/src/tokens.ts` 颜色值的来源，
不是随手放的占位图。

- `reference_sheet_original.jpg`：Paul 提供的原始设计参考图（App 图标 + 两个功能图标合图）
- `app_icon.png`：从原图裁出的主 App 图标（470×470，用于生成 `apps/android-client/res-source/` 下的全部图标资源）
- `feature_icon_wheat_今日灵修.png` / `feature_icon_fish_小组聚会.png`：两个功能图标裁切件，
  留作后续图标资源库参考（当前底部导航只有"公告/消息/我的"三项，这两个图标目前
  没有直接对应的界面位置，先存档，不强行塞进导航里）

## 取色方法

`tokens.ts` 里的颜色不是目测取的，是用 Python/Pillow 对 `app_icon.png` 做
`quantize` 颜色聚类后，从聚类结果里挑出代表色，或者对特定色系（金色麦穗、
深绿按钮）做像素级过滤后取平均值。深墨绿（`deepInkGreen`）取样自另外一张
界面 mockup（启动页"加入群聊"按钮），因为这张图标图里本身没有深绿。

换设计稿后重新取样、更新 `tokens.ts`，并在这里同步说明取样自哪张图、哪个区域。
