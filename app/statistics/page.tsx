import type { Metadata } from "next"
import StatisticsPageContent from "@/components/statistics-page-content"

export const metadata: Metadata = {
  title: "Statistiky | 531Forever",
  description: "Tvoje powerlifting statistiky - Wilks, DOTS, bodyweight multiples a strength level.",
}

export default function StatisticsPage() {
  return <StatisticsPageContent />
}
