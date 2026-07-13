import { describe, it, expect, beforeEach } from 'vitest';
import {
  shouldShowGuestRiskNudge,
  markGuestRiskNudgeShown,
  COMPLETED_THRESHOLD
} from '../../src/ui/utils/guestDataRisk.js';

const UID = 'guest-123';

beforeEach(() => {
  localStorage.clear();
});

describe('shouldShowGuestRiskNudge', () => {
  it('never shows for a non-anonymous (real) account', () => {
    expect(shouldShowGuestRiskNudge(UID, false, COMPLETED_THRESHOLD + 1)).toBe(false);
  });

  it('never shows with no uid', () => {
    expect(shouldShowGuestRiskNudge(null, true, COMPLETED_THRESHOLD + 1)).toBe(false);
  });

  it('does not show before the completed-item threshold is reached', () => {
    expect(shouldShowGuestRiskNudge(UID, true, COMPLETED_THRESHOLD - 1)).toBe(false);
  });

  it('shows once the threshold is reached for an anonymous account', () => {
    expect(shouldShowGuestRiskNudge(UID, true, COMPLETED_THRESHOLD)).toBe(true);
  });

  it('never shows again once marked shown', () => {
    expect(shouldShowGuestRiskNudge(UID, true, COMPLETED_THRESHOLD)).toBe(true);
    markGuestRiskNudgeShown(UID);
    expect(shouldShowGuestRiskNudge(UID, true, COMPLETED_THRESHOLD + 10)).toBe(false);
  });

  it('keeps two different accounts on this device independent', () => {
    markGuestRiskNudgeShown('guest-a');
    expect(shouldShowGuestRiskNudge('guest-a', true, COMPLETED_THRESHOLD)).toBe(false);
    expect(shouldShowGuestRiskNudge('guest-b', true, COMPLETED_THRESHOLD)).toBe(true);
  });
});
