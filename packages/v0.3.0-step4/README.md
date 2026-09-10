# v0.3.0 Step 4 交付包

与 Step 1 / Step 3 相同的两个文件：

| 文件 | 说明 |
|---|---|
| `ai-store-doctor-page-builder-0.3.0-step4-modules.tar.gz` | 仅 Step 4 新增模块 + 测试 + 报告 |
| `ai-store-doctor-page-builder-0.3.0-step4-src.tar.gz` | 完整可构建源码（无 node_modules / dist / .git） |

校验：`sha256sum -c checksums-step4.sha256`

源码包解压后：

```bash
npm ci
npm run typecheck
npm run test
npm run smoke
npm run dev
```
