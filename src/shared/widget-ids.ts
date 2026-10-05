import type { Selection } from './connection';

export type WidgetIdBatch = {
  index: number;
  count: number;
  status: 'started' | 'received' | 'confirmed';
  startedAt: string;
  finishedAt?: string;
  ids?: number[];
  reportedCount?: number;
};
export type WidgetIdReceipt = {
  id: string;
  operationKey: string;
  selection: Selection;
  contentHash: string;
  count: number;
  status: 'preparing' | 'allocating' | 'blocked' | 'uncertain' | 'complete';
  createdAt: string;
  updatedAt: string;
  batches: WidgetIdBatch[];
  mapping: Record<string, string>;
  preparedContent?: string;
  preparedHash?: string;
  detail?: string;
  provenance: string;
};
export type WidgetIdPlan = {
  operationKey: string;
  contentHash: string;
  count: number;
  existingCount: number;
  batchSize: 100;
  batchCount: number;
  canReserve: boolean;
  reason?: string;
  receipt: WidgetIdReceipt | null;
  provenance: string;
};
export type WidgetIdResult = { content: string; receipt: WidgetIdReceipt };
