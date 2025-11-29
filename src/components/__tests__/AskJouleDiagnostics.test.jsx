import { describe, it, expect } from 'vitest';
import { parseCommand } from '../../components/askJouleParser.js';

describe('AskJoule diagnostics parseCommand', () => {
  it('recognizes diagnostics query', () => {
    const parsed = parseCommand('What problems did you find with my system?');
    expect(parsed.action).toBe('showDiagnostics');
  });
  it('recognizes short cycling query', () => {
    const parsed = parseCommand('Is there short cycling happening?');
    expect(parsed.action).toBe('checkShortCycling');
  });
  it('recognizes CSV info query', () => {
    const parsed = parseCommand('Show me my thermostat data');
    expect(parsed.action).toBe('showCsvInfo');
  });
  it('recognizes aux heat issue query', () => {
    const parsed = parseCommand('Is my auxiliary heat usage excessive?');
    expect(parsed.action).toBe('checkAuxHeat');
  });
  it('recognizes temperature stability query', () => {
    const parsed = parseCommand('Do I have a temperature swing problem?');
    expect(parsed.action).toBe('checkTempStability');
  });
});
