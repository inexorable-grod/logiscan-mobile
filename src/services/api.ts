import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { LoginResponse, Route, Client, ClientRequest, SyncResult } from '../types';

const BASE_URL = 'https://logiscan-web-master-uoqyln.free.laravel.cloud/api';

const TOKEN_KEY = 'auth_token';

/** Create an Axios instance with auth interceptor */
function createClient(): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return client;
}

const api = createClient();

/** Store the auth token securely */
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

/** Remove the auth token */
export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** Get the stored auth token */
export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

/** Authenticate and get a Sanctum token */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/login', { email, password });
  await setToken(data.token);
  return data;
}

/** Revoke the current token */
export async function logout(): Promise<void> {
  await api.post('/logout');
  await clearToken();
}

/** Change the authenticated user's password */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/password/change', {
    current_password: currentPassword,
    new_password: newPassword,
    new_password_confirmation: newPassword,
  });
}

/** Get routes for the operario's assigned center */
export async function getRoutes(): Promise<Route[]> {
  const { data } = await api.get<Route[]>('/routes');
  return data;
}

/** Get clients for a specific route */
export async function getClients(routeId: string): Promise<Client[]> {
  const { data } = await api.get<Client[]>('/clients', { params: { route_id: routeId } });
  return data;
}

/** Validate a single barcode scan */
export async function postScan(barcode: string): Promise<{ valid: boolean; type: string | null; error: string | null }> {
  const { data } = await api.post('/scans', { barcode });
  return data;
}

/** Sync a batch of offline scans */
export async function postScanBatch(scans: Array<{
  localId: string;
  barcode: string;
  scanType: string;
  scannedAt: string;
  routeId?: string;
  clientId?: string | null;
}>): Promise<{ results: SyncResult[] }> {
  const { data } = await api.post('/scans/batch', { scans });
  return data;
}

/** Get scan history for the current operator */
export async function getScanHistory(routeId?: string, page: number = 1): Promise<{
  data: Array<{
    id: string;
    barcode: string;
    scan_type: string;
    scanned_at: string;
    client: { id: string; client_code: string; name: string } | null;
  }>;
  current_page: number;
  last_page: number;
}> {
  const params: Record<string, string | number> = { page };
  if (routeId) params.route_id = routeId;
  const { data } = await api.get('/scans/history', { params });
  return data;
}

/** Get scans grouped by order (parsed from barcode) */
export async function getScansByOrder(routeId: string, date?: string): Promise<{
  orders: Array<{
    pedido_number: string;
    scanned_count: number;
    expected_count: number;
    packages: string[];
    missing: string[];
    scan_types: string[];
    is_complete: boolean;
  }>;
  total_orders: number;
  total_scanned: number;
  complete_orders: number;
  missing_orders: number;
  unmatched_scans: number;
}> {
  const params: Record<string, string> = { route_id: routeId };
  if (date) params.date = date;
  const { data } = await api.get('/scans/by-order', { params });
  return data;
}

/** Create a new client request */
export async function postRequest(
  requestType: string,
  requestData: Record<string, unknown>,
  routeId?: string,
): Promise<ClientRequest> {
  const { data } = await api.post<ClientRequest>('/requests', {
    request_type: requestType,
    request_data: requestData,
    route_id: routeId,
  });
  return data;
}

/** Get the operario's own requests */
export async function getMyRequests(): Promise<{ data: ClientRequest[] }> {
  const { data } = await api.get('/requests/mine');
  return data;
}

/** Register an Expo push token */
export async function registerDeviceToken(token: string, platform: 'android' | 'ios'): Promise<void> {
  await api.post('/device-tokens', { token, platform });
}

export default api;
