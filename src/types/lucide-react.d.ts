declare module 'lucide-react' {
  import type { SVGProps, JSX } from 'react';

  interface IconProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    strokeWidth?: number | string;
  }

  const ChevronDown: (props: IconProps) => JSX.Element;
  const User: (props: IconProps) => JSX.Element;
  const ShoppingCart: (props: IconProps) => JSX.Element;
  const Loader2: (props: IconProps) => JSX.Element;
  const MapPin: (props: IconProps) => JSX.Element;

  export { ChevronDown, User, ShoppingCart, Loader2, MapPin };
}