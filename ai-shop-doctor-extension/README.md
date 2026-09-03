# AI 店铺医生 · MIC AI 运营系统 Chrome 插件

面向 Made-in-China.com 外贸运营人员的商品理解与运营决策 Chrome 扩展。

## 功能

### Chrome 侧边栏（Side Panel）
- **Tab 1 概览**：三项核心指标进度条（数据完整度 / 身份可信度 / 内容就绪度），冲突阻断卡，下一步建议
- **Tab 2 商品真相**：身份 Top3 候选，类目候选，属性证据卡（VERIFIED / OBSERVED / INFERRED / UNKNOWN 状态），推理摘要
- **Tab 3 关键词**：当前关键词 chip，已拦截关键词（含原因码），候选关键词（匹配度/意图/搜索需求），正式 Top3（NOT_AVAILABLE 灰卡）
- **Tab 4 内容优化**：标题 / 详情 / FAQ / GEO / 翻译 五个子 Tab，冲突时显示红色阻断卡；解除冲突后显示 3 个安全标题建议（已采用事实 + 已排除风险 + 复制/翻译/证据按钮）
- **Tab 5 证据与调试**：字段统计，事实台账，工具连接状态，开发模式（Reasoning Steps / 已否决假设 / FactGuard / KeywordGate）
- **身份确认浮层**：覆盖整个面板，列出候选 A/B/C + 手动输入，每项含支持/反对证据，确认后解除全局冲突态

### Admin 运营驾驶舱
- **今日概览**（`admin/index.html`）：6 个统计卡片，任务表格（筛选 chip + 排序），右侧抽屉详情
- **商机与 Quick Wins**（`admin/opportunities.html`）：3 个顶部统计卡，Opportunity 明细表格（搜索机会始终 NOT_AVAILABLE），右侧抽屉详情

## 安装

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本目录（`ai-shop-doctor-extension/`）
4. 点击 Chrome 工具栏的扩展图标，侧边栏自动打开

## 文件结构

```
ai-shop-doctor-extension/
├── manifest.json          # Chrome 扩展清单（Manifest V3）
├── background.js          # Service Worker：打开侧边栏 / Admin 页面
├── content.js             # 内容脚本：从 MIC 页面提取产品信息
├── sidepanel.html         # 侧边栏主 HTML（420px 宽）
├── sidepanel.js           # 侧边栏交互逻辑（纯 DOM，无框架依赖）
├── state.js               # 全局状态管理 + 静态数据
├── icons/                 # 扩展图标（16/32/48/128px）
└── admin/
    ├── index.html         # 今日概览驾驶舱
    └── opportunities.html # 商机与 Quick Wins 驾驶舱
```

## Design Tokens

| Token | 值 |
|---|---|
| 主色（侧边栏/主按钮） | `#0F2540` |
| 青绿（激活/链接） | `#0E8E82` |
| VERIFIED | `#1C9A5A` bg `#EAF7EF` |
| OBSERVED | `#2D6FE0` bg `#EAF1FD` |
| INFERRED | `#C8901A` bg `#FFF6DC` |
| CONFLICT | `#C63C3C` bg `#FDEAEA` |
| NOT_AVAILABLE | `#6B7280` bg `#F1F2F4` |

## 核心原则

- **事实优先**：所有建议必须基于已验证/已观察事实，推断值需标注置信度
- **冲突优先于生成**：身份冲突未解除时标题/关键词生成功能暂停
- **没有数据就显示没有数据**：搜索数据未接入时统一显示 NOT_AVAILABLE 灰卡
- **建议与执行分离**：默认 DRY_RUN，不自动写回 MIC 平台
