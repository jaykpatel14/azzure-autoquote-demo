import type { Metadata } from "next";
import "./showroom.css";

export const metadata: Metadata = { title: "Showroom quote" };

export default function ShowroomLayout({ children }: { children: React.ReactNode }) {
  return <main className="showroomRoot">{children}</main>;
}
