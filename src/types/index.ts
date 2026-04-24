/** Authenticated user from the API */
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'gerente_ops' | 'ti_admin' | 'supervisor' | 'operario';
  force_password_change: boolean;
}

/** Login API response */
export interface LoginResponse {
  token: string;
  user: User;
  centers?: OperationCenter[];
  force_password_change: boolean;
}

/** Operation center */
export interface OperationCenter {
  id: string;
  name: string;
  code: string;
}

/** Delivery route */
export interface Route {
  id: string;
  center_id: string;
  route_number: string;
  description: string | null;
}

/** Client on a route */
export interface Client {
  id: string;
  route_id: string;
  client_code: string;
  name: string;
  address: string | null;
  phone: string | null;
}

/** Scan types based on barcode digit length */
export type ScanType = 'bulto' | 'cubeta' | 'rf' | 'controlado' | 'refrigerado';

/** A scan stored in the local offline queue */
export interface PendingScan {
  localId: string;
  barcode: string;
  scanType: ScanType;
  operationId: string;
  routeId: string;
  clientId: string | null;
  scannedAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  retryCount: number;
  serverScanId?: string;
}

/** Structured data for new client requests */
export interface NewClientRequestData {
  client_code: string;
  name: string;
  address: string;
  district: string;
  city: string;
  notes?: string;
}

/** Structured data for update client requests */
export interface UpdateClientRequestData {
  client_id: string;
  client_code: string;
  name: string;
  address: string;
  district: string;
  city: string;
  notes?: string;
}

/** Client request created by an operario */
export interface ClientRequest {
  id: string;
  request_type: 'new_client' | 'update_client' | 'scan_reset';
  status: 'pending' | 'approved' | 'rejected';
  request_data: Record<string, unknown>;
  admin_comment?: string;
  resolved_by?: string;
  created_at: string;
}

/** Batch sync result for a single scan */
export interface SyncResult {
  localId: string;
  status: 'synced' | 'failed' | 'duplicate';
  error?: string;
}
