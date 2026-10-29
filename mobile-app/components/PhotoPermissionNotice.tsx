import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { ImagePlaceholderIcon, SmallChevronRightIcon } from './icons';
import { noticeCopy, type PermissionBlock } from '../lib/photoPermission';

type Props = {
  block: PermissionBlock;
  // Called when the phone can still show the permission popup: the screen asks
  // again and, if allowed, opens the camera or library.
  onTryAgain: () => void;
  onDismiss: () => void;
  // True where a photo isn't required (flags), so "Learn more" says so.
  photoOptional?: boolean;
};

// Shown in place of a dead-end alert when camera or photo library access is off.
export default function PhotoPermissionNotice({ block, onTryAgain, onDismiss, photoOptional = false }: Props) {
  const [showMore, setShowMore] = useState(false);
  const copy = noticeCopy(block, photoOptional);

  const handleButton = () => {
    if (block.canAskAgain) onTryAgain();
    else Linking.openSettings().catch((error) => console.warn('PhotoPermissionNotice: openSettings failed', error));
  };

  return (
    <View style={styles.card} accessibilityRole="alert">
      <View style={styles.headRow}>
        <ImagePlaceholderIcon color={colors.rust} />
        <Text style={styles.title}>{copy.title}</Text>
      </View>
      <Text style={styles.body}>{copy.body}</Text>

      <Pressable style={styles.button} onPress={handleButton} accessibilityRole="button">
        <Text style={styles.buttonText}>{copy.button}</Text>
      </Pressable>

      <View style={styles.linkRow}>
        <Pressable
          style={styles.learnMore}
          onPress={() => setShowMore((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showMore }}
        >
          <Text style={styles.linkText}>{showMore ? 'Hide details' : 'Learn more'}</Text>
          {!showMore ? <SmallChevronRightIcon color={colors.wash} /> : null}
        </Pressable>
        <Pressable onPress={onDismiss} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.dismissText}>Not now</Text>
        </Pressable>
      </View>

      {showMore ? (
        <View style={styles.more}>
          {copy.learnMore.map((line) => (
            <Text key={line} style={styles.moreText}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.rust,
    backgroundColor: colors.rustTint,
    padding: 14,
    marginTop: 8,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink, flexShrink: 1 },
  body: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink, lineHeight: 18, marginBottom: 12 },
  button: { backgroundColor: colors.ink, paddingVertical: 11, alignItems: 'center' },
  buttonText: { fontFamily: fonts.bodySemiBold, fontSize: 13.5, color: colors.white },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  learnMore: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 2 },
  linkText: { fontFamily: fonts.bodySemiBold, fontSize: 12.5, color: colors.wash },
  dismissText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.inkSoft },
  more: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 10, paddingTop: 10, gap: 6 },
  moreText: { fontFamily: fonts.body, fontSize: 12, color: colors.ink, lineHeight: 17 },
});
