"""Generate one DeepSeek translation spec per screen: drop/claude/i18n-<screen>.txt.

Usage: python3 scripts/make_i18n_specs.py ScreenA ScreenB ...
       python3 scripts/make_i18n_specs.py --edit <ns> <path/to/File.tsx> [extra notes]
The --edit form is for long files: DeepSeek answers with OLD/NEW edit blocks instead of the whole file.
Each spec carries the shared rules, the screen source, its existing tests and the i18n API.
"""
import pathlib
import re
import sys

APP = pathlib.Path("apps/android-client")
RULES = """# 任务：把界面「{screen}」改成三语（中文、英文、西班牙语）

你是 SecureInChat（加密群聊 App，React + TypeScript）的软件工程师。

## 输出格式（脚本自动应用，必须严格遵守）
每个文件输出为完整内容的块，块内不要再包 Markdown 代码围栏：
=== FILE: 相对仓库根目录的路径 ===
文件完整内容
=== END FILE ===

## 要做的事
1. 新文件 `apps/android-client/src/i18n/ns/{ns}.ts`：
   `import type {{ Messages }} from "../index";`，导出 `export const zh: Messages`、`export const en: Messages`、`export const es: Messages`。
   三个对象的键完全一致；键一律以 `{ns}.` 开头（如 `{ns}.title`）；参数用 `{{name}}` 占位，三种语言占位符一致。
2. 改写 `apps/android-client/src/screens/{screen}.tsx`：所有给人看的文字（包括 aria-label、placeholder、title、alt、错误提示、按钮文字）改成 `t("{ns}.xxx")`，`const t = useT();` 从 `"../i18n"` 导入。
   - 界面结构、样式、props、行为一律不变。不在组件外（模块顶层常量）调用 t；需要的话把常量挪进组件或改成键名。
   - 中文词条必须与原文**逐字相同**（现有测试按中文断言，必须原样通过）。
   - 日期、数字用 `Intl` 格式化时，locale 用 `useLocale()`（同样从 "../i18n" 导入）。
3. 英语自然简洁；西班牙语用中性拉美西语。语气平实准确，不夸大安全效果（不要写「完全安全」「无法破解」之类）。
4. 不加任何依赖；TypeScript strict，不用 any；保留现有注释。
5. 不要输出测试文件以外的其他文件；不要修改现有测试。

## 翻译层 API（apps/android-client/src/i18n/index.tsx，只读）
- `useT(): (key: string, params?: Record<string, string | number>) => string`
- `useLocale(): "zh" | "en" | "es"`
- 没有 Provider 时默认中文。
"""

EDIT_RULES = """# 任务：把 `{path}` 里给人看的文字改成三语（中文、英文、西班牙语）

你是 SecureInChat（加密群聊 App，React + TypeScript）的软件工程师。这个文件很长，**不要输出整文件**。

## 输出格式（脚本自动应用，必须严格遵守，不要包 Markdown 代码围栏）
1. 新文件整块输出：
=== FILE: apps/android-client/src/i18n/ns/{ns}.ts ===
文件完整内容
=== END FILE ===
2. 对 `{path}` 的修改用编辑块，一个编辑块里可以有多组 OLD/NEW：
=== EDIT: {path} ===
<<<<<<< OLD
原文逐字复制（含缩进），在文件里必须只出现一次；不够唯一就多带一两行上下文
=======
替换后的文字
>>>>>>> NEW
=== END EDIT ===

## 要做的事
1. 新文件 `apps/android-client/src/i18n/ns/{ns}.ts`：`import type {{ Messages }} from "../index";`，导出 `export const zh: Messages`、`export const en: Messages`、`export const es: Messages`。三个对象键完全一致，键以 `{ns}.` 开头；参数用 `{{name}}` 占位，三种语言占位符一致。
2. 把所有给人看的中文字符串（界面文字、错误提示、抛给界面显示的 Error 消息、默认名称）改成 `t("{ns}.xxx")`。**中文注释和 console 日志保持原样，不翻译。**
3. 在用到 t 的 React 组件里加 `const t = useT();`（从 `"./i18n"` 或相对路径的 i18n 导入，按文件位置写对）。组件外的模块级函数不能调用 hook：给它加一个参数 `t: (key: string, params?: Record<string, string | number>) => string`，并修改所有调用处。
4. 中文词条必须与原文**逐字相同**（现有测试按中文断言）。界面结构、样式、props、行为一律不变。
5. 英语自然简洁；西班牙语用中性拉美西语。语气平实，不夸大安全效果。
6. 不加依赖；TypeScript strict，不用 any；不改测试。
{notes}
## 翻译层 API（apps/android-client/src/i18n/index.tsx，只读）
- `useT(): (key: string, params?: Record<string, string | number>) => string`
- `useLocale(): "zh" | "en" | "es"`
- 没有 Provider 时默认中文。
"""


def edit_spec(ns: str, path: str, notes: str) -> None:
    src = pathlib.Path(path)
    parts = [EDIT_RULES.format(ns=ns, path=path, notes=notes), f"\n## 现有源码：{path}\n", src.read_text(encoding="utf-8")]
    out = pathlib.Path("drop/claude") / f"i18n-{ns}.txt"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("".join(parts), encoding="utf-8")
    print(out, len("".join(parts)))


def main(screens: list[str]) -> None:
    for screen in screens:
        ns = screen[0].lower() + screen[1:]
        ns = re.sub(r"Screen$", "", ns) or ns
        src = APP / "src/screens" / f"{screen}.tsx"
        parts = [RULES.format(screen=screen, ns=ns), f"\n## 现有源码：{src}\n", src.read_text(encoding="utf-8")]
        for test in sorted((APP / "test").glob(f"{screen}*.test.tsx")):
            parts += [f"\n## 现有测试（必须原样通过）：{test}\n", test.read_text(encoding="utf-8")]
        out = pathlib.Path("drop/claude") / f"i18n-{ns}.txt"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text("".join(parts), encoding="utf-8")
        print(out, len("".join(parts)))


if __name__ == "__main__":
    if sys.argv[1:2] == ["--edit"]:
        edit_spec(sys.argv[2], sys.argv[3], " ".join(sys.argv[4:]))
    else:
        main(sys.argv[1:])
