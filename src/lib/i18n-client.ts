type TFn = (key: string, values?: Record<string, unknown>) => string;

const registry: { flow?: TFn } = {};

export function initFlowTranslations(t: TFn) {
  registry.flow = t;
}

export function tFlow(key: string, values?: Record<string, unknown>): string {
  return registry.flow?.(key, values) ?? key;
}
