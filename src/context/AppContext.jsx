import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [activeSymbol, setActiveSymbol] = useState(null);
  const [quote, setQuote] = useState(null);
  const [profile, setProfile] = useState(null);

  return (
    <AppContext.Provider value={{ activeSymbol, setActiveSymbol, quote, setQuote, profile, setProfile }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
