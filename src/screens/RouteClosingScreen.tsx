import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { createClosure, uploadDocument } from '../services/routeClosureApi';
import { RouteClosure } from '../types/closure';

interface Props {
  routeId: string;
  routeNumber: string;
  onViewComparison: (closureId: string) => void;
}

interface PhotoItem {
  uri: string;
  fileName: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
}

function getTodayDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function RouteClosingScreen({ routeId, routeNumber, onViewComparison }: Props) {

  const [operationDate, setOperationDate] = useState(getTodayDate);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const [closureResult, setClosureResult] = useState<RouteClosure | null>(null);

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la galeria o camara para tomar fotos del manifiesto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (result.canceled) return;

    const newPhotos: PhotoItem[] = result.assets.map((asset: ImagePicker.ImagePickerAsset, idx: number) => ({
      uri: asset.uri,
      fileName: asset.fileName ?? `manifiesto_${Date.now()}_${idx}.jpg`,
      status: 'pending' as const,
    }));

    setPhotos((prev) => [...prev, ...newPhotos]);
  };

  const handleTakeCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la camara para tomar fotos del manifiesto.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setPhotos((prev) => [
      ...prev,
      {
        uri: asset.uri,
        fileName: asset.fileName ?? `manifiesto_${Date.now()}.jpg`,
        status: 'pending',
      },
    ]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartClosure = async () => {
    if (photos.length === 0) {
      Alert.alert('Sin fotos', 'Debe tomar al menos una foto del manifiesto antes de iniciar el cierre.');
      return;
    }

    if (!operationDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Fecha invalida', 'Ingrese la fecha en formato YYYY-MM-DD.');
      return;
    }

    setIsClosing(true);

    try {
      // Step 1: Create the closure
      const closure = await createClosure(routeId, operationDate);

      // Step 2: Upload each photo
      const updatedPhotos = [...photos];
      for (let i = 0; i < updatedPhotos.length; i++) {
        updatedPhotos[i] = { ...updatedPhotos[i], status: 'uploading' };
        setPhotos([...updatedPhotos]);

        try {
          await uploadDocument(closure.id, updatedPhotos[i].uri, updatedPhotos[i].fileName);
          updatedPhotos[i] = { ...updatedPhotos[i], status: 'uploaded' };
        } catch {
          updatedPhotos[i] = { ...updatedPhotos[i], status: 'error' };
        }

        setPhotos([...updatedPhotos]);
      }

      const hasErrors = updatedPhotos.some((p) => p.status === 'error');
      if (hasErrors) {
        Alert.alert(
          'Carga parcial',
          'Algunas fotos no se pudieron subir. Puede reintentar mas tarde.'
        );
      }

      setClosureResult(closure);
    } catch (err: any) {
      Alert.alert(
        'Error al crear cierre',
        err?.response?.data?.message ?? err?.message ?? 'Ocurrio un error inesperado.'
      );
    } finally {
      setIsClosing(false);
    }
  };

  const handleViewComparison = () => {
    if (!closureResult) return;
    onViewComparison(closureResult.id);
  };

  // --- Completed state ---
  if (closureResult) {
    const uploadedCount = photos.filter((p) => p.status === 'uploaded').length;
    const errorCount = photos.filter((p) => p.status === 'error').length;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Cierre de Ruta {routeNumber}</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Text style={styles.summaryIconText}>OK</Text>
          </View>
          <Text style={styles.summaryTitle}>Cierre creado exitosamente</Text>
          <Text style={styles.summaryDetail}>
            Fecha de operacion: {operationDate}
          </Text>
          <Text style={styles.summaryDetail}>
            Fotos subidas: {uploadedCount} de {photos.length}
          </Text>
          {errorCount > 0 && (
            <Text style={styles.summaryError}>
              {errorCount} foto(s) con error
            </Text>
          )}
          <Text style={styles.summaryDetail}>
            Estado: {closureResult.status === 'pending_documents' ? 'Pendiente de OCR' : closureResult.status}
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleViewComparison}>
          <Text style={styles.primaryButtonText}>Ver comparativo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setClosureResult(null)}
        >
          <Text style={styles.secondaryButtonText}>Volver</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // --- Main form state ---
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cierre de Ruta {routeNumber}</Text>
        <Text style={styles.headerSubtitle}>
          Tome fotos del manifiesto de despacho para iniciar el cierre.
        </Text>
      </View>

      {/* Date picker */}
      <View style={styles.card}>
        <Text style={styles.label}>Fecha de operacion</Text>
        <TextInput
          style={styles.dateInput}
          value={operationDate}
          onChangeText={setOperationDate}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
      </View>

      {/* Photo capture buttons */}
      <View style={styles.card}>
        <Text style={styles.label}>Fotos del manifiesto</Text>
        <View style={styles.photoButtonsRow}>
          <TouchableOpacity
            style={[styles.photoButton, isClosing && styles.buttonDisabled]}
            onPress={handleTakeCamera}
            disabled={isClosing}
          >
            <Text style={styles.photoButtonText}>Tomar foto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.photoButton, styles.photoButtonOutline, isClosing && styles.buttonDisabled]}
            onPress={handleTakePhoto}
            disabled={isClosing}
          >
            <Text style={styles.photoButtonOutlineText}>Seleccionar de galeria</Text>
          </TouchableOpacity>
        </View>

        {/* Thumbnail strip */}
        {photos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.thumbnailStrip}
            contentContainerStyle={styles.thumbnailStripContent}
          >
            {photos.map((photo, index) => (
              <View key={`${photo.uri}-${index}`} style={styles.thumbnailContainer}>
                <Image source={{ uri: photo.uri }} style={styles.thumbnail} />

                {/* Status overlay */}
                <View
                  style={[
                    styles.thumbnailStatus,
                    photo.status === 'uploaded' && styles.thumbnailStatusUploaded,
                    photo.status === 'uploading' && styles.thumbnailStatusUploading,
                    photo.status === 'error' && styles.thumbnailStatusError,
                  ]}
                >
                  {photo.status === 'uploading' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.thumbnailStatusText}>
                      {photo.status === 'uploaded'
                        ? 'Subida'
                        : photo.status === 'error'
                        ? 'Error'
                        : `${index + 1}`}
                    </Text>
                  )}
                </View>

                {/* Remove button (only before closing) */}
                {photo.status === 'pending' && !isClosing && (
                  <TouchableOpacity
                    style={styles.thumbnailRemove}
                    onPress={() => removePhoto(index)}
                  >
                    <Text style={styles.thumbnailRemoveText}>X</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        )}

        {photos.length === 0 && (
          <Text style={styles.noPhotosText}>
            No se han agregado fotos aun.
          </Text>
        )}
      </View>

      {/* Start closure button */}
      <TouchableOpacity
        style={[styles.primaryButton, (isClosing || photos.length === 0) && styles.buttonDisabled]}
        onPress={handleStartClosure}
        disabled={isClosing || photos.length === 0}
      >
        {isClosing ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={[styles.primaryButtonText, { marginLeft: 10 }]}>
              Subiendo fotos...
            </Text>
          </View>
        ) : (
          <Text style={styles.primaryButtonText}>Iniciar cierre</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => { setPhotos([]); setOperationDate(getTodayDate()); }}
        disabled={isClosing}
      >
        <Text style={styles.secondaryButtonText}>Cancelar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#1a56db',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#bfdbfe',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 10,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    color: '#111827',
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#1a56db',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  photoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  photoButtonOutline: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1a56db',
  },
  photoButtonOutlineText: {
    color: '#1a56db',
    fontSize: 14,
    fontWeight: '600',
  },
  thumbnailStrip: {
    marginTop: 12,
  },
  thumbnailStripContent: {
    gap: 10,
  },
  thumbnailContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  thumbnailStatus: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  thumbnailStatusUploaded: {
    backgroundColor: 'rgba(5,150,105,0.85)',
  },
  thumbnailStatusUploading: {
    backgroundColor: 'rgba(26,86,219,0.85)',
  },
  thumbnailStatusError: {
    backgroundColor: 'rgba(220,38,38,0.85)',
  },
  thumbnailStatusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  thumbnailRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(220,38,38,0.85)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailRemoveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  noPhotosText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 12,
  },
  primaryButton: {
    backgroundColor: '#1a56db',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Summary (completed state)
  summaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  summaryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  summaryIconText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  summaryDetail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryError: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
    marginBottom: 4,
  },
});
