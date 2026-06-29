import { useState, useCallback, useEffect } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        // Sync from localStorage after hydration — server and first client render use initialValue.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-hydration sync
        setStoredValue(JSON.parse(item) as T);
      }
    } catch (error) {
      console.error("LocalStorage reading error:", error);
    }
    setIsReady(true);
  }, [key]);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        setStoredValue((current) => {
          const valueToStore =
            value instanceof Function ? value(current) : value;
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
          return valueToStore;
        });
      } catch (error) {
        console.error("LocalStorage writing error:", error);
      }
    },
    [key],
  );

  return [storedValue, setValue, isReady] as const;
}
