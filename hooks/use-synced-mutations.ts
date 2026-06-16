/**
 * useSyncedMutations
 *
 * Hook que envolve todas as operações de escrita (create/update/delete)
 * e dispara automaticamente o triggerSync com debounce de 30s após cada mutação.
 *
 * Uso:
 *   const { createSpace, deleteItem, createFolder } = useSyncedMutations();
 *
 * As funções têm a mesma assinatura das originais em lib/spaces.ts, lib/items.ts
 * e lib/folders.ts — apenas ligam o sync automático por cima.
 */
import { useCallback } from 'react';
import { useSync } from '@/context/SyncContext';

// Imports das libs puras
import {
  createSpace as _createSpace,
  updateSpace as _updateSpace,
  deleteSpace as _deleteSpace,
} from '@/lib/spaces';
import {
  createItem as _createItem,
  updateItem as _updateItem,
  deleteItem as _deleteItem,
} from '@/lib/items';
import {
  createFolder as _createFolder,
  updateFolder as _updateFolder,
  deleteFolder as _deleteFolder,
} from '@/lib/folders';

import type { Space } from '@/lib/spaces';
import type { Item } from '@/lib/items';
import type { Folder } from '@/lib/folders';

export function useSyncedMutations() {
  const { triggerSync } = useSync();

  // ── Spaces ──────────────────────────────────────────────────────────────────
  const createSpace = useCallback(async (data: Parameters<typeof _createSpace>[0]): Promise<Space> => {
    const result = await _createSpace(data);
    triggerSync();
    return result;
  }, [triggerSync]);

  const updateSpace = useCallback(async (...args: Parameters<typeof _updateSpace>): Promise<void> => {
    await _updateSpace(...args);
    triggerSync();
  }, [triggerSync]);

  const deleteSpace = useCallback(async (id: string): Promise<void> => {
    await _deleteSpace(id);
    triggerSync();
  }, [triggerSync]);

  // ── Folders ──────────────────────────────────────────────────────────────────
  const createFolder = useCallback(async (data: Parameters<typeof _createFolder>[0]): Promise<Folder> => {
    const result = await _createFolder(data);
    triggerSync();
    return result;
  }, [triggerSync]);

  const updateFolder = useCallback(async (...args: Parameters<typeof _updateFolder>): Promise<void> => {
    await _updateFolder(...args);
    triggerSync();
  }, [triggerSync]);

  const deleteFolder = useCallback(async (id: string): Promise<void> => {
    await _deleteFolder(id);
    triggerSync();
  }, [triggerSync]);

  // ── Items ────────────────────────────────────────────────────────────────────
  const createItem = useCallback(async (data: Parameters<typeof _createItem>[0]): Promise<Item> => {
    const result = await _createItem(data);
    triggerSync();
    return result;
  }, [triggerSync]);

  const updateItem = useCallback(async (...args: Parameters<typeof _updateItem>): Promise<void> => {
    await _updateItem(...args);
    triggerSync();
  }, [triggerSync]);

  const deleteItem = useCallback(async (id: string): Promise<void> => {
    await _deleteItem(id);
    triggerSync();
  }, [triggerSync]);

  return {
    // spaces
    createSpace,
    updateSpace,
    deleteSpace,
    // folders
    createFolder,
    updateFolder,
    deleteFolder,
    // items
    createItem,
    updateItem,
    deleteItem,
  };
}
