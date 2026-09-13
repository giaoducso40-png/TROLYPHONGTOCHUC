"use client";

export type QueuedMutation = {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
  blocked?: boolean;
};

const DB_NAME = "ued-organization-offline";
const DB_VERSION = 1;
const STORE = "outbox";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("nextAttemptAt", "nextAttemptAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = operation(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function queueMutation(action: string, payload: Record<string, unknown>, idempotencyKey = crypto.randomUUID()) {
  const item: QueuedMutation = {
    id: crypto.randomUUID(),
    action,
    payload,
    idempotencyKey,
    createdAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: Date.now(),
  };
  await transact("readwrite", (store) => store.put(item));
  return item;
}

export async function getOutbox(): Promise<QueuedMutation[]> {
  return transact("readonly", (store) => store.getAll());
}

async function updateOutboxItem(item: QueuedMutation) {
  await transact("readwrite", (store) => store.put(item));
}

async function removeOutboxItem(id: string) {
  await transact("readwrite", (store) => store.delete(id));
}

export async function retryFailedMutations(ids?: string[]) {
  const selected = ids ? new Set(ids) : null;
  const items = await getOutbox();
  let reset = 0;
  for (const item of items) {
    if ((!item.blocked && !item.lastError) || (selected && !selected.has(item.id))) continue;
    await updateOutboxItem({
      ...item,
      blocked: false,
      attempts: 0,
      nextAttemptAt: Date.now(),
      lastError: undefined,
    });
    reset += 1;
  }
  return { reset, remaining: (await getOutbox()).length };
}

export async function sendOrQueue(action: string, payload: Record<string, unknown>) {
  const idempotencyKey = crypto.randomUUID();
  let response: Response;
  try {
    response = await fetch("/api/workspace", {
      method: "POST",
      headers: { "content-type": "application/json", "x-idempotency-key": idempotencyKey },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch (error) {
    const item = await queueMutation(action, payload, idempotencyKey);
    return { queued: true, data: item, error: error instanceof Error ? error.message : "Không thể kết nối máy chủ" };
  }
  const data = await response.json().catch(() => null);
  if (response.ok) return { queued: false, data };
  const message = data?.error ?? `HTTP ${response.status}`;
  if ([408, 425, 429, 502, 503, 504].includes(response.status)) {
    const item = await queueMutation(action, payload, idempotencyKey);
    return { queued: true, data: item, error: message };
  }
  throw new Error(message);
}

export async function flushOutbox(onProgress?: (remaining: number) => void) {
  const items = (await getOutbox()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let sent = 0;
  let failed = 0;

  for (const item of items) {
    if (item.nextAttemptAt > Date.now()) continue;
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": item.idempotencyKey },
        body: JSON.stringify({ action: item.action, ...item.payload }),
      });
      if (!response.ok) {
        const message = (await response.json().catch(() => null))?.error ?? `HTTP ${response.status}`;
        if (![408, 425, 429, 502, 503, 504].includes(response.status)) {
          await updateOutboxItem({ ...item, blocked: true, nextAttemptAt: Number.MAX_SAFE_INTEGER, lastError: message });
          failed += 1;
          onProgress?.((await getOutbox()).length);
          continue;
        }
        throw new Error(message);
      }
      await removeOutboxItem(item.id);
      sent += 1;
    } catch (error) {
      const attempts = item.attempts + 1;
      const delay = Math.min(5 * 60_000, 2 ** attempts * 2_000);
      await updateOutboxItem({
        ...item,
        attempts,
        nextAttemptAt: Date.now() + delay,
        lastError: error instanceof Error ? error.message : "Lỗi không xác định",
      });
      failed += 1;
    }
    onProgress?.((await getOutbox()).length);
  }

  return { sent, failed, remaining: (await getOutbox()).length };
}
