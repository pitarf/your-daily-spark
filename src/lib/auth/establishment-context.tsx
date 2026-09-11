import { createContext, useContext } from "react";

import type { Membership } from "./auth-client";

export type EstablishmentContextValue = {
  membership: Membership;
  memberships: Membership[];
  setActive: (establishmentId: string) => void;
  refresh: () => void;
};

const EstablishmentContext = createContext<EstablishmentContextValue | null>(null);

export const EstablishmentProvider = EstablishmentContext.Provider;

export function useEstablishment(): EstablishmentContextValue {
  const value = useContext(EstablishmentContext);
  if (!value) throw new Error("useEstablishment precisa estar dentro do painel.");
  return value;
}
