import React from "react";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "info" | "success";
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className = "", variant = "default", children, ...props }, ref) => {
    const variantStyles = {
      default: "bg-gray-50 border-gray-200 text-gray-800",
      destructive:
        "bg-red-50 border-red-200 text-red-800 [&>svg]:text-red-600",
      info: "bg-blue-50 border-blue-200 text-blue-800 [&>svg]:text-blue-600",
      success:
        "bg-green-50 border-green-200 text-green-800 [&>svg]:text-green-600",
    }[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={`relative w-full rounded-lg border p-4 text-sm flex items-start gap-3 ${variantStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Alert.displayName = "Alert";

export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className = "", children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`text-sm leading-relaxed ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
AlertDescription.displayName = "AlertDescription";
