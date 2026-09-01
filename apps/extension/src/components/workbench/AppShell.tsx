import type { ReactNode } from 'react';

export type WorkbenchNavId =
  | 'diagnosis'
  | 'keywords'
  | 'titles'
  | 'detail'
  | 'compete'
  | 'buyers'
  | 'monitor'
  | 'history';

const NAV: Array<{ id: WorkbenchNavId; label: string; icon: string; ready: boolean }> = [
  { id: 'diagnosis', label: '商品诊断', icon: '▣', ready: true },
  { id: 'keywords', label: '关键词优化', icon: '⌕', ready: true },
  { id: 'titles', label: '标题优化', icon: '✎', ready: true },
  { id: 'detail', label: '详情页优化', icon: '▤', ready: true },
  { id: 'compete', label: '竞争分析', icon: '◈', ready: false },
  { id: 'buyers', label: '买家洞察', icon: '☺', ready: false },
  { id: 'monitor', label: '监控中心', icon: '◉', ready: false },
  { id: 'history', label: '历史记录', icon: '◷', ready: false },
];

export function AppShell({
  version,
  connected,
  nav,
  onNav,
  children,
}: {
  version: string;
  connected: boolean;
  nav: WorkbenchNavId;
  onNav: (id: WorkbenchNavId) => void;
  children: ReactNode;
}) {
  return (
    <div className="app-shell" data-connected={connected ? 'yes' : 'no'}>
      <aside className="app-nav">
        <div className="app-nav__brand">
          <strong>MIC 店铺医生</strong>
          <span className="app-nav__pro">Pro</span>
          <em>v{version}</em>
        </div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={nav === item.id ? 'app-nav__item app-nav__item--active' : 'app-nav__item'}
              onClick={() => onNav(item.id)}
            >
              <span className="app-nav__icon">{item.icon}</span>
              {item.label}
              {item.ready ? null : <i>即将推出</i>}
            </button>
          ))}
        </nav>
        <div className="app-nav__assist">
          <p>AI 助手</p>
          <span>商品身份、标题与关键词门禁</span>
          <button type="button" disabled>
            立即咨询
          </button>
        </div>
      </aside>
      <div className="app-body">{children}</div>
    </div>
  );
}
