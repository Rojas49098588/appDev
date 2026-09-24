import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { File, Directory, Paths } from 'expo-file-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import { PIECES, type Piece } from '../constants/inventoryData';
import { useCombos } from '../context/CombosContext';
import { useScrollToInput } from '../hooks/useScrollToInput';
import TapeGutter from '../components/TapeGutter';
import { BackChevronIcon, ImagePlaceholderIcon } from '../components/icons';

type Props = NativeStackScreenProps<RootStackParamList, 'AddCombo'>;

function colorsForPiece(piece: Piece): string[] {
  return piece.breakdown.type === 'graded'
    ? piece.breakdown.groups.map((group) => group.color)
    : piece.breakdown.rows.map((row) => row.name);
}

async function persistPickedImage(pickedUri: string, comboId: string): Promise<string> {
  const dir = new Directory(Paths.document, 'combo-images');
  dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${comboId}.jpg`);
  const source = new File(pickedUri);
  await source.copy(dest);
  return dest.uri;
}

export default function AddComboScreen({ navigation }: Props) {
  const { addCombo } = useCombos();
  const [label, setLabel] = useState('');
  const [sub, setSub] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<Record<string, string | null>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { scrollRef, handleScroll, scrollToFocusedInput } = useScrollToInput();

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Photo library access is required to choose an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 1,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Camera access is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 1,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const toggleColor = (pieceName: string, color: string) => {
    setSelectedColors((current) => ({
      ...current,
      [pieceName]: current[pieceName] === color ? null : color,
    }));
  };

  const handleSubmit = async () => {
    if (!label.trim()) {
      Alert.alert('Error', 'Please give this combo a name before continuing.');
      return;
    }
    if (!imageUri) {
      Alert.alert('Error', 'Please choose or take a photo for this combo.');
      return;
    }

    setIsSaving(true);
    try {
      const id = `custom-${Date.now()}`;
      const persistedImageUri = await persistPickedImage(imageUri, id);
      const components = PIECES.map((piece) => {
        const color = selectedColors[piece.name];
        return color ? `${color} ${piece.name}` : null;
      }).filter((component): component is string => component !== null);

      await addCombo({
        id,
        label: label.trim(),
        sub: sub.trim(),
        image: persistedImageUri,
        components,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Something went wrong saving this combo. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.appBody}>
          <TapeGutter />

          <View style={styles.contentColumn}>
            <ScrollView
              ref={scrollRef}
              style={styles.flexOne}
              contentContainerStyle={styles.content}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              <View style={styles.header}>
                <Pressable style={styles.headerSideButton} onPress={() => navigation.goBack()}>
                  <BackChevronIcon color={colors.ink} />
                </Pressable>
                <Text style={styles.pageTitle}>Add combo</Text>
                <View style={styles.headerSideButton} />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Photo</Text>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <ImagePlaceholderIcon color={colors.inkFaint} />
                  </View>
                )}
                <View style={styles.photoButtonRow}>
                  <Pressable style={styles.photoButton} onPress={pickFromLibrary}>
                    <Text style={styles.photoButtonText}>Choose from library</Text>
                  </Pressable>
                  <Pressable style={styles.photoButton} onPress={takePhoto}>
                    <Text style={styles.photoButtonText}>Take photo</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Combo 15"
                  placeholderTextColor={colors.inkFaint}
                  value={label}
                  onChangeText={setLabel}
                  onFocus={scrollToFocusedInput}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Description (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Field — away"
                  placeholderTextColor={colors.inkFaint}
                  value={sub}
                  onChangeText={setSub}
                  onFocus={scrollToFocusedInput}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Garments</Text>
                {PIECES.map((piece) => (
                  <View key={piece.name} style={styles.pieceRow}>
                    <Text style={styles.pieceName}>{piece.name}</Text>
                    <View style={styles.chipRow}>
                      {colorsForPiece(piece).map((color) => {
                        const active = selectedColors[piece.name] === color;
                        return (
                          <Pressable
                            key={color}
                            style={[styles.chip, active && styles.chipActive]}
                            onPress={() => toggleColor(piece.name, color)}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                              {color}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSaving}
              >
                <Text style={styles.submitButtonText}>
                  {isSaving ? 'Saving…' : 'Save combo'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flexOne: { flex: 1 },
  appBody: { flex: 1, flexDirection: 'row' },
  contentColumn: { flex: 1, flexDirection: 'column' },
  content: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 28 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
  },
  headerSideButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.wordmark,
    fontSize: 18,
    color: colors.ink,
  },
  field: { marginBottom: 22 },
  fieldLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.inkSoft, marginBottom: 7 },
  imagePreview: {
    width: '60%',
    aspectRatio: 3 / 4,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 10,
  },
  imagePlaceholder: {
    width: '60%',
    aspectRatio: 3 / 4,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  photoButtonRow: { flexDirection: 'row', gap: 8 },
  photoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 11,
    alignItems: 'center',
  },
  photoButtonText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: colors.ink },
  textInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 13,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
  },
  pieceRow: { marginBottom: 14 },
  pieceName: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink, marginBottom: 7 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
  chipTextActive: { color: colors.paper },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  submitButton: { backgroundColor: colors.ink, paddingVertical: 14, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.paper },
});
