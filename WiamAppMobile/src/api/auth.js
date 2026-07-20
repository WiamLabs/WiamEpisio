import apiClient from './client';
import { Platform } from 'react-native';
import getDeviceFingerprint from '../utils/deviceFingerprint';
import getDeviceSignal from '../utils/deviceSignal';

const authApi = {
  login: async (email, password) => {
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      const deviceSignal = await getDeviceSignal();
      const response = await apiClient.post('/auth/login', {
        email,
        password,
        device_fingerprint: deviceFingerprint,
        platform: Platform.OS,
        device_signal: deviceSignal,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Login failed';
    }
  },

  register: async ({
    email,
    password,
    firstName,
    lastName,
    username,
    dateOfBirth,
    phone,
    referralCode,
  }) => {
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      const deviceSignal = await getDeviceSignal();
      const response = await apiClient.post('/auth/register', {
        email,
        password,
        first_name: firstName,
        last_name: lastName || '',
        username,
        date_of_birth: dateOfBirth,
        phone: phone || '',
        referral_code: referralCode || undefined,
        device_fingerprint: deviceFingerprint,
        platform: Platform.OS,
        device_signal: deviceSignal,
      });
      return response.data;
    } catch (error) {
      const d = error.response?.data;
      if (d && typeof d === 'object') throw d;
      throw error.response?.data?.error || 'Registration failed';
    }
  },

  completeRegistration: async () => {
    try {
      const response = await apiClient.post('/auth/complete-registration', {});
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Could not finish signup';
    }
  },

  googleLogin: async (idToken) => {
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      const deviceSignal = await getDeviceSignal();
      const response = await apiClient.post('/auth/google', {
        id_token: idToken,
        device_fingerprint: deviceFingerprint,
        platform: Platform.OS,
        device_signal: deviceSignal,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Google sign-in failed';
    }
  },

  me: async () => {
    try {
      const response = await apiClient.get('/auth/me');
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch user data';
    }
  },

  forgotPassword: async (email) => {
    try {
      const response = await apiClient.post('/auth/forgot-password', { email });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to send reset code';
    }
  },

  sendVerifyCode: async () => {
    try {
      const response = await apiClient.post('/auth/send-verify-code', { purpose: 'register' });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to send verification code';
    }
  },

  verifyEmail: async (code) => {
    try {
      const response = await apiClient.post('/auth/verify-email', { code });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Verification failed';
    }
  },

  confirmAge: async (age) => {
    try {
      const response = await apiClient.post('/auth/confirm-age', { age });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Age confirmation failed';
    }
  },

  resetPassword: async (email, code, newPassword, confirmPassword) => {
    try {
      const response = await apiClient.post('/auth/reset-password', {
        email,
        code,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to reset password';
    }
  },

  updateProfile: async (fields = {}) => {
    try {
      const body = {};
      if (fields.firstName !== undefined) body.first_name = fields.firstName;
      if (fields.lastName !== undefined) body.last_name = fields.lastName;
      if (fields.bio !== undefined) body.bio = fields.bio;
      if (fields.username !== undefined) body.username = fields.username;
      if (fields.pronouns !== undefined) body.pronouns = fields.pronouns;
      if (fields.dateOfBirth !== undefined) body.date_of_birth = fields.dateOfBirth;
      if (fields.showPronouns !== undefined) body.show_pronouns = fields.showPronouns;
      if (fields.dobVisible !== undefined) body.dob_visible = fields.dobVisible;
      if (fields.phone !== undefined) body.phone = fields.phone;
      if (fields.dateOfBirth !== undefined) body.date_of_birth = fields.dateOfBirth;
      const response = await apiClient.put('/auth/profile', body);
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to update profile';
    }
  },

  uploadAvatar: async (uri) => {
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
      formData.append('avatar', { uri, name: filename, type });
      const response = await apiClient.post('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to upload avatar';
    }
  },

  changePassword: async (currentPassword, newPassword, confirmPassword) => {
    try {
      const response = await apiClient.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to change password';
    }
  },

  deleteAccount: async (password) => {
    try {
      // Explicit Bearer — do not rely only on interceptor (delete must never send without JWT).
      const { getAuthToken } = await import('./client');
      const token = await getAuthToken();
      if (!token) {
        throw 'Your session expired. Sign in again, then delete your account.';
      }
      const response = await apiClient.post(
        '/auth/delete-account',
        { password },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          skipLogout: true,
        },
      );
      return response.data;
    } catch (error) {
      const msg = error?.response?.data?.error || error?.message || error;
      throw typeof msg === 'string' ? msg : 'Failed to delete account';
    }
  },

  getFollowing: async (page = 1) => {
    try {
      const response = await apiClient.get('/my/following', { params: { page } });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch following';
    }
  },

  checkUsername: async (username) => {
    try {
      const response = await apiClient.get('/auth/check-username', { params: { username } });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to check username';
    }
  },

  getUpcomingSchedule: async (page = 1) => {
    try {
      const response = await apiClient.get('/schedule/upcoming', { params: { page } });
      return response.data;
    } catch (error) {
      throw error.response?.data?.error || 'Failed to fetch schedule';
    }
  },
};

export default authApi;
