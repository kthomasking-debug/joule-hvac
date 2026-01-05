import React from "react";

export function Card({ className = "", ...props }) {
  return <div className={"rounded-xl border bg-white dark:bg-gray-900 text-black dark:text-white shadow " + className} {...props} />;
}

export function CardHeader({ className = "", ...props }) {
  return <div className={"p-4 border-b bg-gray-50 dark:bg-gray-800 rounded-t-xl " + className} {...props} />;
}

export function CardTitle({ className = "", ...props }) {
  return <h3 className={"text-lg font-bold " + className} {...props} />;
}

export function CardContent({ className = "", ...props }) {
  return <div className={"p-4 " + className} {...props} />;
}
