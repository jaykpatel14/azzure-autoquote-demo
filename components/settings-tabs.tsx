import Link from "next/link";

type SettingsTabsProps = {
  activeHref: string;
  showShowroom?: boolean;
};

const TABS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/pricing", label: "Pricing & Margin" },
  { href: "/settings/branding", label: "Company & Branding" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/showroom", label: "Showroom & Devices" }
];

export default function SettingsTabs({ activeHref }: SettingsTabsProps) {
  return (
    <nav className="settingsTabs" aria-label="Settings tabs">
      {TABS.map((tab) => {
        const isActive = activeHref === tab.href || (tab.href === "/settings/showroom" && activeHref.startsWith("/settings/showroom"));
        return (
          <Link key={tab.href} className={`settingsTab${isActive ? " isActive" : ""}`} href={tab.href}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
