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
      <span className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center">
        <span className="absolute inset-2 rounded-[22px] bg-blue-400/[0.15] blur-2xl transition duration-500 group-hover:bg-blue-300/[0.24]" />

        <Image
          src="/trading-docks-mark.png"
          alt=""
          width={152}
          height={152}
          priority={priority}
          sizes="76px"
          className="relative h-[76px] w-[76px] object-contain transition duration-500 group-hover:-translate-y-0.5 group-hover:scale-[1.045]"
        />
      </span>

      <span className="hidden flex-col sm:flex">
        <span className="text-[18px] font-semibold tracking-[-0.03em] text-white">
          Trading Docks
        </span>

        <span className="mt-1 text-[8px] font-medium uppercase tracking-[0.25em] text-blue-200/45">
          Collectibles OS
        </span>
      </span>
    </Link>
  );
}
