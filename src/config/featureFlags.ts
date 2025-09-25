interface ImportMetaEnvLike {
  VITE_FEATURE_COSTING_MODULE?: string;
  VITE_COSTING_BACKEND?: string;
}

type EnvSource = ImportMeta & { env: ImportMetaEnvLike };

const getEnv = (): ImportMetaEnvLike => {
  if (typeof import.meta !== 'undefined' && (import.meta as EnvSource)?.env) {
    return (import.meta as EnvSource).env;
  }
  return {};
};

const env = getEnv();

const parseBoolean = (value: string | boolean | undefined): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    return lowered === 'true' || lowered === '1' || lowered === 'yes';
  }
  return false;
};

const resolveCostingModuleFlag = (): boolean => {
  const raw = env.VITE_FEATURE_COSTING_MODULE;
  if (typeof raw === 'undefined' || raw === null) {
    return true;
  }
  return parseBoolean(raw);
};

export const featureFlags = {
  costingModule: resolveCostingModuleFlag(),
} as const;

export type FeatureFlags = typeof featureFlags;
