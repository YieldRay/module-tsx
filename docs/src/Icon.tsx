import { forwardRef, useId } from "react";
import type { CSSProperties, SVGProps } from "react";

// export { default as Stack } from "./Stack";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "path" | "color" | "rotate"> {
  path: string;
  size?: number | string | null;
  color?: string | null;
  horizontal?: boolean;
  vertical?: boolean;
  rotate?: number;
  spin?: boolean | number;
  inStack?: boolean;
  title?: string | null;
  description?: string | null;
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(
  (
    {
      path,
      id,
      title = null,
      description = null,
      size = null,
      color = "currentColor",
      horizontal = false,
      vertical = false,
      rotate = 0,
      spin = false,
      style,
      inStack = false,
      ...rest
    },
    ref,
  ) => {
    const reactId = useId();
    const iconId = id ?? reactId;

    const computedStyle: CSSProperties = { ...style };
    const pathStyle: CSSProperties = {};
    const transforms: string[] = [];

    if (size !== null) {
      if (inStack) {
        transforms.push(`scale(${size})`);
      } else {
        const dimension = typeof size === "string" ? size : `${size * 1.5}rem`;
        computedStyle.width = dimension;
        computedStyle.height = dimension;
      }
    }

    if (horizontal) transforms.push("scaleX(-1)");
    if (vertical) transforms.push("scaleY(-1)");
    if (rotate !== 0) transforms.push(`rotate(${rotate}deg)`);

    if (color !== null) {
      pathStyle.fill = color;
    }

    // Cast `rest` to SVGProps<SVGPathElement> to satisfy strict event handler target checks
    let transformElement = <path d={path} style={pathStyle} {...(inStack ? (rest as SVGProps<SVGPathElement>) : {})} />;

    if (transforms.length > 0) {
      computedStyle.transform = transforms.join(" ");
      computedStyle.transformOrigin = "center";
      if (inStack) {
        transformElement = (
          <g style={computedStyle}>
            {transformElement}
            <rect width="24" height="24" fill="transparent" />
          </g>
        );
      }
    }

    let spinElement = transformElement;
    const spinSec = spin === true || typeof spin !== "number" ? 2 : spin;
    let inverse = !inStack && (horizontal || vertical);

    if (spinSec < 0) {
      inverse = !inverse;
    }

    if (spin) {
      spinElement = (
        <g
          style={{
            animation: `spin${inverse ? "-inverse" : ""} linear ${Math.abs(spinSec)}s infinite`,
            transformOrigin: "center",
          }}
        >
          {transformElement}
          {!(horizontal || vertical || rotate !== 0) && <rect width="24" height="24" fill="transparent" />}
        </g>
      );
    }

    if (inStack) {
      return spinElement;
    }

    const labelledById = `icon_labelledby_${iconId}`;
    const describedById = `icon_describedby_${iconId}`;
    let ariaLabelledby;
    let role;

    if (title) {
      ariaLabelledby = description ? `${labelledById} ${describedById}` : labelledById;
    } else {
      role = "presentation";
      if (description) {
        throw new Error("title attribute required when description is set");
      }
    }

    return (
      <svg ref={ref} viewBox="0 0 24 24" style={computedStyle} role={role} aria-labelledby={ariaLabelledby} {...rest}>
        {title && <title id={labelledById}>{title}</title>}
        {description && <desc id={describedById}>{description}</desc>}

        {!inStack && spin && (
          <style>
            {inverse
              ? "@keyframes spin-inverse { from { transform: rotate(0deg) } to { transform: rotate(-360deg) } }"
              : "@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }"}
          </style>
        )}

        {spinElement}
      </svg>
    );
  },
);

Icon.displayName = "Icon";

export default Icon;
