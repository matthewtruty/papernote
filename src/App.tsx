import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { isDefaultArea, loadAreas, persistAreas } from "./areas";
import { DEFAULT_LIVE_FONT, DEFAULT_MARKDOWN_FONT, findFont, fonts } from "./fonts";
import { filesFromClipboard, imageMarkdown, persistImageFile } from "./images";
import LiveEditor, { applyLiveAction, type LiveAction } from "./LiveEditor";
import { markdownToHtml, noteTitle, plainText, wordCount } from "./markdown";
import type { EditorMode, Folder, MenuName, StoredNote } from "./types";

const CARET = "#000000";
const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";

function relativeTime(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.round(days / 7)}w`;
}

function wrapSelection(value: string, start: number, end: number, before: string, after: string) {
  return value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end);
}

export default function App() {
  const [mode, setMode] = useState<EditorMode>("live");
  const [markdown, setMarkdown] = useState("");
  const [notes, setNotes] = useState<StoredNote[]>([]);
  const [current, setCurrent] = useState<StoredNote | null>(null);
  const [width, setWidth] = useState(() => Number(localStorage.getItem("pn.width")) || 860);
  const [liveFont, setLiveFont] = useState(() => localStorage.getItem("pn.liveFont") || DEFAULT_LIVE_FONT);
  const [markdownFont, setMarkdownFont] = useState(
    () => localStorage.getItem("pn.mdFont") || DEFAULT_MARKDOWN_FONT
  );
  const [zen, setZen] = useState(false);
  const [menu, setMenu] = useState<MenuName>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [toast, setToast] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [areas, setAreas] = useState<string[]>(() => loadAreas());
  const [newArea, setNewArea] = useState("");
  const [addingArea, setAddingArea] = useState(false);
  const newAreaRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<number>(0);
  const toastTimer = useRef<number>(0);

  const flash = useCallback((message: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(""), 1800);
  }, []);

  const closeMenus = useCallback(() => {
    setMenu(null);
    setSearchOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    void api()
      .load()
      .then((data) => {
        setMarkdown(data.scratchpad);
        setNotes(data.notes);
        setAreas(loadAreas(data.notes.map((note) => note.folder)));
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (current) {
        void api()
          .saveNote({ ...current, markdown })
          .then((updated) => {
            setCurrent(updated);
            setNotes((all) => all.map((note) => (note.id === updated.id ? updated : note)));
          });
      } else {
        void api().saveScratchpad(markdown);
      }
    }, 350);
    return () => window.clearTimeout(saveTimer.current);
  }, [current, loaded, markdown]);

  useEffect(() => {
    localStorage.setItem("pn.width", String(width));
    localStorage.setItem("pn.liveFont", liveFont);
    localStorage.setItem("pn.mdFont", markdownFont);
    persistAreas(areas);
  }, [areas, liveFont, markdownFont, width]);

  useEffect(() => {
    if (menu === "file") return;
    setAddingArea(false);
    setNewArea("");
  }, [menu]);

  const setEditorMode = useCallback((next: EditorMode) => {
    setMode(next);
    setMenu(null);
    window.setTimeout(() => {
      if (next === "md") textareaRef.current?.focus();
      else liveRef.current?.focus();
    }, 0);
  }, []);

  const toggleZen = useCallback(() => {
    const next = !zen;
    if (next) setEditorMode("live");
    setZen(next);
    closeMenus();
    api().setZen(next);
    flash(next ? `Zen — ${MOD}. to come back` : "Zen off");
  }, [closeMenus, flash, setEditorMode, zen]);

  const wrapMarkdown = (before: string, after: string) => {
    const field = textareaRef.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const next = wrapSelection(markdown, start, end, before, after);
    setMarkdown(next);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + before.length, end + before.length);
    });
  };

  const prefixMarkdown = (prefix: string) => {
    const field = textareaRef.current;
    if (!field) return;
    const start = markdown.lastIndexOf("\n", field.selectionStart - 1) + 1;
    setMarkdown(markdown.slice(0, start) + prefix + markdown.slice(start));
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(field.selectionStart + prefix.length, field.selectionEnd + prefix.length);
    });
  };

  const format = (action: LiveAction) => {
    if (mode === "md") {
      if (action === "heading") prefixMarkdown("# ");
      else if (action === "list") prefixMarkdown("- ");
      else if (action === "quote") prefixMarkdown("> ");
      else if (action === "bold") wrapMarkdown("**", "**");
      else if (action === "italic") wrapMarkdown("*", "*");
      else if (action === "strike") wrapMarkdown("~~", "~~");
      else if (action === "link") wrapMarkdown("[", "](url)");
      return;
    }
    const element = liveRef.current;
    if (!element) return;
    applyLiveAction(element, action);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const fileNote = async (folder: Folder) => {
    if (!markdown.trim()) {
      flash("Nothing to file yet");
      return;
    }
    const title = noteTitle(markdown);
    if (current) {
      const updated = await api().saveNote({ ...current, title, folder, markdown });
      setCurrent(updated);
      setNotes((all) => [updated, ...all.filter((note) => note.id !== updated.id)]);
    } else {
      const result = await api().fileNote({ title, folder, markdown });
      setNotes(result.notes);
      setCurrent(null);
      setMarkdown("");
    }
    setMenu(null);
    setAddingArea(false);
    setNewArea("");
    flash(`Filed in ${folder}`);
  };

  const addArea = (name: string, fileNow = false) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = areas.find((area) => area.toLowerCase() === trimmed.toLowerCase());
    const next = existing ?? trimmed;
    if (!existing) setAreas((all) => [...all, next]);
    setAddingArea(false);
    setNewArea("");
    if (fileNow) void fileNote(next);
  };

  const removeArea = (name: string) => {
    if (isDefaultArea(name)) return;
    setAreas((all) => all.filter((area) => area !== name));
  };

  const openNote = async (note: StoredNote | null) => {
    if (note) {
      if (!current) await api().saveScratchpad(markdown);
      else await api().saveNote({ ...current, markdown });
      setCurrent(note);
      setMarkdown(note.markdown);
    } else {
      if (current) await api().saveNote({ ...current, markdown });
      const data = await api().load();
      setCurrent(null);
      setMarkdown(data.scratchpad);
    }
    closeMenus();
    flash(note ? `Opened “${note.title}”` : "Scratchpad");
  };

  const searchResults = useMemo(() => {
    const items = [
      {
        id: "scratchpad",
        title: !current && markdown.trim() ? noteTitle(markdown) : "Scratchpad",
        folder: "Scratchpad",
        updatedAt: new Date().toISOString(),
        markdown
      },
      ...notes
    ];
    const needle = query.trim().toLowerCase();
    return items.filter(
      (note) =>
        !needle ||
        note.title.toLowerCase().includes(needle) ||
        note.markdown.toLowerCase().includes(needle) ||
        note.folder.toLowerCase().includes(needle)
    );
  }, [current, markdown, notes, query]);

  useEffect(() => {
    setSearchIndex(0);
  }, [query, searchOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      if (event.key === "Escape") {
        if (searchOpen || menu) closeMenus();
        else if (zen) toggleZen();
        return;
      }
      if (searchOpen) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSearchIndex((index) => Math.min(index + 1, Math.max(searchResults.length - 1, 0)));
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setSearchIndex((index) => Math.max(index - 1, 0));
        } else if (event.key === "Enter") {
          event.preventDefault();
          const choice = searchResults[searchIndex];
          if (choice) openNote(choice.id === "scratchpad" ? null : (choice as StoredNote));
        }
        if (!command) return;
      }
      if (!command) return;
      if (event.key === ".") {
        event.preventDefault();
        toggleZen();
      } else if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        setEditorMode(mode === "live" ? "md" : "live");
      } else if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        setSearchOpen(true);
        setMenu(null);
        window.setTimeout(() => searchRef.current?.focus(), 30);
      } else if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        format("bold");
      } else if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        format("italic");
      } else if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        format("link");
      } else if (/^[1-9]$/.test(event.key)) {
        const area = areas[Number(event.key) - 1];
        if (!area) return;
        event.preventDefault();
        void fileNote(area);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const isMd = mode === "md";
  const activeFont = findFont(isMd ? markdownFont : liveFont);
  const html = markdownToHtml(markdown);
  const words = wordCount(markdown);

  return (
    <div className={`shell${zen ? " is-zen" : ""}`} onMouseDown={() => menu && setMenu(null)}>
      <div className="drag-region" />

      <div className="column-scroll">
        <div className="column" style={{ width: `min(${width}px, 90%)` }}>
          {isMd ? (
            <textarea
              ref={textareaRef}
              className="md-editor"
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
              onPaste={(event) => {
                const files = filesFromClipboard(event.clipboardData);
                if (!files.length) return;
                event.preventDefault();
                const field = textareaRef.current;
                if (!field) return;
                void Promise.all(files.map((file) => persistImageFile(file))).then((sources) => {
                  const snippet = sources.map((src) => imageMarkdown(src)).join("\n\n");
                  const start = field.selectionStart;
                  const end = field.selectionEnd;
                  const next = `${markdown.slice(0, start)}${snippet}${markdown.slice(end)}`;
                  setMarkdown(next);
                  requestAnimationFrame(() => {
                    field.focus();
                    const caret = start + snippet.length;
                    field.setSelectionRange(caret, caret);
                  });
                });
              }}
              spellCheck={false}
              placeholder="Start typing…"
              style={{
                fontFamily: activeFont.family,
                fontSize: activeFont.size,
                caretColor: CARET
              }}
            />
          ) : (
            <LiveEditor
              markdown={markdown}
              onChange={setMarkdown}
              fontFamily={activeFont.family}
              fontSize={activeFont.size}
              caretColor={CARET}
              liveRef={liveRef}
            />
          )}
        </div>
      </div>

      <div className="bottom-bar" onMouseDown={(event) => event.stopPropagation()}>
        <div className="bar-inner">
          <span className="segmented">
            <button
              className={!isMd ? "tab is-on" : "tab"}
              title={`Parsed view — ${MOD}E`}
              onClick={() => setEditorMode("live")}
            >
              Live
            </button>
            <button
              className={isMd ? "tab is-on" : "tab"}
              title={`Markdown source — ${MOD}E`}
              onClick={() => setEditorMode("md")}
            >
              Markdown
            </button>
          </span>

          <button title={`Heading — ${MOD}⌥1`} onClick={() => format("heading")}>
            Heading
          </button>
          <button title="List" onClick={() => format("list")}>
            List
          </button>
          <button title="Blockquote" onClick={() => format("quote")}>
            Quote
          </button>
          <i className="rule" />
          <button className="mark-b" title={`Bold — ${MOD}B`} onClick={() => format("bold")}>
            B
          </button>
          <button className="mark-i" title={`Italic — ${MOD}I`} onClick={() => format("italic")}>
            I
          </button>
          <button className="mark-s" title="Strikethrough" onClick={() => format("strike")}>
            S
          </button>
          <button title={`Link — ${MOD}K on selection`} onClick={() => format("link")}>
            Link
          </button>
          <i className="rule" />
          <button
            title={`Search — ${MOD}O`}
            onClick={() => {
              setSearchOpen(true);
              setMenu(null);
              window.setTimeout(() => searchRef.current?.focus(), 30);
            }}
          >
            Search
          </button>
          <button title="File this note away" onClick={() => setMenu(menu === "file" ? null : "file")}>
            File It
          </button>
          <button title="Publish" onClick={() => setMenu(menu === "publish" ? null : "publish")}>
            Publish
          </button>
          <button title="Copy note" onClick={() => setMenu(menu === "copy" ? null : "copy")}>
            Copy
          </button>

          <span className="grow" />

          <input
            className="width-slider"
            type="range"
            min={520}
            max={1200}
            step={20}
            value={width}
            title="Editor width"
            onChange={(event) => setWidth(Number(event.target.value))}
          />
          <button
            className="font-name"
            title="Font for current mode"
            style={{ fontFamily: activeFont.family }}
            onClick={() => setMenu(menu === "fonts" ? null : "fonts")}
          >
            {activeFont.name}
          </button>
          <span className="words">{words} words</span>
          <button className="zen-toggle" title={`Zen mode — ${MOD}.`} onClick={toggleZen}>
            ◐
          </button>
        </div>
      </div>

      {menu === "file" && (
        <div className="popover file-pop" onMouseDown={(event) => event.stopPropagation()}>
          <div className="pop-label">File this note in</div>
          {areas.map((folder, index) => (
            <button key={folder} onClick={() => void fileNote(folder)}>
              <span>{folder}</span>
              <span className="file-meta">
                {index < 9 && <span className="hint">{MOD}{index + 1}</span>}
                {!isDefaultArea(folder) && (
                  <span
                    className="remove-area"
                    title={`Remove ${folder}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeArea(folder);
                    }}
                  >
                    ×
                  </span>
                )}
              </span>
            </button>
          ))}
          {addingArea ? (
            <form
              className="new-area"
              onSubmit={(event) => {
                event.preventDefault();
                addArea(newArea, true);
              }}
            >
              <input
                ref={newAreaRef}
                value={newArea}
                onChange={(event) => setNewArea(event.target.value)}
                placeholder="Area name"
                maxLength={32}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setAddingArea(false);
                    setNewArea("");
                  }
                }}
              />
              <button type="submit" disabled={!newArea.trim()}>
                Add
              </button>
            </form>
          ) : (
            <button
              className="add-area"
              onClick={() => {
                setAddingArea(true);
                window.setTimeout(() => newAreaRef.current?.focus(), 0);
              }}
            >
              + New area
            </button>
          )}
        </div>
      )}

      {menu === "publish" && (
        <div className="popover publish-pop" onMouseDown={(event) => event.stopPropagation()}>
          <div className="publish-title">Publish to web</div>
          <p>Creates a public read-only page for this note.</p>
          <button
            className="publish-go"
            onClick={() => {
              void api()
                .exportNote({
                  title: current?.title || noteTitle(markdown),
                  markdown,
                  html,
                  format: "html"
                })
                .then((saved) => saved && flash("Published a local page"));
              setMenu(null);
            }}
          >
            Publish note
          </button>
        </div>
      )}

      {menu === "copy" && (
        <div className="popover copy-pop" onMouseDown={(event) => event.stopPropagation()}>
          <button
            onClick={() => {
              void api().copy({ markdown });
              setMenu(null);
              flash("Markdown copied");
            }}
          >
            <span>Copy as Markdown</span>
            <span className="hint">.md</span>
          </button>
          <button
            onClick={() => {
              void api().copy({ markdown: plainText(markdown), html });
              setMenu(null);
              flash("Formatted text copied");
            }}
          >
            <span>Copy as formatted text</span>
            <span className="hint">rich</span>
          </button>
        </div>
      )}

      {menu === "fonts" && (
        <div className="popover fonts-pop" onMouseDown={(event) => event.stopPropagation()}>
          <div className="pop-label">{isMd ? "Markdown mode font" : "Live mode font"}</div>
          {fonts.map((font) => {
            const selected = font.name === activeFont.name;
            return (
              <button
                key={font.name}
                className={selected ? "is-selected" : ""}
                onClick={() => {
                  if (isMd) setMarkdownFont(font.name);
                  else setLiveFont(font.name);
                  setMenu(null);
                  window.setTimeout(() => (isMd ? textareaRef.current : liveRef.current)?.focus(), 0);
                }}
              >
                <span className="font-row-top">
                  <span>
                    {font.name} · {font.group}
                  </span>
                  {selected && <span className="mark">✓</span>}
                </span>
                <span className="font-preview" style={{ fontFamily: font.family }}>
                  A quiet tool for loud thoughts.
                </span>
              </button>
            );
          })}
        </div>
      )}

      {searchOpen && (
        <div className="overlay" onMouseDown={closeMenus}>
          <div className="search-panel" onMouseDown={(event) => event.stopPropagation()}>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes…"
            />
            <div className="search-list">
              {searchResults.length ? (
                searchResults.map((note, index) => (
                  <button
                    key={note.id}
                    className={index === searchIndex ? "is-active" : ""}
                    onMouseEnter={() => setSearchIndex(index)}
                    onClick={() => openNote(note.id === "scratchpad" ? null : (note as StoredNote))}
                  >
                    <span>{note.title}</span>
                    <span className="meta">
                      {note.folder} · {relativeTime(note.updatedAt)}
                    </span>
                  </button>
                ))
              ) : (
                <div className="search-empty">No matching notes</div>
              )}
            </div>
            <div className="search-footer">
              <span>↑↓ navigate</span>
              <span>↩ open</span>
              <span>esc close</span>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
