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
  { href: "/settings/billing", label: "Billing" }
];

export default function SettingsTabs({ activeHref, showShowroom = false }: SettingsTabsProps) {
  const tabs = showShowroom ? [...TABS, { href: "/settings/showroom", label: "Showroom" }] : TABS;
  return (
    <nav className="settingsTabs" aria-label="Settings tabs">
      {tabs.map((tab) => (
        <Link key={tab.href} className={`settingsTab${activeHref === tab.href ? " isActive" : ""}`} href={tab.href}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
