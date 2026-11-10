import type { HTMLAttributes } from "react";
import { cx } from "../utils/cx";
import "./Card.css";

type CardTag = "div" | "section" | "aside" | "form" | "article";

/** White card from the Figma: padding 24, gap 16, line border, radius 4. */
export function Card({
  as: Tag = "section",
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: CardTag }) {
  return <Tag className={cx("ui-card", className)} {...rest} />;
}
