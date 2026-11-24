/** SDK29. Include this declaration for the signed Android HTML entry. */
import type { AttendanceCheckin, ScriptImage } from "./types.js";

export type PageRecordValue =
  | null | boolean | number | string
  | PageRecordValue[]
  | { [name: string]: PageRecordValue };

export interface PackagePage {
  storage: {
    entry(dataset: string, key: string): Promise<{ value: PageRecordValue; revision: string }>;
    write(dataset: string, key: string, revision: string, value: PageRecordValue): Promise<null>;
    remove(dataset: string, key: string, revision: string): Promise<null>;
  };
  /** Invokes a declared same-package shareable read, without interactive input. */
  query(capability: string, params?: Record<string, PageRecordValue>): Promise<unknown>;
  /** Call synchronously from a user gesture; each call admits one operation. */
  checkin(pageInput?: string): Promise<AttendanceCheckin>;
  scanQRCode(): Promise<{ text: string; format: "qrCode" } | null>;
  capturePhoto(): Promise<ScriptImage | null>;
}

declare global {
  interface Window { readonly eleconPage: PackagePage; }
}
