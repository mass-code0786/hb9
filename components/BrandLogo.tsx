type BrandLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "h-6 w-6 md:h-7 md:w-7",
  md: "h-7 w-7 md:h-8 md:w-8",
  lg: "h-12 w-12"
};

export function BrandLogo({ className = "", size = "md" }: BrandLogoProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[0.85rem] shadow-[0_0_22px_rgba(49,208,170,0.22)] ${sizes[size]} ${className}`}
      aria-hidden="true"
    >
      <img className="h-full w-full rounded-[inherit]" src="/icons/icon.svg" alt="" />
    </span>
  );
}
