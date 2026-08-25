"use client";

import { useState, useEffect } from "react";

type KioskStaffPinModalProps = {
  showroomToken: string;
  brandColor?: string;
  onClose: () => void;
  onAuthenticated: (data: { staffName: string; staffId: string; sessionToken: string }) => void;
};

export default function KioskStaffPinModal({
  showroomToken,
  brandColor = "#c9a84c",
  onClose,
  onAuthenticated
}: KioskStaffPinModalProps) {
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Lock countdown timer
  useEffect(() => {
    if (!lockedUntil) return;

    const updateTimer = () => {
      const diff = Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));
      setRemainingSeconds(diff);
      if (diff === 0) {
        setLockedUntil(null);
        setError(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const handleDigitClick = (digit: string) => {
    if (verifying || lockedUntil || pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setError(null);

    if (nextPin.length === 4) {
      submitPin(nextPin);
    }
  };

  const handleBackspace = () => {
    if (verifying || lockedUntil) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const submitPin = async (pinToSubmit: string) => {
    setVerifying(true);
    setError(null);

    try {
      const res = await fetch("/api/showroom/staff/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showroomToken, pin: pinToSubmit })
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        onAuthenticated({
          staffName: data.staffName,
          staffId: data.staffId,
          sessionToken: data.sessionToken
        });
        return;
      }

      // Handle locked response
      if (data.locked && data.unlocksAt) {
        setLockedUntil(new Date(data.unlocksAt));
        setError("Account locked for 5 minutes due to multiple failed attempts.");
        setPin("");
        triggerShake();
        return;
      }

      // Incorrect PIN
      triggerShake();
      setPin("");
      const attemptsRemaining = data.attemptsRemaining ?? 0;
      if (attemptsRemaining > 0) {
        setError(`Incorrect PIN. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining.`);
      } else {
        setError("Incorrect PIN. Please try again.");
      }
    } catch {
      triggerShake();
      setPin("");
      setError("Unable to verify PIN. Please check your connection.");
    } finally {
      setVerifying(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(8, 9, 11, 0.95)",
        backdropFilter: "blur(20px)",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "system-ui, -apple-system, sans-serif",
        userSelect: "none"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 28,
          padding: "36px 32px",
          textAlign: "center",
          position: "relative",
          boxShadow: "0 30px 70px rgba(0, 0, 0, 0.8)"
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.08)",
            border: "none",
            color: "#94a3b8",
            fontSize: 24,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          aria-label="Close"
        >
          ×
        </button>

        <span
          style={{
            fontSize: "0.8125rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: brandColor
          }}
        >
          Staff Mode
        </span>
        <h2 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "8px 0 6px", color: "#ffffff" }}>
          Enter Staff PIN
        </h2>
        <p style={{ color: "#94a3b8", fontSize: "0.95rem", margin: "0 0 28px" }}>
          Enter your 4-digit code to access sales lookup
        </p>

        {/* PIN Dot Indicators */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 18,
            marginBottom: 32,
            transform: shake ? "translateX(0)" : "none",
            animation: shake ? "pinShake 0.4s ease-in-out" : "none"
          }}
        >
          <style>{`
            @keyframes pinShake {
              0%, 100% { transform: translateX(0); }
              20%, 60% { transform: translateX(-10px); }
              40%, 80% { transform: translateX(10px); }
            }
          `}</style>
          {[0, 1, 2, 3].map((index) => {
            const filled = pin.length > index;
            return (
              <div
                key={index}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: filled ? brandColor : "rgba(255, 255, 255, 0.15)",
                  boxShadow: filled ? `0 0 14px ${brandColor}` : "none",
                  transition: "all 0.15s ease"
                }}
              />
            );
          })}
        </div>

        {/* Error / Lock Message */}
        {error ? (
          <div
            style={{
              marginBottom: 20,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              fontSize: "0.875rem"
            }}
          >
            {error}
            {remainingSeconds > 0 ? (
              <div style={{ marginTop: 4, fontWeight: 700 }}>
                Re-enables in {Math.floor(remainingSeconds / 60)}:
                {String(remainingSeconds % 60).padStart(2, "0")}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Large Custom Touch Numpad */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
            maxWidth: 320,
            margin: "0 auto"
          }}
        >
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={verifying || Boolean(lockedUntil)}
              onClick={() => handleDigitClick(digit)}
              style={{
                minHeight: 76,
                borderRadius: 18,
                background: "rgba(255, 255, 255, 0.07)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                fontSize: "1.75rem",
                fontWeight: 600,
                cursor: lockedUntil ? "not-allowed" : "pointer",
                transition: "background 0.1s ease, transform 0.1s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.94)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onTouchStart={(e) => (e.currentTarget.style.transform = "scale(0.94)")}
              onTouchEnd={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              {digit}
            </button>
          ))}

          {/* Empty spacer */}
          <div />

          {/* 0 Button */}
          <button
            type="button"
            disabled={verifying || Boolean(lockedUntil)}
            onClick={() => handleDigitClick("0")}
            style={{
              minHeight: 76,
              borderRadius: 18,
              background: "rgba(255, 255, 255, 0.07)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              fontSize: "1.75rem",
              fontWeight: 600,
              cursor: lockedUntil ? "not-allowed" : "pointer",
              transition: "background 0.1s ease, transform 0.1s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.94)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            onTouchStart={(e) => (e.currentTarget.style.transform = "scale(0.94)")}
            onTouchEnd={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            disabled={verifying || Boolean(lockedUntil) || pin.length === 0}
            onClick={handleBackspace}
            style={{
              minHeight: 76,
              borderRadius: 18,
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: pin.length > 0 ? "#cbd5e1" : "#475569",
              fontSize: "1.5rem",
              fontWeight: 600,
              cursor: pin.length === 0 || lockedUntil ? "not-allowed" : "pointer",
              transition: "background 0.1s ease, transform 0.1s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            aria-label="Backspace"
          >
            ←
          </button>
        </div>
      </div>
    </div>
  );
}
