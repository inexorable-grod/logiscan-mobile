import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { getMyRequests, postRequest, getClients } from '../services/api';
import { ClientRequest, Client } from '../types';

const REQUEST_TYPES = [
  { key: 'new_client', label: 'Nuevo cliente' },
  { key: 'update_client', label: 'Actualizar cliente' },
  { key: 'scan_reset', label: 'Reset de escaneo' },
] as const;

interface Props {
  routeId: string;
}

export default function RequestsScreen({ routeId }: Props) {
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<string>('new_client');
  const [submitting, setSubmitting] = useState(false);

  // Structured form fields
  const [clientCode, setClientCode] = useState('');
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');

  // For update_client: client selector
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const fetchRequests = useCallback(async () => {
    try {
      const { data } = await getMyRequests();
      setRequests(data);
    } catch {
      // Silently fail — user can pull to refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Load clients when update_client is selected
  useEffect(() => {
    if (formType === 'update_client' && routeId) {
      getClients(routeId)
        .then(setClients)
        .catch(() => setClients([]));
    }
  }, [formType, routeId]);

  const resetForm = () => {
    setClientCode('');
    setClientName('');
    setAddress('');
    setDistrict('');
    setCity('');
    setNotes('');
    setSelectedClientId(null);
    setShowClientSelector(false);
    setClientSearch('');
  };

  const handleTypeChange = (type: string) => {
    setFormType(type);
    resetForm();
  };

  const selectClient = (client: Client) => {
    setSelectedClientId(client.id);
    setClientCode(client.client_code);
    setClientName(client.name);
    setAddress(client.address ?? '');
    setShowClientSelector(false);
    setClientSearch('');
  };

  const filteredClients = clients.filter((c) => {
    const q = clientSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.client_code.toLowerCase().includes(q)
    );
  });

  const handleSubmitRequest = async () => {
    if (formType === 'new_client' || formType === 'update_client') {
      if (!clientName.trim()) {
        Alert.alert('Error', 'El nombre del cliente es obligatorio.');
        return;
      }
      if (formType === 'update_client' && !selectedClientId) {
        Alert.alert('Error', 'Seleccione un cliente a actualizar.');
        return;
      }
    } else if (formType === 'scan_reset') {
      if (!notes.trim()) {
        Alert.alert('Error', 'Agregue una descripcion para el reset.');
        return;
      }
    }

    setSubmitting(true);
    try {
      let requestData: Record<string, unknown>;

      if (formType === 'new_client') {
        requestData = {
          client_code: clientCode.trim(),
          name: clientName.trim(),
          address: address.trim(),
          district: district.trim(),
          city: city.trim(),
          notes: notes.trim() || undefined,
        };
      } else if (formType === 'update_client') {
        requestData = {
          client_id: selectedClientId,
          client_code: clientCode.trim(),
          name: clientName.trim(),
          address: address.trim(),
          district: district.trim(),
          city: city.trim(),
          notes: notes.trim() || undefined,
        };
      } else {
        requestData = { notes: notes.trim() };
      }

      await postRequest(formType, requestData, routeId);
      Alert.alert('Exito', 'Solicitud enviada correctamente.');
      setShowForm(false);
      resetForm();
      fetchRequests();
    } catch {
      Alert.alert('Error', 'No se pudo enviar la solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#059669';
      case 'rejected': return '#dc2626';
      default: return '#f59e0b';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Aprobada';
      case 'rejected': return 'Rechazada';
      default: return 'Pendiente';
    }
  };

  const renderItem = ({ item }: { item: ClientRequest }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.cardType}>
          {REQUEST_TYPES.find((t) => t.key === item.request_type)?.label ?? item.request_type}
        </Text>
        <View style={[styles.badge, { backgroundColor: statusColor(item.status) }]}>
          <Text style={styles.badgeText}>{statusLabel(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString('es')}</Text>
      {item.admin_comment && (
        <Text style={styles.comment}>Comentario: {item.admin_comment}</Text>
      )}
    </View>
  );

  const renderClientForm = () => (
    <>
      {formType === 'update_client' && (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Cliente a actualizar *</Text>
          <TouchableOpacity
            style={styles.selectorButton}
            onPress={() => setShowClientSelector(!showClientSelector)}
          >
            <Text style={selectedClientId ? styles.selectorText : styles.selectorPlaceholder}>
              {selectedClientId
                ? `${clientCode} — ${clientName}`
                : 'Seleccionar cliente...'}
            </Text>
          </TouchableOpacity>

          {showClientSelector && (
            <View style={styles.clientDropdown}>
              <TextInput
                style={styles.dropdownSearch}
                placeholder="Buscar cliente..."
                value={clientSearch}
                onChangeText={setClientSearch}
                autoCapitalize="none"
              />
              <ScrollView style={styles.dropdownList} nestedScrollEnabled>
                {filteredClients.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.dropdownItem}
                    onPress={() => selectClient(c)}
                  >
                    <Text style={styles.dropdownCode}>{c.client_code}</Text>
                    <Text style={styles.dropdownName}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
                {filteredClients.length === 0 && (
                  <Text style={styles.dropdownEmpty}>Sin resultados</Text>
                )}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Codigo del cliente</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="Ej: CLI-0001"
          value={clientCode}
          onChangeText={setClientCode}
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Nombre del cliente *</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="Nombre completo o razon social"
          value={clientName}
          onChangeText={setClientName}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Direccion</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="Calle, numero, edificio..."
          value={address}
          onChangeText={setAddress}
        />
      </View>

      <View style={styles.rowFields}>
        <View style={[styles.fieldGroup, { flex: 1 }]}>
          <Text style={styles.fieldLabel}>Barrio</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="Barrio"
            value={district}
            onChangeText={setDistrict}
          />
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.fieldGroup, { flex: 1 }]}>
          <Text style={styles.fieldLabel}>Ciudad</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="Ciudad"
            value={city}
            onChangeText={setCity}
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Notas adicionales</Text>
        <TextInput
          style={[styles.fieldInput, styles.textArea]}
          placeholder="Informacion adicional..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
        />
      </View>
    </>
  );

  const renderScanResetForm = () => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>Descripcion del reset *</Text>
      <TextInput
        style={[styles.fieldInput, styles.textArea]}
        placeholder="Describa el motivo del reset de escaneo..."
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a56db" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Mis solicitudes</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            if (showForm) resetForm();
            setShowForm(!showForm);
          }}
        >
          <Text style={styles.addButtonText}>{showForm ? 'Cancelar' : '+ Nueva'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <ScrollView style={styles.formScroll} nestedScrollEnabled>
          <View style={styles.form}>
            {/* Type selector */}
            <View style={styles.typeRow}>
              {REQUEST_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeChip, formType === t.key && styles.typeChipActive]}
                  onPress={() => handleTypeChange(t.key)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      formType === t.key && styles.typeChipTextActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {(formType === 'new_client' || formType === 'update_client')
              ? renderClientForm()
              : renderScanResetForm()
            }

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.buttonDisabled]}
              onPress={handleSubmitRequest}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Enviando...' : 'Enviar solicitud'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {!showForm && (
        <FlashList
          data={requests}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchRequests(); }}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No hay solicitudes.</Text>
            </View>
          }
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  addButton: {
    backgroundColor: '#1a56db',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  formScroll: { flex: 1 },
  form: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    padding: 16,
    elevation: 2,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  typeChipActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  typeChipText: { fontSize: 13, color: '#374151' },
  typeChipTextActive: { color: '#fff' },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#f9fafb',
  },
  textArea: { minHeight: 60, textAlignVertical: 'top' },
  rowFields: { flexDirection: 'row' },
  selectorButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
  },
  selectorText: { fontSize: 15, color: '#111827' },
  selectorPlaceholder: { fontSize: 15, color: '#9ca3af' },
  clientDropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#fff',
    maxHeight: 200,
  },
  dropdownSearch: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  dropdownList: { maxHeight: 150 },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownCode: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  dropdownName: { fontSize: 14, color: '#111827', marginTop: 1 },
  dropdownEmpty: { textAlign: 'center', color: '#9ca3af', padding: 12, fontSize: 13 },
  submitButton: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 10,
    padding: 16,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardType: { fontSize: 15, fontWeight: '600', color: '#111827' },
  badge: { borderRadius: 12, paddingVertical: 3, paddingHorizontal: 10 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  cardDate: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  comment: { fontSize: 13, color: '#374151', marginTop: 6, fontStyle: 'italic' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 16, color: '#6b7280' },
});
