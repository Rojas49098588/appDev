import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TabIconName = 'home' | 'sections' | 'catalogue' | 'inventory';

export default function TabIcon({
  name,
  color,
  size = 19,
}: {
  name: TabIconName;
  color: string;
  size?: number;
}) {
  const common = { stroke: color, strokeWidth: 1.6, fill: 'none' } as const;

  switch (name) {
    case 'home':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 11L12 4l8 7" {...common} />
          <Path d="M6 10v9h12v-9" {...common} />
        </Svg>
      );
    case 'sections':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={8} r={3.4} {...common} />
          <Path d="M5 20c1-4 4-6 7-6s6 2 7 6" {...common} />
        </Svg>
      );
    case 'catalogue':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x={4} y={4} width={7} height={7} {...common} />
          <Rect x={13} y={4} width={7} height={7} {...common} />
          <Rect x={4} y={13} width={7} height={7} {...common} />
          <Rect x={13} y={13} width={7} height={7} {...common} />
        </Svg>
      );
    case 'inventory':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M5 6h14M5 12h14M5 18h9" {...common} />
        </Svg>
      );
  }
}
