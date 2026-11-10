import type { HTMLAttributes } from "react";
import { cx } from "../utils/cx";
import "./Callout.css";

/** White box with a fail border (padding 16/24, gap 8, radius 4) for failures and outages. */
export function Callout({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ui-callout", className)} {...rest} />;
}
