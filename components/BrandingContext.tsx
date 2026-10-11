"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface BrandingInfo {
  companyName: string;
  logoUrl: string;
  currency: string;
}

interface BrandingContextType {
  branding: BrandingInfo;
  updateBranding: (newBranding: Partial<BrandingInfo>) => void;
  refreshBranding: () => Promise<void>;
}

const defaultBranding: BrandingInfo = {
  companyName: "Apex Logistics",
  logoUrl: "",
  currency: "INR",
};

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  updateBranding: () => {},
  refreshBranding: async () => {},
});

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingInfo>(defaultBranding);

  const fetchBranding = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data?.settings) {
          const name = data.settings.companyName || data.settings.name || "Apex Logistics";
          const logo = data.settings.companyLogoUrl || "";
          const curr = data.settings.currency || "INR";
          setBranding({
            companyName: name,
            logoUrl: logo,
            currency: curr,
          });
          if (typeof document !== "undefined" && name) {
            document.title = `${name} | AI Inventory & Order Management Platform`;
          }
        }
      }
    } catch (err) {
      console.error("Failed to load branding:", err);
    }
  }, []);

  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  const updateBranding = useCallback((newBranding: Partial<BrandingInfo>) => {
    setBranding((prev) => {
      const updated = { ...prev, ...newBranding };
      if (typeof document !== "undefined" && updated.companyName) {
        document.title = `${updated.companyName} | AI Inventory & Order Management Platform`;
      }
      return updated;
    });
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, updateBranding, refreshBranding: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
