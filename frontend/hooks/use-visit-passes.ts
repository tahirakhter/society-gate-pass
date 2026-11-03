"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authApi, HouseRecord } from "@/lib/api";
import {
  mapVisitTokenToVisitorPass,
  VisitorPass,
  VisitorPassInput,
} from "@/lib/visit-pass-mapper";

export function useVisitPasses() {
  const [passes, setPasses] = useState<VisitorPass[]>([]);
  const [houses, setHouses] = useState<HouseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshPasses = useCallback(async () => {
    const tokens = await authApi.getMyVisitTokens();
    setPasses(tokens.map(mapVisitTokenToVisitorPass));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [ownedHouses, tokens] = await Promise.all([
        authApi.getMyHouses(),
        authApi.getMyVisitTokens(),
      ]);
      setHouses(ownedHouses);
      setPasses(tokens.map(mapVisitTokenToVisitorPass));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load visitor passes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addManualPass(input: VisitorPassInput) {
    setError("");

    const token = await authApi.createVisitToken({
      cnic: input.cnic,
      fullName: input.name,
      carNumber: input.carNumber,
      houseId: input.houseId,
    });
    const nextPass = mapVisitTokenToVisitorPass(token);
    setPasses((current) => [nextPass, ...current]);
    return nextPass;
  }

  async function deactivatePass(id: string) {
    setError("");

    const token = await authApi.deactivateVisitToken(id);
    const updatedPass = mapVisitTokenToVisitorPass(token);
    setPasses((current) =>
      current.map((pass) => (pass.id === updatedPass.id ? updatedPass : pass)),
    );
    await refreshPasses();
    return updatedPass;
  }

  const defaultHouseId = useMemo(() => houses[0]?.id || "", [houses]);

  return {
    passes,
    houses,
    loading,
    error,
    defaultHouseId,
    refresh,
    refreshPasses,
    addManualPass,
    deactivatePass,
    setError,
  };
}
