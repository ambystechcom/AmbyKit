/**
 * Live-dashboard design tokens (feature 017), mirroring specs/017-live-dashboard/design-tokens.json
 * with every `{tier.path}` reference resolved against the merged 014 + 017 token tree. Same shapes
 * as `TOKENS` (014): colors are `{ truecolor: { dark, light }, ansi16 }`, glyphs are `{ u, a }`.
 * test/ui/dashboard-live-tokens.test.ts keeps this file in sync with the JSON.
 */
export const LIVE_TOKENS = {
  "glyph": {
    "agent-claude": {
      "u": "✸",
      "a": "[CC]"
    },
    "agent-codex": {
      "u": "◎",
      "a": "[CX]"
    },
    "agent-opencode": {
      "u": "◇",
      "a": "[OC]"
    },
    "agent-cursor": {
      "u": "➤",
      "a": "[CU]"
    },
    "agent-copilot": {
      "u": "◉",
      "a": "[CP]"
    },
    "agent-antigravity": {
      "u": "▲",
      "a": "[AG]"
    },
    "agent-generic": {
      "u": "●",
      "a": "[??]"
    },
    "worktree": {
      "u": "⎇",
      "a": "wt"
    },
    "dirty": {
      "u": "●",
      "a": "*"
    },
    "merged": {
      "u": "⊘",
      "a": "-merged"
    },
    "live": {
      "u": "●",
      "a": "live"
    },
    "polling": {
      "u": "◌",
      "a": "poll"
    },
    "active": {
      "u": "●",
      "a": "[*]"
    },
    "idle": {
      "u": "○",
      "a": "[o]"
    },
    "stale": {
      "u": "–",
      "a": "[-]"
    },
    "detected": {
      "u": "~",
      "a": "~"
    },
    "caret": {
      "u": "▏",
      "a": "_"
    }
  },
  "nerd": {
    "worktree": {
      "u": "",
      "a": "wt"
    },
    "claude": {
      "u": "",
      "a": "[CC]"
    },
    "codex": {
      "u": "",
      "a": "[CX]"
    },
    "copilot": {
      "u": "",
      "a": "[CP]"
    },
    "generic": {
      "u": "",
      "a": "[??]"
    }
  },
  "time": {
    "heartbeat-s": 5,
    "debounce-ms": 150,
    "poll-s": 2,
    "active-min": 2,
    "idle-min": 30
  },
  "limit": {
    "worktrees-max-wide": 8,
    "worktrees-max-narrow": 5,
    "notice-max": 3
  },
  "semantic": {
    "color": {
      "agent-claude": {
        "truecolor": {
          "dark": "#e8896b",
          "light": "#a8462a"
        },
        "ansi16": "33"
      },
      "agent-codex": {
        "truecolor": {
          "dark": "#d4d8e0",
          "light": "#3b4252"
        },
        "ansi16": "37"
      },
      "agent-opencode": {
        "truecolor": {
          "dark": "#f5b400",
          "light": "#9a6700"
        },
        "ansi16": "33"
      },
      "agent-cursor": {
        "truecolor": {
          "dark": "#4fd1c5",
          "light": "#0f766e"
        },
        "ansi16": "36"
      },
      "agent-copilot": {
        "truecolor": {
          "dark": "#8fb8ff",
          "light": "#2f5bd3"
        },
        "ansi16": "34"
      },
      "agent-antigravity": {
        "truecolor": {
          "dark": "#7dd36f",
          "light": "#2e7d32"
        },
        "ansi16": "32"
      }
    },
    "symbol": {
      "worktree": {
        "u": "⎇",
        "a": "wt"
      },
      "dirty": {
        "u": "●",
        "a": "*"
      },
      "merged": {
        "u": "⊘",
        "a": "-merged"
      },
      "active": {
        "u": "●",
        "a": "[*]"
      },
      "idle": {
        "u": "○",
        "a": "[o]"
      },
      "stale": {
        "u": "–",
        "a": "[-]"
      }
    },
    "time": {
      "active": 2,
      "idle": 30,
      "heartbeat": 5
    }
  },
  "component": {
    "checkout-tag": {
      "glyph": {
        "u": "⎇",
        "a": "wt"
      },
      "nerd": {
        "u": "",
        "a": "wt"
      },
      "fg": {
        "truecolor": {
          "dark": "#0391fe",
          "light": "#316aea"
        },
        "ansi16": "36"
      },
      "dirty": {
        "glyph": {
          "u": "●",
          "a": "*"
        },
        "fg": {
          "truecolor": {
            "dark": "#f5b400",
            "light": "#9a6700"
          },
          "ansi16": "33"
        }
      },
      "stale": {
        "glyph": {
          "u": "⊘",
          "a": "-merged"
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
    "live": {
      "watching": {
        "glyph": {
          "u": "●",
          "a": "live"
        },
        "fg": {
          "truecolor": {
            "dark": "#00c9ff",
            "light": "#00799a"
          },
          "ansi16": "32"
        }
      },
      "polling": {
        "glyph": {
          "u": "◌",
          "a": "poll"
        },
        "fg": {
          "truecolor": {
            "dark": "#8a93a9",
            "light": "#67728e"
          },
          "ansi16": "2"
        }
      },
      "paused": {
        "glyph": {
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
      "ago-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "changed": {
        "fg": {
          "truecolor": {
            "dark": "#ff4db7",
            "light": "#c21489"
          },
          "ansi16": "35"
        },
        "weight": "1"
      }
    },
    "agent": {
      "claude": {
        "name": "Claude",
        "glyph": {
          "u": "✸",
          "a": "[CC]"
        },
        "nerd": {
          "u": "",
          "a": "[CC]"
        },
        "fg": {
          "truecolor": {
            "dark": "#e8896b",
            "light": "#a8462a"
          },
          "ansi16": "33"
        }
      },
      "claude-vscode": {
        "name": "Claude",
        "glyph": {
          "u": "✸",
          "a": "[CC]"
        },
        "nerd": {
          "u": "",
          "a": "[CC]"
        },
        "fg": {
          "truecolor": {
            "dark": "#e8896b",
            "light": "#a8462a"
          },
          "ansi16": "33"
        }
      },
      "codex": {
        "name": "Codex",
        "glyph": {
          "u": "◎",
          "a": "[CX]"
        },
        "nerd": {
          "u": "",
          "a": "[CX]"
        },
        "fg": {
          "truecolor": {
            "dark": "#d4d8e0",
            "light": "#3b4252"
          },
          "ansi16": "37"
        }
      },
      "opencode": {
        "name": "OpenCode",
        "glyph": {
          "u": "◇",
          "a": "[OC]"
        },
        "nerd": {
          "u": "◇",
          "a": "[OC]"
        },
        "fg": {
          "truecolor": {
            "dark": "#f5b400",
            "light": "#9a6700"
          },
          "ansi16": "33"
        }
      },
      "copilot": {
        "name": "Copilot",
        "glyph": {
          "u": "◉",
          "a": "[CP]"
        },
        "nerd": {
          "u": "",
          "a": "[CP]"
        },
        "fg": {
          "truecolor": {
            "dark": "#8fb8ff",
            "light": "#2f5bd3"
          },
          "ansi16": "34"
        }
      },
      "copilot-cli": {
        "name": "Copilot CLI",
        "glyph": {
          "u": "◉",
          "a": "[CP]"
        },
        "nerd": {
          "u": "",
          "a": "[CP]"
        },
        "fg": {
          "truecolor": {
            "dark": "#8fb8ff",
            "light": "#2f5bd3"
          },
          "ansi16": "34"
        }
      },
      "cursor": {
        "name": "Cursor",
        "glyph": {
          "u": "➤",
          "a": "[CU]"
        },
        "nerd": {
          "u": "➤",
          "a": "[CU]"
        },
        "fg": {
          "truecolor": {
            "dark": "#4fd1c5",
            "light": "#0f766e"
          },
          "ansi16": "36"
        }
      },
      "cursor-cli": {
        "name": "Cursor CLI",
        "glyph": {
          "u": "➤",
          "a": "[CU]"
        },
        "nerd": {
          "u": "➤",
          "a": "[CU]"
        },
        "fg": {
          "truecolor": {
            "dark": "#4fd1c5",
            "light": "#0f766e"
          },
          "ansi16": "36"
        }
      },
      "antigravity": {
        "name": "Antigravity",
        "glyph": {
          "u": "▲",
          "a": "[AG]"
        },
        "nerd": {
          "u": "▲",
          "a": "[AG]"
        },
        "fg": {
          "truecolor": {
            "dark": "#7dd36f",
            "light": "#2e7d32"
          },
          "ansi16": "32"
        }
      },
      "antigravity-cli": {
        "name": "Antigravity CLI",
        "glyph": {
          "u": "▲",
          "a": "[AG]"
        },
        "nerd": {
          "u": "▲",
          "a": "[AG]"
        },
        "fg": {
          "truecolor": {
            "dark": "#7dd36f",
            "light": "#2e7d32"
          },
          "ansi16": "32"
        }
      },
      "generic": {
        "name": "",
        "glyph": {
          "u": "●",
          "a": "[??]"
        },
        "nerd": {
          "u": "",
          "a": "[??]"
        },
        "fg": {
          "truecolor": {
            "dark": "#8a93a9",
            "light": "#67728e"
          },
          "ansi16": "2"
        }
      },
      "detected": {
        "prefix": {
          "u": "~",
          "a": "~"
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
    "presence": {
      "active": {
        "glyph": {
          "u": "●",
          "a": "[*]"
        },
        "fg": {
          "truecolor": {
            "dark": "#00c9ff",
            "light": "#00799a"
          },
          "ansi16": "32"
        }
      },
      "idle": {
        "glyph": {
          "u": "○",
          "a": "[o]"
        },
        "fg": {
          "truecolor": {
            "dark": "#a58bff",
            "light": "#6f50d1"
          },
          "ansi16": "33"
        }
      },
      "stale": {
        "glyph": {
          "u": "–",
          "a": "[-]"
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
    "worktrees-panel": {
      "max-wide": 8,
      "max-narrow": 5
    },
    "overlay": {
      "backdrop": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "frame": {
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
    "input": {
      "label-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "fg": {
        "truecolor": {
          "dark": "39",
          "light": "39"
        },
        "ansi16": "39"
      },
      "caret": {
        "u": "▏",
        "a": "_"
      },
      "frame-fg": {
        "truecolor": {
          "dark": "#f20c95",
          "light": "#f20c95"
        },
        "ansi16": "35"
      }
    },
    "empty-state": {
      "title-fg": {
        "truecolor": {
          "dark": "39",
          "light": "39"
        },
        "ansi16": "39"
      },
      "hint-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      }
    },
    "notice": {
      "max-lines": 3
    }
  }
} as const;
