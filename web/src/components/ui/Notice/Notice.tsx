import type { HTMLAttributes } from "react";
import { cx } from "../utils/cx";
import "./Notice.css";

type NoticeProps = HTMLAttributes<HTMLParagraphElement> & {
  /** sm = padding 12, 13/18 medium (recording panel); md = padding 16, 15/22 regular (capture progress). */
  size?: "sm" | "md";
};

/** Seal-tint notice box with ink text. */
export function Notice({ size = "sm", className, ...rest }: NoticeProps) {
  return <p className={cx("ui-notice", `ui-notice--${size}`, className)} {...rest} />;
}
