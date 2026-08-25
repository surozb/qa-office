import { join } from 'node:path';

export function projectSlug(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, '-');
}

export function transcriptPath(claudeHome: string, cwd: string, sessionId: string): string {
  return join(claudeHome, 'projects', projectSlug(cwd), `${sessionId}.jsonl`);
}
