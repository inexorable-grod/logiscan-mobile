import api from './api';
import { RouteClosure, MachComparison, Order } from '../types/closure';

/** Create a new route closure */
export async function createClosure(routeId: string, operationDate: string, notes?: string): Promise<RouteClosure> {
  const { data } = await api.post<RouteClosure>('/route-closures', { route_id: routeId, operation_date: operationDate, notes });
  return data;
}

/** Get route closures, optionally filtered by route */
export async function getClosures(routeId?: string): Promise<RouteClosure[]> {
  const params: Record<string, string> = {};
  if (routeId) params.route_id = routeId;
  const { data } = await api.get('/route-closures', { params });
  return data.data; // paginated
}

/** Get a single route closure by ID */
export async function getClosure(id: string): Promise<RouteClosure> {
  const { data } = await api.get<RouteClosure>(`/route-closures/${id}`);
  return data;
}

/** Upload a document image to a route closure */
export async function uploadDocument(closureId: string, fileUri: string, fileName: string): Promise<any> {
  const formData = new FormData();
  formData.append('file', { uri: fileUri, name: fileName, type: 'image/jpeg' } as any);
  const { data } = await api.post(`/route-closures/${closureId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** Get the comparison between expected orders and scanned manifests */
export async function getComparison(closureId: string): Promise<MachComparison> {
  const { data } = await api.get<MachComparison>(`/route-closures/${closureId}/comparison`);
  return data;
}

/** Get orders for a specific route, optionally filtered by date */
export async function getRouteOrders(routeId: string, date?: string): Promise<Order[]> {
  const params: Record<string, string> = {};
  if (date) params.date = date;
  const { data } = await api.get<Order[]>(`/routes/${routeId}/orders`, { params });
  return data;
}
