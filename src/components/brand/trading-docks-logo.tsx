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
      width={128}
      height={128}
      priority
      sizes="64px"
      className={`h-16 w-16 object-contain drop-shadow-[0_0_16px_rgba(59,130,246,0.16)] ${className}`}
    />
  ) : (
    <Image
      src="/brand/trading-docks-horizontal.png"
      alt="Trading Docks"
      width={740}
      height={247}
      priority
      sizes="370px"
      className={`h-[82px] w-auto max-w-[370px] object-contain object-left drop-shadow-[0_0_18px_rgba(59,130,246,0.1)] ${className}`}
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
      width={96}
      height={96}
      sizes="48px"
      className={`object-contain ${className}`}
    />
  );
}
