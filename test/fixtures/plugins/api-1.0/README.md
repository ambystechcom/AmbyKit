Plugins written for the 1.0 plugin API (feature 033, US-6): an object form, a factory form and one that reached into an
internal module. They declare `"pluginApi": "^1"` and use only names the 1.0 API had. `test/plugins/legacy-plugin.test.ts` loads them
with the 2.x core.
