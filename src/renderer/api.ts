import type { StudioBridge, StudioEvent } from '../shared/types';
const missing: StudioBridge = {
  invoke: async () => {
    throw new Error('Open UltraCart Studio in its desktop window to connect to the local engine.');
  },
  subscribe: () => () => {},
  previewBounds: () => {},
};
export const api = window.studio || missing;
export const invoke = <T = any>(method: string, params?: unknown) => api.invoke<T>(method, params);
export const subscribe = (callback: (event: StudioEvent) => void) => api.subscribe(callback);
export function errorText(error: unknown) {
  return (error instanceof Error ? error.message : 'Something went wrong.').replace(
    /^Error invoking remote method '[^']+': Error: /,
    ''
  );
}
