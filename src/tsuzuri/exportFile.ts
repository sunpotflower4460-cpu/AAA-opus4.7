import { Capacitor, registerPlugin } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { dataWriteAllowed } from "../lib/dataEpoch";
import { newId } from "./model";
import { EXPORT_DIRECTORY } from "./nativeFiles";

const bridge = registerPlugin<{ shareFile(options: { path: string }): Promise<{ completed: boolean }> }>("ZanshinTsuzuri");
let active = Promise.resolve();
const objectUrls = new Set<string>();

export function drainExports() {
  return active.then(() => {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.clear();
  });
}

export function fileBlob(bytes: Uint8Array<ArrayBufferLike>, type: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}

export async function offerFile(file: Blob, name: string, epoch: string | null) {
  if (!dataWriteAllowed(epoch)) throw new Error("exportFailed");
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(file);
    objectUrls.add(url);
    const link = document.createElement("a");
    link.download = name;
    link.href = url;
    link.click();
    window.setTimeout(() => {
      if (objectUrls.delete(url)) URL.revokeObjectURL(url);
    }, 30_000);
    return "downloadOffered" as const;
  }
  const operation = active.then(async () => {
    if (!dataWriteAllowed(epoch)) throw new Error("exportFailed");
    const folder = `${EXPORT_DIRECTORY}/${newId()}`;
    const path = `${folder}/${name}`;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let content = "";
      for (let i = 0; i < bytes.length; i += 8192) content += String.fromCharCode(...bytes.subarray(i, i + 8192));
      if (!dataWriteAllowed(epoch)) throw new Error("exportFailed");
      await Filesystem.writeFile({ path, data: btoa(content), directory: Directory.Cache, recursive: true });
      if (!dataWriteAllowed(epoch)) throw new Error("exportFailed");
      const result = await bridge.shareFile({ path });
      return result.completed ? "shareFinished" as const : "shareClosed" as const;
    } finally {
      await Filesystem.rmdir({ path: folder, directory: Directory.Cache, recursive: true }).catch(() => {});
    }
  });
  active = operation.then(() => {}, () => {});
  return operation;
}
