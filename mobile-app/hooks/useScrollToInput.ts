import { useCallback, useEffect, useRef } from 'react';
import {
  Keyboard,
  ScrollView,
  UIManager,
  type FocusEvent,
  type HostInstance,
  type LayoutChangeEvent,
  type MeasureInWindowOnSuccessCallback,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

// event.target is a plain node handle under the legacy architecture, or the
// host element itself (with its own measureInWindow) under Fabric.
function measureTargetInWindow(
  target: number | undefined | HostInstance,
  callback: MeasureInWindowOnSuccessCallback
) {
  if (target == null) return;
  if (typeof target === 'number') {
    UIManager.measureInWindow(target, callback);
  } else {
    target.measureInWindow(callback);
  }
}

// Scrolls whichever TextInput just gained focus up above the keyboard (and
// above any pinned bottom bar sitting on top of it, e.g. a submit footer or
// the numeric-keyboard "Done" bar — measured via registerBottomInset).
//
// This measures the input and the keyboard in the same coordinate space
// (absolute screen position) and scrolls the exact distance needed. RN's own
// `scrollResponderScrollNativeHandleToKeyboard` looks like the built-in way
// to do this, but it compares the input's position *relative to the
// ScrollView* against the keyboard's *absolute screen* position — those only
// match if the ScrollView starts at the very top of the screen, which it
// never does once there's a header/safe-area above it, so it undershoots by
// that same amount and the field ends up hidden behind the pinned bar anyway.
export function useScrollToInput(extraGap = 12) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetY = useRef(0);
  const keyboardScreenY = useRef<number | null>(null);
  const bottomInset = useRef(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardScreenY.current = e.endCoordinates.screenY;
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardScreenY.current = null;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetY.current = event.nativeEvent.contentOffset.y;
  }, []);

  // Attach to onLayout of whatever's pinned above the keyboard (a footer, a
  // KeyboardDoneBar, or a wrapper around both) so its height is always known,
  // even as it appears/disappears or changes size.
  const registerBottomInset = useCallback((event: LayoutChangeEvent) => {
    bottomInset.current = event.nativeEvent.layout.height;
  }, []);

  const scrollTargetAboveKeyboard = useCallback(
    (target: number | undefined | HostInstance) => {
      if (keyboardScreenY.current == null) return;
      measureTargetInWindow(target, (_x, y, _width, height) => {
        const inputBottom = y + height;
        const visibleBottom = keyboardScreenY.current! - bottomInset.current - extraGap;
        if (inputBottom > visibleBottom) {
          scrollRef.current?.scrollTo({
            y: scrollOffsetY.current + (inputBottom - visibleBottom),
            animated: true,
          });
        }
      });
    },
    [extraGap]
  );

  const scrollToFocusedInput = useCallback(
    (event: FocusEvent) => {
      const target = event.target;
      if (keyboardScreenY.current != null) {
        scrollTargetAboveKeyboard(target);
        return;
      }
      // First focus in the screen — the keyboard hasn't reported its
      // position yet. Wait for it once, then scroll.
      const sub = Keyboard.addListener('keyboardDidShow', (e) => {
        keyboardScreenY.current = e.endCoordinates.screenY;
        sub.remove();
        scrollTargetAboveKeyboard(target);
      });
    },
    [scrollTargetAboveKeyboard]
  );

  return { scrollRef, handleScroll, registerBottomInset, scrollToFocusedInput };
}
