import { useCallback, useEffect, useState } from "react";
import { subscribe } from "@/services/storage";

/**
 * Subscribe a component to one of the mock service stores.
 * Replace with react-query `useQuery` when the FastAPI backend lands.
 */
export function useStore<T>(key: string, read: () => T): [T, () => void] {
  const [value, setValue] = useState<T>(read);
  const refresh = useCallback(() => setValue(read()), [read]);

  useEffect(() => {
    refresh();
    return subscribe(key, refresh);
  }, [key, refresh]);

  return [value, refresh];
}
