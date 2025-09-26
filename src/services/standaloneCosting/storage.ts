import { StandaloneCostingDraft, StandaloneCostingState } from './types';

const STORAGE_KEY = "standaloneCosting.v1";
const CURRENT_VERSION = 1;

const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const loadDraft = (): StandaloneCostingState | null => {
  if (!isBrowser) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StandaloneCostingDraft;
    if (!parsed || parsed.version !== CURRENT_VERSION) {
      return null;
    }
    return parsed.state;
  } catch (error) {
    console.error('[StandaloneCosting] Failed to load draft', error);
    return null;
  }
};

export const saveDraft = (state: StandaloneCostingState): void => {
  if (!isBrowser) {
    return;
  }
  try {
    const payload: StandaloneCostingDraft = {
      state,
      version: CURRENT_VERSION,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('[StandaloneCosting] Failed to save draft', error);
  }
};

export const clearDraft = (): void => {
  if (!isBrowser) {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[StandaloneCosting] Failed to clear draft', error);
  }
};
