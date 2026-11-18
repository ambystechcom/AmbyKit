/**
 * Fleet view design tokens (feature 029), mirroring specs/029-fleet-control-room/design-tokens.json with every
 * `{tier.path}` reference resolved against the merged 014 + 017 + 029 tree. Same shapes as `TOKENS` (014): colors
 * are `{ truecolor: { dark, light }, ansi16 }`, glyphs are `{ u, a }`. test/ui/fleet-tokens.test.ts keeps this file
 * in sync with the JSON. Nerd mode reuses the Unicode glyph (signed-off decision, ui.md).
 */
export const FLEET_TOKENS = {
  "glyph": {
    "fleet-working": {
      "u": "▶",
      "a": "[>]"
    },
    "fleet-waiting": {
      "u": "◷",
      "a": "[~]"
    },
    "fleet-blocked": {
      "u": "⊘",
      "a": "[x]"
    },
    "fleet-paused": {
      "u": "‖",
      "a": "[|]"
    },
    "fleet-done": {
      "u": "✓",
      "a": "[v]"
    },
    "fleet-unreported": {
      "u": "·",
      "a": "[.]"
    },
    "fleet-unknown": {
      "u": "?",
      "a": "[?]"
    },
    "fleet-stalled": {
      "u": "⚠",
      "a": "[!]"
    }
  },
  "word": {
    "working": "working",
    "waiting": "waiting",
    "blocked": "blocked",
    "paused": "paused",
    "done": "done",
    "unreported": "unreported",
    "unknown": "unknown",
    "stalled": "STALLED",
    "needs-decision": "NEEDS A DECISION",
    "gate-awaiting": "awaiting approval"
  },
  "text": {
    "directive-none": "—",
    "directive-none-ascii": "-",
    "directive-pending": "pending",
    "directive-pause-requested": "pause requested",
    "directive-paused": "paused",
    "directive-obeyed": "obeyed"
  },
  "space": {
    "fleet-lane-col": 9,
    "fleet-assistant-col": 12,
    "fleet-state-col": 12,
    "fleet-quiet-col": 6,
    "fleet-narrow-max": 60,
    "fleet-confirm-width": 46
  },
  "limit": {
    "fleet-rows-min": 4
  },
  "semantic": {
    "symbol": {
      "fleet-working": {
        "u": "▶",
        "a": "[>]"
      },
      "fleet-waiting": {
        "u": "◷",
        "a": "[~]"
      },
      "fleet-blocked": {
        "u": "⊘",
        "a": "[x]"
      },
      "fleet-paused": {
        "u": "‖",
        "a": "[|]"
      },
      "fleet-done": {
        "u": "✓",
        "a": "[v]"
      },
      "fleet-unreported": {
        "u": "·",
        "a": "[.]"
      },
      "fleet-unknown": {
        "u": "?",
        "a": "[?]"
      },
      "fleet-stalled": {
        "u": "⚠",
        "a": "[!]"
      }
    },
    "color": {
      "fleet-working": {
        "truecolor": {
          "dark": "#a58bff",
          "light": "#6f50d1"
        },
        "ansi16": "33"
      },
      "fleet-waiting": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "fleet-blocked": {
        "truecolor": {
          "dark": "#ff5c5c",
          "light": "#c62828"
        },
        "ansi16": "31"
      },
      "fleet-paused": {
        "truecolor": {
          "dark": "#f5b400",
          "light": "#9a6700"
        },
        "ansi16": "33"
      },
      "fleet-done": {
        "truecolor": {
          "dark": "#00c9ff",
          "light": "#00799a"
        },
        "ansi16": "32"
      },
      "fleet-unreported": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "fleet-unknown": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "fleet-stalled": {
        "truecolor": {
          "dark": "#ff5c5c",
          "light": "#c62828"
        },
        "ansi16": "31"
      }
    }
  },
  "component": {
    "fleet-header": {
      "fg": {
        "truecolor": {
          "dark": "#ff4db7",
          "light": "#c21489"
        },
        "ansi16": "35"
      },
      "needs-decision": {
        "fg": {
          "truecolor": {
            "dark": "#f5b400",
            "light": "#9a6700"
          },
          "ansi16": "33"
        },
        "weight": "1",
        "text": "NEEDS A DECISION"
      },
      "more-runs-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      }
    },
    "fleet-lane": {
      "state": {
        "working": {
          "glyph": {
            "u": "▶",
            "a": "[>]"
          },
          "nerd": {
            "u": "▶",
            "a": "[>]"
          },
          "word": "working",
          "fg": {
            "truecolor": {
              "dark": "#a58bff",
              "light": "#6f50d1"
            },
            "ansi16": "33"
          }
        },
        "waiting": {
          "glyph": {
            "u": "◷",
            "a": "[~]"
          },
          "nerd": {
            "u": "◷",
            "a": "[~]"
          },
          "word": "waiting",
          "fg": {
            "truecolor": {
              "dark": "#8a93a9",
              "light": "#67728e"
            },
            "ansi16": "2"
          }
        },
        "blocked": {
          "glyph": {
            "u": "⊘",
            "a": "[x]"
          },
          "nerd": {
            "u": "⊘",
            "a": "[x]"
          },
          "word": "blocked",
          "fg": {
            "truecolor": {
              "dark": "#ff5c5c",
              "light": "#c62828"
            },
            "ansi16": "31"
          }
        },
        "paused": {
          "glyph": {
            "u": "‖",
            "a": "[|]"
          },
          "nerd": {
            "u": "‖",
            "a": "[|]"
          },
          "word": "paused",
          "fg": {
            "truecolor": {
              "dark": "#f5b400",
              "light": "#9a6700"
            },
            "ansi16": "33"
          }
        },
        "done": {
          "glyph": {
            "u": "✓",
            "a": "[v]"
          },
          "nerd": {
            "u": "✓",
            "a": "[v]"
          },
          "word": "done",
          "fg": {
            "truecolor": {
              "dark": "#00c9ff",
              "light": "#00799a"
            },
            "ansi16": "32"
          }
        },
        "unreported": {
          "glyph": {
            "u": "·",
            "a": "[.]"
          },
          "nerd": {
            "u": "·",
            "a": "[.]"
          },
          "word": "unreported",
          "fg": {
            "truecolor": {
              "dark": "#8a93a9",
              "light": "#67728e"
            },
            "ansi16": "2"
          }
        },
        "unknown": {
          "glyph": {
            "u": "?",
            "a": "[?]"
          },
          "nerd": {
            "u": "?",
            "a": "[?]"
          },
          "word": "unknown",
          "fg": {
            "truecolor": {
              "dark": "#8a93a9",
              "light": "#67728e"
            },
            "ansi16": "2"
          }
        }
      },
      "stalled": {
        "glyph": {
          "u": "⚠",
          "a": "[!]"
        },
        "text": "STALLED",
        "fg": {
          "truecolor": {
            "dark": "#ff5c5c",
            "light": "#c62828"
          },
          "ansi16": "31"
        },
        "weight": "1"
      },
      "quiet-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "selected": {
        "cursor": {
          "u": "▸",
          "a": ">"
        },
        "weight": "1"
      }
    },
    "fleet-directive": {
      "none": "—",
      "none-ascii": "-",
      "pending": "pending",
      "pause-requested": "pause requested",
      "paused": "paused",
      "obeyed": "obeyed",
      "fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      }
    },
    "fleet-gate": {
      "glyph": {
        "u": "→",
        "a": "[>]"
      },
      "text": "awaiting approval",
      "pending": {
        "fg": {
          "truecolor": {
            "dark": "#f5b400",
            "light": "#9a6700"
          },
          "ansi16": "33"
        }
      }
    },
    "fleet-confirm": {
      "border": {
        "u": "━",
        "a": "="
      },
      "title-fg": {
        "truecolor": {
          "dark": "#f5b400",
          "light": "#9a6700"
        },
        "ansi16": "33"
      },
      "width": 46
    },
    "fleet-layout": {
      "narrow-max": 60,
      "rows-min": 4
    }
  }
};
