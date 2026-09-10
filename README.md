# AI Store Doctor — Page Builder

可视化页面编辑器框架。**v0.2.1 — Core Review Fixes**（仅编辑器，不含 AI / 后端 / 发布）。

## 运行

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc -b（strict）
npm run test       # Vitest：core、store、dropPlan 与 UI 集成测试（103 例）
npm run smoke      # 无头校验（reducer / 样式层级 / schema / 预设 / SSR 渲染）
npm run build      # tsc -b + vite build → dist/
```

## 界面

- **顶栏** — 页面名、设备切换（Desktop / Tablet / Mobile）、撤销重做、预览、保存状态与保存。
- **左栏** — Layers（图层树）／Components（八个内置组件）／Templates（整页模板）／Sections（区块预设）。
- **中间** — 画布。点击选中，选中框上带工具条（拖拽抓手、选父级、上移、下移、复制、删除）；
  拖拽时显示插入指示线，落点由指针位置和组件兼容规则共同决定。
- **右栏** — Inspector：Content / Style / Advanced。Style 页带单位控件、四边联动、
  以及 overridden / inherited / unset 三态标记。

## 数据安全

- 编辑内容会**自动保存**为草稿（防抖 1.2s，切走标签页时立即写入）。
- 崩溃或意外关闭后重开，若草稿比上次手动保存更新，顶部会出现恢复提示条，由你选择 Restore 或 Discard。
- 手动保存（`⌘S`）写入已提交文档并清掉草稿。两者分开存储，所以恢复不会覆盖你确实保存过的版本。

## 快捷键

| 键 | 动作 |
|---|---|
| `⌘Z` / `Ctrl+Z` | 撤销 |
| `⇧⌘Z` / `Ctrl+Shift+Z` | 重做 |
| `⌘S` | 保存到 localStorage |
| `⌘D` | 复制选中节点 |
| `Delete` / `Backspace` | 删除选中节点 |
| `Esc` | 退出预览 / 取消选中 |

连续输入（改文案、拖滑块）会合并成一次撤销；新增 / 删除 / 移动 / 复制这类结构性操作各自独立成步。

架构说明与设计取舍见 [ARCHITECTURE.md](ARCHITECTURE.md)。


### 键盘拖拽（v0.2.1）

聚焦画布节点、图层行或组件按钮，按 Space / Enter 开始；Down / Right 按文档顺序选择下一个合法插入位置，Up / Left 选择上一个；Space / Enter 确认，Esc 取消。首次向前从首个合法位置开始，首次向后从最后一个合法位置开始。只导航当前可见落点，若需进入折叠的图层，请先展开。位置提示由屏幕阅读器播报，插入线显示实际位置。拖拽期间暂停编辑器删除、撤销等快捷键。
