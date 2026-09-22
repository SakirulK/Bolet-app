import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/ProfileView";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return <ProfileView initialSection="settings" />;
}
