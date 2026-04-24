import { useCallback, useState } from 'react';

type ToggleType = 'bulto' | 'cubeta';
type ScanResult = 'bulto' | 'cubeta' | 'rf' | 'modal' | null;

/**
 * Hook for managing the Bulto/Cubeta toggle on the scanning screen.
 *
 * The toggle only applies to 10-digit codes. 5-digit and 11-digit codes
 * ignore the toggle state and use their own type logic.
 *
 * @returns scanType, toggleScanType, getScanTypeForCode
 */
export function useScanToggle() {
  const [scanType, setScanType] = useState<ToggleType>('bulto');

  const toggleScanType = useCallback(() => {
    setScanType((prev) => (prev === 'bulto' ? 'cubeta' : 'bulto'));
  }, []);

  /**
   * Determine the scan type for a given barcode based on its digit length.
   * @param code - The scanned barcode string
   * @returns The scan type, or null if the code length is invalid
   */
  const getScanTypeForCode = useCallback(
    (code: string): ScanResult => {
      if (!/^\d+$/.test(code)) return null;

      switch (code.length) {
        case 5:
          return 'rf';
        case 10:
          return scanType; // Uses the current toggle value
        case 11:
          return 'modal';
        default:
          return null;
      }
    },
    [scanType]
  );

  return { scanType, toggleScanType, getScanTypeForCode };
}
