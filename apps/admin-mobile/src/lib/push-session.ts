let activePushToken: string | null = null;

export const getActivePushToken = () => activePushToken;

export const setActivePushToken = (token: string | null) => {
  activePushToken = token && token.trim() ? token.trim() : null;
};
