import { atom, useAtom } from "jotai";

const selectedAtom = atom<string | null>(null);

export function useMail() {
  return useAtom(selectedAtom);
}
