import Image from "next/image";
import Link from "next/link";

type BrandMarkProps = {
  href?: string;
  priority?: boolean;
};

export function BrandMark({
  href = "/",
  priority = false,
}: BrandMarkProps) {
  return (
    <Link
      href={href}
      aria-label="Trading Docks home"
      className="group inline-flex items-center gap-4"
    >
      <span className="relative flex h-[68px] w-[68px] shrink-0 items-center justify-center">
        <span className="absolute inset-2 rounded-[22px] bg-cyan-400/[0.15] blur-2xl transition duration-500 group-hover:bg-cyan-300/[0.24]" />

        <Image
          src="/trading-docks-mark.png"
          alt=""
          width={1024}
          height={1024}
          priority={priority}
          className="relative h-[68px] w-[68px] object-contain transition duration-500 group-hover:-translate-y-0.5 group-hover:scale-[1.045]"
        />
      </span>

      <span className="hidden flex-col sm:flex">
        <span className="text-[17px] font-semibold tracking-[-0.03em] text-white">
          Trading Docks
        </span>

        <span className="mt-1 text-[8px] font-medium uppercase tracking-[0.25em] text-slate-600">
          Collectibles OS
        </span>
      </span>
    </Link>
  );
}

