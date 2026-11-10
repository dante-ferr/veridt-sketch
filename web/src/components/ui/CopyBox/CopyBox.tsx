import { useState, type ReactNode } from "react";
import "./CopyBox.css";

type CopyBoxProps = {
  /** Box title, e.g. "Pix copia e cola" or "Hash do manifesto". */
  title: ReactNode;
  /** Small mono tag next to the title, e.g. "SHA-256". */
  tag?: ReactNode;
  /** Value shown in mono and copied to the clipboard. */
  value: string;
  /** Shown instead of the value when it is empty. */
  emptyText?: ReactNode;
};

/** Seal-tint box with a title, a "Copiar" button and a long mono value (Pix code, manifest hash). */
export function CopyBox({ title, tag, value, emptyText }: CopyBoxProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value).catch(() => undefined);
    setCopied(true);
  }

  return (
    <div className="ui-copy-box">
      <div className="ui-copy-box-head">
        <span className="ui-copy-box-title">
          <strong>{title}</strong>
          {tag ? <span className="ui-copy-box-tag">{tag}</span> : null}
        </span>
        {value ? (
          <button className="ui-copy-box-button" type="button" onClick={() => void copy()}>
            {copied ? "Copiado" : "Copiar"}
          </button>
        ) : null}
      </div>
      <p className="ui-copy-box-value">{value || emptyText}</p>
    </div>
  );
}
