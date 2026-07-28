import Image from "next/image";
import Link from "next/link";

type TradingDocksLogoProps = {
  href?: string;
  compact?: boolean;
  className?: string;
};

export function TradingDocksLogo({
  href = "/",
  compact = false,
  className = "",
}: TradingDocksLogoProps) {
  const logo = compact ? (
    <Image
      src="/brand/trading-docks-mark.png"
      alt="Trading Docks"
      width={700}
      height={700}
      priority
      className={`h-14 w-14 object-contain ${className}`}
    />
  ) : (
    <Image
      src="/brand/trading-docks-horizontal.png"
      alt="Trading Docks"
      width={1800}
      height={600}
      priority
      className={`h-[72px] w-auto max-w-[300px] object-contain object-left ${className}`}
    />
  );

  if (!href) {
    return logo;
  }

  return (
    <Link
      href={href}
      aria-label="Trading Docks home"
      className="inline-flex shrink-0 items-center rounded-xl transition-opacity hover:opacity-90"
    >
      {logo}
    </Link>
  );
}

type TradingDocksMarkProps = {
  className?: string;
};

export function TradingDocksMark({
  className = "h-10 w-10",
}: TradingDocksMarkProps) {
  return (
    <Image
      src="/brand/trading-docks-mark.png"
      alt=""
      width={700}
      height={700}
      className={`object-contain ${className}`}
    />
  );
}