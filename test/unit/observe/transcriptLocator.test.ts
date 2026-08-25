import { describe, it, expect } from 'vitest';
import { projectSlug, transcriptPath } from '../../../src/main/observe/transcriptLocator';

describe('projectSlug', () => {
  it.each([
    ['C:\\MaitriAutomation\\CaptureManage', 'C--MaitriAutomation-CaptureManage'],
    ['c:\\careerGrowth', 'c--careerGrowth'],
    ['C:\\MaitriAutomation\\capture-qa-automation\\Evaire', 'C--MaitriAutomation-capture-qa-automation-Evaire'],
    ['C:\\Users\\Suraj.Maharjan', 'C--Users-Suraj-Maharjan'],
  ])('%s → %s', (cwd, slug) => { expect(projectSlug(cwd)).toBe(slug); });
});

describe('transcriptPath', () => {
  it('joins home, projects, slug and sessionId', () => {
    expect(transcriptPath('C:\\Users\\me\\.claude', 'C:\\x\\y', 'abc'))
      .toBe('C:\\Users\\me\\.claude\\projects\\C--x-y\\abc.jsonl');
  });
});
