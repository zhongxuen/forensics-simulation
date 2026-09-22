import type { ComponentType } from "react";
import { BookOpenIcon, Icon, type IconProps } from "@/components/ui/icons";
import type { AppSectionId } from "@/lib/app-sections";

export function FlagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2.5 4.5L17 13H5" />
    </Icon>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.75" fill="currentColor" />
    </Icon>
  );
}

export function CubeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12l8-4.5" />
      <path d="M12 12v9" />
    </Icon>
  );
}

export function TerminalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="m7 9.5 3 2.5-3 2.5" />
      <path d="M12.5 15H17" />
    </Icon>
  );
}

export function NetworkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="5" r="2.25" />
      <circle cx="5" cy="18.5" r="2.25" />
      <circle cx="19" cy="18.5" r="2.25" />
      <path d="M10.9 7 6.1 16.5" />
      <path d="m13.1 7 4.8 9.5" />
      <path d="M7.25 18.5h9.5" />
    </Icon>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h9" />
      <path d="M17 7h3" />
      <circle cx="15" cy="7" r="2" />
      <path d="M4 17h3" />
      <path d="M11 17h9" />
      <circle cx="9" cy="17" r="2" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </Icon>
  );
}

export function ChevronsLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m11 17-5-5 5-5" />
      <path d="m18 17-5-5 5-5" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 19.5 6v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

export const SECTION_ICONS: Readonly<Record<AppSectionId, ComponentType<IconProps>>> = {
  cases: FlagIcon,
  sandbox: CubeIcon,
  learn: BookOpenIcon,
  settings: SlidersIcon,
};
