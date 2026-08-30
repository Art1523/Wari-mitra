import {
  BatteryCharging,
  Droplets,
  Pill,
  Shield,
  Stethoscope,
  Tent,
  Toilet,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { FacilityCategory } from "@/data/mockData";

export const CATEGORY_ICON: Record<FacilityCategory, LucideIcon> = {
  Medical: Stethoscope,
  Toilet: Toilet,
  Water: Droplets,
  Food: Utensils,
  Pharmacy: Pill,
  Rest: Tent,
  Police: Shield,
  Charging: BatteryCharging,
};

export function CategoryIcon({
  category,
  className,
}: {
  category: FacilityCategory;
  className?: string;
}) {
  const Icon = CATEGORY_ICON[category];
  return <Icon className={className} />;
}
