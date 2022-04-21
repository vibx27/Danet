export function removeTrailingSlash(path: string) {
  if (path[path.length - 1] === "/") {
    path = path.substring(0, path.length - 1);
  }
  return path;
}
