import React from 'react';

// Base SVG component matching Sandpack
const SVG: React.FC<React.SVGAttributes<unknown>> = (props) => (
  <svg
    fill="currentColor"
    height="16"
    viewBox="0 0 16 16"
    width="16"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  />
);

// Directory Icon (Closed) - Exact match from CodeSandbox
export const DirectoryIconClosed = (): React.ReactElement => (
  <SVG>
    <title>Directory</title>
    <path
      d="M12.3334 12.6667H3.66675C3.11446 12.6667 2.66675 12.219 2.66675 11.6667V5C2.66675 4.44772 3.11446 4 3.66675 4H5.69731C5.89473 4 6.08774 4.05844 6.25201 4.16795L7.74816 5.16538C7.91242 5.2749 8.10543 5.33333 8.30286 5.33333H12.3334C12.8857 5.33333 13.3334 5.78105 13.3334 6.33333V11.6667C13.3334 12.219 12.8857 12.6667 12.3334 12.6667Z"
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="round"
    />
  </SVG>
);

// Directory Icon (Open) - Exact match from CodeSandbox
export const DirectoryIconOpen = (): React.ReactElement => (
  <SVG>
    <title>Directory</title>
    <path
      d="M12.5526 12.6667H3.66675C3.2922 12.6667 2.96575 12.4608 2.79442 12.156L3.81072 8.0908C3.92201 7.64563 4.32199 7.33333 4.78086 7.33333H13.386C14.0365 7.33333 14.5139 7.94472 14.3561 8.57587L13.5228 11.9092C13.4115 12.3544 13.0115 12.6667 12.5526 12.6667Z"
      fill="currentColor"
    />
    <path
      d="M13.3334 6.63333V6.33333C13.3334 5.78105 12.8857 5.33333 12.3334 5.33333H8.30286C8.10543 5.33333 7.91242 5.2749 7.74816 5.16538L6.25201 4.16795C6.08774 4.05844 5.89473 4 5.69731 4H3.66675C3.11446 4 2.66675 4.44772 2.66675 5L2.66675 11.6667C2.66675 12.219 3.11446 12.6667 3.66675 12.6667H3.81072"
      fill="currentColor"
    />
  </SVG>
);

// File Icon - Exact match from CodeSandbox
export const FileIcon = (): React.ReactElement => (
  <SVG fill="currentColor">
    <title>File</title>
    <path
      clipRule="evenodd"
      d="M4.5 4.33325C4.5 4.05711 4.72386 3.83325 5 3.83325H8.5V6.33325C8.5 6.88554 8.94772 7.33325 9.5 7.33325H12V11.6666C12 11.9427 11.7761 12.1666 11.5 12.1666H5C4.72386 12.1666 4.5 11.9427 4.5 11.6666V4.33325ZM9.5 6.33325V4.33325L12 6.83325H9.5Z"
      fillRule="evenodd"
    />
  </SVG>
);