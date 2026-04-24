import { useCallback, useEffect, useRef, useState } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { getPendingScans, markSynced, markFailed, getStats } from '../services/offlineQueue';
import { postScanBatch } from '../services/api';

/**
 * Hook for managing offline scan synchronization.
 *
 * Automatically triggers sync when network connectivity is restored.
 * Provides manual sync trigger and status information.
 *
 * @returns isSyncing, pendingCount, lastSyncAt, syncNow
 */
export function useOfflineSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const syncInProgress = useRef(false);

  /** Refresh the pending count from the local database */
  const refreshStats = useCallback(async () => {
    const stats = await getStats();
    setPendingCount(stats.pending ?? 0);
  }, []);

  /** Sync all pending scans to the server */
  const syncNow = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    setIsSyncing(true);

    try {
      const pending = await getPendingScans(50);
      if (pending.length === 0) {
        await refreshStats();
        return;
      }

      const { results } = await postScanBatch(
        pending.map((s) => ({
          localId: s.localId,
          barcode: s.barcode,
          scanType: s.scanType,
          scannedAt: s.scannedAt,
          routeId: s.routeId,
          clientId: s.clientId,
        }))
      );

      for (const result of results) {
        if (result.status === 'synced' || result.status === 'duplicate') {
          await markSynced(result.localId);
        } else {
          await markFailed(result.localId);
        }
      }

      setLastSyncAt(new Date());
      await refreshStats();
    } catch {
      // Network error — scans remain pending for next attempt
    } finally {
      setIsSyncing(false);
      syncInProgress.current = false;
    }
  }, [refreshStats]);

  // Auto-sync when network reconnects
  useNetworkStatus(syncNow);

  // Load initial stats
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  return { isSyncing, pendingCount, lastSyncAt, syncNow, refreshStats };
}
