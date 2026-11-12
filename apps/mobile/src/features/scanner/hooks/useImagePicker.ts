import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

export type ImagePickerError =
  | 'permission_denied'
  | 'no_image'
  | 'unknown';

export interface PickedImage {
  uri: string;
  base64: string;
  width: number;
  height: number;
}

export function useImagePicker() {
  const [picking, setPicking] = useState(false);

  const launchCamera = useCallback(async (): Promise<
    PickedImage | ImagePickerError
  > => {
    setPicking(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        return 'permission_denied';
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      return parseResult(result);
    } catch {
      return 'unknown';
    } finally {
      setPicking(false);
    }
  }, []);

  const launchLibrary = useCallback(async (): Promise<
    PickedImage | ImagePickerError
  > => {
    setPicking(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return 'permission_denied';
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      return parseResult(result);
    } catch {
      return 'unknown';
    } finally {
      setPicking(false);
    }
  }, []);

  return {
    picking,
    launchCamera,
    launchLibrary,
  };
}

function parseResult(
  result: ImagePicker.ImagePickerResult,
): PickedImage | ImagePickerError {
  if (result.canceled || !result.assets || result.assets.length === 0) {
    return 'no_image';
  }

  const asset = result.assets[0]!;
  const base64 = asset.base64;
  const uri = asset.uri;

  if (!base64) {
    return 'unknown';
  }

  const mimeType = asset.mimeType ?? 'image/jpeg';
  const prefix = `data:${mimeType};base64,`;

  return {
    uri,
    base64: prefix + base64,
    width: asset.width ?? 0,
    height: asset.height ?? 0,
  };
}
