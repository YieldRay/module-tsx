import { forwardRef } from "react";
import type { CSSProperties, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "path" | "color"> {
  path: string;
  size?: number | string | null;
  color?: string | null;
}

const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ path, size = null, color = "currentColor", style, ...rest }, ref) => {
    const computedStyle: CSSProperties = { ...style };
    if (size !== null) {
      const dimension = typeof size === "string" ? size : `${size * 1.5}rem`;
      computedStyle.width = dimension;
      computedStyle.height = dimension;
    }
    return (
      <svg ref={ref} viewBox="0 0 24 24" style={computedStyle} role="presentation" {...rest}>
        <path d={path} style={{ fill: color ?? "currentColor" }} />
      </svg>
    );
  },
);

Icon.displayName = "Icon";
export default Icon;
