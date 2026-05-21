import { HB9Logo } from "@/components/brand/HB9Logo";

type BrandLogoProps = {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
};

export function BrandLogo({ className = "", showText = false, size = "md" }: BrandLogoProps) {
  return <HB9Logo className={className} showText={showText} size={size} />;
}
