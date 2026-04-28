export interface RouteClosure {
  id: string;
  route_id: string;
  closed_by: string;
  approved_by: string | null;
  operation_date: string;
  status: 'pending_documents' | 'pending_ocr' | 'pending_review' | 'pending_approval' | 'approved' | 'rejected';
  notes: string | null;
  closed_at: string | null;
  approved_at: string | null;
  route?: { id: string; route_number: string; description: string };
  closedBy?: { id: string; name: string };
}

export interface ClosureDocument {
  id: string;
  route_closure_id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  ocr_status: 'pending' | 'processing' | 'completed' | 'failed';
  sort_order: number;
}

export interface Order {
  id: string;
  route_id: string;
  client_id: string | null;
  pedido_number: string;
  client_name_ocr: string | null;
  expected_cubetas: number;
  expected_cajas_bolsa: number;
  expected_refrigerado: number;
  expected_controlado: number;
  expected_total: number;
  client?: { id: string; name: string; client_code: string };
}

export interface ManifestItem {
  id: string;
  pedido_number: string;
  nombre_local: string;
  cubetas: number;
  cajas_bolsa: number;
  refrigerado: number;
  controlado: number;
  confidence_score: number;
  is_manually_corrected: boolean;
}

export interface ComparisonSummary {
  total_orders: number;
  complete: number;
  incomplete: number;
  pending: number;
  over: number;
}

export interface OrderComparison {
  order_id: string;
  pedido_number: string;
  client_name: string;
  client_code: string | null;
  expected: { cubetas: number; cajas_bolsa: number; refrigerado: number; controlado: number; total: number };
  scanned: { cubetas: number; cajas_bolsa: number; refrigerado: number; controlado: number; total: number };
  status: 'complete' | 'incomplete' | 'pending' | 'over';
}

export interface MachComparison {
  summary: ComparisonSummary;
  orders: OrderComparison[];
  unmatched_scans: Array<{ id: string; barcode: string; scan_type: string; scanned_at: string }>;
}
