/**
 * Dashboard design tokens (feature 014), mirroring specs/014-enhanced-dashboard/design-tokens.json
 * with every `{tier.path}` reference resolved. Colors are `{ truecolor: { dark, light }, ansi16 }`
 * where each value is a hex color or an SGR parameter; glyphs are `{ u, a }` pairs picked by
 * `Capabilities.unicode`. test/ui/dashboard-tokens.test.ts keeps this file in sync with the JSON.
 */
export const TOKENS = {
  "glyph": {
    "tick": {
      "u": "✓",
      "a": "[ok]"
    },
    "cross": {
      "u": "✗",
      "a": "[x]"
    },
    "warn": {
      "u": "⚠",
      "a": "[!]"
    },
    "partial": {
      "u": "◐",
      "a": "[~]"
    },
    "todo": {
      "u": "○",
      "a": "[ ]"
    },
    "dash": {
      "u": "–",
      "a": "[.]"
    },
    "wait": {
      "u": "→",
      "a": "[>]"
    },
    "other": {
      "u": "?",
      "a": "[?]"
    },
    "cursor": {
      "u": "▸",
      "a": ">"
    },
    "brand": {
      "u": "◆",
      "a": "#"
    },
    "breadcrumb": {
      "u": "›",
      "a": ">"
    },
    "rule-heavy": {
      "u": "━",
      "a": "="
    },
    "bar-fill": {
      "u": "█",
      "a": "#"
    },
    "bar-empty": {
      "u": "░",
      "a": "-"
    },
    "bar-eighths": {
      "u": [
        "",
        "▏",
        "▎",
        "▍",
        "▌",
        "▋",
        "▊",
        "▉"
      ],
      "a": [
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        ""
      ]
    },
    "fill-done": {
      "u": "█",
      "a": "#"
    },
    "fill-progress": {
      "u": "▓",
      "a": "="
    },
    "fill-ready": {
      "u": "▒",
      "a": "+"
    },
    "fill-draft": {
      "u": "░",
      "a": "-"
    },
    "fill-blocked": {
      "u": "▚",
      "a": "!"
    },
    "fill-deferred": {
      "u": "·",
      "a": "."
    },
    "fill-other": {
      "u": ":",
      "a": ":"
    },
    "not-planned": {
      "u": "╌",
      "a": "-"
    },
    "box-tl": {
      "u": "╭",
      "a": "+"
    },
    "box-tr": {
      "u": "╮",
      "a": "+"
    },
    "box-bl": {
      "u": "╰",
      "a": "+"
    },
    "box-br": {
      "u": "╯",
      "a": "+"
    },
    "box-h": {
      "u": "─",
      "a": "-"
    },
    "box-v": {
      "u": "│",
      "a": "|"
    },
    "box-focus-tl": {
      "u": "┏",
      "a": "#"
    },
    "box-focus-tr": {
      "u": "┓",
      "a": "#"
    },
    "box-focus-bl": {
      "u": "┗",
      "a": "#"
    },
    "box-focus-br": {
      "u": "┛",
      "a": "#"
    },
    "box-focus-h": {
      "u": "━",
      "a": "="
    },
    "box-focus-v": {
      "u": "┃",
      "a": "#"
    },
    "elision": {
      "u": "⋮",
      "a": ":"
    },
    "empty": {
      "u": "—",
      "a": "-"
    },
    "none": {
      "u": "·",
      "a": "."
    },
    "bar-done": {
      "u": "░",
      "a": ":"
    },
    "axis-tick": {
      "u": "┤",
      "a": "|"
    },
    "axis-v": {
      "u": "│",
      "a": "|"
    },
    "axis-h": {
      "u": "─",
      "a": "-"
    },
    "axis-corner": {
      "u": "└",
      "a": "+"
    }
  },
  "space": {
    "col-1": 1,
    "col-2": 2,
    "card-gap": 1,
    "panel-gap": 1,
    "card-min-width": 17,
    "story-bar-width": 10,
    "wide-min": 100,
    "min-columns": 60,
    "wide-feature-bar": 30,
    "narrow-feature-bar": 16,
    "name-wide": 30,
    "name-narrow": 24,
    "burndown-height-wide": 6,
    "burndown-height-narrow": 5,
    "burndown-bar-max": 8
  },
  "limit": {
    "up-next-max": 5,
    "attention-max": 8,
    "burndown-min-points": 2
  },
  "semantic": {
    "color": {
      "accent": {
        "truecolor": {
          "dark": "#ff4db7",
          "light": "#c21489"
        },
        "ansi16": "35"
      },
      "accent-strong": {
        "truecolor": {
          "dark": "#f20c95",
          "light": "#f20c95"
        },
        "ansi16": "35"
      },
      "state-done": {
        "truecolor": {
          "dark": "#00c9ff",
          "light": "#00799a"
        },
        "ansi16": "32"
      },
      "state-in-progress": {
        "truecolor": {
          "dark": "#a58bff",
          "light": "#6f50d1"
        },
        "ansi16": "33"
      },
      "state-ready": {
        "truecolor": {
          "dark": "#0391fe",
          "light": "#316aea"
        },
        "ansi16": "36"
      },
      "state-blocked": {
        "truecolor": {
          "dark": "#ff5c5c",
          "light": "#c62828"
        },
        "ansi16": "31"
      },
      "warn": {
        "truecolor": {
          "dark": "#f5b400",
          "light": "#9a6700"
        },
        "ansi16": "33"
      },
      "text": {
        "truecolor": {
          "dark": "39",
          "light": "39"
        },
        "ansi16": "39"
      },
      "muted": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "frame": {
        "truecolor": {
          "dark": "#33405f",
          "light": "#8a93a9"
        },
        "ansi16": "90"
      },
      "state-draft": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "state-deferred": {
        "truecolor": {
          "dark": "#33405f",
          "light": "#8a93a9"
        },
        "ansi16": "90"
      }
    },
    "symbol": {
      "done": {
        "u": "✓",
        "a": "[ok]"
      },
      "in-progress": {
        "u": "◐",
        "a": "[~]"
      },
      "ready": {
        "u": "○",
        "a": "[ ]"
      },
      "draft": {
        "u": "○",
        "a": "[ ]"
      },
      "blocked": {
        "u": "✗",
        "a": "[x]"
      },
      "deferred": {
        "u": "–",
        "a": "[.]"
      },
      "other": {
        "u": "?",
        "a": "[?]"
      },
      "waiting": {
        "u": "→",
        "a": "[>]"
      },
      "graph-problem": {
        "u": "⚠",
        "a": "[!]"
      },
      "cursor": {
        "u": "▸",
        "a": ">"
      }
    },
    "weight": {
      "heading": "1",
      "selected": "1"
    },
    "space": {
      "gutter": 2,
      "indent": 2,
      "panel-gap": 1
    }
  },
  "component": {
    "header": {
      "brand": {
        "u": "◆",
        "a": "#"
      },
      "brand-fg": {
        "truecolor": {
          "dark": "#f20c95",
          "light": "#f20c95"
        },
        "ansi16": "35"
      },
      "title-weight": "1",
      "breadcrumb": {
        "u": "›",
        "a": ">"
      },
      "meta-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "rule": {
        "u": "━",
        "a": "="
      },
      "rule-fg": {
        "truecolor": {
          "dark": "#f20c95",
          "light": "#f20c95"
        },
        "ansi16": "35"
      }
    },
    "layout": {
      "wide-min": 100,
      "min-columns": 60,
      "card-gap": 1,
      "panel-gap": 1,
      "card-min-width": 17
    },
    "panel": {
      "frame-fg": {
        "truecolor": {
          "dark": "#33405f",
          "light": "#8a93a9"
        },
        "ansi16": "90"
      },
      "title-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "corner-tl": {
        "u": "╭",
        "a": "+"
      },
      "corner-tr": {
        "u": "╮",
        "a": "+"
      },
      "corner-bl": {
        "u": "╰",
        "a": "+"
      },
      "corner-br": {
        "u": "╯",
        "a": "+"
      },
      "edge-h": {
        "u": "─",
        "a": "-"
      },
      "edge-v": {
        "u": "│",
        "a": "|"
      },
      "focused": {
        "frame-fg": {
          "truecolor": {
            "dark": "#f20c95",
            "light": "#f20c95"
          },
          "ansi16": "35"
        },
        "title-fg": {
          "truecolor": {
            "dark": "#ff4db7",
            "light": "#c21489"
          },
          "ansi16": "35"
        },
        "corner-tl": {
          "u": "┏",
          "a": "#"
        },
        "corner-tr": {
          "u": "┓",
          "a": "#"
        },
        "corner-bl": {
          "u": "┗",
          "a": "#"
        },
        "corner-br": {
          "u": "┛",
          "a": "#"
        },
        "edge-h": {
          "u": "━",
          "a": "="
        },
        "edge-v": {
          "u": "┃",
          "a": "#"
        }
      }
    },
    "summary-card": {
      "value-fg": {
        "truecolor": {
          "dark": "39",
          "light": "39"
        },
        "ansi16": "39"
      },
      "value-weight": "1",
      "caption-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "empty": {
        "u": "—",
        "a": "-"
      }
    },
    "completion-bar": {
      "fill": {
        "u": "█",
        "a": "#"
      },
      "empty": {
        "u": "░",
        "a": "-"
      },
      "eighths": {
        "u": [
          "",
          "▏",
          "▎",
          "▍",
          "▌",
          "▋",
          "▊",
          "▉"
        ],
        "a": [
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          ""
        ]
      },
      "fg-complete": {
        "truecolor": {
          "dark": "#00c9ff",
          "light": "#00799a"
        },
        "ansi16": "32"
      },
      "fg-partial": {
        "truecolor": {
          "dark": "#f20c95",
          "light": "#f20c95"
        },
        "ansi16": "35"
      },
      "fg-empty": {
        "truecolor": {
          "dark": "#33405f",
          "light": "#8a93a9"
        },
        "ansi16": "90"
      },
      "not-planned": {
        "u": "╌",
        "a": "-"
      },
      "not-planned-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      }
    },
    "status-chart": {
      "done": {
        "fg": {
          "truecolor": {
            "dark": "#00c9ff",
            "light": "#00799a"
          },
          "ansi16": "32"
        },
        "symbol": {
          "u": "✓",
          "a": "[ok]"
        },
        "fill": {
          "u": "█",
          "a": "#"
        }
      },
      "in-progress": {
        "fg": {
          "truecolor": {
            "dark": "#a58bff",
            "light": "#6f50d1"
          },
          "ansi16": "33"
        },
        "symbol": {
          "u": "◐",
          "a": "[~]"
        },
        "fill": {
          "u": "▓",
          "a": "="
        }
      },
      "ready": {
        "fg": {
          "truecolor": {
            "dark": "#0391fe",
            "light": "#316aea"
          },
          "ansi16": "36"
        },
        "symbol": {
          "u": "○",
          "a": "[ ]"
        },
        "fill": {
          "u": "▒",
          "a": "+"
        }
      },
      "draft": {
        "fg": {
          "truecolor": {
            "dark": "#8a93a9",
            "light": "#67728e"
          },
          "ansi16": "2"
        },
        "symbol": {
          "u": "○",
          "a": "[ ]"
        },
        "fill": {
          "u": "░",
          "a": "-"
        }
      },
      "blocked": {
        "fg": {
          "truecolor": {
            "dark": "#ff5c5c",
            "light": "#c62828"
          },
          "ansi16": "31"
        },
        "symbol": {
          "u": "✗",
          "a": "[x]"
        },
        "fill": {
          "u": "▚",
          "a": "!"
        }
      },
      "deferred": {
        "fg": {
          "truecolor": {
            "dark": "#33405f",
            "light": "#8a93a9"
          },
          "ansi16": "90"
        },
        "symbol": {
          "u": "–",
          "a": "[.]"
        },
        "fill": {
          "u": "·",
          "a": "."
        }
      },
      "other": {
        "fg": {
          "truecolor": {
            "dark": "#8a93a9",
            "light": "#67728e"
          },
          "ansi16": "2"
        },
        "symbol": {
          "u": "?",
          "a": "[?]"
        },
        "fill": {
          "u": ":",
          "a": ":"
        }
      },
      "legend-fg": {
        "truecolor": {
          "dark": "39",
          "light": "39"
        },
        "ansi16": "39"
      },
      "share-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      }
    },
    "attention-item": {
      "blocked": {
        "symbol": {
          "u": "✗",
          "a": "[x]"
        },
        "fg": {
          "truecolor": {
            "dark": "#ff5c5c",
            "light": "#c62828"
          },
          "ansi16": "31"
        }
      },
      "waiting": {
        "symbol": {
          "u": "→",
          "a": "[>]"
        },
        "fg": {
          "truecolor": {
            "dark": "#a58bff",
            "light": "#6f50d1"
          },
          "ansi16": "33"
        }
      },
      "graph-problem": {
        "symbol": {
          "u": "⚠",
          "a": "[!]"
        },
        "fg": {
          "truecolor": {
            "dark": "#f5b400",
            "light": "#9a6700"
          },
          "ansi16": "33"
        }
      },
      "id-fg": {
        "truecolor": {
          "dark": "39",
          "light": "39"
        },
        "ansi16": "39"
      },
      "reason-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "max-items": 8
    },
    "up-next-item": {
      "task-id-fg": {
        "truecolor": {
          "dark": "#ff4db7",
          "light": "#c21489"
        },
        "ansi16": "35"
      },
      "story-id-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "text-fg": {
        "truecolor": {
          "dark": "39",
          "light": "39"
        },
        "ansi16": "39"
      },
      "max-items": 5
    },
    "feature-row": {
      "ref-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "name-fg": {
        "truecolor": {
          "dark": "39",
          "light": "39"
        },
        "ansi16": "39"
      },
      "phase-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "phase-done-fg": {
        "truecolor": {
          "dark": "#00c9ff",
          "light": "#00799a"
        },
        "ansi16": "32"
      },
      "clarif-fg": {
        "truecolor": {
          "dark": "#f5b400",
          "light": "#9a6700"
        },
        "ansi16": "33"
      },
      "clarif-none": {
        "u": "·",
        "a": "."
      },
      "bar-width-wide": 30,
      "bar-width-narrow": 16,
      "name-width-wide": 30,
      "name-width-narrow": 24
    },
    "burndown": {
      "remaining-fill": {
        "u": "█",
        "a": "#"
      },
      "remaining-fg": {
        "truecolor": {
          "dark": "#f20c95",
          "light": "#f20c95"
        },
        "ansi16": "35"
      },
      "done-fill": {
        "u": "░",
        "a": ":"
      },
      "done-fg": {
        "truecolor": {
          "dark": "#00c9ff",
          "light": "#00799a"
        },
        "ansi16": "32"
      },
      "axis-tick": {
        "u": "┤",
        "a": "|"
      },
      "axis-v": {
        "u": "│",
        "a": "|"
      },
      "axis-h": {
        "u": "─",
        "a": "-"
      },
      "axis-corner": {
        "u": "└",
        "a": "+"
      },
      "axis-fg": {
        "truecolor": {
          "dark": "#33405f",
          "light": "#8a93a9"
        },
        "ansi16": "90"
      },
      "label-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "height-wide": 6,
      "height-narrow": 5,
      "bar-width-max": 8,
      "min-points": 2,
      "empty": {
        "u": "—",
        "a": "-"
      },
      "empty-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      }
    },
    "artifact-item": {
      "present": {
        "symbol": {
          "u": "✓",
          "a": "[ok]"
        },
        "fg": {
          "truecolor": {
            "dark": "#00c9ff",
            "light": "#00799a"
          },
          "ansi16": "32"
        }
      },
      "partial": {
        "symbol": {
          "u": "◐",
          "a": "[~]"
        },
        "fg": {
          "truecolor": {
            "dark": "#a58bff",
            "light": "#6f50d1"
          },
          "ansi16": "33"
        }
      },
      "pending": {
        "symbol": {
          "u": "○",
          "a": "[ ]"
        },
        "fg": {
          "truecolor": {
            "dark": "#8a93a9",
            "light": "#67728e"
          },
          "ansi16": "2"
        }
      }
    },
    "story-row": {
      "bar-width": 10,
      "waiting-fg": {
        "truecolor": {
          "dark": "#a58bff",
          "light": "#6f50d1"
        },
        "ansi16": "33"
      }
    },
    "row": {
      "cursor": {
        "u": "▸",
        "a": ">"
      },
      "cursor-fg": {
        "truecolor": {
          "dark": "#ff4db7",
          "light": "#c21489"
        },
        "ansi16": "35"
      },
      "selected-weight": "1"
    },
    "elision": {
      "glyph": {
        "u": "⋮",
        "a": ":"
      },
      "fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      }
    },
    "key-hints": {
      "key-fg": {
        "truecolor": {
          "dark": "39",
          "light": "39"
        },
        "ansi16": "39"
      },
      "label-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      }
    },
    "hint-line": {
      "fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "command-fg": {
        "truecolor": {
          "dark": "#ff4db7",
          "light": "#c21489"
        },
        "ansi16": "35"
      }
    },
    "notice": {
      "symbol": {
        "u": "⚠",
        "a": "[!]"
      },
      "fg": {
        "truecolor": {
          "dark": "#f5b400",
          "light": "#9a6700"
        },
        "ansi16": "33"
      }
    }
  }
} as const;

export type ColorToken = (typeof TOKENS)["semantic"]["color"][keyof (typeof TOKENS)["semantic"]["color"]];
