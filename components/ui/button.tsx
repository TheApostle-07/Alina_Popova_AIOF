import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "btn-click-fx relative isolate inline-flex items-center justify-center overflow-hidden whitespace-nowrap rounded-xl text-sm font-semibold transition-[transform,colors,opacity,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/80 disabled:pointer-events-none disabled:opacity-50 before:pointer-events-none before:absolute before:-left-[135%] before:top-0 before:h-full before:w-[120%] before:rotate-[18deg] before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent before:opacity-0 before:transition-all before:duration-700 hover:before:left-[130%] hover:before:opacity-100 disabled:before:hidden motion-reduce:before:hidden",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-white shadow-rose hover:-translate-y-0.5 hover:bg-accentHover hover:shadow-[0_20px_36px_-16px_rgba(230,75,140,0.8)] active:translate-y-0 motion-reduce:hover:translate-y-0",
        secondary:
          "border border-border bg-surface text-text hover:-translate-y-0.5 hover:border-accent/45 hover:bg-surface/95 hover:shadow-[0_16px_30px_-18px_rgba(230,75,140,0.55)] active:translate-y-0 motion-reduce:hover:translate-y-0",
        ghost: "bg-transparent text-text hover:bg-surface/80",
        danger:
          "bg-danger text-white hover:-translate-y-0.5 hover:bg-danger/90 hover:shadow-[0_18px_32px_-16px_rgba(239,68,68,0.72)] active:translate-y-0 motion-reduce:hover:translate-y-0"
      },
      size: {
        default: "h-11 px-6 py-3",
        sm: "h-9 px-4",
        lg: "h-13 px-8 text-base",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
