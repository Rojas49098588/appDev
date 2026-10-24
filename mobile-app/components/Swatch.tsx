import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Rect } from 'react-native-svg';
import { colors } from '../constants/colors';

const BLUE = '#346FA3';
const RED = '#A8483D';

// Uniform color names from piece types' colors (InventoryContext).
const SWATCHES: Record<string, string> = {
  Blue: BLUE,
  Red: RED,
  Candy: '#E9DDC8',
  White: '#F8F7F2',
  Black: '#282C30',
};

// "Purple" (putple) isn't purple: it's the blue-and-red striped uniform.
const STRIPED = ['Purple'];

export default function Swatch({ color, large = false }: { color: string; large?: boolean }) {
  const size = large ? 44 : 28;
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (STRIPED.includes(color)) {
    return <StripedSwatch size={size} style={shape} />;
  }
  return <View style={[styles.swatch, shape, { backgroundColor: SWATCHES[color] ?? colors.inkFaint }]} />;
}

// Plain rotated bands clipped to a circle. An SVG <Pattern> with
// patternTransform renders as broken triangles on iOS.
function StripedSwatch({ size, style }: { size: number; style: object }) {
  // useId returns ":r0:"-style ids, which break url(#...) references.
  const clipId = `stripes${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const center = size / 2;
  const stripe = size / 5;
  // Bands span past the circle on every side so the rotation leaves no gaps.
  const bands = Array.from({ length: 12 }, (_, i) => -size + i * stripe);
  return (
    <View style={[styles.swatch, style, styles.clip]}>
      <Svg width={size} height={size}>
        <Defs>
          <ClipPath id={clipId}>
            <Circle cx={center} cy={center} r={center} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          <G rotation={45} origin={`${center}, ${center}`}>
            {bands.map((x, i) => (
              <Rect key={i} x={x} y={-size} width={stripe + 0.5} height={size * 3} fill={i % 2 ? RED : BLUE} />
            ))}
          </G>
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  swatch: { borderWidth: 1, borderColor: 'rgba(30, 35, 40, 0.1)' },
  clip: { overflow: 'hidden' },
});
