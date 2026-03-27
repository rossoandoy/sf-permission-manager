/**
 * Salesforce REST API / Tooling API クライアント
 * すべてのAPIコールはこのモジュールを経由する
 */

import pLimit from "p-limit";
import type {
  SfSession,
  SfQueryResult,
  SfCompositeRequest,
  SfCompositeResponse,
  SfCollectionResponse,
  SfApiErrorResponse,
  SfDescribeResult,
} from "../types/salesforce";

// --- 定数 ---

export const SF_API_VERSION = "62.0";

/** 並列リクエスト上限 */
const limit = pLimit(5);

// --- エラークラス ---

export class SfSessionExpiredError extends Error {
  constructor() {
    super(
      "セッションが切れました。Salesforceにログインし直してください。",
    );
    this.name = "SfSessionExpiredError";
  }
}

export class SfApiLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SfApiLimitError";
  }
}

export class SfApiError extends Error {
  readonly statusCode: number;
  readonly body: string;

  constructor(message: string, statusCode: number, body: string = "") {
    super(message);
    this.name = "SfApiError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

// --- 内部ユーティリティ ---

function apiBase(session: SfSession): string {
  return `${session.instanceUrl}/services/data/v${SF_API_VERSION}`;
}

/**
 * 認証付きfetchラッパー
 * 401 → SfSessionExpiredError、429 → SfApiLimitError
 */
async function sfFetch<T>(
  session: SfSession,
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await limit(() =>
    fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    }),
  );

  if (response.status === 401) {
    throw new SfSessionExpiredError();
  }

  if (response.status === 429) {
    throw new SfApiLimitError(
      "APIリクエスト制限に達しました。しばらく待ってから再試行してください。",
    );
  }

  // 204 No Content（PATCH成功時など）
  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.text();

  if (!response.ok) {
    // SFエラーレスポンスのパース試行
    let message = `SF API error: ${response.status}`;
    try {
      const errors = JSON.parse(body) as SfApiErrorResponse[];
      if (errors.length > 0) {
        message = errors.map((e) => `${e.errorCode}: ${e.message}`).join("; ");
      }
    } catch {
      message = body || message;
    }
    throw new SfApiError(message, response.status, body);
  }

  return JSON.parse(body) as T;
}

// --- クエリ ---

/**
 * SOQLクエリ実行（自動ページネーション付き）
 */
export async function query<T>(
  session: SfSession,
  soql: string,
): Promise<SfQueryResult<T>> {
  const encoded = encodeURIComponent(soql);
  let result = await sfFetch<SfQueryResult<T>>(
    session,
    `${apiBase(session)}/query/?q=${encoded}`,
  );

  const allRecords = [...result.records];

  while (!result.done && result.nextRecordsUrl) {
    result = await sfFetch<SfQueryResult<T>>(
      session,
      `${session.instanceUrl}${result.nextRecordsUrl}`,
    );
    allRecords.push(...result.records);
  }

  return { ...result, records: allRecords, done: true };
}

/**
 * Tooling APIクエリ実行（自動ページネーション付き）
 */
export async function toolingQuery<T>(
  session: SfSession,
  soql: string,
): Promise<SfQueryResult<T>> {
  const encoded = encodeURIComponent(soql);
  let result = await sfFetch<SfQueryResult<T>>(
    session,
    `${apiBase(session)}/tooling/query/?q=${encoded}`,
  );

  const allRecords = [...result.records];

  while (!result.done && result.nextRecordsUrl) {
    result = await sfFetch<SfQueryResult<T>>(
      session,
      `${session.instanceUrl}${result.nextRecordsUrl}`,
    );
    allRecords.push(...result.records);
  }

  return { ...result, records: allRecords, done: true };
}

// --- CRUD ---

/**
 * レコード更新（PATCH）
 */
export async function updateRecord(
  session: SfSession,
  sobjectType: string,
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await sfFetch<void>(
    session,
    `${apiBase(session)}/sobjects/${sobjectType}/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(fields),
    },
  );
}

/**
 * レコード作成（POST）→ 新規IDを返却
 */
export async function createRecord(
  session: SfSession,
  sobjectType: string,
  fields: Record<string, unknown>,
): Promise<string> {
  const result = await sfFetch<{ id: string; success: boolean }>(
    session,
    `${apiBase(session)}/sobjects/${sobjectType}`,
    {
      method: "POST",
      body: JSON.stringify(fields),
    },
  );
  return result.id;
}

// --- バッチ操作 ---

/** 1回のCollection APIリクエストの上限 */
const COLLECTION_BATCH_SIZE = 200;

/**
 * SObject Collection API でバッチ更新（PATCH）
 * 200件ずつ分割して実行
 */
export async function collectionUpdate(
  session: SfSession,
  sobjectType: string,
  records: { Id: string; [key: string]: unknown }[],
): Promise<SfCollectionResponse> {
  const results: SfCollectionResponse = [];

  for (let i = 0; i < records.length; i += COLLECTION_BATCH_SIZE) {
    const batch = records.slice(i, i + COLLECTION_BATCH_SIZE).map((rec) => ({
      attributes: { type: sobjectType },
      ...rec,
    }));

    const batchResult = await sfFetch<SfCollectionResponse>(
      session,
      `${apiBase(session)}/composite/sobjects`,
      {
        method: "PATCH",
        body: JSON.stringify({ allOrNone: false, records: batch }),
      },
    );

    results.push(...batchResult);
  }

  return results;
}

/**
 * SObject Collection API でバッチ作成（POST）
 * 200件ずつ分割して実行
 */
export async function collectionCreate(
  session: SfSession,
  sobjectType: string,
  records: Record<string, unknown>[],
): Promise<SfCollectionResponse> {
  const results: SfCollectionResponse = [];

  for (let i = 0; i < records.length; i += COLLECTION_BATCH_SIZE) {
    const batch = records.slice(i, i + COLLECTION_BATCH_SIZE).map((rec) => ({
      attributes: { type: sobjectType },
      ...rec,
    }));

    const batchResult = await sfFetch<SfCollectionResponse>(
      session,
      `${apiBase(session)}/composite/sobjects`,
      {
        method: "POST",
        body: JSON.stringify({ allOrNone: false, records: batch }),
      },
    );

    results.push(...batchResult);
  }

  return results;
}

// --- Describe API ---

/**
 * オブジェクトの describe（フィールド一覧含む）を取得
 */
export async function describeObject(
  session: SfSession,
  sobjectType: string,
): Promise<SfDescribeResult> {
  return sfFetch<SfDescribeResult>(
    session,
    `${apiBase(session)}/sobjects/${sobjectType}/describe`,
  );
}

// --- Composite API ---

/**
 * Composite APIリクエスト実行
 */
export async function compositeRequest(
  session: SfSession,
  request: SfCompositeRequest,
): Promise<SfCompositeResponse> {
  return sfFetch<SfCompositeResponse>(
    session,
    `${apiBase(session)}/composite`,
    {
      method: "POST",
      body: JSON.stringify(request),
    },
  );
}
