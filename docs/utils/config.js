export const getConfigUrl = (filename = 'config.json') => {
  const basePath = window.location.pathname.endsWith('/')
    ? window.location.pathname
    : `${window.location.pathname}/`;
  return new URL(filename, `${window.location.origin}${basePath}`).toString();
};
