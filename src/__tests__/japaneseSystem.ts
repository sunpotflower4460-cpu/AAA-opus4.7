// The pre-bilingual regression suite exercises the Japanese UI.
// Multilingual tests set their own system and override preferences.
Object.defineProperty(Navigator.prototype, "languages", {
  configurable: true,
  get: () => ["ja-JP", "en-US"],
});
