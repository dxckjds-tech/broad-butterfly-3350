/** Short, collision-resistant node ids. Readable enough to debug by eye. */
export function createId(prefix = 'n'): string {
  const cryptoRef = globalThis.crypto as Crypto | undefined
  const raw =
    cryptoRef && typeof cryptoRef.randomUUID === 'function'
      ? cryptoRef.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12)
  return `${prefix}_${raw}`
}
