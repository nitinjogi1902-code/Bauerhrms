import React, {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

import {
  buildAIContext,
  sanitizeAIContext,
} from "./aiService";

import { canAIRead } from "./aiPermissions";

const HrsyncAIContext = createContext(null);

export function HrsyncAIProvider({
  children,
  user = null,
  employees = [],
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [module, setModule] = useState("Dashboard");

  const context = useMemo(() => {
    return sanitizeAIContext(
      buildAIContext({
        user,
        module,
        employees,
      })
    );
  }, [user, module, employees]);

  const value = useMemo(() => {
    return {
      isOpen,

      setIsOpen,

      openAI: () => setIsOpen(true),

      closeAI: () => setIsOpen(false),

      module,

      setModule,

      context,

      canRead: (targetModule) =>
        canAIRead(
          user?.role || "employee",
          targetModule
        ),
    };
  }, [
    isOpen,
    module,
    context,
    user?.role,
  ]);

  return (
    <HrsyncAIContext.Provider value={value}>
      {children}
    </HrsyncAIContext.Provider>
  );
}

export function useHrsyncAI() {
  const value = useContext(HrsyncAIContext);

  if (!value) {
    throw new Error(
      "useHrsyncAI must be used inside HrsyncAIProvider"
    );
  }

  return value;
}