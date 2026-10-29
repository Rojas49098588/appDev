import { useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import type { Flag, FlagStatus } from '../constants/flagsData';
import type { PhotoChange } from '../lib/flagHistory';
import { OFFLINE_DIM, useConnection } from '../hooks/useConnection';
import { CloseIcon, DropIcon, WrenchIcon } from './icons';
import Swatch from './Swatch';
import PhotoPermissionNotice from './PhotoPermissionNotice';
import { usePhotoPermission } from '../hooks/usePhotoPermission';

export type FlagTarget = {
  piece: string;
  color: string;
  // Assigned size, '' when staff haven't set one.
  size: string;
  itemName: string;
  dirtyOnly: boolean;
  flag?: Flag;
};

type Props = {
  target: FlagTarget | null;
  // Changes on every open so the form resets to the piece's current flag.
  openKey: number;
  onClose: () => void;
  onSubmit: (status: FlagStatus, comment: string, photo: PhotoChange) => Promise<void>;
};

export const STATUS_LABELS: Record<FlagStatus, string> = { dirty: 'Dirty', repair: 'Needs repair' };

export default function FlagSheet({ target, openKey, onClose, onSubmit }: Props) {
  // Keep showing the last piece while the modal fades out.
  const lastTarget = useRef(target);
  if (target) lastTarget.current = target;
  const shown = lastTarget.current;

  const slide = useRef(new Animated.Value(0)).current;
  const onShow = () => {
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  };

  return (
    <Modal
      visible={target !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={onShow}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close flag sheet">
          <View style={styles.backdrop} />
        </Pressable>
        {shown && (
          <Animated.View
            style={{
              transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }],
            }}
          >
            <SheetBody key={openKey} target={shown} onClose={onClose} onSubmit={onSubmit} />
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SheetBody({
  target,
  onClose,
  onSubmit,
}: {
  target: FlagTarget;
  onClose: () => void;
  onSubmit: Props['onSubmit'];
}) {
  const insets = useSafeAreaInsets();
  const { isOnline } = useConnection();
  const [status, setStatus] = useState<FlagStatus | undefined>(
    target.flag?.status ?? (target.dirtyOnly ? 'dirty' : undefined)
  );
  const [comment, setComment] = useState(target.flag?.comment ?? '');
  const [isSaving, setIsSaving] = useState(false);
  // undefined = untouched, string = newly picked local file, null = removed.
  const [pickedUri, setPickedUri] = useState<string | null | undefined>(undefined);
  const existingUrl = target.flag?.photoUrl;
  const hadPhoto = !!target.flag?.photoPath;
  const displayUri = pickedUri === undefined ? existingUrl : (pickedUri ?? undefined);

  const photoPermission = usePhotoPermission();

  const pickFromLibrary = async () => {
    if (!(await photoPermission.request('library'))) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.5,
    });
    if (!result.canceled) setPickedUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    if (!(await photoPermission.request('camera'))) return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.5 });
    if (!result.canceled) setPickedUri(result.assets[0].uri);
  };

  const addPhoto = () =>
    Alert.alert('Add a photo', undefined, [
      { text: 'Take photo', onPress: takePhoto },
      { text: 'Choose from library', onPress: pickFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const photoChange = (): PhotoChange => {
    if (typeof pickedUri === 'string') return { kind: 'set', localUri: pickedUri };
    if (pickedUri === null && hadPhoto) return { kind: 'remove' };
    return { kind: 'keep' };
  };

  const submit = async () => {
    if (!status) return;
    setIsSaving(true);
    try {
      await onSubmit(status, comment, photoChange());
    } finally {
      setIsSaving(false);
    }
  };

  const options: [FlagStatus, (color: string) => ReactNode][] = [
    ['dirty', (color) => <DropIcon color={color} />],
    ['repair', (color) => <WrenchIcon color={color} />],
  ];

  return (
    <Pressable
      style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 12) }]}
      onPress={Keyboard.dismiss}
      accessible={false}
    >
      <View style={styles.handle} />
      <View style={styles.headerRow}>
        <Swatch color={target.color} large />
        <View style={styles.headerText}>
          <Text style={styles.title}>
            Flag {target.color} {target.itemName}
          </Text>
          <Text style={styles.subtitle}>
            {target.piece} · {target.size ? `Size ${target.size}` : 'No size assigned'}
          </Text>
        </View>
        <Pressable style={styles.closeButton} onPress={onClose} accessibilityLabel="Close">
          <CloseIcon color={colors.inkSoft} />
        </Pressable>
      </View>

      {target.dirtyOnly ? (
        <Text style={styles.dirtyOnlyNote}>
          Only flag your white shirt as dirty if you've left it in the bin for washing.
        </Text>
      ) : (
        <>
          <Text style={styles.question}>What's wrong with it?</Text>
          <View style={styles.optionGrid}>
            {options.map(([value, icon]) => {
              const selected = status === value;
              const tint = selected ? colors.tealDark : colors.inkSoft;
              return (
                <Pressable
                  key={value}
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => setStatus(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  {icon(tint)}
                  <Text style={[styles.optionLabel, { color: tint }]}>{STATUS_LABELS[value]}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.noteLabel}>
        Add a note <Text style={styles.noteOptional}>(optional)</Text>
      </Text>
      <TextInput
        style={styles.noteInput}
        value={comment}
        onChangeText={setComment}
        placeholder="e.g. mud stain on left sleeve"
        placeholderTextColor={colors.inkFaint}
        multiline
      />
      <Text style={styles.noteLabel}>
        Add a photo <Text style={styles.noteOptional}>(optional)</Text>
      </Text>
      {displayUri ? (
        <View style={styles.photoWrap}>
          <Image source={{ uri: displayUri }} style={styles.photoThumb} accessibilityLabel="Flag photo" />
          <Pressable
            style={styles.photoRemove}
            onPress={() => setPickedUri(null)}
            accessibilityLabel="Remove photo"
          >
            <CloseIcon color={colors.white} size={14} />
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.photoAdd} onPress={addPhoto} accessibilityRole="button" accessibilityLabel="Add photo">
          <Text style={styles.photoAddText}>Add photo</Text>
        </Pressable>
      )}
      {photoPermission.block ? (
        <PhotoPermissionNotice
          block={photoPermission.block}
          onTryAgain={photoPermission.block.source === 'camera' ? takePhoto : pickFromLibrary}
          onDismiss={photoPermission.dismiss}
          photoOptional
        />
      ) : null}
      <Pressable
        style={[
          styles.submit,
          !status && styles.submitDisabled,
          (!isOnline || isSaving) && OFFLINE_DIM,
        ]}
        disabled={!status || isSaving}
        onPress={submit}
      >
        <Text style={[styles.submitText, !status && styles.submitTextDisabled]}>Submit flag</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 20,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1, paddingTop: 2 },
  title: { fontFamily: fonts.wordmark, fontSize: 20, color: colors.ink },
  subtitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  question: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: colors.ink, marginTop: 28 },
  optionGrid: { flexDirection: 'row', gap: 12, marginTop: 12 },
  option: {
    flex: 1,
    minHeight: 100,
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.lineSoft,
    borderRadius: 14,
    backgroundColor: colors.white,
    padding: 16,
  },
  optionSelected: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  optionLabel: { fontFamily: fonts.bodySemiBold, fontSize: 14 },
  dirtyOnlyNote: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.amber,
    backgroundColor: colors.amberTint,
    borderRadius: 14,
    padding: 14,
    marginTop: 24,
  },
  noteLabel: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink, marginTop: 24 },
  noteOptional: { fontFamily: fonts.body, color: colors.inkSoft },
  noteInput: {
    marginTop: 8,
    minHeight: 92,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  photoAdd: {
    marginTop: 8,
    height: 72,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.inkSoft },
  photoWrap: { marginTop: 8, width: 96, height: 96 },
  photoThumb: { width: 96, height: 96, borderRadius: 14, backgroundColor: colors.paper },
  photoRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: {
    marginTop: 20,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.wash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: { backgroundColor: colors.lineSoft },
  submitText: { fontFamily: fonts.bodySemiBold, fontSize: 16, color: colors.white },
  submitTextDisabled: { color: colors.inkFaint },
});
