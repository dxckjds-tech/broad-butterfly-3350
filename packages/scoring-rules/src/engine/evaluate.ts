import type { IssueCategory, IssueSeverity, IssuePriority, RuleResult, SuggestionType } from '@trade-ai/shared-types';
import { contentConfig } from '../config/content.config';
import { conversionConfig } from '../config/conversion.config';
import { micConfig } from '../config/mic.config';
import { applicationSuggestion } from '../suggestions/application';
import { companySuggestion } from '../suggestions/company';
import { descriptionSuggestion } from '../suggestions/description';
import { faqSuggestion } from '../suggestions/faq';
import { oemSuggestion } from '../suggestions/oem';
import { specificationSuggestion } from '../suggestions/specification';
import { titleSuggestion } from '../suggestions/title';
import type { RuleContext } from './context';
import { RULE_REGISTRY_MAP } from './registry';
import { englishWords, SECTION_KEYS, symbolCount } from './text';
import { inspectProductIdentity } from './truth-profile';

function impact(severity: IssueSeverity): number {
  if (severity === 'CRITICAL') return -18;
  if (severity === 'HIGH') return -10;
  if (severity === 'MEDIUM') return -6;
  return -3;
}

function make(
  ctx: RuleContext,
  ruleId: string,
  status: RuleResult['status'],
  opts: {
    title: string;
    description: string;
    suggestion: string;
    severity?: IssueSeverity;
    suggestionType?: SuggestionType;
    scoreImpact?: number;
    evidence?: Record<string, unknown>;
    fieldSource?: string;
    confidence?: number;
  },
): RuleResult {
  const meta = RULE_REGISTRY_MAP.get(ruleId);
  const severity = opts.severity ?? 'MEDIUM';
  return {
    ruleId,
    category: (meta?.category ?? 'CONTENT') as IssueCategory,
    status,
    confidence: opts.confidence ?? (status === 'UNCERTAIN' ? 0.45 : 0.9),
    severity,
    priority: (meta?.priority ?? 'P2') as IssuePriority,
    title: opts.title,
    description: opts.description,
    suggestion: opts.suggestion,
    suggestionType: opts.suggestionType ?? (severity === 'CRITICAL' || severity === 'HIGH' ? 'FIX' : 'ENHANCEMENT'),
    scoreImpact: status === 'PASS' || status === 'SKIPPED' ? 0 : (opts.scoreImpact ?? impact(severity)),
    evidence: opts.evidence ?? {},
    fieldSource: opts.fieldSource,
  };
}

function missingCopy(ctx: RuleContext, fieldLabel: string, certainTitle: string, certainDesc: string): {
  status: RuleResult['status'];
  title: string;
  description: string;
  severity: IssueSeverity;
} {
  if (ctx.parseUncertain) {
    return {
      status: 'UNCERTAIN',
      title: `当前页面暂未可靠识别到${fieldLabel}`,
      description: `当前页面暂未可靠识别到${fieldLabel}，请确认页面实际是否已填写。解析完整度 ${ctx.parseScore}。`,
      severity: 'LOW',
    };
  }
  return { status: 'FAIL', title: certainTitle, description: certainDesc, severity: 'HIGH' };
}

export function evaluateAllRules(ctx: RuleContext): RuleResult[] {
  const results: RuleResult[] = [];
  const product = ctx.page.pageType === 'PRODUCT' || ctx.page.pageType === 'MIC_PRODUCT_EDIT';
  const skip = (id: string) =>
    make(ctx, id, 'SKIPPED', {
      title: '非产品页跳过',
      description: '当前页面不是产品详情页。',
      suggestion: '',
      severity: 'LOW',
    });

  const title = ctx.page.productName || ctx.page.title || '';
  const titleStatus = ctx.field('productName');

  if (!product) {
    for (const id of [
      'mic-title-exists',
      'mic-title-word-count',
      'mic-title-core-term',
      'mic-title-keyword-stuffing',
      'mic-title-repetition',
      'mic-title-readability',
      'mic-title-attribute-richness',
      'mic-title-brand-noise',
      'mic-title-symbol-overuse',
    ]) {
      results.push(skip(id));
    }
  } else {
    if (!title.trim() || titleStatus === 'MISSING') {
      const copy = missingCopy(ctx, '产品标题', '产品标题缺失', '未能识别到有效产品标题，买家无法判断这是什么产品。');
      results.push(
        make(ctx, 'mic-title-exists', copy.status, {
          ...copy,
          suggestion: titleSuggestion({ core: ctx.coreProductTerm, wordCount: 0 }),
          severity: copy.status === 'UNCERTAIN' ? 'LOW' : 'CRITICAL',
          suggestionType: 'FIX',
          evidence: { productName: title, fieldStatus: titleStatus },
          fieldSource: 'productName',
          confidence: titleStatus === 'FOUND' ? 0.98 : ctx.parseUncertain ? 0.4 : 0.95,
        }),
      );
    } else {
      results.push(
        make(ctx, 'mic-title-exists', 'PASS', {
          title: '已识别产品标题',
          description: '标题字段可用。',
          suggestion: '',
          evidence: { productName: title },
          fieldSource: 'productName',
          confidence: 0.98,
        }),
      );
    }

    let wcStatus: RuleResult['status'] = 'PASS';
    let wcSev: IssueSeverity = 'LOW';
    if (ctx.titleWords < micConfig.titleMinWordsSevere) {
      wcStatus = 'FAIL';
      wcSev = 'HIGH';
    } else if (ctx.titleWords < micConfig.titleMinWordsMedium) {
      wcStatus = 'FAIL';
      wcSev = 'MEDIUM';
    } else if (ctx.titleWords > micConfig.titleSoftMaxWords) {
      wcStatus = 'FAIL';
      wcSev = 'MEDIUM';
    } else if (ctx.titleWords > micConfig.titleIdealMaxWords) {
      wcStatus = 'FAIL';
      wcSev = 'LOW';
    }
    results.push(
      make(ctx, 'mic-title-word-count', wcStatus, {
        title: wcStatus === 'PASS' ? '标题有效词数量合适' : ctx.titleWords < 6 ? '产品标题过短' : '产品标题偏长',
        description:
          wcStatus === 'PASS'
            ? `根据当前店铺运营与搜索表达建议，当前标题约 ${ctx.titleWords} 个有效英文单词。`
            : `当前标题仅包含 ${ctx.titleWords} 个有效英文单词，信息表达${ctx.titleWords < 6 ? '不足' : '偏冗长'}。根据当前店铺运营与搜索表达建议，更利于检索的标题通常把核心产品词和少量属性写清楚。`,
        suggestion: titleSuggestion({ core: ctx.coreProductTerm, wordCount: ctx.titleWords, attributes: ctx.attributes }),
        severity: wcSev,
        evidence: { wordCount: ctx.titleWords, productName: title },
        fieldSource: 'productName',
        confidence: 0.98,
      }),
    );

    const manyCores = ctx.distinctProductTerms.filter((t) => t.split(' ').length >= 1 && !['hardware', 'accessories'].includes(t));
    const stuffingCores = ctx.distinctProductTerms.length >= 3;
    results.push(
      make(ctx, 'mic-title-core-term', stuffingCores ? 'FAIL' : ctx.coreProductTerm ? 'PASS' : 'FAIL', {
        title: stuffingCores ? '标题中心词不清晰' : ctx.coreProductTerm ? '已识别核心产品词' : '未能识别核心产品词',
        description: stuffingCores
          ? `标题中出现多个明显不同的产品中心词：${ctx.distinctProductTerms.join('、')}。`
          : ctx.coreProductTerm
            ? `核心产品词：${ctx.coreProductTerm}`
            : '标题缺少可识别的核心产品词。',
        suggestion: titleSuggestion({ core: ctx.coreProductTerm, wordCount: ctx.titleWords, stuffing: stuffingCores }),
        severity: stuffingCores ? 'HIGH' : 'MEDIUM',
        evidence: { coreProductTerm: ctx.coreProductTerm, distinctProductTerms: ctx.distinctProductTerms },
        fieldSource: 'productName',
      }),
    );

    const marketingInTitle = /high quality|best|cheap|hot sale|factory price/i.test(title);
    const slashStack = symbolCount(title) >= micConfig.symbolOveruseCount;
    results.push(
      make(ctx, 'mic-title-keyword-stuffing', stuffingCores || (marketingInTitle && ctx.attributes < 2) ? 'FAIL' : 'PASS', {
        title: stuffingCores || marketingInTitle ? '标题营销词或中心词堆砌' : '未发现明显关键词堆砌',
        description: stuffingCores
          ? '连续堆叠多个产品中心词，搜索主题不清晰。'
          : marketingInTitle
            ? '标题中过多营销词占用了产品属性表达空间。'
            : '标题未发现明显堆词。',
        suggestion: titleSuggestion({ core: ctx.coreProductTerm, wordCount: ctx.titleWords, stuffing: true }),
        severity: stuffingCores ? 'HIGH' : 'MEDIUM',
        evidence: { marketingInTitle, distinctProductTerms: ctx.distinctProductTerms },
        fieldSource: 'productName',
      }),
    );

    const words = englishWords(title);
    const repeats = words.filter((w, i) => words.indexOf(w) !== i && w.length > 3);
    results.push(
      make(ctx, 'mic-title-repetition', repeats.length >= 2 ? 'FAIL' : 'PASS', {
        title: repeats.length >= 2 ? '标题存在重复词' : '标题重复词正常',
        description: repeats.length >= 2 ? `重复词：${[...new Set(repeats)].join(', ')}` : '无明显重复。',
        suggestion: '去掉重复单词，把空间留给材质或场景。',
        severity: 'LOW',
        evidence: { repeats: [...new Set(repeats)] },
      }),
    );

    const unreadable = title === title.toUpperCase() && title.length > 12;
    results.push(
      make(ctx, 'mic-title-readability', unreadable ? 'FAIL' : 'PASS', {
        title: unreadable ? '标题可读性较差' : '标题可读性可接受',
        description: unreadable ? '标题几乎全大写，不利于阅读与检索理解。' : '大小写与分隔可接受。',
        suggestion: '使用正常英文大小写，避免全大写堆砌。',
        severity: 'LOW',
        evidence: { allCaps: unreadable },
      }),
    );

    const attrStatus = ctx.attributes >= 2 ? 'PASS' : 'FAIL';
    results.push(
      make(ctx, 'mic-title-attribute-richness', attrStatus, {
        title: attrStatus === 'PASS' ? '标题属性较完整' : '标题产品属性覆盖不足',
        description: `识别到约 ${ctx.attributes} 类属性（材质/应用/类型/特性）。`,
        suggestion: titleSuggestion({ core: ctx.coreProductTerm, wordCount: ctx.titleWords, attributes: ctx.attributes }),
        severity: ctx.attributes === 0 ? 'MEDIUM' : 'LOW',
        evidence: { attributeCount: ctx.attributes },
        fieldSource: 'productName',
      }),
    );

    const brandNoise = /made in china|factory outlet|wholesale lots/i.test(title);
    results.push(
      make(ctx, 'mic-title-brand-noise', brandNoise ? 'FAIL' : 'PASS', {
        title: brandNoise ? '标题含平台/营销噪音' : '标题噪音可控',
        description: brandNoise ? '标题中的 Made in China / Wholesale 等词挤占有效属性。' : '未发现明显噪音词。',
        suggestion: '把产地与批发信息放到参数或公司介绍，标题留给产品实体。',
        severity: 'LOW',
        evidence: { brandNoise },
      }),
    );

    results.push(
      make(ctx, 'mic-title-symbol-overuse', slashStack ? 'FAIL' : 'PASS', {
        title: slashStack ? '标题符号堆叠过多' : '标题符号使用正常',
        description: `逗号/斜杠等符号约 ${symbolCount(title)} 个。`,
        suggestion: '减少斜杠和逗号堆叠，改成自然短语。',
        severity: 'LOW',
        evidence: { symbolCount: symbolCount(title) },
      }),
    );
    void manyCores;
  }

  const desc = ctx.page.description || '';
  const descField = ctx.field('description');
  if (!desc.trim() || descField === 'MISSING') {
    const copy = missingCopy(ctx, '产品描述', '产品描述缺失', '页面没有可识别的产品描述正文。');
    results.push(
      make(ctx, 'content-description-exists', copy.status, {
        ...copy,
        suggestion: descriptionSuggestion(0, ['Product Overview', 'Specifications', 'Applications']),
        severity: copy.status === 'UNCERTAIN' ? 'LOW' : 'CRITICAL',
        suggestionType: 'FIX',
        fieldSource: 'description',
        evidence: { wordCount: 0 },
      }),
    );
  } else {
    results.push(
      make(ctx, 'content-description-exists', 'PASS', {
        title: '已识别产品描述',
        description: '描述字段可用。',
        suggestion: '',
        fieldSource: 'description',
        evidence: { wordCount: ctx.descWords },
        confidence: 0.92,
      }),
    );
  }

  let descSev: IssueSeverity = 'LOW';
  let descFail: RuleResult['status'] = 'PASS';
  if (ctx.descWords < contentConfig.descriptionShortHigh) {
    descFail = 'FAIL';
    descSev = 'HIGH';
  } else if (ctx.descWords < contentConfig.descriptionShortMedium) {
    descFail = 'FAIL';
    descSev = 'MEDIUM';
  } else if (ctx.descWords < contentConfig.descriptionShortLow) {
    descFail = 'FAIL';
    descSev = 'LOW';
  }
  const missingSections = Object.entries(SECTION_KEYS)
    .filter(([, re]) => !re.test(`${desc} ${ctx.page.rawText}`))
    .map(([k]) => k);
  results.push(
    make(ctx, 'content-description-length', descFail, {
      title: descFail === 'PASS' ? '描述长度可接受' : '产品描述有效信息偏少',
      description: `有效英文词约 ${ctx.descWords}，可识别小节 ${ctx.sectionCount}，有意义文本比例 ${ctx.meaningfulRatio.toFixed(2)}。长文不等于优质，还需结构。`,
      suggestion: descriptionSuggestion(ctx.descWords, missingSections),
      severity: descSev,
      evidence: { wordCount: ctx.descWords, sectionCount: ctx.sectionCount, meaningfulTextRatio: ctx.meaningfulRatio },
      fieldSource: 'description',
    }),
  );

  const specField = ctx.field('specifications');
  let specStatus: RuleResult['status'] = 'PASS';
  let specSev: IssueSeverity = 'LOW';
  if (ctx.specTotal === 0) {
    if (ctx.parseUncertain || specField === 'UNCERTAIN' || ctx.page.sectionAvailability?.SPECIFICATIONS === 'NOT_LOADED') {
      specStatus = 'UNCERTAIN';
      specSev = 'LOW';
    } else {
      specStatus = 'FAIL';
      specSev = 'HIGH';
    }
  } else if (ctx.specTotal <= contentConfig.specFew || ctx.weakOnlySpecs || ctx.meaningfulSpecificationCount < 3) {
    specStatus = 'FAIL';
    specSev = ctx.weakOnlySpecs ? 'HIGH' : 'MEDIUM';
  } else if (ctx.meaningfulSpecificationCount < contentConfig.specGood) {
    specStatus = 'FAIL';
    specSev = 'LOW';
  }
  results.push(
    make(ctx, 'content-specification-coverage', specStatus, {
      title:
        specStatus === 'UNCERTAIN'
          ? '规格参数暂未成功识别'
          : specStatus === 'PASS'
            ? '产品参数较完整'
            : '产品参数信息不足',
      description:
        specStatus === 'UNCERTAIN'
          ? '当前页面暂未可靠识别到规格参数，请确认页面实际是否已填写。'
          : `当前识别到 ${ctx.specTotal} 项参数，其中有效产品参数约 ${ctx.meaningfulSpecificationCount} 项。`,
      suggestion: specificationSuggestion(ctx.specTotal, ctx.meaningfulSpecificationCount),
      severity: specSev,
      evidence: {
        specificationCount: ctx.specTotal,
        meaningfulSpecificationCount: ctx.meaningfulSpecificationCount,
        weakOnly: ctx.weakOnlySpecs,
      },
      fieldSource: 'specifications',
      confidence: specStatus === 'UNCERTAIN' ? 0.5 : specField === 'FOUND' ? 0.93 : 0.75,
    }),
  );

  results.push(
    make(ctx, 'content-application-coverage', ctx.hasApplication ? 'PASS' : 'FAIL', {
      title: ctx.hasApplication ? '已覆盖应用场景' : '缺少应用场景描述',
      description: ctx.hasApplication
        ? '正文中出现 Application / Used for 等场景线索。'
        : '描述中完全没有说明产品用于哪里。',
      suggestion: applicationSuggestion(ctx.coreProductTerm),
      severity: conversionConfig.applicationMissingSeverity,
      evidence: { hasApplicationContent: ctx.hasApplication },
    }),
  );

  const hasFeatures = Boolean(SECTION_KEYS.features?.test(`${desc} ${ctx.page.rawText}`));
  results.push(
    make(ctx, 'content-feature-coverage', hasFeatures ? 'PASS' : 'FAIL', {
      title: hasFeatures ? '已有特性说明' : '特性/卖点结构偏弱',
      description: hasFeatures ? '识别到 Features 类小节。' : '建议用条目列出可验证特性，而不是营销形容词。',
      suggestion: '用 3–6 条可验证特性（尺寸、工艺、适配）替代空泛卖点。',
      severity: 'LOW',
      evidence: { hasFeatures },
    }),
  );

  results.push(
    make(ctx, 'content-company-coverage', ctx.companyScore >= 2 ? 'PASS' : 'FAIL', {
      title: ctx.companyScore >= 2 ? '企业能力信息有基础覆盖' : '公司实力证据不足',
      description: `companyEvidenceScore=${ctx.companyScore}（0–5）。`,
      suggestion: companySuggestion(ctx.companyScore),
      severity: ctx.companyScore === 0 ? 'MEDIUM' : 'LOW',
      evidence: { companyEvidenceScore: ctx.companyScore },
      fieldSource: 'companyName',
    }),
  );

  const oemText = /oem|odm|custom logo|customiz/i.test(ctx.blob) || ctx.page.oemAvailable;
  const oemField = ctx.field('oemAvailable');
  const oemContentStatus: RuleResult['status'] =
    oemField === 'UNCERTAIN' && !oemText ? 'UNCERTAIN' : oemText ? 'PASS' : ctx.customRelevant ? 'FAIL' : 'PASS';
  results.push(
    make(ctx, 'content-oem-coverage', oemContentStatus, {
      title:
        oemContentStatus === 'UNCERTAIN'
          ? 'OEM 区域未加载，暂不判定不支持'
          : oemText
            ? '内容提到定制/OEM'
            : '内容未覆盖 OEM',
      description:
        oemContentStatus === 'UNCERTAIN'
          ? '后台 OEM/ODM 模块尚未加载，不能因为正文未出现 OEM 就判不支持。'
          : oemText
            ? '页面提及 OEM/ODM 或定制。'
            : '正文未覆盖定制能力。',
      suggestion: oemSuggestion(ctx.customRelevant),
      severity: 'LOW',
      scoreImpact: oemContentStatus === 'UNCERTAIN' ? 0 : undefined,
      evidence: { oemText, isCustomizationRelevant: ctx.customRelevant, oemParseStatus: oemField },
    }),
  );

  const hasCert = (ctx.page.certifications?.length ?? 0) > 0 || /iso|ce\b|rohs/i.test(ctx.blob);
  results.push(
    make(ctx, 'content-certification-coverage', hasCert ? 'PASS' : 'FAIL', {
      title: hasCert ? '有认证线索' : '认证信息不足',
      description: hasCert ? '识别到认证字段或关键词。' : '页面未展示认证；不要虚构认证。',
      suggestion: '仅在真实持有时列出认证名称与证书范围。',
      severity: 'LOW',
      evidence: { certifications: ctx.page.certifications },
    }),
  );

  const hasPack = Boolean(SECTION_KEYS.packaging?.test(ctx.blob));
  results.push(
    make(ctx, 'content-packaging-coverage', hasPack ? 'PASS' : 'FAIL', {
      title: hasPack ? '有包装说明' : '包装说明不足',
      description: hasPack ? '识别到包装相关表述。' : '缺少包装数量/方式说明。',
      suggestion: '补充单件包装、外箱数量和出口包装方式。',
      severity: 'LOW',
      evidence: { hasPackaging: hasPack },
    }),
  );

  const hasDelivery = Boolean(ctx.page.deliveryTime?.trim()) || Boolean(SECTION_KEYS.delivery?.test(ctx.blob));
  const deliveryField = ctx.field('deliveryTime');
  const deliveryStatus: RuleResult['status'] = hasDelivery ? 'PASS' : deliveryField === 'UNCERTAIN' ? 'UNCERTAIN' : 'FAIL';
  results.push(
    make(ctx, 'content-delivery-coverage', deliveryStatus, {
      title: deliveryStatus === 'UNCERTAIN' ? '交期区域未加载' : hasDelivery ? '有交期信息' : '交期信息不足',
      description:
        deliveryStatus === 'UNCERTAIN'
          ? '贸易信息未展开，交期状态为 UNCERTAIN，不按缺失扣分。'
          : hasDelivery
            ? `交期字段：${ctx.page.deliveryTime || '正文提及'}`
            : '未识别交期。',
      suggestion: '写明常规交期区间，并说明定制会延长。',
      severity: 'LOW',
      scoreImpact: deliveryStatus === 'UNCERTAIN' ? 0 : undefined,
      evidence: { deliveryTime: ctx.page.deliveryTime },
      fieldSource: 'deliveryTime',
    }),
  );

  results.push(
    make(ctx, 'content-faq-coverage', ctx.hasFaq ? 'PASS' : 'FAIL', {
      title: ctx.hasFaq ? '存在 FAQ 线索' : 'FAQ 缺失（非严重）',
      description: ctx.hasFaq ? '正文已有问答结构或 FAQ。' : 'FAQ 更偏 GEO 与转化，不是 MIC 硬性要求。',
      suggestion: faqSuggestion(),
      severity: 'LOW',
      suggestionType: 'ENHANCEMENT',
      evidence: { hasFaq: ctx.hasFaq },
    }),
  );

  let imgStatus: RuleResult['status'] = 'PASS';
  let imgSev: IssueSeverity = 'LOW';
  if (ctx.uniqueImageCount === 0) {
    if (ctx.parseUncertain || ctx.field('images') === 'UNCERTAIN' || ctx.page.sectionAvailability?.IMAGES === 'NOT_LOADED' || ctx.page.sectionAvailability?.IMAGES === 'PARTIAL') {
      imgStatus = 'UNCERTAIN';
      imgSev = 'LOW';
    } else {
      imgStatus = 'FAIL';
      imgSev = 'CRITICAL';
    }
  } else if (ctx.uniqueImageCount === 1) {
    imgStatus = 'FAIL';
    imgSev = 'HIGH';
  } else if (ctx.uniqueImageCount === 2) {
    imgStatus = 'FAIL';
    imgSev = 'MEDIUM';
  } else if (ctx.uniqueImageCount < micConfig.minImageCountPass) {
    imgStatus = 'FAIL';
    imgSev = 'LOW';
  }
  results.push(
    make(ctx, 'content-images', imgStatus, {
      title:
        imgStatus === 'UNCERTAIN'
          ? '产品图片暂未成功识别'
          : imgStatus === 'PASS'
            ? '图片数量较充足'
            : '产品图片不足',
      description: `去重后 ${ctx.uniqueImageCount} 张（主图约 ${ctx.mainImageCount}，细节约 ${ctx.detailImageCount}），重复率 ${(ctx.duplicateImageRatio * 100).toFixed(0)}%。`,
      suggestion: '提供主图、细节、场景图；相同 URL 不计入多图。',
      severity: imgSev,
      scoreImpact: imgStatus === 'UNCERTAIN' ? 0 : undefined,
      evidence: {
        imageCount: ctx.page.images.length,
        uniqueCount: ctx.uniqueImageCount,
        mainImageCount: ctx.mainImageCount,
        detailImageCount: ctx.detailImageCount,
        duplicateImageRatio: ctx.duplicateImageRatio,
      },
      fieldSource: 'images',
    }),
  );

  const fluffBad = ctx.fluffHits >= 3 && ctx.meaningfulSpecificationCount < 3;
  results.push(
    make(ctx, 'content-marketing-fluff', fluffBad ? 'FAIL' : 'PASS', {
      title: fluffBad ? '营销性表达较多' : '营销空话可控',
      description: fluffBad
        ? '描述中营销性表达较多，但可验证产品信息偏少。'
        : `营销套话命中 ${ctx.fluffHits}。`,
      suggestion: '用规格、材料、测试和交期替换 High Quality / Best / Hot Sale。',
      severity: 'MEDIUM',
      evidence: { marketingFluffHits: ctx.fluffHits, meaningfulSpecificationCount: ctx.meaningfulSpecificationCount },
    }),
  );

  const moqFound = Boolean(ctx.page.moq?.trim()) || ctx.field('moq') === 'FOUND';
  const moqConf = ctx.field('moq') === 'FOUND' || /minimum order/i.test(ctx.page.rawText + ctx.page.moq) ? 0.95 : ctx.page.moq ? 0.8 : 0.6;
  let moqStatus: RuleResult['status'] = moqFound ? 'PASS' : 'FAIL';
  let moqSev: IssueSeverity = 'LOW';
  if (!moqFound) {
    if (ctx.field('moq') === 'UNCERTAIN' || (ctx.parseUncertain && ctx.field('moq') !== 'MISSING')) {
      moqStatus = 'UNCERTAIN';
      moqSev = 'LOW';
    } else if (ctx.profile === 'CUSTOM_MANUFACTURING') {
      moqSev = 'MEDIUM';
    } else {
      moqSev = 'LOW';
    }
  }
  results.push(
    make(ctx, 'conversion-moq', moqStatus, {
      title: moqStatus === 'UNCERTAIN' ? '当前页面暂未可靠识别到 MOQ' : moqFound ? '已提供 MOQ' : '缺少 MOQ 信息',
      description:
        moqStatus === 'UNCERTAIN'
          ? '当前页面暂未可靠识别到 MOQ，请确认页面实际是否已填写。'
          : moqFound
            ? `MOQ：${ctx.page.moq}`
            : `产品类型 ${ctx.profile}：起订量缺失的影响因类目而异。`,
      suggestion:
        ctx.profile === 'MACHINERY'
          ? '设备类可写 1 set 及选配说明，避免含糊。'
          : '明确 MOQ 与是否支持混批，定制单需说明打样起订。',
      severity: moqSev,
      scoreImpact: moqStatus === 'UNCERTAIN' ? 0 : undefined,
      evidence: { moq: ctx.page.moq, productTypeProfile: ctx.profile },
      fieldSource: 'moq',
      confidence: moqFound ? moqConf : ctx.parseUncertain ? 0.45 : 0.85,
    }),
  );

  let oemStatus: RuleResult['status'] = ctx.page.oemAvailable || oemText ? 'PASS' : 'FAIL';
  let oemSev: IssueSeverity = ctx.customRelevant ? 'MEDIUM' : 'LOW';
  if (oemStatus === 'FAIL' && (ctx.field('oemAvailable') === 'UNCERTAIN' || (ctx.parseUncertain && ctx.field('oemAvailable') !== 'FOUND'))) {
    oemStatus = 'UNCERTAIN';
    oemSev = 'LOW';
  }
  results.push(
    make(ctx, 'conversion-oem', oemStatus, {
      title: oemStatus === 'UNCERTAIN' ? '当前页面暂未可靠识别到 OEM/ODM' : oemStatus === 'PASS' ? 'OEM/ODM 有线索' : 'OEM/ODM 不明确',
      description: `isCustomizationRelevant=${ctx.customRelevant}，profile=${ctx.profile}。`,
      suggestion: oemSuggestion(ctx.customRelevant),
      severity: oemSev,
      scoreImpact: oemStatus === 'UNCERTAIN' ? 0 : undefined,
      evidence: { oemAvailable: ctx.page.oemAvailable, isCustomizationRelevant: ctx.customRelevant, profile: ctx.profile },
      fieldSource: 'oemAvailable',
    }),
  );

  results.push(
    make(ctx, 'conversion-application', ctx.hasApplication ? 'PASS' : 'FAIL', {
      title: ctx.hasApplication ? '转化侧应用场景充分' : '买家难以判断适用场景',
      description: '应用场景同时影响询盘匹配与 GEO。',
      suggestion: applicationSuggestion(ctx.coreProductTerm),
      severity: 'MEDIUM',
      evidence: { hasApplicationContent: ctx.hasApplication },
    }),
  );

  results.push(
    make(ctx, 'conversion-company', ctx.companyScore >= 3 ? 'PASS' : 'FAIL', {
      title: ctx.companyScore >= 3 ? '公司证据较完整' : '制造商证据偏弱',
      description: `companyEvidenceScore=${ctx.companyScore}`,
      suggestion: companySuggestion(ctx.companyScore),
      severity: ctx.companyScore <= 1 ? 'MEDIUM' : 'LOW',
      evidence: { companyEvidenceScore: ctx.companyScore },
    }),
  );

  results.push(
    make(ctx, 'conversion-faq', ctx.hasFaq ? 'PASS' : 'FAIL', {
      title: ctx.hasFaq ? 'FAQ 有助于降低询盘成本' : '建议补充 FAQ',
      description: 'FAQ 缺失不作为严重问题。',
      suggestion: faqSuggestion(),
      severity: 'LOW',
      suggestionType: 'ENHANCEMENT',
      evidence: { hasFaq: ctx.hasFaq },
    }),
  );

  const kw = ctx.page.keywords.filter((k) => k.trim()).length;
  const kwParse = ctx.field('keywords');
  let kwStatus: RuleResult['status'] = kw >= 3 ? 'PASS' : 'FAIL';
  let kwTitle = kw >= 3 ? '关键词覆盖尚可' : '关键词覆盖不足';
  let kwDesc = `可识别关键词 ${kw} 个（基础规则）。`;
  if (kwParse === 'UNCERTAIN') {
    kwStatus = 'UNCERTAIN';
    kwTitle = '暂未可靠识别后台关键词，请确认。';
    kwDesc = '关键词解析状态为 UNCERTAIN，不能按 0 个关键词扣分。';
  } else if (kwParse === 'FOUND' && kw === 0) {
    kwStatus = 'FAIL';
    kwTitle = '关键词缺失';
    kwDesc = '已定位关键词区域，但未读取到关键词。';
  }
  results.push(
    make(ctx, 'google-keyword-count', kwStatus, {
      title: kwTitle,
      description: kwDesc,
      suggestion: '补充核心词、同义词与长尾，不要堆砌到标题。前 3 个关键词权重更高。',
      severity: kwStatus === 'UNCERTAIN' ? 'LOW' : 'MEDIUM',
      scoreImpact: kwStatus === 'UNCERTAIN' ? 0 : undefined,
      evidence: {
        keywordCount: kw,
        keywordParseStatus: kwParse,
        primaryKeywords: ctx.page.primaryKeywords ?? ctx.page.keywords.slice(0, 3),
      },
      fieldSource: 'keywords',
    }),
  );

  const primary = ctx.page.primaryKeywords?.length ? ctx.page.primaryKeywords : ctx.page.keywords.slice(0, 3);
  const titleLow = title.toLowerCase();
  const core = (ctx.coreProductTerm || '').toLowerCase();
  const catLow = (ctx.page.category || '').toLowerCase();
  if (product) {
    primary.forEach((keyword, index) => {
    const k = keyword.toLowerCase();
    const overlapTitle = k.split(/\s+/).filter((w) => w.length > 2 && titleLow.includes(w)).length > 0;
    const overlapCore = Boolean(core) && (k.includes(core) || core.includes(k.split(/\s+/).pop() || ''));
    const overlapCat = Boolean(catLow) && k.split(/\s+/).some((w) => w.length > 2 && catLow.includes(w));
    const aligned = overlapTitle || overlapCore || overlapCat;
    results.push(
      make(ctx, `mic-primary-keyword-${index + 1}`, !keyword ? 'SKIPPED' : aligned ? 'PASS' : 'FAIL', {
        title: aligned ? `Keyword #${index + 1} 与标题/中心词一致` : `Keyword #${index + 1} 与标题/类目一致性偏弱`,
        description: `前三关键词：${keyword}。对照 Title / Core Term / Category。`,
        suggestion: '保证前 3 个关键词覆盖产品中心词，并与标题、类目一致。',
        severity: 'LOW',
        evidence: { keyword, index: index + 1, overlapTitle, overlapCore, overlapCat },
        fieldSource: 'keywords',
      }),
    );
    });
  }

  const centers = ctx.page.centerTerms ?? [];
  if (ctx.page.pageType === 'MIC_PRODUCT_EDIT' || centers.length) {
    const missing = centers.filter((term) => !titleLow.includes(term.toLowerCase()));
    results.push(
      make(ctx, 'mic-center-term-title', centers.length === 0 ? 'UNCERTAIN' : missing.length ? 'FAIL' : 'PASS', {
        title: missing.length ? '中心词与标题不完全一致' : centers.length ? '中心词与标题一致' : '中心词暂未可靠识别',
        description: `centerTerms=${centers.join(', ') || '—'}`,
        suggestion: '中心词应出现在产品名称中。',
        severity: 'LOW',
        scoreImpact: centers.length === 0 ? 0 : undefined,
        evidence: { centerTerms: centers, missingInTitle: missing },
      }),
    );
  }

  const relevance = ctx.page.categoryRelevance;
  if (ctx.page.pageType === 'MIC_PRODUCT_EDIT' && ctx.page.category) {
    const relStatus =
      !relevance || relevance.status === 'UNCERTAIN'
        ? 'UNCERTAIN'
        : relevance.status === 'MATCH'
          ? 'PASS'
          : 'FAIL';
    results.push(
      make(ctx, 'mic-category-relevance', relStatus, {
        title:
          relevance?.status === 'MATCH'
            ? '类目与产品名称匹配'
            : '当前产品名称与所选 MIC 子目录可能存在匹配度问题，建议人工确认类目。',
        description: relevance?.message ?? `Title + Selected Category：${title} / ${ctx.page.category}`,
        suggestion: '不要自动修改类目。请人工确认 Steam Cleaner 等子目录是否与真空吸尘器产品一致。',
        severity: relevance?.status === 'MISMATCH' ? 'HIGH' : relStatus === 'FAIL' ? 'MEDIUM' : 'LOW',
        evidence: {
          title,
          category: ctx.page.category,
          categorySource: ctx.page.categorySource,
          status: relevance?.status,
        },
        fieldSource: 'category',
      }),
    );
  }

  if (product) {
    const identity = inspectProductIdentity(ctx.page);
    const conflict = identity.conflict;
    const verified = identity.profile.userVerified;
    results.push(
      make(
        ctx,
        'product-identity-conflict',
        conflict && !verified ? 'FAIL' : 'PASS',
        {
          title: conflict
            ? verified
              ? '产品身份已人工确认'
              : 'PRODUCT_IDENTITY_CONFLICT：标题与类目/关键词不是同一产品'
            : '产品身份一致',
          description: conflict
            ? conflict.summary
            : `核心产品 ${identity.profile.coreProduct}，产品族 ${identity.profile.productFamily}。`,
          suggestion: conflict
            ? verified
              ? '已按人工确认的产品身份继续。AI 不得覆盖该身份。'
              : '请先人工确认产品身份。确认前暂停关键词推荐，且不得自动改 MIC。'
            : '保持标题、类目、关键词、参数指向同一产品。',
          severity: conflict && !verified ? 'HIGH' : 'LOW',
          scoreImpact: conflict && !verified ? -12 : 0,
          evidence: {
            code: conflict?.code ?? 'PRODUCT_IDENTITY_OK',
            coreProduct: identity.profile.coreProduct,
            productFamily: identity.profile.productFamily,
            identityConfidence: identity.profile.identityConfidence,
            userVerified: verified,
            keywordRecommendationsPaused: identity.keywordRecommendationsPaused,
            conflict,
          },
        },
      ),
    );
  }

  results.push(
    make(ctx, 'geo-application', ctx.hasApplication ? 'PASS' : 'FAIL', {
      title: ctx.hasApplication ? 'GEO 应用实体有线索' : 'GEO 应用实体不足',
      description: ctx.hasApplication
        ? '有场景用语，利于实体关联。'
        : '当前页面描述了产品，但未明确适用行业和使用场景，AI 难以建立 usedFor 关系。',
      suggestion: '在 Product Description 后新增 Applications 模块，列出实际适用场景。',
      severity: 'MEDIUM',
      evidence: { hasApplicationContent: ctx.hasApplication },
    }),
  );

  results.push(
    make(ctx, 'geo-faq', ctx.hasFaq ? 'PASS' : 'FAIL', {
      title: ctx.hasFaq ? 'GEO FAQ 有覆盖' : 'FAQ 对 AI 可见性不足',
      description: '问答结构更容易被模型摘取。',
      suggestion: faqSuggestion(),
      severity: 'LOW',
      suggestionType: 'ENHANCEMENT',
      evidence: { hasFaq: ctx.hasFaq },
    }),
  );

  results.push(
    make(ctx, 'geo-company', ctx.companyScore >= 2 ? 'PASS' : 'FAIL', {
      title: ctx.companyScore >= 2 ? '制造商实体可识别' : '公司实体偏弱',
      description: `公司名 ${ctx.page.companyName || '缺失'}，证据分 ${ctx.companyScore}。`,
      suggestion: companySuggestion(ctx.companyScore),
      severity: 'MEDIUM',
      evidence: { companyName: ctx.page.companyName, companyEvidenceScore: ctx.companyScore },
    }),
  );

  results.push(
    make(ctx, 'geo-evidence', ctx.evidence >= 3 ? 'PASS' : 'FAIL', {
      title: ctx.evidence >= 3 ? '可验证事实密度尚可' : '证据型内容偏少',
      description: `evidenceCount=${ctx.evidence}`,
      suggestion: '补充尺寸、材料、交期、MOQ、包装数量等可核对事实。',
      severity: 'MEDIUM',
      evidence: { evidenceCount: ctx.evidence },
    }),
  );

  return results;
}
