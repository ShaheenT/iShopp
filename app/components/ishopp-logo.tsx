import Image from "next/image";

export default function IShoppLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/IMG_2934.png"
      alt="iShopp"
      width={160}
      height={64}
      priority
      className={className}
    />
  );
}
