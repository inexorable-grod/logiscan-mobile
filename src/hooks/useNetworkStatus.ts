import { useEffect, useState, useRef, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

/**
 * Hook for monitoring network connectivity status.
 *
 * Triggers a callback when connectivity is restored (transitions from
 * offline to online), useful for triggering sync operations.
 *
 * @param onReconnect - Optional callback invoked when connectivity is restored
 * @returns isConnected boolean
 */
export function useNetworkStatus(onReconnect?: () => void) {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const wasDisconnected = useRef<boolean>(false);

  const handleStateChange = useCallback(
    (state: NetInfoState) => {
      const connected = state.isConnected ?? false;

      if (!connected) {
        wasDisconnected.current = true;
      }

      if (connected && wasDisconnected.current) {
        wasDisconnected.current = false;
        onReconnect?.();
      }

      setIsConnected(connected);
    },
    [onReconnect]
  );

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(handleStateChange);
    return () => unsubscribe();
  }, [handleStateChange]);

  return { isConnected };
}
