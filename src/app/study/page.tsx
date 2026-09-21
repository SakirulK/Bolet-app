import type { Metadata } from "next";
import { StudyPicker } from "@/components/study/StudyPicker";

export const metadata: Metadata = {
  title: "Study",
};

export default function StudyPage() {
  return <StudyPicker />;
}
