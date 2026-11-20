/**
 * Dashboard tab-frame design tokens (feature 032), mirroring specs/032-dashboard-redesign-and-metrics/design-tokens.json
 * with every `{tier.path}` reference resolved against the merged 014 + 017 + 029 + 032 tree. Same shapes as `TOKENS` (014):
 * colors are `{ truecolor: { dark, light }, ansi16 }`, glyphs are `{ u, a }`. test/ui/tab-tokens.test.ts keeps this file in
 * sync with the JSON. Generated once from the signed-off design; edit the JSON first, then update this mirror.
 */
export const TAB_TOKENS = {
  "glyph": {
    "tab-open": {
      "u": "[",
      "a": "["
    },
    "tab-close": {
      "u": "]",
      "a": "]"
    },
    "tab-badge-attention": {
      "u": "●",
      "a": "*"
    },
    "tab-badge-warn": {
      "u": "⚠",
      "a": "[!]"
    },
    "bar-fill": {
      "u": "█",
      "a": "#"
    },
    "bar-empty": {
      "u": "░",
      "a": "."
    },
    "feature-open": {
      "u": "▾",
      "a": "v"
    },
    "feature-closed": {
      "u": "▸",
      "a": ">"
    },
    "trend-improving": {
      "u": "↓",
      "a": "down"
    },
    "trend-worsening": {
      "u": "↑",
      "a": "up"
    },
    "trend-flat": {
      "u": "→",
      "a": "flat"
    },
    "spark": {
      "u": "▁▂▃▄▅▆▇█",
      "a": "_.-="
    }
  },
  "word": {
    "tab-overview": "overview",
    "tab-fleet": "fleet",
    "tab-graph": "graph",
    "tab-quality": "quality",
    "tab-overview-short": "ovw",
    "tab-fleet-short": "flt",
    "tab-graph-short": "gph",
    "tab-quality-short": "qlt",
    "trend-improving": "improving",
    "trend-worsening": "worsening",
    "trend-flat": "flat",
    "metrics-loading": "reading history…",
    "metrics-none-yet": "no completed cycle yet",
    "metrics-skipped": "revisions could not be read and were skipped",
    "metrics-too-little": "Not enough history for metrics yet",
    "metrics-not-a-repo": "Not a git repository, so there is no history to read.",
    "metrics-git-missing": "git is not available, so metrics cannot be computed.",
    "no-match": "Nothing matches",
    "filter-clear": "Press esc to clear."
  },
  "space": {
    "tab-bar-gap": 3,
    "metrics-label-col": 20,
    "metrics-typical-col": 10,
    "metrics-bar-width": 10,
    "metrics-bar-narrow": 0,
    "metrics-top-features": 3,
    "default-columns": 80,
    "trend-threshold-pct": 10
  },
  "limit": {
    "metrics-gap-runs-shown": 5
  },
  "semantic": {
    "symbol": {
      "state-working": {
        "u": "▶",
        "a": "[>]"
      },
      "state-waiting": {
        "u": "◷",
        "a": "[~]"
      },
      "state-blocked": {
        "u": "⊘",
        "a": "[x]"
      },
      "state-paused": {
        "u": "‖",
        "a": "[|]"
      },
      "state-done": {
        "u": "✓",
        "a": "[v]"
      },
      "state-stalled": {
        "u": "⚠",
        "a": "[!]"
      }
    },
    "state": {
      "working": {
        "glyph": {
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
        "word": "done",
        "fg": {
          "truecolor": {
            "dark": "#00c9ff",
            "light": "#00799a"
          },
          "ansi16": "32"
        }
      },
      "stalled": {
        "glyph": {
          "u": "⚠",
          "a": "[!]"
        },
        "word": "STALLED",
        "fg": {
          "truecolor": {
            "dark": "#ff5c5c",
            "light": "#c62828"
          },
          "ansi16": "31"
        },
        "weight": "1"
      }
    }
  },
  "component": {
    "tab-bar": {
      "active": {
        "open": {
          "u": "[",
          "a": "["
        },
        "close": {
          "u": "]",
          "a": "]"
        },
        "fg": {
          "truecolor": {
            "dark": "#f20c95",
            "light": "#f20c95"
          },
          "ansi16": "35"
        },
        "weight": "1"
      },
      "inactive": {
        "fg": {
          "truecolor": {
            "dark": "#8a93a9",
            "light": "#67728e"
          },
          "ansi16": "2"
        }
      },
      "number-fg": {
        "truecolor": {
          "dark": "39",
          "light": "39"
        },
        "ansi16": "39"
      },
      "gap": 3,
      "badge": {
        "attention": {
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
        "warn": {
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
        }
      },
      "narrow": {
        "names": {
          "overview": "ovw",
          "fleet": "flt",
          "graph": "gph",
          "quality": "qlt"
        }
      }
    },
    "tab-body": {
      "loading": {
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
      "error": {
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
      }
    },
    "filter-line": {
      "state-fg": {
        "truecolor": {
          "dark": "#ff4db7",
          "light": "#c21489"
        },
        "ansi16": "35"
      },
      "count-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "match-fg": {
        "truecolor": {
          "dark": "#ff4db7",
          "light": "#c21489"
        },
        "ansi16": "35"
      },
      "no-match-fg": {
        "truecolor": {
          "dark": "#f5b400",
          "light": "#9a6700"
        },
        "ansi16": "33"
      }
    },
    "metrics": {
      "title-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "label-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "value-fg": {
        "truecolor": {
          "dark": "39",
          "light": "39"
        },
        "ansi16": "39"
      },
      "note-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      },
      "bar": {
        "fill": {
          "u": "█",
          "a": "#"
        },
        "empty": {
          "u": "░",
          "a": "."
        },
        "fg": {
          "truecolor": {
            "dark": "#a58bff",
            "light": "#6f50d1"
          },
          "ansi16": "33"
        },
        "width": 10,
        "width-narrow": 0
      },
      "spark": {
        "glyphs": {
          "u": "▁▂▃▄▅▆▇█",
          "a": "_.-="
        },
        "fg": {
          "truecolor": {
            "dark": "#ff4db7",
            "light": "#c21489"
          },
          "ansi16": "35"
        },
        "runs-shown": 5
      },
      "trend": {
        "improving": {
          "glyph": {
            "u": "↓",
            "a": "down"
          },
          "word": "improving",
          "fg": {
            "truecolor": {
              "dark": "#00c9ff",
              "light": "#00799a"
            },
            "ansi16": "32"
          }
        },
        "worsening": {
          "glyph": {
            "u": "↑",
            "a": "up"
          },
          "word": "worsening",
          "fg": {
            "truecolor": {
              "dark": "#f5b400",
              "light": "#9a6700"
            },
            "ansi16": "33"
          }
        },
        "flat": {
          "glyph": {
            "u": "→",
            "a": "flat"
          },
          "word": "flat",
          "fg": {
            "truecolor": {
              "dark": "#8a93a9",
              "light": "#67728e"
            },
            "ansi16": "2"
          }
        },
        "threshold-pct": 10
      },
      "col": {
        "label": 20,
        "typical": 10,
        "top-features": 3
      }
    },
    "state-badge": {
      "working": {
        "glyph": {
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
        "word": "done",
        "fg": {
          "truecolor": {
            "dark": "#00c9ff",
            "light": "#00799a"
          },
          "ansi16": "32"
        }
      },
      "stalled": {
        "glyph": {
          "u": "⚠",
          "a": "[!]"
        },
        "word": "STALLED",
        "fg": {
          "truecolor": {
            "dark": "#ff5c5c",
            "light": "#c62828"
          },
          "ansi16": "31"
        },
        "weight": "1"
      }
    },
    "fleet-feature": {
      "glyph-open": {
        "u": "▾",
        "a": "v"
      },
      "glyph-closed": {
        "u": "▸",
        "a": ">"
      },
      "name-fg": {
        "truecolor": {
          "dark": "39",
          "light": "39"
        },
        "ansi16": "39"
      },
      "cause-fg": {
        "truecolor": {
          "dark": "#8a93a9",
          "light": "#67728e"
        },
        "ansi16": "2"
      }
    },
    "dashboard-layout": {
      "wide-min": 100,
      "narrow-max": 60,
      "default-columns": 80
    }
  }
};
