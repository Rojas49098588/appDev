import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Rect } from 'react-native-svg';
import { useTheme, useThemedStyles, type Theme } from '../hooks/useTheme';

const BLUE = '#346FA3';
const RED = '#A8483D';
const WHITE = '#F8F7F2';

// Uniform color names from piece types' colors (InventoryContext).
const SWATCHES: Record<string, string> = {
  Blue: BLUE,
  Red: RED,
  White: WHITE,
  Black: '#282C30',
};

// Striped uniforms and their two stripe colors.
// "Purple" (putple) isn't purple: it's the blue-and-red striped uniform.
// "Candy" is the red-and-white striped uniform (like a candy cane).
const STRIPED: Record<string, [string, string]> = {
  Purple: [BLUE, RED],
  Candy: [RED, WHITE],
};

export default function Swatch({ color, large = false }: { color: string; large?: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const size = large ? 44 : 28;
  const shape = { width: size, height: size, borderRadius: size / 2 };

  const stripes = STRIPED[color];
  if (stripes) {
    return <StripedSwatch size={size} style={shape} stripes={stripes} />;
  }
  return <View style={[styles.swatch, shape, { backgroundColor: SWATCHES[color] ?? colors.inkFaint }]} />;
}

// Plain rotated bands clipped to a circle. An SVG <Pattern> with
// patternTransform renders as broken triangles on iOS.
function StripedSwatch({ size, style, stripes }: { size: number; style: object; stripes: [string, string] }) {
  const styles = useThemedStyles(makeStyles);
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
              <Rect key={i} x={x} y={-size} width={stripe + 0.5} height={size * 3} fill={i % 2 ? stripes[1] : stripes[0]} />
            ))}
          </G>
        </G>
      </Svg>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
  swatch: { borderWidth: 1, borderColor: 'rgba(30, 35, 40, 0.1)' },
  clip: { overflow: 'hidden' },
});
}
