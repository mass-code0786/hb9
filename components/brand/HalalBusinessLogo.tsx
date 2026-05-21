import { HB9Logo } from "@/components/brand/HB9Logo";

type HalalBusinessLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg" | number;
};

export function HalalBusinessLogo(props: HalalBusinessLogoProps) {
  return <HB9Logo {...props} />;
}
