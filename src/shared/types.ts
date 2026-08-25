export type SessionStatus = 'busy' | 'idle';
export interface SessionRecord {
  pid: number; sessionId: string; cwd: string; name: string;
  status: SessionStatus; kind: string; procStart: string;
  startedAt: number; updatedAt: number;
}
export type Emote = 'search' | 'read' | 'edit' | 'shell' | 'browser' | 'skill' | 'delegate' | 'think' | 'other';
export type ActivityEvent =
  | { kind: 'tool'; sessionId: string; at: string; tool: string; emote: Emote; summary: string }
  | { kind: 'text'; sessionId: string; at: string; role: 'user' | 'assistant'; text: string }
  | { kind: 'usage'; sessionId: string; at: string; input: number; output: number; cacheRead: number }
  | { kind: 'title'; sessionId: string; title: string }
  | { kind: 'branch'; sessionId: string; branch: string }
  | { kind: 'skill'; sessionId: string; at: string; skill: string };
export interface Station { id: string; name: string; cwds: string[]; skills: string[]; grid: { col: number; row: number } }
export interface OfficeConfig { stations: Station[]; defaultStationByCwd: Record<string, string>; lobbyId: string }
export type OccupantOrigin = 'walkin' | 'staff';
export interface Occupant {
  sessionId: string; name: string; pid: number; cwd: string; stationId: string;
  status: SessionStatus | 'gone'; origin: OccupantOrigin; title?: string; branch?: string;
  currentTool?: string; emote?: Emote; tokens: { input: number; output: number; cacheRead: number };
  lastSkill?: string; lastSeen: string;
}
export interface OfficeState { stations: Station[]; lobbyId: string; occupants: Occupant[]; log: LogLine[]; generatedAt: string }
export interface LogLine { at: string; sessionId: string; name: string; text: string }
export const IPC = { state: 'office:state', assignFolder: 'office:assignFolder', requestState: 'office:requestState' } as const;
