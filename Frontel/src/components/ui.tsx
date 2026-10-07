/** Small dark-technical UI primitives for the editor chrome. */
import { useState, type CSSProperties, type ReactNode } from "react";
import { EditorIcon } from "@/lib/editorIcons.tsx";

export function Field({
  label,
  children,
  hint,
  tip,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  tip?: string;
}) {
  return (
    <label className="block">
      <span
        className="mb-1 flex cursor-help items-center justify-between text-[11px] font-medium uppercase tracking-wider text-ink-400"
        title={tip}
      >
        {label}
        {hint && <span className="font-mono normal-case tracking-normal text-ink-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <input
      className="fe-field w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-1.5 text-[13px] text-ink-200 placeholder:text-ink-500"
      style={mono ? { fontFamily: "var(--font-mono)" } : undefined}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      className="fe-field w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-1.5 text-[13px] text-ink-200"
      value={value ?? ""}
      min={min}
      max={max}
      step={step}
      placeholder="auto"
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      className="w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-1.5 text-[13px] text-ink-200"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        className="flex-1"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-10 text-right font-mono text-[11px] text-ink-400">{value}</span>
    </div>
  );
}

export function ColorInput({
  value,
  onChange,
  allowSemantic,
  semanticOptions,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  allowSemantic?: boolean;
  semanticOptions?: string[];
}) {
  const isCustom = value && !value.startsWith("#");
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        className="h-7 w-8 cursor-pointer rounded border border-ink-600 bg-ink-900 p-0.5"
        value={value?.startsWith("#") ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        className="fe-field min-w-0 flex-1 rounded-md border border-ink-600 bg-ink-900 px-2 py-1.5 font-mono text-[12px] text-ink-200"
        value={value ?? ""}
        placeholder="empty"
        onChange={(e) => onChange(e.target.value || undefined)}
      />
      {allowSemantic && semanticOptions && (
        <select
          className="rounded-md border border-ink-600 bg-ink-900 px-1 py-1.5 text-[11px] text-ink-400"
          value={isCustom ? "" : value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="">theme…</option>
          {semanticOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  title,
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger";
  title?: string;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const classes: Record<string, string> = {
    default: "border-ink-600 bg-ink-800 text-ink-200 hover:bg-ink-700",
    primary: "border-accent-600 bg-accent-600 text-ink-950 hover:bg-accent-500 font-semibold",
    ghost: "border-transparent bg-transparent text-ink-400 hover:text-ink-200 hover:bg-ink-800",
    danger: "border-red-900/60 bg-red-950/40 text-red-300 hover:bg-red-900/40",
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${classes[variant]}`}
    >
      {children}
    </button>
  );
}

export function PanelHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-ink-700/60 px-3">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">{children}</span>
      {right}
    </div>
  );
}

/** Square icon button for toolbars — accessible label required. */
export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  active,
  danger,
  size = 26,
}: {
  icon: string;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  size?: number;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent-500 disabled:cursor-not-allowed disabled:opacity-35 ${
        active
          ? "bg-accent-600/20 text-accent-400"
          : danger
            ? "text-ink-400 hover:bg-red-500/15 hover:text-red-300"
            : "text-ink-400 hover:bg-ink-700 hover:text-ink-100"
      }`}
      style={{ width: size, height: size }}
    >
      <EditorIcon name={icon} size={size <= 24 ? 13 : 14} />
    </button>
  );
}

/** Compact segmented control for small option sets. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label?: string; icon?: string; tip?: string }[];
  size?: "sm" | "md";
}) {
  return (
    <div className="flex rounded-md border border-ink-600 bg-ink-900 p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.tip ?? o.label}
          onClick={() => onChange(o.value)}
          className={`flex flex-1 items-center justify-center gap-1 rounded transition-colors ${
            size === "sm" ? "px-1.5 py-0.5 text-[10.5px]" : "px-2 py-1 text-[11px]"
          } font-medium ${
            value === o.value ? "bg-accent-600/20 text-accent-400" : "text-ink-400 hover:text-ink-200"
          }`}
        >
          {o.icon && <EditorIcon name={o.icon} size={size === "sm" ? 11 : 12} />}
          {o.label && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

/** Collapsible inspector group with an accent left-edge when it has content. */
export function PanelSection({
  title,
  icon,
  children,
  right,
  defaultOpen = true,
  badge,
}: {
  title: string;
  icon?: string;
  children: ReactNode;
  right?: ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-ink-700/50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left transition-colors hover:bg-ink-800/50"
      >
        <EditorIcon
          name="chevronRight"
          size={11}
          className={`shrink-0 text-ink-500 transition-transform ${open ? "rotate-90" : ""}`}
        />
        {icon && <EditorIcon name={icon} size={12} className="shrink-0 text-ink-500" />}
        <span className="flex-1 text-[10.5px] font-semibold uppercase tracking-widest text-ink-400">{title}</span>
        {badge && (
          <span className="rounded bg-accent-600/15 px-1.5 py-px font-mono text-[9.5px] text-accent-400">{badge}</span>
        )}
        {right}
      </button>
      {open && <div className="flex flex-col gap-2 px-3 pb-2.5">{children}</div>}
    </div>
  );
}

/** Small inline hint text under a control. */
export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[10.5px] leading-snug text-ink-500">{children}</p>;
}
