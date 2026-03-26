/**
 * Chrome API モック定義
 * vitest.setup.ts から使用
 */

import { vi } from "vitest";

export function setupChromeApiMock(): void {
  const chromeMock = {
    cookies: {
      get: vi.fn(),
      getAll: vi.fn(),
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      session: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
      },
      lastError: null,
    },
    tabs: {
      query: vi.fn(),
    },
  };

  // @ts-expect-error chrome API mock
  globalThis.chrome = chromeMock;
}
