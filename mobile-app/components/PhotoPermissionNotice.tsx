import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles, type Theme } from '../hooks/useTheme';
import OutlineButton from './OutlineButton';
import { fonts } from '../constants/fonts';
import { ImagePlaceholderIcon } from './icons';
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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
        <OutlineButton
          label={showMore ? 'Hide details' : 'Learn more ›'}
          accessibilityLabel={showMore ? 'Hide details' : 'Learn more'}
          onPress={() => setShowMore((v) => !v)}
        />
        <OutlineButton label="Not now" onPress={onDismiss} />
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

function makeStyles(t: Theme) {
  return StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: t.colors.rust,
    backgroundColor: t.colors.rustTint,
    padding: 14,
    marginTop: 8,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: t.font(14), color: t.colors.ink, flexShrink: 1 },
  body: { fontFamily: fonts.body, fontSize: t.font(12.5), color: t.colors.ink, lineHeight: t.font(18), marginBottom: 12 },
  button: { backgroundColor: t.colors.ink, paddingVertical: 11, alignItems: 'center' },
  buttonText: { fontFamily: fonts.bodySemiBold, fontSize: t.font(13.5), color: t.colors.white },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  more: { borderTopWidth: 1, borderTopColor: t.colors.line, marginTop: 10, paddingTop: 10, gap: 6 },
  moreText: { fontFamily: fonts.body, fontSize: t.font(12), color: t.colors.ink, lineHeight: t.font(17) },
});
}
