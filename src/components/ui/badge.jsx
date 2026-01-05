import React from "react";

export function Badge({ className = "", ...props }) {
  return <span className={"inline-block px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-semibold " + className} {...props} />;
}
