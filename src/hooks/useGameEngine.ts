import { useCallback, useMemo, useState } from 'react';
import type { EngineState } from '../types/game';
import { initEngine, selectAtPosition, resetEngine, getAllEvents } from '../engine/calculator';

export function useGameEngine() {
  const [engine, setEngine] = useState<EngineState>(() => initEngine());
  const events = useMemo(() => getAllEvents(), []);

  const choose = useCallback((timelinePos: number, decisionId: string) => {
    setEngine((prev) => selectAtPosition(prev, timelinePos, decisionId));
  }, []);

  const reset = useCallback(() => {
    setEngine(resetEngine());
  }, []);

  return { engine, events, choose, reset };
}
