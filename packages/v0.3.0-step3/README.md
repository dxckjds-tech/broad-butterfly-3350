# v0.3.0 Step 3 交付包

与 Step 1 相同的两个文件：

| 文件 | 说明 |
|---|---|
| `ai-store-doctor-page-builder-0.3.0-step3-modules.tar.gz` | 仅 Step 3 新增模块 + 测试 + 报告 |
| `ai-store-doctor-page-builder-0.3.0-step3-src.tar.gz` | 完整可构建源码（无 node_modules / dist / .git） |

校验：`sha256sum -c checksums-step3.sha256`

源码包解压后：

```bash
npm ci
npm run typecheck
npm run test
npm run smoke
npm run dev
```
