export class IndependentSiteAdapter {
  readonly platform = 'INDEPENDENT_SITE' as const;
  matches(_url: string): boolean {
    return false;
  }
}
