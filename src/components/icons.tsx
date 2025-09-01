import type { SVGProps } from "react";

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      {...props}
    >
      <rect width="256" height="256" fill="none" />
      <path
        d="M88,184,40.4,96.7a8,8,0,0,1,15.2-6.8L80,140l24.4-49.9a8,8,0,0,1,15.2,6.8L88,184Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
      <path
        d="M216,184l-47.6-87.3a8,8,0,0,0-15.2,6.8L177.6,152l-24.4-49.9a8,8,0,0,0-15.2,6.8L168,184"
        fill="currentColor"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
    </svg>
  );
}
