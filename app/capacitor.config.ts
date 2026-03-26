import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.coconot.app',
  appName: 'CocoNot',
  webDir: '.web-dist',
  ios: {
    backgroundColor: '#00000000',
  },
  android: {
    backgroundColor: '#00000000',
  },
  // Uncomment for live reload during development:
  // server: {
  //   url: 'http://YOUR_LAN_IP:5173',
  //   cleartext: true,
  // },
};

export default config;
