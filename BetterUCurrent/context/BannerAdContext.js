import React, { createContext, useContext, useMemo, useState } from 'react';

const BannerAdContext = createContext({
  suppressed: false,
  setSuppressed: () => {},
});

export function BannerAdProvider({ children }) {
  const [suppressed, setSuppressed] = useState(false);
  const value = useMemo(() => ({ suppressed, setSuppressed }), [suppressed]);
  return <BannerAdContext.Provider value={value}>{children}</BannerAdContext.Provider>;
}

export function useBannerAd() {
  return useContext(BannerAdContext);
}
