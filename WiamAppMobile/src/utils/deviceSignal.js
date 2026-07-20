import { Platform } from 'react-native';
import * as Device from 'expo-device';
import getDeviceFingerprint from './deviceFingerprint';

export const getDeviceSignal = async () => {
  const installId = await getDeviceFingerprint();
  return {
    install_id: installId,
    device_name: Device.deviceName || '',
    model_name: Device.modelName || '',
    os_name: Platform.OS,
    os_version: String(Platform.Version || ''),
    is_device: !!Device.isDevice,
  };
};

export default getDeviceSignal;

