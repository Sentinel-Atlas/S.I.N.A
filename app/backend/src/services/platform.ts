import os from 'os';

export type RuntimePlatformId = 'linux' | 'wsl2' | 'windows' | 'macos' | 'unsupported';

export interface RuntimePlatform {
  id: RuntimePlatformId;
  label: string;
  is_wsl2: boolean;
  support_tier: 'primary' | 'supported' | 'future' | 'unsupported';
  supported_now: boolean;
}

export function detectRuntimePlatform(): RuntimePlatform {
  const nodePlatform = os.platform();
  const release = os.release().toLowerCase();
  const wslEnv = process.env.WSL_INTEROP || process.env.WSL_DISTRO_NAME;
  const isWsl = nodePlatform === 'linux' && (Boolean(wslEnv) || release.includes('microsoft'));

  if (isWsl) {
    return {
      id: 'wsl2',
      label: 'Windows via WSL2 Ubuntu',
      is_wsl2: true,
      support_tier: 'supported',
      supported_now: true,
    };
  }

  if (nodePlatform === 'linux') {
    return {
      id: 'linux',
      label: 'Linux native',
      is_wsl2: false,
      support_tier: 'primary',
      supported_now: true,
    };
  }

  if (nodePlatform === 'win32') {
    return {
      id: 'windows',
      label: 'Windows native (future path)',
      is_wsl2: false,
      support_tier: 'future',
      supported_now: false,
    };
  }

  if (nodePlatform === 'darwin') {
    return {
      id: 'macos',
      label: 'macOS (not yet supported)',
      is_wsl2: false,
      support_tier: 'unsupported',
      supported_now: false,
    };
  }

  return {
    id: 'unsupported',
    label: `${nodePlatform} (not yet supported)`,
    is_wsl2: false,
    support_tier: 'unsupported',
    supported_now: false,
  };
}
