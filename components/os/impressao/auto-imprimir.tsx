"use client";

import { useEffect, useRef } from "react";

type PropsAutoImprimir = {
  ativar: boolean;
};

export function AutoImprimir({ ativar }: PropsAutoImprimir) {
  const jaImprimiuRef = useRef(false);

  useEffect(() => {
    if (!ativar || jaImprimiuRef.current) {
      return;
    }

    const imprimir = () => {
      if (jaImprimiuRef.current) {
        return;
      }
      jaImprimiuRef.current = true;
      window.print();
    };

    if (document.readyState === "complete") {
      const idFrame = requestAnimationFrame(imprimir);
      return () => cancelAnimationFrame(idFrame);
    }

    window.addEventListener("load", imprimir, { once: true });
    return () => window.removeEventListener("load", imprimir);
  }, [ativar]);

  return null;
}
