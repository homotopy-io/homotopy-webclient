//import LZ from "lz-string";
import Pako from "pako";

export function compress(string) {
  //return LZ.compressToBase64(string);
  return btoa(Pako.deflate(string, { to: 'string' }));
}

export function decompress(string) {
  //return LZ.decompressFromBase64(string);
  return Pako.inflate(atob(string), { to: 'string' });
}