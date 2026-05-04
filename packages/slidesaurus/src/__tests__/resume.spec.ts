import { describe, it, expect, beforeEach } from "vitest";

// --- Minimal in-memory localStorage mock ---

function makeStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
  } as Storage;
}

// --- Pure helpers mirroring SlidevPresentation resume logic ---

function storageKey(id: string): string {
  return `slidev-resume-${id}`;
}

function readResumeSlide(storage: Storage, id: string): number | null {
  const stored = storage.getItem(storageKey(id));
  const slide = stored ? parseInt(stored, 10) : NaN;
  return !isNaN(slide) && slide > 1 ? slide : null;
}

function saveResumeSlide(storage: Storage, id: string, hash: string): void {
  const slide = parseInt(hash.replace("#", ""), 10);
  if (!isNaN(slide) && slide > 1) {
    storage.setItem(storageKey(id), String(slide));
  }
}

function clearResumeSlide(storage: Storage, id: string): void {
  storage.removeItem(storageKey(id));
}

// --- Tests ---

describe("resume slide — storage key", () => {
  it("uses slidev-resume-{id} as key", () => {
    expect(storageKey("my-talk")).toBe("slidev-resume-my-talk");
  });
});

describe("resume slide — readResumeSlide", () => {
  let storage: Storage;

  beforeEach(() => { storage = makeStorage(); });

  it("returns null when nothing is stored", () => {
    expect(readResumeSlide(storage, "talk")).toBeNull();
  });

  it("returns the stored slide number when > 1", () => {
    storage.setItem("slidev-resume-talk", "5");
    expect(readResumeSlide(storage, "talk")).toBe(5);
  });

  it("returns null for slide 1 (start of deck — no resume needed)", () => {
    storage.setItem("slidev-resume-talk", "1");
    expect(readResumeSlide(storage, "talk")).toBeNull();
  });

  it("returns null for slide 0", () => {
    storage.setItem("slidev-resume-talk", "0");
    expect(readResumeSlide(storage, "talk")).toBeNull();
  });

  it("returns null for a non-numeric value", () => {
    storage.setItem("slidev-resume-talk", "abc");
    expect(readResumeSlide(storage, "talk")).toBeNull();
  });

  it("returns null for an empty string", () => {
    storage.setItem("slidev-resume-talk", "");
    expect(readResumeSlide(storage, "talk")).toBeNull();
  });

  it("parses large slide numbers correctly", () => {
    storage.setItem("slidev-resume-talk", "42");
    expect(readResumeSlide(storage, "talk")).toBe(42);
  });
});

describe("resume slide — saveResumeSlide", () => {
  let storage: Storage;

  beforeEach(() => { storage = makeStorage(); });

  it("saves slide number from hash string", () => {
    saveResumeSlide(storage, "talk", "#7");
    expect(storage.getItem("slidev-resume-talk")).toBe("7");
  });

  it("does not save slide 1", () => {
    saveResumeSlide(storage, "talk", "#1");
    expect(storage.getItem("slidev-resume-talk")).toBeNull();
  });

  it("does not save NaN hash", () => {
    saveResumeSlide(storage, "talk", "#intro");
    expect(storage.getItem("slidev-resume-talk")).toBeNull();
  });

  it("does not save empty hash", () => {
    saveResumeSlide(storage, "talk", "");
    expect(storage.getItem("slidev-resume-talk")).toBeNull();
  });

  it("does not save slide 0", () => {
    saveResumeSlide(storage, "talk", "#0");
    expect(storage.getItem("slidev-resume-talk")).toBeNull();
  });

  it("overwrites an older value with the new one", () => {
    saveResumeSlide(storage, "talk", "#3");
    saveResumeSlide(storage, "talk", "#9");
    expect(storage.getItem("slidev-resume-talk")).toBe("9");
  });
});

describe("resume slide — clearResumeSlide", () => {
  let storage: Storage;

  beforeEach(() => { storage = makeStorage(); });

  it("removes the stored value", () => {
    storage.setItem("slidev-resume-talk", "4");
    clearResumeSlide(storage, "talk");
    expect(storage.getItem("slidev-resume-talk")).toBeNull();
  });

  it("is a no-op when nothing is stored", () => {
    expect(() => clearResumeSlide(storage, "talk")).not.toThrow();
  });

  it("only clears the targeted presentation, not others", () => {
    storage.setItem("slidev-resume-a", "3");
    storage.setItem("slidev-resume-b", "7");
    clearResumeSlide(storage, "a");
    expect(storage.getItem("slidev-resume-a")).toBeNull();
    expect(storage.getItem("slidev-resume-b")).toBe("7");
  });
});
