import { Link, type LinkProps } from "react-router-dom";
import { cx } from "../utils/cx";
import "./TextLink.css";

/** Underlined seal link. sm = 13/18 medium (inside cards), md = 15/22 regular (body text). */
export function TextLink({
  size = "sm",
  className,
  ...rest
}: LinkProps & { size?: "sm" | "md" }) {
  return (
    <Link className={cx("ui-link", `ui-link--${size}`, className)} {...rest} />
  );
}
