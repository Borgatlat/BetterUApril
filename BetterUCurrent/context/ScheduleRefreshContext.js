import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ScheduleRefreshContext = createContext({
  refreshKey: 0,
  notifyScheduleUpdated: () => {},
});

export function ScheduleRefreshProvider({ children }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const notifyScheduleUpdated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const value = useMemo(
    () => ({ refreshKey, notifyScheduleUpdated }),
    [refreshKey, notifyScheduleUpdated]
  );

  return (
    <ScheduleRefreshContext.Provider value={value}>{children}</ScheduleRefreshContext.Provider>
  );
}

export function useScheduleRefresh() {
  return useContext(ScheduleRefreshContext);
}
