// Utility helpers
function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k === 'style') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  });
  children.flat().forEach(c => {
    if (c == null) return;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
}
function div(props, ...c) { return el('div', props, ...c); }
function span(props, ...c) { return el('span', props, ...c); }
function btn(props, ...c) { return el('button', props, ...c); }

function badgeEl(status) {
  const s = ss(status);
  const e = span({ class: 'badge' }, s.label);
  e.style.background = s.bg;
  e.style.color = s.fg;
  e.style.border = `1px solid ${s.border}`;
  return e;
}

function metricColor(val) {
  return val >= 70 ? '#1C9A5A' : val >= 40 ? '#C8901A' : '#C63C3C';
}

// ---- Render helpers ----

function renderMetricBar(label, val) {
  const color = metricColor(val);
  return div({ class: 'metric-row' },
    div({ class: 'metric-label' },
      span({}, label),
      span({ style: { fontWeight: 700, color } }, val + '')
    ),
    div({ class: 'metric-track' },
      div({ class: 'metric-fill', style: { width: val + '%', background: color } })
    )
  );
}

function renderConflictBtn(label, onClick) {
  const b = div({ class: '', style: { alignSelf: 'flex-start', fontSize: '11px', fontWeight: 600, color: '#FFFFFF', background: '#C63C3C', borderRadius: '6px', padding: '6px 11px', cursor: 'pointer' } }, label);
  b.addEventListener('click', onClick);
  return b;
}

function renderFactCard(f) {
  const s = ss(f.status);
  return div({ class: 'fact-card' },
    div({ class: 'fact-top' },
      div({ class: 'fact-kv' }, span({ class: 'fact-key' }, f.label + '：'), span({ style: { fontWeight: 600 } }, f.value)),
      (() => {
        const b = span({ class: 'badge' }, s.label);
        b.style.background = s.bg; b.style.color = s.fg; b.style.border = `1px solid ${s.border}`;
        return b;
      })()
    ),
    div({ class: 'fact-source' }, '来源：' + f.source),
    div({ class: 'fact-note' }, f.note)
  );
}

// ---- Tab renderers ----

function renderTab0(state) {
  const resolved = !state.conflictScenario;
  const identityTrust = resolved ? 90 : 62;
  const contentReadiness = resolved ? 82 : 48;
  const confirmedName = state.confirmedName || 'Canister Vacuum Cleaner';

  const items = [
    renderMetricBar('数据完整度', 75),
    renderMetricBar('身份可信度', identityTrust),
    renderMetricBar('内容就绪度', contentReadiness),
  ];

  const metricsCard = div({ class: 'card' },
    div({ class: 'card-title' }, '三个核心指标'),
    ...items
  );

  let alertCard;
  if (state.conflictScenario) {
    alertCard = div({ class: 'alert-conflict' },
      div({ class: 'alert-conflict-title' }, '当前阻断问题'),
      div({ class: 'alert-conflict-body' }, '标题 "Steam Cleaner" 与商品分组 "Canister Vacuum Cleaner" 冲突，已暂停标题与关键词生成。'),
      div({ class: 'flex-row' },
        renderConflictBtn('查看证据并确认', openModal)
      )
    );
  } else {
    alertCard = div({ class: 'alert-success' }, '身份已确认：' + confirmedName + '。阻断已解除，内容优化可正常生成。');
  }

  let nextSteps;
  if (state.conflictScenario) {
    nextSteps = div({ class: 'card' },
      div({ style: { fontSize: '11.5px', fontWeight: 700, color: '#0F2540', marginBottom: '6px' } }, '下一步建议'),
      div({ style: { fontSize: '11.5px', color: '#3A4250', lineHeight: 1.8 } }, '1. 确认或修正商品身份\n2. 补充认证结构化字段\n3. 重新生成标题')
    );
    nextSteps.querySelector('div:last-child').style.whiteSpace = 'pre-line';
  } else {
    nextSteps = div({ class: 'card' },
      div({ style: { fontSize: '11.5px', fontWeight: 700, color: '#0F2540', marginBottom: '6px' } }, '下一步建议'),
      div({ style: { fontSize: '11.5px', color: '#3A4250', lineHeight: 1.8 } }, '1. 补充额定功率字段以提升数据完整度\n2. 审核并复制内容优化建议\n3. 接入搜索数据后生成正式 Top3 关键词')
    );
    nextSteps.querySelector('div:last-child').style.whiteSpace = 'pre-line';
  }

  return [metricsCard, alertCard, nextSteps];
}

function renderTab1(state) {
  const nodes = [];

  // Identity candidates
  const candList = div({ class: 'flex-col', style: { gap: '6px' } });
  IDENTITY_CANDIDATES.filter(c => c.pct !== null).forEach(c => {
    candList.appendChild(div({
      style: {
        display: 'flex', justifyContent: 'space-between', fontSize: '11.5px',
        color: '#3A4250', border: '1px solid #E2E5EA', borderRadius: '6px', padding: '7px 10px'
      }
    },
      span({ style: { overflowWrap: 'break-word', paddingRight: '8px' } }, c.name),
      span({ style: { fontWeight: 700, color: '#0F2540', whiteSpace: 'nowrap' } }, c.pct + '%')
    ));
  });
  nodes.push(div({},
    div({ class: 'card-title' }, '商品身份 · Top 3 候选'),
    candList
  ));

  // Category candidates
  const catList = div({});
  [['Household Vacuum Cleaners', '88% 匹配'], ['Industrial Vacuum Cleaners', '42% 匹配']].forEach(([name, match]) => {
    catList.appendChild(div({
      style: { display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#3A4250', padding: '6px 0', borderBottom: '1px solid #EEF0F3' }
    }, span({}, name), span({ style: { color: '#8B95A1' } }, match)));
  });
  nodes.push(div({},
    div({ class: 'card-title' }, '类目候选'),
    catList
  ));

  // Conflict field card
  if (state.conflictScenario) {
    nodes.push(div({ class: 'alert-conflict' },
      div({ class: 'alert-conflict-title' }, '冲突字段'),
      div({ style: { fontSize: '11px', color: '#8A3030', lineHeight: 1.6 } }, '原标题：Steam Cleaner\n商品分组：Canister Vacuum Cleaner'),
      renderConflictBtn('打开身份确认', openModal)
    ));
  }

  // Fact evidence
  nodes.push(div({},
    div({ class: 'card-title' }, '商品数字身份证 · 属性证据'),
    div({ class: 'flex-col' }, ...FACT_ROWS.map(renderFactCard))
  ));

  // Reasoning summary
  nodes.push(div({ class: 'summary-text' }, '推理摘要：图片与规格字段一致指向罐式吸尘器结构；标题中的 "Steam" 一词缺乏支持证据，已标记为冲突。'));

  return nodes;
}

function renderTab2(state) {
  const nodes = [];

  // Current keywords
  nodes.push(div({},
    div({ class: 'card-title' }, '当前关键词'),
    div({ class: 'flex-row' }, ...CURRENT_KEYWORDS.map(kw => span({ class: 'chip' }, kw)))
  ));

  // Blocked keywords
  const blockedList = div({ class: 'flex-col' });
  BLOCKED_KEYWORDS.forEach(k => {
    const s = ss('BLOCKED');
    const c = div({ class: 'keyword-blocked', style: { border: `1px solid ${s.border}`, background: s.bg } },
      div({ style: { display: 'flex', justifyContent: 'space-between', gap: '6px' } },
        span({ style: { fontSize: '11.5px', fontWeight: 600, color: '#1A2433' } }, k.kw),
        span({ style: { fontSize: '9.5px', fontWeight: 700, color: s.fg, whiteSpace: 'nowrap' } }, k.reasonLabel)
      ),
      div({ style: { fontSize: '10.5px', color: '#8A3030', marginTop: '4px' } }, k.detail)
    );
    blockedList.appendChild(c);
  });
  nodes.push(div({},
    div({ class: 'card-title' }, '已拦截关键词'),
    blockedList
  ));

  // Candidate keywords
  const candKwList = div({ class: 'flex-col' });
  CANDIDATE_KEYWORDS.forEach(k => {
    const ds = ss('UNKNOWN');
    const badge = span({ class: 'badge' }, k.demandStatus);
    badge.style.background = ds.bg; badge.style.color = ds.fg; badge.style.border = `1px solid ${ds.border}`;

    candKwList.appendChild(div({ class: 'kw-cand' },
      div({ class: 'kw-cand-name' }, k.kw),
      div({ class: 'kw-cand-meta' },
        span({}, '匹配度 '), el('b', {}, k.matchScore + ''),
        span({}, '意图 ' + k.intent)
      ),
      div({ style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: '#5B6472', flexWrap: 'wrap' } },
        span({}, '搜索需求'),
        badge,
        span({ style: { color: '#8B95A1' } }, '· ' + k.evidenceLabel)
      )
    ));
  });
  nodes.push(div({},
    div({ class: 'card-title' }, '候选关键词'),
    candKwList
  ));

  // Formal top3
  nodes.push(div({},
    div({ class: 'card-title' }, '正式 Top 3'),
    div({ class: 'alert-unavailable' }, '未接入真实搜索数据源，正式 Top3 暂缺。\n状态：NOT_AVAILABLE，不参与排名与流量结论。')
  ));

  return nodes;
}

function renderTab3(state) {
  const subTabLabels = ['标题', '详情', 'FAQ', 'GEO', '翻译'];
  const confirmedName = state.confirmedName || 'Canister Vacuum Cleaner';

  const subtabBar = div({ class: 'subtab-bar' });
  subTabLabels.forEach((label, idx) => {
    const b = el('button', { class: 'subtab-btn' + (state.contentSubTab === idx ? ' active' : '') }, label);
    b.addEventListener('click', () => setState({ contentSubTab: idx }));
    subtabBar.appendChild(b);
  });

  let content;

  if (state.contentSubTab === 0) {
    // Title sub-tab
    if (state.conflictScenario) {
      content = div({ class: 'alert-conflict' },
        div({ class: 'alert-conflict-title' }, '标题生成已暂停'),
        div({ style: { fontSize: '11px', color: '#8A3030', lineHeight: 1.6 } }, '原标题：Steam Cleaner\n商品分组：Canister Vacuum Cleaner\n原因：核心商品身份不一致'),
        renderConflictBtn('查看冲突并确认身份', openModal)
      );
    } else {
      const suggestions = [
        {
          styleTag: '简洁直接型',
          text: confirmedName + ' 20L Home & Office Cleaning Machine with Hose & Brush Set',
          used: ['容量 20L（VERIFIED）', '配件：软管、组合刷头（VERIFIED）'],
          excluded: ['CE 认证（未验证，已排除）'],
        },
        {
          styleTag: '参数导向型',
          text: confirmedName + ' for Home and Office, 20L Capacity, with Hose and Brush Accessories',
          used: ['容量 20L（VERIFIED）', '应用场景：家庭/办公室（INFERRED 65%）'],
          excluded: ['额定功率（UNKNOWN，未填写）'],
        },
        {
          styleTag: '买家场景型',
          text: 'Portable ' + confirmedName + ' 20L with Hose and Dual Brush Heads for Daily Cleaning',
          used: ['容量 20L（VERIFIED）', '应用场景：家庭/办公室（INFERRED 65%）'],
          excluded: ['CE 认证（未验证，已排除）'],
        },
      ];

      content = div({ class: 'flex-col' }, ...suggestions.map(t => {
        const card = div({ class: 'suggestion-card' },
          span({ class: 'style-tag' }, t.styleTag),
          div({ class: 'suggestion-text' }, t.text),
          div({ class: 'suggestion-facts' },
            div({ style: { fontSize: '10px', color: '#5B6472' } }, '已采用事实：'),
            ...t.used.map(u => div({ class: 'fact-used' }, '✓ ' + u)),
            div({ style: { fontSize: '10px', color: '#5B6472', marginTop: '3px' } }, '未采用 / 已排除：'),
            ...t.excluded.map(e => div({ class: 'fact-excluded' }, '✕ ' + e))
          ),
          div({ class: 'suggestion-actions' },
            el('button', { class: 'action-btn', onclick: () => copyText(t.text) }, '复制英文'),
            el('button', { class: 'action-btn' }, '翻译中文'),
            el('button', { class: 'action-btn' }, '查看证据')
          )
        );
        return card;
      }));
    }
  } else if (state.contentSubTab === 1) {
    if (state.conflictScenario) {
      content = div({ class: 'alert-conflict' },
        div({ style: { fontSize: '11px', color: '#8A3030', lineHeight: 1.6 } }, '详情生成已暂停：核心商品身份存在冲突，请先确认身份。')
      );
    } else {
      content = div({ class: 'card', style: { fontSize: '11.5px', color: '#1A2433', lineHeight: 1.6 } },
        '建议要点：20L 大容量罐式设计，适合家庭与办公室日常清洁；标配软管与组合刷头，开箱即用。',
        div({ style: { fontSize: '10px', color: '#5B6472', marginTop: '6px' } }, '已采用：容量 20L（VERIFIED）、配件（VERIFIED）')
      );
    }
  } else if (state.contentSubTab === 2) {
    if (state.conflictScenario) {
      content = div({ class: 'alert-conflict' },
        div({ style: { fontSize: '11px', color: '#8A3030', lineHeight: 1.6 } }, 'FAQ 生成已暂停：核心商品身份存在冲突。')
      );
    } else {
      content = div({ class: 'card', style: { fontSize: '11.5px', color: '#1A2433', lineHeight: 1.6 } },
        'Q：该吸尘器是否支持湿吸？\nA：产品规格未标注湿吸密封结构，暂无法确认。',
        div({ style: { fontSize: '10px', color: '#5B6472', marginTop: '6px' } }, '证据：UNKNOWN，规格字段未填写')
      );
    }
  } else if (state.contentSubTab === 3) {
    content = div({ class: 'alert-unavailable' }, 'GEO 内容依赖搜索意图与买家问题数据，当前数据源未接入。\n状态：NOT_AVAILABLE');
  } else if (state.contentSubTab === 4) {
    const langDefs = [{ code: 'es', label: '西班牙语' }, { code: 'ar', label: '阿拉伯语' }, { code: 'pt', label: '葡萄牙语' }];
    const langChips = div({ class: 'lang-chips' }, ...langDefs.map(l => {
      const active = state.translateLang === l.code;
      const c = span({
        class: 'lang-chip',
        style: { background: active ? '#0E8E82' : '#F1F2F4', color: active ? '#FFFFFF' : '#5B6472' }
      }, l.label);
      c.addEventListener('click', () => setState({ translateLang: l.code }));
      return c;
    }));

    content = div({ class: 'flex-col' },
      div({},
        div({ style: { fontSize: '10px', color: '#5B6472', marginBottom: '4px' } }, '原文（永久保留）'),
        div({ class: 'card', style: { fontSize: '11.5px', color: '#1A2433' } }, 'Steam Cleaner Portable Home Vacuum Cleaner with CE Certification')
      ),
      langChips,
      div({},
        div({ style: { fontSize: '10px', color: '#5B6472', marginBottom: '4px' } }, '译文预览'),
        div({ class: 'card', style: { fontSize: '11.5px', color: '#1A2433' } }, TRANSLATIONS[state.translateLang] || '')
      ),
      div({ style: { fontSize: '10.5px', color: '#1C6E42', lineHeight: 1.7 } }, '✓ 数字一致　✓ 单位一致　✓ 型号一致　✓ 认证状态一致')
    );
  }

  return [subtabBar, content];
}

function renderTab4(state) {
  const nodes = [];

  const devToggle = div({
    style: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    }
  },
    div({ class: 'section-title', style: { marginBottom: 0 } }, '证据与调试'),
    (() => {
      const b = span({
        style: {
          fontSize: '10px', fontWeight: 600, padding: '4px 9px', borderRadius: '11px',
          cursor: 'pointer', background: state.devMode ? '#0F2540' : '#F1F2F4',
          color: state.devMode ? '#FFFFFF' : '#5B6472'
        }
      }, state.devMode ? '开发模式：开' : '开发模式：关');
      b.addEventListener('click', () => setState(s => ({ devMode: !s.devMode })));
      return b;
    })()
  );
  nodes.push(devToggle);

  // Field stats
  const missing = ['认证证书上传', '产品视频链接', '包装规格', '交期字段', '售后条款', '合规声明'];
  nodes.push(div({ class: 'card' },
    '已读取字段：', el('b', {}, '18'), ' / 24',
    div({ style: { fontSize: '10px', color: '#5B6472', marginTop: '7px' } }, '未读取字段：'),
    div({ class: 'flex-row', style: { marginTop: '4px' } }, ...missing.map(m => span({ class: 'chip', style: { fontSize: '10px' } }, m)))
  ));

  // Evidence ledger
  nodes.push(div({},
    div({ class: 'section-title' }, '事实证据台账（状态 · 来源 · 时间）'),
    div({ class: 'evidence-table' }, ...FACT_ROWS.map(f => {
      const s = ss(f.status);
      const badge = span({ class: 'badge' }, s.label);
      badge.style.background = s.bg; badge.style.color = s.fg; badge.style.border = `1px solid ${s.border}`;
      return div({ class: 'evidence-row' },
        span({ class: 'ev-label' }, f.label),
        badge,
        span({ class: 'ev-source' }, f.source),
        span({ class: 'ev-ts text-mono' }, f.ts)
      );
    }))
  ));

  // Tool statuses
  const toolStatusColorMap = { OK: 'VERIFIED', UNAVAILABLE: 'CONFLICT', NOT_AVAILABLE: 'NOT_AVAILABLE', SKIPPED: 'UNKNOWN' };
  nodes.push(div({},
    div({ class: 'section-title' }, '工具连接状态'),
    div({ class: 'flex-col' }, ...TOOL_STATUSES.map(t => {
      const s = ss(toolStatusColorMap[t.status] || 'UNKNOWN');
      const badge = span({ class: 'badge' }, t.status);
      badge.style.background = s.bg; badge.style.color = s.fg; badge.style.border = `1px solid ${s.border}`;
      return div({ class: 'tool-row' },
        span({ class: 'tool-name' }, t.name),
        badge
      );
    }))
  ));

  // Dev mode section
  if (state.devMode) {
    const devSection = div({ class: 'divider-dashed flex-col' });

    // Reasoning steps
    const stepsList = div({}, ...REASONING_STEPS.map(r =>
      div({ class: 'reasoning-step' },
        span({}, el('b', { class: 'teal' }, r.phase), ' — ' + r.detail),
        span({ class: 'ev-ts text-mono' }, r.ts)
      )
    ));
    devSection.appendChild(div({},
      div({ class: 'section-title' }, 'Reasoning Steps'),
      stepsList
    ));

    // Rejected hypotheses
    devSection.appendChild(div({},
      div({ class: 'section-title' }, '已否决假设'),
      div({}, ...REJECTED_HYPOTHESES.map(h =>
        div({ style: { fontSize: '10.5px', color: '#3A4250', padding: '4px 0' } },
          el('s', {}, h.name), ' — ' + h.reason
        )
      ))
    ));

    // FactGuard removals
    devSection.appendChild(div({},
      div({ class: 'section-title' }, 'FactGuard 删除项'),
      div({}, ...FACT_GUARD_REMOVALS.map(g =>
        div({ style: { fontSize: '10.5px', color: '#B04040', padding: '4px 0', display: 'flex', justifyContent: 'space-between', gap: '6px' } },
          span({}, '✕ ' + g.claim + ' — ' + g.reason),
          span({ class: 'ev-ts text-mono' }, g.ts)
        )
      ))
    ));

    // KeywordGate
    devSection.appendChild(div({},
      div({ class: 'section-title' }, 'KeywordGate 决策'),
      div({}, ...BLOCKED_KEYWORDS.map(k =>
        div({ style: { fontSize: '10.5px', color: '#B04040', padding: '4px 0' } },
          '✕ ' + k.kw + ' — ' + k.reasonLabel + '（' + k.detail + '）'
        )
      ))
    ));

    // Engine info
    devSection.appendChild(div({ style: { fontSize: '10px', color: '#8B95A1' } },
      '推理引擎 v0.9.3 · Prompt 版本 v12 · 规则引擎 + LLM 混合'
    ));

    nodes.push(devSection);
  }

  return nodes;
}

// ---- Modal ----

function openModal() {
  setState({ showModal: true });
  renderModal();
}

function renderModal() {
  const modal = document.getElementById('identity-modal');
  modal.classList.remove('hidden');
  modal.innerHTML = '';

  const state = getState();

  const header = div({ class: 'modal-header' },
    div({ class: 'modal-title' }, '确认商品身份'),
    span({ class: 'modal-close', onclick: closeModal }, '关闭')
  );
  modal.appendChild(header);
  modal.appendChild(div({ class: 'modal-subtitle' }, '系统检测到标题与商品分组存在冲突，请确认真实商品身份。'));

  IDENTITY_CANDIDATES.forEach(c => {
    const selected = state.selectedChoice === c.key;
    const card = div({ class: 'candidate-card' + (selected ? ' selected' : '') });
    card.addEventListener('click', () => {
      setState({ selectedChoice: c.key });
      renderModal();
    });

    const topRow = div({ class: 'candidate-top' },
      span({ class: 'radio-dot' + (selected ? ' filled' : '') }),
      span({ class: 'candidate-name' }, c.name),
      c.pct !== null ? span({ class: 'candidate-pct' }, c.pct + '%') : null
    );
    card.appendChild(topRow);
    c.support.forEach(s => card.appendChild(div({ class: 'cand-support' }, '✓ ' + s)));
    c.oppose.forEach(o => card.appendChild(div({ class: 'cand-oppose' }, '✕ ' + o)));
    modal.appendChild(card);
  });

  const hasChoice = !!state.selectedChoice;
  const confirmBg = hasChoice ? '#0E8E82' : '#B7D8D4';

  const actions = div({ class: 'modal-actions' },
    el('button', { class: 'btn-cancel', onclick: closeModal }, '取消'),
    (() => {
      const b = el('button', { class: 'btn-confirm', style: { background: confirmBg } }, '确认身份并重新检测');
      b.addEventListener('click', confirmIdentity);
      if (!hasChoice) b.setAttribute('disabled', '');
      return b;
    })()
  );
  modal.appendChild(actions);
}

function closeModal() {
  document.getElementById('identity-modal').classList.add('hidden');
  setState({ showModal: false });
}

function confirmIdentity() {
  const state = getState();
  if (!state.selectedChoice) return;
  const cand = IDENTITY_CANDIDATES.find(c => c.key === state.selectedChoice);
  const resolvedName = state.selectedChoice === 'other' ? '待手动填写身份' : cand.name;
  setState({ showModal: false, conflictScenario: false, confirmedName: resolvedName });
  document.getElementById('identity-modal').classList.add('hidden');
}

// ---- Main render ----

function render(state) {
  // Scene toggle button
  const sceneToggle = document.getElementById('scene-toggle');
  sceneToggle.textContent = state.conflictScenario ? '冲突演示' : '已确认演示';
  sceneToggle.onclick = () => setState(s => ({
    conflictScenario: !s.conflictScenario,
    showModal: false,
    selectedChoice: null,
    confirmedName: s.conflictScenario ? null : s.confirmedName,
  }));

  // Summary
  const confirmedName = state.confirmedName || 'Canister Vacuum Cleaner';
  document.getElementById('summary-name').textContent = confirmedName;

  const badgeEl2 = document.getElementById('summary-badge');
  badgeEl2.innerHTML = '';
  if (state.conflictScenario) {
    const chip = span({ class: 'status-chip chip-conflict' }, '有冲突 · 待确认');
    badgeEl2.appendChild(chip);
  } else {
    const chip = span({ class: 'status-chip chip-confirmed' }, '已确认');
    badgeEl2.appendChild(chip);
  }

  const contentReadiness = state.conflictScenario ? 48 : 82;
  document.getElementById('summary-sub').textContent = `数据完整度 75 · 内容就绪度 ${contentReadiness}`;

  // Tab bar
  const tabBar = document.getElementById('tab-bar');
  tabBar.innerHTML = '';
  ['概览', '商品真相', '关键词', '内容优化', '证据与调试'].forEach((label, idx) => {
    const b = el('button', { class: 'tab-btn' + (state.activeTab === idx ? ' active' : '') }, label);
    b.addEventListener('click', () => setState({ activeTab: idx }));
    tabBar.appendChild(b);
  });

  // Content
  const contentArea = document.getElementById('content-area');
  contentArea.innerHTML = '';
  let nodes = [];
  if (state.activeTab === 0) nodes = renderTab0(state);
  else if (state.activeTab === 1) nodes = renderTab1(state);
  else if (state.activeTab === 2) nodes = renderTab2(state);
  else if (state.activeTab === 3) nodes = renderTab3(state);
  else if (state.activeTab === 4) nodes = renderTab4(state);
  nodes.filter(Boolean).forEach(n => contentArea.appendChild(n));
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('已复制到剪贴板');
  }).catch(() => {});
}

function openAdmin() {
  chrome.runtime.sendMessage({ type: 'OPEN_ADMIN' });
}

// Wire up export button
document.getElementById('btn-export').addEventListener('click', () => {
  const state = getState();
  const data = {
    productId: '8823910',
    identity: state.confirmedName || 'Canister Vacuum Cleaner',
    conflictResolved: !state.conflictScenario,
    facts: FACT_ROWS,
    keywords: { current: CURRENT_KEYWORDS, blocked: BLOCKED_KEYWORDS, candidates: CANDIDATE_KEYWORDS },
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'evidence_8823910.json'; a.click();
  URL.revokeObjectURL(url);
});

// Subscribe and initial render
subscribe(render);
render(getState());
