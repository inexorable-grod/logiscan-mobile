import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Vibration,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useScanToggle } from '../hooks/useScanToggle';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { addScan } from '../services/offlineQueue';
import { getClients } from '../services/api';
import { ScanType, Client } from '../types';

interface Props {
  operationId: string;
  routeId: string;
}

const DEBOUNCE_MS = 1500;

export default function ScannerScreen({ operationId, routeId }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const { scanType, toggleScanType, getScanTypeForCode } = useScanToggle();
  const { isSyncing, pendingCount, syncNow } = useOfflineSync();
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const debounceRef = useRef<number>(0);

  // Client picker state
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [pendingScanType, setPendingScanType] = useState<ScanType | null>(null);
  const [clientSearch, setClientSearch] = useState('');

  // Fetch clients for the selected route
  useEffect(() => {
    if (routeId) {
      getClients(routeId)
        .then(setClients)
        .catch(() => setClients([]));
    }
  }, [routeId]);

  const filteredClients = clients.filter((c) => {
    const q = clientSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.client_code.toLowerCase().includes(q) ||
      (c.address?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleBarCodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      const now = Date.now();
      if (now - debounceRef.current < DEBOUNCE_MS) return;
      debounceRef.current = now;

      const type = getScanTypeForCode(data);

      if (!type) {
        Vibration.vibrate([0, 100, 50, 100]);
        setLastScanned(`[No valido] ${data}`);
        Alert.alert(
          'Codigo no reconocido',
          `El codigo "${data}" (${data.length} digitos) no coincide con los formatos esperados (5, 10 u 11 digitos numericos).`
        );
        return;
      }

      if (type === 'modal') {
        Alert.alert(
          'Tipo de escaneo',
          `Codigo: ${data}`,
          [
            {
              text: 'Controlado',
              onPress: () => openClientPicker(data, 'controlado'),
            },
            {
              text: 'Refrigerado',
              onPress: () => openClientPicker(data, 'refrigerado'),
            },
            { text: 'Cancelar', style: 'cancel' },
          ]
        );
        return;
      }

      openClientPicker(data, type as ScanType);
    },
    [getScanTypeForCode]
  );

  const openClientPicker = (barcode: string, type: ScanType) => {
    setPendingBarcode(barcode);
    setPendingScanType(type);
    setClientSearch('');
    setShowClientPicker(true);
  };

  const confirmScan = async (clientId: string | null) => {
    if (!pendingBarcode || !pendingScanType) return;
    setShowClientPicker(false);

    try {
      const result = await addScan({
        barcode: pendingBarcode,
        scanType: pendingScanType,
        operationId,
        routeId,
        clientId,
      });

      if (result === 'duplicate') {
        Vibration.vibrate([0, 100, 50, 100]);
        Alert.alert(
          'Duplicado',
          `El codigo "${pendingBarcode}" ya fue escaneado en esta ruta.`
        );
      } else {
        setLastScanned(pendingBarcode);
        setScanCount((c) => c + 1);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Error', 'No se pudo guardar el escaneo.');
    }

    setPendingBarcode(null);
    setPendingScanType(null);
  };

  const cancelPicker = () => {
    setShowClientPicker(false);
    setPendingBarcode(null);
    setPendingScanType(null);
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          Se necesita acceso a la camara para escanear codigos de barras.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Permitir Camara</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'codabar', 'qr'],
        }}
        onBarcodeScanned={showClientPicker ? undefined : handleBarCodeScanned}
      >
        {/* Scan overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
          </View>
          <Text style={styles.hintText}>Apunte al codigo de barras</Text>
        </View>
      </CameraView>

      {/* Bottom controls */}
      <View style={styles.controls}>
        {/* Toggle Bulto/Cubeta */}
        <TouchableOpacity style={styles.toggleButton} onPress={toggleScanType}>
          <Text style={styles.toggleLabel}>Modo:</Text>
          <Text style={styles.toggleValue}>
            {scanType === 'bulto' ? 'BULTO' : 'CUBETA'}
          </Text>
        </TouchableOpacity>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{scanCount}</Text>
            <Text style={styles.statLabel}>Escaneados</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, pendingCount > 0 && styles.pendingValue]}>
              {pendingCount}
            </Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
        </View>

        {lastScanned && (
          <Text style={styles.lastScanned} numberOfLines={1}>
            Ultimo: {lastScanned}
          </Text>
        )}

        {/* Sync button */}
        <TouchableOpacity
          style={[styles.syncButton, isSyncing && styles.buttonDisabled]}
          onPress={syncNow}
          disabled={isSyncing}
        >
          <Text style={styles.syncButtonText}>
            {isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Client Picker Modal */}
      <Modal visible={showClientPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Asignar cliente</Text>
              <TouchableOpacity onPress={cancelPicker}>
                <Text style={styles.modalCancel}>Cancelar</Text>
              </TouchableOpacity>
            </View>

            {/* Scanned barcode info */}
            <View style={styles.scanInfo}>
              <Text style={styles.scanInfoLabel}>Codigo escaneado</Text>
              <Text style={styles.scanInfoValue}>{pendingBarcode}</Text>
              <Text style={styles.scanInfoType}>
                Tipo: {pendingScanType?.toUpperCase()}
              </Text>
            </View>

            {/* Search */}
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre, codigo o direccion..."
              value={clientSearch}
              onChangeText={setClientSearch}
              autoCapitalize="none"
            />

            {/* Client list */}
            <FlatList
              data={filteredClients}
              keyExtractor={(item) => item.id}
              style={styles.clientList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.clientItem}
                  onPress={() => confirmScan(item.id)}
                >
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientCode}>{item.client_code}</Text>
                    <Text style={styles.clientName}>{item.name}</Text>
                    {item.address && (
                      <Text style={styles.clientAddress} numberOfLines={1}>
                        {item.address}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.selectArrow}>›</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {clientSearch ? 'Sin resultados.' : 'No hay clientes en esta ruta.'}
                </Text>
              }
            />

            {/* Skip client button */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => confirmScan(null)}
            >
              <Text style={styles.skipButtonText}>Guardar sin cliente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const CORNER_SIZE = 20;
const CORNER_WIDTH = 3;
const CORNER_COLOR = '#1a56db';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scanArea: {
    width: 280,
    height: 160,
    backgroundColor: 'transparent',
  },
  cornerTL: {
    position: 'absolute', top: 0, left: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH,
    borderColor: CORNER_COLOR,
  },
  cornerTR: {
    position: 'absolute', top: 0, right: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH,
    borderColor: CORNER_COLOR,
  },
  cornerBL: {
    position: 'absolute', bottom: 0, left: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH,
    borderColor: CORNER_COLOR,
  },
  cornerBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH,
    borderColor: CORNER_COLOR,
  },
  hintText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  controls: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 12,
  },
  toggleLabel: { fontSize: 16, color: '#6b7280', marginRight: 8 },
  toggleValue: { fontSize: 18, fontWeight: '700', color: '#1a56db' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#111827' },
  pendingValue: { color: '#f59e0b' },
  statLabel: { fontSize: 12, color: '#6b7280' },
  lastScanned: {
    textAlign: 'center',
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  syncButton: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  syncButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f0f4f8',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#374151',
  },
  button: {
    backgroundColor: '#1a56db',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Client picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalCancel: { fontSize: 15, color: '#dc2626', fontWeight: '500' },
  scanInfo: {
    backgroundColor: '#f0f4f8',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  scanInfoLabel: { fontSize: 12, color: '#6b7280' },
  scanInfoValue: { fontSize: 18, fontWeight: '700', color: '#111827', marginTop: 2 },
  scanInfoType: { fontSize: 13, color: '#1a56db', fontWeight: '500', marginTop: 2 },
  searchInput: {
    marginHorizontal: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#f9fafb',
  },
  clientList: {
    marginTop: 8,
    maxHeight: 300,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  clientInfo: { flex: 1 },
  clientCode: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  clientName: { fontSize: 15, color: '#111827', fontWeight: '500', marginTop: 1 },
  clientAddress: { fontSize: 13, color: '#9ca3af', marginTop: 1 },
  selectArrow: { fontSize: 24, color: '#d1d5db', marginLeft: 8 },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    padding: 20,
  },
  skipButton: {
    marginHorizontal: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: { color: '#6b7280', fontSize: 14, fontWeight: '500' },
});
