import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'apps/extension/dist');
const home = homedir();
const targets = [
  path.join(root, 'AI-店铺医生-插件'),
  path.join(home, 'AI-店铺医生-插件'),
  path.join(home, 'Desktop', 'AI-店铺医生-插件'),
  path.join(home, '桌面', 'AI-店铺医生-插件'),
];

if (!existsSync(path.join(src, 'manifest.json'))) {
  console.error('未找到构建产物。请先运行：pnpm --filter @trade-ai/extension build');
  process.exit(1);
}

function copyLoadDir(target) {
  mkdirSync(path.dirname(target), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(src, target, {
    recursive: true,
    filter: (file) => !file.includes(`${path.sep}.vite${path.sep}`) && !file.endsWith(`${path.sep}.vite`),
  });
  writeFileSync(
    path.join(target, '请选择当前这个文件夹.txt'),
    [
      'Chrome / Edge 加载插件时：',
      '请选中「AI-店铺医生-插件」这一层文件夹（本文件所在目录）。',
      '该目录内必须能看到 manifest.json。',
      '',
      '版本：0.6.7（可连接远程 API · DeepSeek 标题+关键词+类目+描述+GEO · 不保存 API Key）',
      target,
      '',
    ].join('\n'),
    'utf8',
  );
}

for (const target of targets) {
  copyLoadDir(target);
}

const { execSync } = await import('node:child_process');
const zipPath = path.join(root, 'AI-店铺医生-插件.zip');
execSync(`rm -f ${JSON.stringify(zipPath)} && zip -r ${JSON.stringify(zipPath)} AI-店铺医生-插件 -x "*.DS_Store"`, {
  cwd: root,
  stdio: 'inherit',
});
for (const dir of [path.join(home, 'Desktop'), path.join(home, '桌面')]) {
  mkdirSync(dir, { recursive: true });
  cpSync(zipPath, path.join(dir, 'AI-店铺医生-插件.zip'));
}

console.log('Chrome 加载时请选择下面任一目录（不要选上一级）：');
for (const target of targets) {
  console.log(target);
}
