// Spike: photo library + camera access for the future combo-image-upload
// feature. Verified working on-device in Expo Go (both photo library
// picking and in-app camera capture, via expo-image-picker) before the
// real feature (screens/AddComboScreen.tsx) was built. Kept here, unwired
// from navigation, as a record of that spike test — not part of the live app.
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';

export default function ImagePickerSpikeScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState('No image picked yet.');

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus('Photo library permission denied.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 1,
    });
    if (result.canceled) {
      setStatus('Library pick canceled.');
      return;
    }
    setImage(result.assets[0].uri);
    setStatus(`Picked from library: ${result.assets[0].uri}`);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setStatus('Camera permission denied.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 1,
    });
    if (result.canceled) {
      setStatus('Camera capture canceled.');
      return;
    }
    setImage(result.assets[0].uri);
    setStatus(`Captured with camera: ${result.assets[0].uri}`);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>Image picker spike</Text>
      <Text style={styles.status}>{status}</Text>

      {image ? (
        <Image source={{ uri: image }} style={styles.preview} />
      ) : (
        <View style={styles.previewPlaceholder} />
      )}

      <Pressable style={styles.button} onPress={pickFromLibrary}>
        <Text style={styles.buttonText}>Choose from library</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={takePhoto}>
        <Text style={styles.buttonText}>Take photo</Text>
      </Pressable>
      <Pressable
        style={styles.backButton}
        onPress={() => Alert.alert('Spike screen', 'This screen is throwaway spike code.')}
      >
        <Text style={styles.backButtonText}>About this spike</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 18,
  },
  title: {
    fontFamily: fonts.blockTitle,
    fontSize: 18,
    color: colors.ink,
    marginBottom: 8,
  },
  status: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkSoft,
    textAlign: 'center',
    marginBottom: 16,
  },
  preview: {
    width: 180,
    height: 240,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 20,
  },
  previewPlaceholder: {
    width: 180,
    height: 240,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    marginBottom: 20,
  },
  button: {
    width: '100%',
    backgroundColor: colors.ink,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.paper,
  },
  backButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  backButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
  },
});
