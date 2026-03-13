import React, { forwardRef, useId } from "react";
import type { CSSProperties, ReactElement, SVGProps } from "react";
import type { IconProps } from "./Icon.tsx";

export interface StackProps extends Omit<SVGProps<SVGSVGElement>, "children" | "color" | "rotate"> {
  title?: string | null;
  description?: string | null;
  size?: number | string | null;
  color?: string | null;
  horizontal?: boolean | null;
  vertical?: boolean | null;
  rotate?: number | null;
  spin?: boolean | number | null;
  children: ReactElement<IconProps> | ReactElement<IconProps>[];
}

export const Stack = forwardRef<SVGSVGElement, StackProps>(
  (
    {
      title = null,
      description = null,
      size = null,
      color = null,
      horizontal = null,
      vertical = null,
      rotate = null,
      spin = null,
      style,
      children,
      id,
      ...rest
    },
    ref,
  ) => {
    const reactId = useId();
    const stackId = id ?? reactId;

    let anySpin = spin === null ? false : spin;

    const childrenWithProps = React.Children.map(children, (child) => {
      if (!React.isValidElement(child)) return child;

      const childElement = child as ReactElement<IconProps>;

      if (anySpin !== true) {
        anySpin = (spin === null ? childElement.props.spin : spin) === true;
      }

      let scaledSize = childElement.props.size;
      if (typeof size === "number" && typeof childElement.props.size === "number") {
        scaledSize = childElement.props.size / size;
      }

      const props: Partial<IconProps> = {
        size: scaledSize,
        color: color === null ? childElement.props.color : color,
        horizontal: horizontal === null ? childElement.props.horizontal : horizontal,
        vertical: vertical === null ? childElement.props.vertical : vertical,
        rotate: rotate === null ? childElement.props.rotate : rotate,
        spin: spin === null ? childElement.props.spin : spin,
        inStack: true,
      };

      return React.cloneElement(childElement, props);
    });

    const computedStyle: CSSProperties = { ...style };

    if (size !== null) {
      computedStyle.width = typeof size === "string" ? size : `${size * 1.5}rem`;
    }

    const labelledById = `stack_labelledby_${stackId}`;
    const describedById = `stack_describedby_${stackId}`;
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

        {anySpin && (
          <style>
            {"@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }"}
            {"@keyframes spin-inverse { from { transform: rotate(0deg) } to { transform: rotate(-360deg) } }"}
          </style>
        )}

        {childrenWithProps}
      </svg>
    );
  },
);

Stack.displayName = "Stack";

export default Stack;
