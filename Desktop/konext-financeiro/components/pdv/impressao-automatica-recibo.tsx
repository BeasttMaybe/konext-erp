"use client";

import { useEffect } from "react";

export function ImpressaoAutomaticaRecibo() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.print();
    }, 120);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
