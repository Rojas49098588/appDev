import { useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fonts } from '../constants/fonts';
import { useThemedStyles, type Theme } from '../hooks/useTheme';

const ROW_HEIGHT = 36;
const VISIBLE_ROWS = 5;
const CENTER_INDEX = Math.floor(VISIBLE_ROWS / 2);
const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;

export default function InstrumentWheel({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const initialIndex = Math.max(0, options.indexOf(value));
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  let scrollRef: ScrollView | null = null;

  const indexFromOffset = (offsetY: number) =>
    Math.min(options.length - 1, Math.max(0, Math.round(offsetY / ROW_HEIGHT)));

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = indexFromOffset(e.nativeEvent.contentOffset.y);
    if (index !== activeIndex) setActiveIndex(index);
  };

  const handleSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = indexFromOffset(e.nativeEvent.contentOffset.y);
    setActiveIndex(index);
    onChange(options[index]);
  };

  const scrollToIndex = (index: number) => {
    scrollRef?.scrollTo({ y: index * ROW_HEIGHT, animated: true });
  };

  return (
    <View style={styles.wheel}>
      <View pointerEvents="none" style={styles.highlight} />
      <ScrollView
        ref={(ref) => {
          scrollRef = ref;
        }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleSettle}
        onScrollEndDrag={handleSettle}
        contentContainerStyle={{ paddingVertical: CENTER_INDEX * ROW_HEIGHT }}
        contentOffset={{ x: 0, y: initialIndex * ROW_HEIGHT }}
      >
        {options.map((option, index) => {
          const distance = Math.abs(index - activeIndex);
          return (
            <Pressable accessibilityRole="button" key={option} style={styles.row} onPress={() => scrollToIndex(index)}>
              <Text
                style={[
                  styles.rowText,
                  distance === 1 && styles.rowTextNear,
                  distance === 0 && styles.rowTextSelected,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
  wheel: {
    height: WHEEL_HEIGHT,
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: CENTER_INDEX * ROW_HEIGHT,
    height: ROW_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: t.colors.line,
    zIndex: 1,
  },
  row: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    fontFamily: fonts.body,
    fontSize: t.font(13.5),
    color: t.colors.inkFaint,
  },
  rowTextNear: {
    fontFamily: fonts.body,
    fontSize: t.font(14.5),
    color: t.colors.inkSoft,
  },
  rowTextSelected: {
    fontFamily: fonts.wordmark,
    fontSize: t.font(16),
    color: t.colors.ink,
  },
});
}
