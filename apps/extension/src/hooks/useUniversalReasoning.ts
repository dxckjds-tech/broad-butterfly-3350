import { useEffect, useState } from 'react';
import type { PlatformPageData, ReasoningState } from '@trade-ai/shared-types';
import { reasonAboutProduct } from '@trade-ai/universal-product-intelligence';

export function copyRequiresConfirm(state: ReasoningState | null): boolean {
  if (!state) return false;
  return (
    state.status === 'CONFLICT' ||
    state.status === 'UNCERTAIN' ||
    state.confidence.score < 0.55 ||
    !state.seo.canProceed
  );
}

export function useUniversalReasoning(page: PlatformPageData | null): ReasoningState | null {
  const [state, setState] = useState<ReasoningState | null>(null);

  useEffect(() => {
    if (!page || (!page.productName && !page.title)) {
      setState(null);
      return;
    }
    let cancelled = false;
    void reasonAboutProduct(page).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return state;
}
