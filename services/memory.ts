
import { MissionState } from '../types';

const STORAGE_KEY = 'autolearn_mission_state';

export const MemoryService = {
  saveMission: (state: MissionState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save mission memory', e);
    }
  },

  loadMission: (): MissionState | null => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      // Re-hydrate dates
      parsed.logs = parsed.logs.map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }));
      parsed.artifacts = parsed.artifacts.map((a: any) => ({ ...a, timestamp: new Date(a.timestamp) }));
      return parsed as MissionState;
    } catch {
      return null;
    }
  },

  clearMission: () => {
    localStorage.removeItem(STORAGE_KEY);
  }
};
