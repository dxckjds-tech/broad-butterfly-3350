# AI Store Doctor Page Builder v0.2.1 — Core Review Fixes

## 结果

基于上传的 v0.2.0 源码原地修复，保留 core → store → UI 的架构、组件注册表、Schema 版本 1、现有依赖版本及持久化格式。未添加 AI、后端或业务组件。上传的旧 dist 包目录有效；交付 dist 为修复后重新构建的产物。

## 修改内容

- computeDropPlan 保留当前位置的 inside/beside 优先级；候选无效时逐层向祖先回退，找到最近合法父容器，直到根节点。指示线 overId 指向对应祖先，index 保持删除前索引，与 MOVE_NODE 一致。前后方向沿用悬停矩形与指针位置，并按候选父容器方向判断。
- 明确拒绝根节点移动、不存在或类型不匹配的 active 节点、自身与自身子树目标（含 drop: 前缀）；非法落点不生成计划。
- 新增 UPDATE_PAGE_META，仅允许编辑当前模型实际存在的可编辑元数据 name。id、root、schemaVersion 不作为元数据暴露，updatedAt 由 reducer 维护。相同名称或空 patch 不产生历史。
- renamePage 委托 dispatch。名称输入通过现有 useEditTransaction 聚合 focus/blur 之间的连续输入，支持撤销、重做、分支历史及保存。
- 基础无障碍：状态通知使用带名称的 status；折叠按钮提供 aria-expanded；Tabs 使用活动项 tabIndex，支持左右方向键、Home、End；普通 IconButton 不再默认声称是切换按钮。
- 新增 14 个 dropPlan 测试、5 个 keyboardDropPlan 测试、4 个元数据历史测试、8 个完整 EditorShell UI 集成测试；原 72 个测试保留，总计 103 个。
- 补齐画布、图层、组件面板的键盘拖拽：方向键按文档顺序选合法且可见的插入位置，Space/Enter 确认，Esc 取消；排除自身子树、无效移动。位置通过屏幕阅读器提示，使用现有 DnD 与 Command 生命周期。
- 拖拽时暂停编辑器快捷键；鼠标坐标改为捕获阶段更新，并在 onDragOver 同步计划，避免旧坐标或旧落点。

## 实际修改文件

- `ARCHITECTURE.md`
- `README.md`
- `package-lock.json`
- `package.json`
- `src/editor/canvas/__tests__/dropPlan.test.ts`（新增）
- `src/editor/canvas/__tests__/keyboardDropPlan.test.ts`（新增）
- `src/editor/canvas/dropPlan.ts`
- `src/editor/canvas/keyboardDropPlan.ts`（新增）
- `src/editor/core/commands.ts`
- `src/editor/core/reducer.ts`
- `src/editor/hooks/useKeyboardDrag.ts`（新增）
- `src/editor/hooks/useKeyboardShortcuts.ts`
- `src/editor/hooks/usePointerPosition.ts`
- `src/editor/layers/LayerRow.tsx`
- `src/editor/layers/LayersPanel.tsx`
- `src/editor/layout/EditorShell.tsx`
- `src/editor/layout/Toolbar.tsx`
- `src/editor/layout/__tests__/integration.test.tsx`（新增）
- `src/editor/store/__tests__/history.test.ts`
- `src/editor/store/editorStore.ts`
- `src/editor/ui/IconButton.tsx`
- `src/editor/ui/Tabs.tsx`

另外新增本报告 REVIEW-v0.2.1.md，源码包内附同一份报告。

## 实际验证结果

验证日期：2026-09-10（本机 macOS）。

| 检查 | 结果 |
|---|---|
| npm ci | 上一轮默认缓存曾因权限失败；本轮 `npm ci --cache ../npm-cache` 成功，2 秒安装 123 个包，未更改依赖版本 |
| npm run typecheck | PASS，退出码 0 |
| npm run test | PASS，9 个测试文件，103/103 通过 |
| npm run smoke | PASS，32 个检查全部通过 |
| npm run build | PASS，2024 个模块，生成 dist/index.html、CSS、JS |

首次 UI 测试暴露 jsdom 不提供 ResizeObserver；测试中仅替换该浏览器布局 API，React、DnD 组件、store、reducer、持久化均使用真实实现。另修正了状态提示的定位，区分 DnD 自带的 status 区域。最终完整检查链全部成功。

生产构建：JS 442.21 kB（gzip 135.21 kB），CSS 23.51 kB（gzip 5.46 kB）。

## 真实浏览器验证

在本机真实浏览器以桌面尺寸验证以下操作，全部通过：

- 画布标题：Space 开始，方向键选择插入位置，观察插入线与目标位置一致，Enter 落地后顺序正确；Undo 恢复原顺序。
- 鼠标将标题从 Section 拖入 Columns 下的空 Container，实际节点层级正确。
- 图层标题：Space 开始、方向键选择外层 Section 位置、Space 确认，标题从内层容器移动到外层。
- 图层 Esc 取消，页面结构保持不变。
- 组件面板 Button：键盘选择落点后 Enter 确认，只新增一个按钮。
- 浏览器日志检查：无 error/warn。

## 尚未解决问题与验证边界

- 本次要求的修复与验证均完成，无剩余的类型检查、测试、smoke 或构建失败。
- 键盘按文档顺序选择合法且可见的位置，不采用屏幕像素方向寻找最近节点；若需进入折叠图层，应先展开。操作说明已写入 README 与辅助技术提示。
- 本轮已做真实浏览器关键操作验证，但不等于全浏览器、全设备兼容性认证，也未进行完整 WCAG / 屏幕阅读器专项审计。

## 交付

- ai-store-doctor-page-builder-0.2.1-src.tar.gz：完整源码、锁文件、配置、测试与文档，根目录 page-builder/；排除 node_modules、缓存、dist、dist-smoke 和 TypeScript 增量产物。
- dist.tar.gz：本次生产构建，根目录 dist/。
- v0.2.1-changes.patch：相对原上传源码的修改补丁（报告单独附带）。

解压源码后执行 npm ci；开发运行 npm run dev，构建执行 npm run build。
