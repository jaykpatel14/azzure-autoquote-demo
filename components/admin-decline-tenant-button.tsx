"use client";

import React from "react";

export function AdminDeclineTenantButton({
  companyName
}: {
  companyName: string;
}) {
  return (
    <button
      className="button secondary"
      type="submit"
      name="accountStatus"
      value="DECLINED"
      formNoValidate
      style={{
        background: "rgba(239, 68, 68, 0.12)",
        borderColor: "rgba(239, 68, 68, 0.4)",
        color: "#f87171"
      }}
      onClick={(e) => {
        const confirmed = window.confirm(
          `Are you sure you want to decline "${companyName}"?\n\nThis will permanently delete this company, its application, and its associated user from the database.`
        );
        if (!confirmed) {
          e.preventDefault();
        }
      }}
    >
      Decline &amp; delete company
    </button>
  );
}
