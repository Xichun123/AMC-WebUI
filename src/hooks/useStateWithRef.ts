import { useCallback, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { resolveUpdaterOrValue } from '@/stores/stateUpdaters';

export const useStateWithRef = <T>(initialValue: T): readonly [T, Dispatch<SetStateAction<T>>, MutableRefObject<T>] => {
  const [state, setState] = useState(initialValue);
  const ref = useRef(state);

  const setStateAndRef = useCallback((value: SetStateAction<T>) => {
    const nextValue = resolveUpdaterOrValue(value, ref.current);
    ref.current = nextValue;
    setState(() => nextValue);
  }, []);

  return [state, setStateAndRef, ref] as const;
};
