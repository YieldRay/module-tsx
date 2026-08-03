interface IconProps {
  /** Icon size in CSS units. Defaults to `1em` so it follows font-size. */
  size?: number | string;
}

const iconSize = (size: IconProps["size"]) => size ?? "1em";

export const FilePlusIcon = ({ size }: IconProps = {}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    viewBox="0 0 16 16"
    width={iconSize(size)}
    height={iconSize(size)}
    aria-hidden="true"
  >
    <path
      d="M9.5 1a.5.5 0 0 1 .354.146l4 4A.5.5 0 0 1 14 5.5v1.916A5 5 0 0 0 8 15H4.5A2.5 2.5 0 0 1 2 12.5v-9A2.5 2.5 0 0 1 4.5 1z"
      opacity="0.4"
    />
    <path
      fillRule="evenodd"
      d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 1.5a.5.5 0 0 0-.5.5v1.5H10a.5.5 0 0 0 0 1h1.5V14a.5.5 0 0 0 1 0v-1.5H14a.5.5 0 0 0 0-1h-1.5V10a.5.5 0 0 0-.5-.5"
      clipRule="evenodd"
    />
  </svg>
);

export const FolderPlusIcon = ({ size }: IconProps = {}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    viewBox="0 0 16 16"
    width={iconSize(size)}
    height={iconSize(size)}
    aria-hidden="true"
  >
    <path
      d="M14 7.416A5 5 0 0 0 7.417 14H2a2 2 0 0 1-2-2V6h14zM4.585 2a2 2 0 0 1 1.028.285l1.788 1.072a1 1 0 0 0 .514.143H12c.932 0 1.712.638 1.935 1.5H0V4a2 2 0 0 1 2-2z"
      opacity="0.4"
    />
    <path
      fillRule="evenodd"
      d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 1.5a.5.5 0 0 0-.5.5v1.5H10a.5.5 0 0 0 0 1h1.5V14a.5.5 0 0 0 1 0v-1.5H14a.5.5 0 0 0 0-1h-1.5V10a.5.5 0 0 0-.5-.5"
      clipRule="evenodd"
    />
  </svg>
);

export const PlayIcon = ({ size }: IconProps = {}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={iconSize(size)}
    height={iconSize(size)}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2S2 6.477 2 12s4.477 10 10 10"
      clipRule="evenodd"
      opacity=".5"
    />
    <path
      fill="currentColor"
      d="m15.414 13.059l-4.72 2.787C9.934 16.294 9 15.71 9 14.786V9.214c0-.924.934-1.507 1.694-1.059l4.72 2.787c.781.462.781 1.656 0 2.118"
    />
  </svg>
);

export const RestartIcon = ({ size }: IconProps = {}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={iconSize(size)}
    height={iconSize(size)}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <g fill="none">
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        clipPath="url(#restart-clip)"
      >
        <path
          d="M19.729 10.929a8 8 0 1 1-2.072-3.585l.707.706"
          opacity=".5"
        />
        <path d="M14.121 8.05h4.243V3.808" />
      </g>
      <defs>
        <clipPath id="restart-clip">
          <path fill="#fff" d="M0 0h24v24H0z" />
        </clipPath>
      </defs>
    </g>
  </svg>
);
