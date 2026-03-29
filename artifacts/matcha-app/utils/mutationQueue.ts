import AsyncStorage from "@react-native-async-storage/async-storage";

export const MUTATION_QUEUE_STORAGE_KEY = "mutationQueue:v1";

export type MutationQueueType =
  | "profile_field_patch"
  | "settings_save"
  | "profile_photo_upload"
  | "profile_photo_delete";

export type MutationQueueStatus =
  | "queued"
  | "saving"
  | "retryable_error"
  | "permanent_error"
  | "completed";

export type MutationQueueItem<T = unknown> = {
  id: string;
  userId: number;
  type: MutationQueueType;
  targetKey: string;
  canonicalPayload: T;
  status: MutationQueueStatus;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  lastError: string | null;
};

type QueueStore = MutationQueueItem[];

function generateMutationId() {
  return `mq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function readStore(): Promise<QueueStore> {
  const raw = await AsyncStorage.getItem(MUTATION_QUEUE_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as QueueStore;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeStore(items: QueueStore) {
  await AsyncStorage.setItem(MUTATION_QUEUE_STORAGE_KEY, JSON.stringify(items));
}

export async function loadMutationQueue() {
  return readStore();
}

export async function listMutationQueueForUser(userId: number) {
  const items = await readStore();
  return items.filter((item) => item.userId === userId);
}

export async function clearMutationQueueForUser(userId: number) {
  const items = await readStore();
  await writeStore(items.filter((item) => item.userId !== userId));
}

export async function enqueueMutation<T>(input: {
  userId: number;
  type: MutationQueueType;
  targetKey: string;
  canonicalPayload: T;
}) {
  const items = await readStore();
  const now = new Date().toISOString();
  const existingIndex = [...items]
    .reverse()
    .findIndex(
      (item) =>
        item.userId === input.userId &&
        item.targetKey === input.targetKey &&
        item.status !== "saving" &&
        item.status !== "completed"
    );

  if (existingIndex !== -1) {
    const index = items.length - 1 - existingIndex;
    const existing = items[index]!;
    const nextItem: MutationQueueItem<T> = {
      ...existing,
      type: input.type,
      canonicalPayload: input.canonicalPayload,
      status: "queued",
      updatedAt: now,
      lastError: null,
    };
    const nextItems = [...items];
    nextItems[index] = nextItem;
    await writeStore(nextItems);
    return nextItem;
  }

  const nextItem: MutationQueueItem<T> = {
    id: generateMutationId(),
    userId: input.userId,
    type: input.type,
    targetKey: input.targetKey,
    canonicalPayload: input.canonicalPayload,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
    lastError: null,
  };
  await writeStore([...items, nextItem]);
  return nextItem;
}

export async function updateMutationQueueItem<T>(
  id: string,
  updates: Partial<MutationQueueItem<T>>
) {
  const items = await readStore();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) {
    return null;
  }

  const nextItem: MutationQueueItem<T> = {
    ...(items[index] as MutationQueueItem<T>),
    ...updates,
    updatedAt: updates.updatedAt ?? new Date().toISOString(),
  };
  const nextItems = [...items];
  nextItems[index] = nextItem;
  await writeStore(nextItems);
  return nextItem;
}

export async function removeCompletedMutationsForUser(userId: number) {
  const items = await readStore();
  await writeStore(
    items.filter((item) => !(item.userId === userId && item.status === "completed"))
  );
}

export async function getReplayableMutationsForUser(userId: number) {
  const items = await readStore();
  return items
    .filter(
      (item) =>
        item.userId === userId &&
        (item.status === "queued" || item.status === "retryable_error")
    )
    .sort((a, b) => {
      if (a.createdAt === b.createdAt) {
        return a.updatedAt.localeCompare(b.updatedAt);
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
}
