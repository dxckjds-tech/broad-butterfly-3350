import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'apps/extension/dist');
const repoLoadDir = path.join(root, 'AI-店铺医生-插件');
const homeLoadDir = path.join(homedir(), 'AI-店铺医生-插件');

if (!existsSync(path.join(src, 'manifest.json'))) {
  console.error('未找到构建产物。请先运行：pnpm --filter @trade-ai/extension build');
  process.exit(1);
}

function copyLoadDir(target) {
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
      `本机完整路径：`,
      target,
      '',
    ].join('\n'),
    'utf8',
  );
}

copyLoadDir(repoLoadDir);
copyLoadDir(homeLoadDir);

console.log('Chrome 加载时请选择下面任一目录（不要选上一级）：');
console.log(repoLoadDir);
console.log(homeLoadDir);
