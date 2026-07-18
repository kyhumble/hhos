/** Minimal process.env typing for EXPO_PUBLIC_* without full @types/node. */
declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};
