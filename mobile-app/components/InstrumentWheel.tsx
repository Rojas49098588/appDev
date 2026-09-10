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
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';

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
            <Pressable key={option} style={styles.row} onPress={() => scrollToIndex(index)}>
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

const styles = StyleSheet.create({
  wheel: {
    height: WHEEL_HEIGHT,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
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
    borderColor: colors.line,
    zIndex: 1,
  },
  row: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    fontFamily: fonts.body,
    fontSize: 13.5,
    color: colors.inkFaint,
  },
  rowTextNear: {
    fontFamily: fonts.body,
    fontSize: 14.5,
    color: colors.inkSoft,
  },
  rowTextSelected: {
    fontFamily: fonts.wordmark,
    fontSize: 16,
    color: colors.ink,
  },
});
