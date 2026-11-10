import type { HTMLAttributes } from "react";
import { cx } from "../utils/cx";
import "./ActionRow.css";

/** Row with content on the left and an action on the right; `divided` adds the line above (16px). */
export function ActionRow({
  divided,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { divided?: boolean }) {
  return (
    <div
      className={cx(
        "ui-action-row",
        divided && "ui-action-row--divided",
        className,
      )}
      {...rest}
    />
  );
}
