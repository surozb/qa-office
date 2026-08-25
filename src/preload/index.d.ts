import type { OfficeState } from '../shared/types';
export interface OfficeApi {
  onState(cb: (s: OfficeState) => void): () => void;
  requestState(): void;
  assignFolder(cwd: string, stationId: string): void;
}
declare global { interface Window { office: OfficeApi } }
