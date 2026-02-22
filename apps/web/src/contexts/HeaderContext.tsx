import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface HeaderContextValue {
  title: string | undefined;
  setTitle: (title: string | undefined) => void;
  actions: ReactNode;
  setActions: (actions: ReactNode) => void;
}

const HeaderContext = createContext<HeaderContextValue | null>(null);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitleState] = useState<string | undefined>(undefined);
  const [actions, setActionsState] = useState<ReactNode>(null);

  const setTitle = useCallback((t: string | undefined) => setTitleState(t), []);
  const setActions = useCallback((a: ReactNode) => setActionsState(a), []);

  return (
    <HeaderContext.Provider value={{ title, setTitle, actions, setActions }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  const ctx = useContext(HeaderContext);
  if (!ctx) throw new Error("useHeader must be used within HeaderProvider");
  return ctx;
}

export function useHeaderOptional() {
  return useContext(HeaderContext);
}
