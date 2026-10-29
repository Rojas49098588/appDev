// Copy and choices for the "camera / photo library access unavailable" notice.
// Pure: no React Native imports, so it runs under Node tests.

export type PhotoSource = 'camera' | 'library';

// Why a photo couldn't be taken or picked. canAskAgain is false once the person
// has said "Don't allow": the phone then won't show the permission popup again,
// so the only way back is the app's page in Settings.
export type PermissionBlock = { source: PhotoSource; canAskAgain: boolean };

export type NoticeCopy = {
  title: string;
  body: string;
  button: string;
  learnMore: string[];
};

export function noticeCopy(block: PermissionBlock, photoOptional: boolean): NoticeCopy {
  const camera = block.source === 'camera';
  const thing = camera ? 'Camera' : 'Photo library';
  const setting = camera ? 'Camera' : 'Photos';
  const learnMore = [
    'Mustang Closet only uses photos for uniform damage reports and combo pictures.',
    `To turn access on: open Settings, find Mustang Closet (or Expo Go while testing), and allow ${setting}.`,
  ];
  if (photoOptional) learnMore.push('A photo is optional. You can still send this without one.');
  return {
    title: `${thing} access unavailable`,
    body: camera
      ? 'Mustang Closet needs your camera to take uniform photos.'
      : 'Mustang Closet needs your photo library to choose uniform photos.',
    button: block.canAskAgain ? `Try ${camera ? 'camera' : 'photo library'} access again` : 'Open Settings',
    learnMore,
  };
}
