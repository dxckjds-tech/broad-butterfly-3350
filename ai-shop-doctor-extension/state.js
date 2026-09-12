// Central state store
const STATE = {
  conflictScenario: true,
  showModal: false,
  selectedChoice: null,
  confirmedName: null,
  activeTab: 0,
  contentSubTab: 0,
  devMode: false,
  translateLang: 'es',
};

const SUBSCRIBERS = [];

function getState() { return { ...STATE }; }

function setState(patch) {
  Object.assign(STATE, typeof patch === 'function' ? patch(STATE) : patch);
  SUBSCRIBERS.forEach(fn => fn(STATE));
}

function subscribe(fn) { SUBSCRIBERS.push(fn); }

// Static data
const STATUS_MAP = {
  VERIFIED:      { label: 'VERIFIED',      bg: '#EAF7EF', fg: '#1C9A5A', border: '#BEE8CB' },
  OBSERVED:      { label: 'OBSERVED',      bg: '#EAF1FD', fg: '#2D6FE0', border: '#C6DBFB' },
  INFERRED:      { label: 'INFERRED',      bg: '#FFF6DC', fg: '#96690A', border: '#F0DBA0' },
  CONFLICT:      { label: 'CONFLICT',      bg: '#FDEAEA', fg: '#C63C3C', border: '#F5C2C2' },
  BLOCKED:       { label: 'BLOCKED',       bg: '#FDEAEA', fg: '#C63C3C', border: '#F5C2C2' },
  UNKNOWN:       { label: 'UNKNOWN',       bg: '#F1F2F4', fg: '#6B7280', border: '#DCE0E5' },
  NOT_AVAILABLE: { label: 'NOT_AVAILABLE', bg: '#F1F2F4', fg: '#6B7280', border: '#DCE0E5' },
};

function ss(key) { return STATUS_MAP[key] || STATUS_MAP.UNKNOWN; }

const IDENTITY_CANDIDATES = [
  {
    key: 'A', name: 'Canister Vacuum Cleaner', pct: 82,
    support: ['商品分组：Household › Canister Vacuum Cleaners', '产品图片 ×4：罐式吸尘器机身与软管', '规格字段容量 20L 与该品类常见范围一致'],
    oppose: ['原标题包含 "Steam Cleaner" 一词'],
  },
  {
    key: 'B', name: 'Steam Cleaner', pct: 11,
    support: ['原标题："Steam Cleaner Portable Home..."'],
    oppose: ['无加热/蒸汽压力结构相关字段', '商品分组、图片均为吸尘器结构', '规格表无温度参数'],
  },
  {
    key: 'C', name: 'Wet & Dry Vacuum', pct: 7,
    support: ['部分买家问答提及"可湿吸"'],
    oppose: ['规格表未标注湿吸密封结构', '图片未显示湿吸专用配件'],
  },
  {
    key: 'other', name: '以上都不是，手动输入身份', pct: null,
    support: [], oppose: [],
  },
];

const FACT_ROWS = [
  { label: '容量',    value: '20 L',             status: 'VERIFIED',  source: '产品规格 › Capacity',      note: '与页面结构化字段一致',                              ts: '09:13:58' },
  { label: '材质',    value: 'ABS 塑料外壳',       status: 'OBSERVED',  source: '旧标题 + 描述',            note: '未在结构化字段确认，建议补充材质字段',                    ts: '09:14:04' },
  { label: '额定功率', value: '未填写',             status: 'UNKNOWN',   source: '—',                      note: '规格表功率字段为空',                                 ts: '09:14:07' },
  { label: '认证',    value: 'CE',               status: 'OBSERVED',  source: '旧标题',                   note: '未验证，禁止用于推荐内容；建议填写认证字段或上传证书',           ts: '09:14:11' },
  { label: '配件',    value: '软管、组合刷头 ×2',   status: 'VERIFIED',  source: '产品图片（人工确认）',        note: '图片中可清晰识别',                                   ts: '09:14:18' },
  { label: '应用场景', value: '家庭 / 办公室清洁',  status: 'INFERRED',  source: '多项证据推断 · 置信度 65%', note: '基于图片场景 + 描述用词综合推断',                        ts: '09:14:25' },
];

const CURRENT_KEYWORDS = ['steam cleaner', 'portable vacuum', 'home cleaning machine', 'ce certified vacuum'];

const BLOCKED_KEYWORDS = [
  { kw: 'steam mop',         reasonLabel: 'PRODUCT_MISMATCH',  detail: '与商品身份 Canister Vacuum Cleaner 不符' },
  { kw: 'ce certified vacuum', reasonLabel: 'CERT_UNVERIFIED', detail: '认证字段未验证，不能用于关键词声明' },
];

const CANDIDATE_KEYWORDS = [
  { kw: 'canister vacuum cleaner',    matchScore: 91, intent: '商业采购', demandStatus: 'UNKNOWN', evidenceLabel: 'PRODUCT_MATCH_ONLY' },
  { kw: 'home vacuum cleaner 20l',    matchScore: 84, intent: '商业采购', demandStatus: 'UNKNOWN', evidenceLabel: 'PRODUCT_MATCH_ONLY' },
  { kw: 'lightweight canister vacuum', matchScore: 78, intent: '产品调研', demandStatus: 'UNKNOWN', evidenceLabel: 'PRODUCT_MATCH_ONLY' },
];

const TOOL_STATUSES = [
  { name: 'ImageAnalyzer（图像识别）',          status: 'UNAVAILABLE' },
  { name: 'SearchDataProvider（搜索数据）',     status: 'NOT_AVAILABLE' },
  { name: 'TranslationProvider（翻译，DeepSeek）', status: 'OK' },
  { name: 'CompetitorProvider（竞品证据）',     status: 'SKIPPED' },
];

const REASONING_STEPS = [
  { phase: 'OBSERVE',     ts: '09:14:02', detail: '读取标题、类目、图片、规格字段共 18 项' },
  { phase: 'HYPOTHESIZE', ts: '09:14:09', detail: '生成候选身份：Canister Vacuum Cleaner / Steam Cleaner / Wet & Dry Vacuum' },
  { phase: 'CHECK',       ts: '09:14:16', detail: '比对图片结构与规格字段，未发现蒸汽相关组件' },
  { phase: 'CHALLENGE',   ts: '09:14:24', detail: '标题词 "Steam Cleaner" 与商品分组、图片证据冲突' },
  { phase: 'PLAN',        ts: '09:14:31', detail: '标记冲突，暂停标题/关键词生成，等待人工确认' },
];

const REJECTED_HYPOTHESES = [
  { name: 'Steam Cleaner',     reason: '缺少加热/蒸汽压力结构证据，且与商品分组冲突' },
  { name: 'Wet & Dry Vacuum',  reason: '缺少湿吸密封结构证据' },
];

const FACT_GUARD_REMOVALS = [
  { claim: 'CE 认证',      reason: '仅在旧标题出现，未在结构化字段验证',       ts: '09:14:41' },
  { claim: '额定功率 1200W', reason: '模型推测值，无对应规格字段，已拦截',       ts: '09:14:43' },
];

const TRANSLATIONS = {
  es: 'Aspiradora de bidón de 20L para uso doméstico y de oficina, con manguera y juego de cepillos incluido.',
  ar: 'مكنسة كهربائية بسعة 20 لترًا للاستخدام المنزلي والمكتبي، مزودة بخرطوم وطاقم فرش.',
  pt: 'Aspirador de pó tipo tambor de 20L para uso doméstico e escritório, com mangueira e kit de escovas.',
};
