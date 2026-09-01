"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import DeviceRegistrationScreen from "./device-registration-screen";

const DEVICE_TOKEN_KEY = "azzure_device_token";
const CONFIG_VERSION_KEY = "azzure_config_version";

type ShowroomDeviceContextType = {
  deviceToken: string | null;
  showroomToken: string;
};

const ShowroomDeviceContext = createContext<ShowroomDeviceContextType>({
  deviceToken: null,
  showroomToken: ""
});

export function useShowroomDevice() {
  return useContext(ShowroomDeviceContext);
}

type ShowroomDeviceProviderProps = {
  children: ReactNode;
  showroomToken: string;
  defaultDeviceName?: string;
  branding?: {
    companyName?: string | null;
    logoUrl?: string | null;
    primaryColor?: string | null;
  };
};

export default function ShowroomDeviceProvider({
  children,
  showroomToken,
  defaultDeviceName,
  branding
}: ShowroomDeviceProviderProps) {
  const [status, setStatus] = useState<"checking" | "registering" | "ready">("checking");
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem(DEVICE_TOKEN_KEY);
        if (stored) {
          setDeviceToken(stored);
          setStatus("ready");
        } else {
          setStatus("registering");
        }
      } catch {
        // If localStorage is blocked/unavailable (private mode, strict webview policy),
        // gracefully proceed as a guest session without device registration.
        setStatus("ready");
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Heartbeat loop: Runs while kiosk is ready with a registered device token
  useEffect(() => {
    if (!deviceToken || !showroomToken || status !== "ready") return;

    const performHeartbeat = async () => {
      try {
        const screenResolution = typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : undefined;
        const res = await fetch("/api/showroom/devices/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceToken,
            showroomToken,
            screenResolution,
            appVersion: "2.4.0",
            currentMode: "quoting"
          })
        });

        if (res.status === 401) {
          // Device deactivated from dashboard — clear token and reload
          try {
            localStorage.removeItem(DEVICE_TOKEN_KEY);
          } catch {}
          window.location.reload();
          return;
        }

        if (res.ok) {
          const data = await res.json();
          let cachedVersion: string | null = null;
          try {
            cachedVersion = sessionStorage.getItem(CONFIG_VERSION_KEY);
          } catch {}

          if (data.configVersion && data.configVersion !== cachedVersion) {
            try {
              sessionStorage.setItem(CONFIG_VERSION_KEY, data.configVersion);
            } catch {}
            router.refresh();
          }
        }
      } catch {
        // Network resilience: offline mode keeps existing cached kiosk working
      }
    };

    const timer = setTimeout(() => {
      void performHeartbeat();
    }, 0);
    const interval = setInterval(performHeartbeat, 60 * 1000); // every 60 seconds
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [deviceToken, showroomToken, status, router]);

  if (status === "checking") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#08090b",
          color: "#94a3b8",
          fontFamily: "system-ui, sans-serif"
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid rgba(255,255,255,0.1)",
              borderTopColor: branding?.primaryColor || "#c9a84c",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px"
            }}
          />
          <p style={{ fontSize: "0.95rem" }}>Initializing showroom screen…</p>
        </div>
      </div>
    );
  }

  if (status === "registering") {
    return (
      <DeviceRegistrationScreen
        showroomToken={showroomToken}
        defaultDeviceName={defaultDeviceName}
        branding={branding}
        onRegistered={(token) => {
          try {
            localStorage.setItem(DEVICE_TOKEN_KEY, token);
          } catch {}
          setDeviceToken(token);
          setStatus("ready");
        }}
      />
    );
  }

  return (
    <ShowroomDeviceContext.Provider value={{ deviceToken, showroomToken }}>
      {children}
    </ShowroomDeviceContext.Provider>
  );
}
