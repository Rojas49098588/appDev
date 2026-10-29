import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { PermissionBlock, PhotoSource } from '../lib/photoPermission';

const requestFor = (source: PhotoSource) =>
  source === 'camera' ? ImagePicker.requestCameraPermissionsAsync() : ImagePicker.requestMediaLibraryPermissionsAsync();
const checkFor = (source: PhotoSource) =>
  source === 'camera' ? ImagePicker.getCameraPermissionsAsync() : ImagePicker.getMediaLibraryPermissionsAsync();

// Asks for camera / photo library access and remembers a refusal, so the screen
// can show PhotoPermissionNotice instead of a dead end. After someone comes back
// from Settings, it checks again and clears the notice once access is on.
export function usePhotoPermission() {
  const [block, setBlock] = useState<PermissionBlock | null>(null);

  // Resolves true when the picker may open.
  const request = useCallback(async (source: PhotoSource): Promise<boolean> => {
    const permission = await requestFor(source);
    if (permission.granted) {
      setBlock(null);
      return true;
    }
    setBlock({ source, canAskAgain: permission.canAskAgain });
    return false;
  }, []);

  useEffect(() => {
    if (!block) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      checkFor(block.source)
        .then((permission) => {
          if (permission.granted) setBlock(null);
          else setBlock({ source: block.source, canAskAgain: permission.canAskAgain });
        })
        .catch((error) => console.warn('usePhotoPermission: recheck failed', error));
    });
    return () => subscription.remove();
  }, [block]);

  const dismiss = useCallback(() => setBlock(null), []);

  return { block, request, dismiss };
}
