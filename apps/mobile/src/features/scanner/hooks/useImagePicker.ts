import {
  ImageManipulator,
  SaveFormat,
} from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

import { fitWithin } from '@/features/scanner/utils/resize';

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
      });

      return await parseResult(result);
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
      });

      return await parseResult(result);
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

/**
 * Shrinks the photo before it is sent: a full camera photo is several MB of
 * base64, slow on mobile data, while 1024 px is plenty to recognise food.
 */
async function parseResult(
  result: ImagePicker.ImagePickerResult,
): Promise<PickedImage | ImagePickerError> {
  if (result.canceled || !result.assets || result.assets.length === 0) {
    return 'no_image';
  }

  const asset = result.assets[0]!;

  try {
    const context = ImageManipulator.manipulate(asset.uri);
    const target = fitWithin(asset.width ?? 0, asset.height ?? 0);
    if (target) {
      context.resize(target);
    }

    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.7,
      base64: true,
    });

    if (!saved.base64) {
      return 'unknown';
    }

    return {
      uri: saved.uri,
      base64: `data:image/jpeg;base64,${saved.base64}`,
      width: saved.width,
      height: saved.height,
    };
  } catch {
    return 'unknown';
  }
}
