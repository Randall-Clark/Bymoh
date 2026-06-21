import React, { createContext, useContext, useState } from "react";

interface ActiveBusinessContextValue {
  selectedBusinessId: string;
  setSelectedBusinessId: (id: string) => void;
}

const ActiveBusinessContext = createContext<ActiveBusinessContextValue | null>(null);

export function ActiveBusinessProvider({ children }: { children: React.ReactNode }) {
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");

  return (
    <ActiveBusinessContext.Provider value={{ selectedBusinessId, setSelectedBusinessId }}>
      {children}
    </ActiveBusinessContext.Provider>
  );
}

export function useActiveBusiness() {
  const ctx = useContext(ActiveBusinessContext);
  if (!ctx) throw new Error("useActiveBusiness must be used within ActiveBusinessProvider");
  return ctx;
}
