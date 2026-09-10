import Svg, { Circle, Path } from 'react-native-svg';

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

export function SmallChevronRightIcon({ color, size = 9 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={3} fill="none" />
    </Svg>
  );
}
