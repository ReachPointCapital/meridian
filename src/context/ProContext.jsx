import { createContext, useContext, useState, useEffect } from 'react';

const ProContext = createContext();

const STORAGE_KEY = 'meridian_pro';

export function ProProvider({ children }) {
  const [isPro, setIsPro] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) === true;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(isPro));
  }, [isPro]);

  const togglePro = () => setIsPro((prev) => !prev);

  return (
    <ProContext.Provider value={{ isPro, togglePro }}>
      {children}
    </ProContext.Provider>
  );
}

export function usePro() {
  const context = useContext(ProContext);
  if (!context) {
    throw new Error('usePro must be used within a ProProvider');
  }
  return context;
}
