import React from "react";
import Link from "next/link";

type Props = React.PropsWithChildren<{
  href?: string;
  variant?: "solid" | "ghost";
  className?: string;
  onClick?: () => void;
}>;

export default function Button({ href, variant = "solid", className = "", children, onClick }: Props) {
  const cls = variant === "solid" ? "btn" : "btn-ghost";
  const El: any = href ? Link : "button";
  const props = href ? { href } : { type: "button", onClick };
  return <El className={`${cls} ${className}`} {...props}>{children}</El>;
}
