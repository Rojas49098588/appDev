import Svg, { Circle, Path, Rect } from 'react-native-svg';

export function BackChevronIcon({ color, size = 19 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M15 5l-7 7 7 7" stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

export function PlusIcon({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}

export function SearchIcon({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={1.8} fill="none" />
      <Path d="M20 20l-4-4" stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

export function ChevronDownIcon({
  color,
  size = 14,
  open,
}: {
  color: string;
  size?: number;
  open?: boolean;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={open ? { transform: [{ rotate: '180deg' }] } : undefined}
    >
      <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

export function ImagePlaceholderIcon({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={2.5} y={4.5} width={19} height={15} rx={0} stroke={color} strokeWidth={1.4} fill="none" />
      <Circle cx={8.5} cy={10} r={1.6} stroke={color} strokeWidth={1.4} fill="none" />
      <Path d="M3 16.5l5.5-5 4 3.5 3-2.5 5.5 4.5" stroke={color} strokeWidth={1.4} fill="none" />
    </Svg>
  );
}

export function SmallChevronRightIcon({
  color,
  size = 9,
  strokeWidth = 3,
}: {
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={strokeWidth} fill="none" />
    </Svg>
  );
}

export function FlagIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5.5 21V4.5m0 0c4-3 7 3 13-1v10c-6 4-9-2-13 1"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function CloseIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 7l10 10M17 7L7 17" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function DropIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3.4S6.7 9.8 6.7 14.2a5.3 5.3 0 0 0 10.6 0C17.3 9.8 12 3.4 12 3.4Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M9.5 15.2c.3 1.2 1.1 1.8 2.2 2" stroke={color} strokeWidth={1.7} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export function WrenchIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M14.8 6.7a4.4 4.4 0 0 0-5.5 5.5L4 17.5A1.8 1.8 0 1 0 6.5 20l5.3-5.3a4.4 4.4 0 0 0 5.5-5.5l-2.6 2.6-2.5-2.5 2.6-2.6Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function CheckIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 12.5l4.2 4.2L19 7"
        stroke={color}
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
