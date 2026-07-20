/**
 * Pick image then force OS crop editor before upload.
 * Avatar: square (displayed circular). Banner: wide 16:9.
 */
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

async function ensureLibraryPermission() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photos', 'Allow photo access to upload.');
    return false;
  }
  return true;
}

export async function pickImageAsIs() {
  if (!(await ensureLibraryPermission())) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.95,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

/**
 * @param {'avatar'|'banner'|number[]} kindOrAspect
 * @returns {Promise<string|null>} local uri after crop, or null if cancelled
 */
export async function pickCroppedImage(kindOrAspect = 'avatar') {
  if (!(await ensureLibraryPermission())) return null;

  let aspect = [1, 1];
  if (kindOrAspect === 'banner') aspect = [16, 9];
  else if (Array.isArray(kindOrAspect)) aspect = kindOrAspect;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.9,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

export async function pickVideo() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permission needed', 'Allow media access to pick a video.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

export default pickCroppedImage;
