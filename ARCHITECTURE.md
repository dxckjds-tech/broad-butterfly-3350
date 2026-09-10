# AI Store Doctor — Page Builder 架构说明

当前版本 **v0.2.1 — Core Review Fixes**。

v0.1 交付的是"能跑的编辑器框架"；v0.2 把它加固成可以继续往上盖业务的核心：真实拖拽排序、
事务化历史、可拒绝脏数据的 Schema、集中的节点兼容规则、图层面板、schema 驱动的 Inspector、
自动保存与崩溃恢复，以及一套正式单元测试。

仍然**不含** AI 生成、后端、发布系统。所有设计取舍都以"第二期接 AI 与发布时不用重写"为准。

技术栈：React 19 + TypeScript 5.9（strict）+ Vite 8 + Zustand 5 + @dnd-kit/core 6 +
@dnd-kit/sortable 10 + Zod 4 + Tailwind CSS 4 + lucide-react；测试用 Vitest 5 + jsdom。

---

## 1. 分层与目录

```
src/
├── main.tsx                 挂载入口；side-effect 导入组件注册表
├── App.tsx / pages/         路由级页面（当前只有 EditorPage）
├── utils/cn.ts              极小的 className 拼接工具
└── editor/
    ├── core/                纯逻辑，零 React、零 DOM
    │   ├── types.ts         EditorNode / PageDocument / Device / StyleMap
    │   ├── ids.ts           id 生成
    │   ├── limits.ts        MAX_TREE_DEPTH / MAX_NODE_COUNT / HISTORY_* 的唯一出处
    │   ├── schema.ts        不可信输入的唯一入口：preflight → Zod → migrate → validate
    │   ├── validate.ts      树级不变量校验，返回全部 issue 而不是抛第一个
    │   ├── migrations/      版本迁移链（index.ts 运行器 + v1.ts）
    │   ├── rules.ts         canInsertNode / explainInsert：节点兼容规则的唯一出处
    │   ├── tree.ts          不可变树操作：查找 / 插入 / 删除 / 克隆 / 路径
    │   ├── styles.ts        响应式层级解析（desktop → tablet → mobile）
    │   ├── commands.ts      Command 联合类型 + 结构性判定 + 合并键
    │   ├── reducer.ts       applyCommand(page, command) → page（纯函数）
    │   ├── registry.ts      组件注册表
    │   ├── props.ts         props 的类型安全读取器
    │   └── __tests__/       tree / reducer / schema / styles 单元测试
    ├── store/               Zustand：状态容器 + 历史栈 + 持久化 + 自动保存
    │   └── __tests__/       history / autosave 单元测试
    ├── components/          八个内置组件，一个文件一个组件
    ├── canvas/              画布、递归渲染器、drop 规划、指示线、选中浮层、面包屑
    ├── layers/              图层树面板
    ├── inspector/           右侧属性面板（Content / Style / Advanced）
    ├── layout/              Toolbar、左右面板、EditorShell、恢复提示条
    ├── presets/             Section / Template 预设（纯数据）
    ├── hooks/               选中节点、盒模型测量、快捷键、编辑事务、指针位置、自动保存
    └── ui/                  与编辑器无关的通用小控件
```

**依赖方向是单向的**：`core` 不 import 任何上层；`store` 只依赖 `core`；
`components / canvas / layers / inspector / layout` 依赖 `core + store`。
因此 `core` 可以整块搬到 Node 端复用（第二期的 SSR 渲染、发布产物生成、AI 生成结果校验都需要它）。

---

## 2. 数据模型

```ts
interface EditorNode {
  id: string
  type: string                    // 注册表 key
  props: Record<string, unknown>  // 组件自有属性，故意不收窄
  styles: ResponsiveStyles        // { desktop?, tablet?, mobile? }
  children?: EditorNode[]
}

interface PageDocument {
  id: string
  name: string
  schemaVersion: number
  root: EditorNode
  updatedAt: string
}
```

v0.2 **没有改动**这个结构 —— 加固的是它的入口，不是它本身。

三个刻意的决定：

**props 是 `Record<string, unknown>` 而不是泛型。** 页面文档要能 JSON 序列化、跨版本读取、被 AI
生成的 JSON 填充。如果把 props 做成 `EditorNode<HeadingProps>`，树里就无法混装不同组件，
Zod 校验也会退化成一堆判别联合。代价是渲染器读 props 时要收窄，这由 `core/props.ts` 的
`getString / getNumber / getBoolean / getStringArray` 统一承担 —— 全项目没有一处 `as any`。

**样式是三层覆盖，不是三份完整样式。** `resolveStyles` 按 desktop → tablet → mobile 依次浅合并。
写入时 `mergeStyleLayer` 把 `null` 当作"删除该声明"，所以移动端可以显式清掉某个继承来的属性；
某层被清空后整层会被删掉，文档里不留空对象。`hasOverride` 回答"这层自己声明了吗"，
`originOf` 回答"这个值最终来自哪一层"——Inspector 的三态标记就建立在这两个函数上。

**schemaVersion 有了真正的迁移入口。** 见下一节。

### 2.1 不可信输入：四段式流水线

`parsePageDocument(input)` 是 localStorage、草稿、导入文件、以及第二期 API / AI 输出的**唯一**入口。
顺序是有原因的：

1. **preflight** —— 在原始值上做环检测、深度和节点数上限。递归的 Zod schema 遇到循环引用会
   一直走下去，所以形状守卫必须在 Zod 之前。
2. **Zod** —— 字段形状与类型。`schemaVersion` 这一段只要求"非负整数"，
   版本策略交给迁移层，否则老文档会在能被迁移之前就被形状校验挡掉。
3. **migrate** —— 低于当前版本的按顺序跑迁移链；等于当前版本原样返回；
   高于当前版本**拒绝**（新版编辑器写的文档，我们会静默丢掉不认识的字段）。
4. **validate** —— Zod 表达不了的树级不变量，一次性返回全部问题：

| IssueCode | 含义 |
|---|---|
| `SHAPE` | 没过 Zod 形状校验 |
| `DUPLICATE_ID` | 全树 id 不唯一 |
| `EMPTY_ID` | id 为空或全空白 |
| `ROOT_MISSING` / `ROOT_TYPE` | 缺 root 或 root.type 不是 `root` |
| `UNKNOWN_TYPE` | 组件类型不在注册表里 |
| `ILLEGAL_CHILDREN` | 非容器带 children，或子节点不被该父节点接受 |
| `DEPTH_EXCEEDED` | 嵌套超过 `MAX_TREE_DEPTH` |
| `NODE_COUNT_EXCEEDED` | 节点数超过 `MAX_NODE_COUNT` |
| `CYCLE` | 循环引用 |
| `VERSION_TOO_NEW` | 文档版本高于本编辑器 |

上限集中在 `core/limits.ts`，本文档引用的就是那里的常量名：
`MAX_TREE_DEPTH = 32`、`MAX_NODE_COUNT = 5000`、`HISTORY_LIMIT = 100`、
`HISTORY_MERGE_WINDOW_MS = 600`、`AUTOSAVE_DEBOUNCE_MS = 1200`。改数字只改那一个文件。

### 2.2 迁移链

```
core/migrations/
├── index.ts   migratePageDocument()：运行器 + 版本受理策略
└── v1.ts      migrateToV1()
```

当前只有版本 1，`migrateToV1` 因此几乎是空的 —— 它存在的目的是让**下一次迁移是复制一个文件，
而不是新造一套机制**。运行器按 `to` 递增依次施加所有高于文档版本的步骤，
跑完仍未到 `SCHEMA_VERSION` 就报"无迁移路径"，不会放一个半迁移的文档进编辑器。

---

## 3. Command 系统、历史栈与事务

所有变更都走 `applyCommand(page, command) → PageDocument`，一个纯函数：

| Command | 语义 | 结构性 |
|---|---|---|
| `UPDATE_PAGE_META` | 更新页面名称，支持事务与历史合并 | 否 |
| `ADD_NODE` | 插入到 parent 的 index（缺省追加），先过兼容规则 | 是 |
| `DELETE_NODE` | 删除，root 受保护 | 是 |
| `MOVE_NODE` | 跨父移动；禁止移入自身子树；先过兼容规则 | 是 |
| `DUPLICATE_NODE` | 深拷贝并重发 id，插到原节点之后 | 是 |
| `UPDATE_PROPS` | 浅合并 props | 否 |
| `UPDATE_STYLE` | 写入指定 device 层，`null` 表示删除 | 否 |
| `SELECT_NODE` | 选中（**不进历史**） | — |

两个关键约定保持不变：

1. **无变化时返回同一个引用。** 删除不存在的节点、把节点移到自己里面、把节点移到它已经在的位置、
   插入一个父节点不接受的类型，`applyCommand` 都原样返回 `page`。Store 靠引用相等判断
   "这次 dispatch 什么都没发生"，于是不会往历史栈里压一条空记录。
2. **选中不是历史。** 否则撤销会先倒退一串点击。

历史栈是 `PageDocument[]` + 游标，上限 `HISTORY_LIMIT = 100`（源码与本文档同源于 `limits.ts`）。
文档是不可变结构，未改动的子树在版本之间共享引用，所以整页快照的实际内存开销接近 diff。

### 3.1 合并：连续输入只占一步

输入 `H / He / Hel / Hell / Hello` 应该是**一次**撤销，而不是五次。机制有两层：

- **隐式合并**：`mergeKeyOf(command)` 为可合并命令生成一个键（`nodeId` + device + 被改属性集合）。
  相邻两条命令键相同、且间隔在 `HISTORY_MERGE_WINDOW_MS` 内、且游标位于栈顶时，
  替换栈顶记录而不是追加。换节点、换属性、换断点都会自然产生不同的键，因此不会误合并。
- **显式事务**：`beginTransaction(label)` / `commitTransaction()`。事务期间所有可合并命令共用一个键，
  **不受时间窗限制** —— 用户在输入框里想多久都算一步。UI 侧由 `hooks/useEditTransaction.ts`
  把它接到 focus/blur（取色器用 pointerdown/pointerup），这样"点进输入框、改一串、点出去"就是一步。

**结构性命令永不合并**，并且会关闭当前所有合并状态（包括正在进行的事务）：
"输入标题然后删掉这个节点"必须是两步撤销。

---

## 4. 组件注册表与兼容规则

一个组件 = 一个文件 + 一次 `registerComponent()`：

```ts
registerComponent({
  type: 'heading',
  label: 'Heading',
  category: 'basic',
  icon: Type,
  acceptsChildren: false,
  allowedParents: ['section', 'container'],   // 可选
  allowedChildren: ['container'],             // 可选（见 Columns）
  canDrop: (parent, child) => boolean,        // 可选，最高优先级
  defaultProps: { text: 'Heading', level: 'h2' },
  defaultStyles: { desktop: { fontSize: '32px', fontWeight: '700' } },
  renderer: HeadingRenderer,
  inspector: HeadingInspector,   // 可选
})
```

**"这个节点能放进那个节点吗"只有一个答案来源**：`core/rules.ts` 的
`canInsertNode(parentType, childType)`（布尔，拖拽热路径用）和 `explainInsert(...)`
（带原因，UI 提示用）。优先级从高到低：`parent.canDrop` → `parent.allowedChildren` →
`child.allowedParents` → `parent.acceptsChildren`。

调用方全部指向这一套：`ADD_NODE` / `MOVE_NODE` reducer、拖拽的 drop 规划、图层面板的拖放、
以及文档校验（`ILLEGAL_CHILDREN`）。**Canvas JSX 里没有任何兼容判断** —— 同一条规则写在两处，
第一次改动就会开始互相矛盾。

现有约束：root 只接 `section / container / columns`；`columns` 只接 `container`；
非容器（heading / text / button / image / spacer）不接任何子节点。

### chrome：不套壳的选中/拖放接线

递归渲染器不给节点包一层 wrapper div，而是把一组属性（`data-node-id`、className、
resolved style、点击/悬停回调、dnd-kit 的 sortable/droppable ref）打包成 `chrome`，
交给渲染器自己展开到它的根元素上：

```tsx
function SectionRenderer({ chrome, children }: RendererProps) {
  return <section {...chrome}>{children}</section>
}
```

这样导出的 DOM 就是用户设计的 DOM，没有编辑器留下的额外层级 —— 第二期做发布时
不需要再写一遍"去掉编辑器包装"的逻辑。选中框和工具条画在一个绝对定位的浮层里
（`SelectionOverlay`），用 `getBoundingClientRect` 相对设备框测量，不参与布局。

内置八个组件：Section、Container、Columns（布局）／Heading、Text、Button、Spacer（基础）／Image（媒体）。

---

## 5. 拖拽排序

用 `@dnd-kit/core` + `@dnd-kit/sortable`，三条路径共用同一套落点计算：
左侧面板拖入、画布内节点拖动、图层面板拖动。

### 5.1 落点是纯函数

`canvas/dropPlan.ts` 的 `computeDropPlan()` 接收"命中的节点、指针坐标、被拖动的类型、
容器的主轴方向"，返回一个 `DropPlan`：

```ts
type DropPlan = {
  parentId: string
  index: number
  edge: 'before' | 'after' | 'inside'
  targetId: string    // 指示线画在谁身上
}
```

规则：命中容器且它接受该类型 → 落在容器内（空容器 `inside`，非空则按指针落到首/尾）；
命中叶子节点 → 按指针在该元素矩形内的位置取 `before` / `after`，父节点取它的父容器；
父容器不接受该类型时**向上回退**，直到找到接受它的祖先，找不到就放弃。
判定用的是同一个 `canInsertNode`，所以"看得见的指示线"和"真的会插进去"永远一致。

它是纯函数，不碰 DOM、不碰 store，所以可以直接单测。

### 5.2 最深命中优先

嵌套容器会同时命中多个 droppable，碰撞检测用自定义的 `deepestPointerWithin`：
在 `pointerWithin` 的结果里按节点深度取最深的一个，否则拖到内层容器会被外层 Section 抢走。
`Canvas` 另外注册了一个 depth `-1` 的兜底 droppable，让"拖到画布空白处"也有明确落点。

### 5.3 指示线

`canvas/DropIndicator.tsx` 只有两种形态：夹在两个兄弟之间的**插入线**（按主轴自动转 90°），
和空容器/容器整体的**高亮框**。它由 `DropPlanContext` 驱动，NodeRenderer 只根据
"当前 plan 是否指向我"决定画不画，节点自己不参与落点决策。

排序期间用 `sortStrategy.ts` 的 `noShiftStrategy`：dnd-kit 默认会把兄弟节点推开腾位置，
但页面编辑器里布局本身就是内容，推开会让用户以为页面已经变了。所以位置靠指示线表达，
节点保持不动。

### 5.4 落地仍然只走 Command

拖拽结束时 `EditorShell` 把 `DropPlan` 翻译成 `ADD_NODE` 或 `MOVE_NODE` 派发出去。
**UI 不允许直接改树**，dnd-kit 只提供坐标和命中，不拥有状态。

palette item 同时支持点击追加，PointerSensor 设了 6px 激活阈值，所以点击与拖拽不互相干扰。

---

## 6. 图层面板

`layers/LayersPanel.tsx` 展示整棵树：展开/折叠（选中节点的祖先自动展开）、点击选中、
hover 与画布双向联动、当前选中高亮、组件图标 + 标签（标签取自节点 props 的文本，退化到组件名）。
root 不可删除、不可拖动。

拖拽复用画布那套语义：`before` / `after` / `inside` 由指针在行内的位置决定，
落点同样过 `canInsertNode`，最终同样派发 `MOVE_NODE`。
**没有第二套树修改逻辑** —— 这是这个面板唯一的硬性约束。

---

## 7. Inspector

三页：

- **Content** —— 渲染 `definition.inspector`，组件自己定义有哪些字段。
- **Style** —— schema 驱动。`inspector/styleFields.ts` 用声明式数组描述分组
  （Typography / Background / Layout / Size / Spacing / Border / Radius / Shadow）。
  **加一个样式控件 = 往数组里加一行，不写 JSX。**
- **Advanced** —— 锚点 id、自定义 class、分端可见性、以及只读的节点 JSON（调试用）。

v0.2 的三个加强：

**带单位的数值控件。** `inspector/dimension.ts` 把 CSS 长度解析成 `{ value, unit }`，
支持 `px / % / rem / em / vw / vh` 与 `auto / none` 关键字。**解析不了的值（如 `calc(...)`）
不会被改写**，控件退化成纯文本输入框原样透传 —— 编辑器不能因为看不懂就悄悄破坏用户的样式。

**四边联动。** Margin / Padding / Radius 用 `SidesInput`：联动模式下四个方向一次 patch
写进同一条命令，所以"改一次内边距"是一步撤销，而不是四步。

**三态标记。** 每个字段旁边区分 overridden（本断点自己声明）/ inherited（来自更宽断点，
并标出来自哪一层）/ unset，由 `originOf` 计算。配套 Reset property 与 Reset breakpoint。

Style 页写入的 key 就是 camelCase 的 CSS 属性名，直接进 `styles[device]`，没有中间 DSL ——
这是为了让第二期 AI 的"改样式"动作可以直接产出同一份 JSON。

---

## 8. 持久化、自动保存与崩溃恢复

`store/persistence.ts` 管两个 localStorage 槽：

| key | 谁写 | 语义 |
|---|---|---|
| `asd.page-builder.document.v1` | 手动保存（Save / ⌘S） | 已提交的文档 |
| `asd.page-builder.draft.v1` | 自动保存 | 未提交的草稿（带写入时间戳） |

**分成两个槽是崩溃恢复能成立的前提**：如果自动保存直接盖掉已保存文档，崩溃后就没有"原来的版本"
可以对照了。现在崩溃后已提交文档完好，草稿是编辑器**提供给用户选择**的东西，而不是悄悄替换掉的东西。

- **自动保存**：`hooks/useAutosave.ts`，文档每次变化重启 `AUTOSAVE_DEBOUNCE_MS` 计时器，
  一串连续编辑只写一次；另外在 `pagehide` 和标签页转入后台时立刻 flush（标签页可能在防抖中途被关掉）。
  store 里的 `autosave` action **不碰 page、不碰 history** —— "自动保存不污染历史"是结构上的保证，
  不是约定。
- **崩溃恢复**：启动时两个槽都读。草稿不比已保存文档旧时，放进 `recovery` 状态并弹出提示条
  （Restore / Discard 由用户决定）。手动保存会清掉草稿，因此还留着的草稿必然晚于上一次保存。
- **手动保存**：`updatedAt` 只写进存储副本，不写回 state —— 否则 `state.page` 会和它所来自的
  history 记录分叉，撤销时会出现一次无意义的时间戳回退。
- **状态显示**：工具栏的 `SaveStatus` 显示 dirty 圆点 + 最后写入时间，并区分 Saved / Autosaved，
  所以"Saved"永远指已提交文档。

读取时**一定**过 `parsePageDocument`：草稿和已保存文档都当不可信输入处理。
校验失败不会让编辑器白屏 —— 清掉脏数据、落回空白页、在工具栏提示一句。
这条路径同时也是第二期"从 API 拉取页面"和"校验 AI 生成的 JSON"要走的路径。

---

## 9. 测试

```
src/editor/core/__tests__/     fixtures.ts / tree / reducer / schema / styles / sanity
src/editor/store/__tests__/    history（含 autosave 与恢复）
```

103 个用例，覆盖：

- **tree** —— findNode / findParent / depth / index / insert（含索引钳制）/ remove /
  update / cloneWithNewIds（id 全新、不共享 props 与 styles 对象）/ collectIds 唯一性 / isDescendant。
- **reducer** —— 六个命令的正常路径 + 拒绝路径（拖入自身子树、root 保护、被规则拒绝的落点）、
  no-op 的引用相等、兼容规则本身。
- **schema** —— 正常文档、各类 malformed 输入、循环引用、重复 id、空白 id、
  未知组件、非法 children、深度上限、版本过新拒绝、旧版本迁移。
- **styles** —— desktop / tablet / mobile 三层继承、清除覆盖后回落、`originOf` 判定、空层删除。
- **history** —— undo / redo / 撤销后分支截断 / 连续输入合并成一步 / 时间窗过期后分段 /
  事务跨时间窗合并 / 结构性命令隔离 / 自动保存不进历史 / 恢复与丢弃草稿 / 脏数据不白屏。

保留了 v0.1 的 `npm run smoke`：把应用按 SSR 打包后在 Node 里跑一遍，
验证"导入顺序 / 注册表填充 / 首屏渲染"这类只有运行期才暴露的问题。单测和 smoke 是互补的，不是重复。

### 验证方式

```bash
npm install
npm run typecheck   # tsc -b（strict）
npm run test        # Vitest（jsdom）
npm run smoke       # 无头校验：reducer / styles / schema / presets / SSR render
npm run build       # tsc -b + vite build
npm run dev         # 开发服务器
```

---

## 10. 当前边界

以下是**明确没做**的，不是遗漏：

1. **没有键盘拖拽排序的完整语义。** KeyboardSensor 已接入，但键盘落点仍走 dnd-kit 默认行为，
   没有像指针那样的 before/after 细分。
2. **富文本只到 `contentEditable` 级别**，没有工具条、没有内联样式片段。
3. **图片是 URL 输入**，没有上传、没有媒体库（要等后端）。
4. **没有多页面 / 路由**，一次只编辑一个 PageDocument。
5. **没有协同、没有权限。**
6. **自动保存只写 localStorage**，没有服务端草稿、没有版本历史（换成 fetch 即可，见下）。
7. **组件级测试很薄**：单测集中在 `core` 与 `store`（纯逻辑收益最高），
   UI 层只有 smoke 的一次 SSR 渲染兜底。
8. **未做无障碍审计**：焦点顺序、ARIA 标注是随手补的，没有系统检查过。

---

## 11. 第二期怎么接

- **AI 生成页面** → 让模型直接产出 `PageDocument` JSON，过 `parsePageDocument` 校验，
  再 `replacePage()`。不需要新的数据通路。
- **AI 局部改写** → 让模型产出 `Command[]`，逐条 `applyCommand`；用一个事务包起来，
  整次 AI 改写就是一步撤销。天然可审计。
- **后端存储** → 把 `persistence.ts` 的两个槽换成 fetch，store 的接口形状不变。
- **发布** → `core/` 整块搬到服务端，用同一套 `resolveStyles` + 注册表渲染静态 HTML。
  这正是 chrome 机制不给节点套 wrapper 的原因。
- **组件市场** → 注册表已经是运行时 Map，`allowedParents / allowedChildren / canDrop`
  让远程注册的组件也能声明自己的嵌套约束，不需要改 core。


### v0.2.1 键盘拖拽补充

`keyboardDropPlans` 按树顺序枚举合法插入位置，使用同一兼容规则，排除自身子树与同层无效移动。`useKeyboardDrag` 通过 KeyboardSensor 的正常事件生命周期驱动计划，并筛选可见落点；键盘模式不依赖 pointerWithin 或历史鼠标坐标。画布与图层共享规则，鼠标仍采用原来的几何命中。pointermove 在捕获阶段更新坐标；onDragOver 同步更新计划，防止命中切换后沿用旧计划。
