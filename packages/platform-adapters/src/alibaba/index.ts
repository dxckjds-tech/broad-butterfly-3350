export class AlibabaAdapter {
  readonly platform = 'ALIBABA' as const;
  matches(_url: string): boolean {
    return false;
  }
}
