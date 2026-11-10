import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";
import "./Heading.css";

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  /** page = 32/40 (page and big form titles), card = 20/28 (card titles). */
  size?: "page" | "card";
  level?: "h1" | "h2" | "h3";
};

export function Heading({
  size = "card",
  level = "h2",
  className,
  ...rest
}: HeadingProps) {
  const Tag = level;
  return (
    <Tag
      className={cx("ui-heading", `ui-heading--${size}`, className)}
      {...rest}
    />
  );
}

/** Page title (32/40) with optional subtitle and actions on the right. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  if (!subtitle && !actions) return <Heading size="page">{title}</Heading>;
  return (
    <div className="ui-page-header">
      <div>
        <Heading size="page">{title}</Heading>
        {subtitle ? <p className="ui-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}
