import { Focusable, GamepadButton, GamepadEvent } from "@decky/ui";
import { FC, FocusEvent, useEffect, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight, FaSyncAlt, FaTimes } from "react-icons/fa";
import { ScreenshotItem } from "./types";
import { fetchFullScreenshot, getCachedFullScreenshot } from "./store";
import { t } from "./i18n";
import { COLORS, LegendItem, revealInParent } from "./shared";

interface ScreenshotModalProps {
  pluginId: string;
  pluginName: string;
  accent: string;
  screenshots: ScreenshotItem[];
  initialIndex?: number;
  onIndexChange?: (idx: number) => void;
  closeModal: () => void;
}

export const ScreenshotModal: FC<ScreenshotModalProps> = ({
  pluginId,
  pluginName,
  accent,
  screenshots,
  initialIndex = 0,
  onIndexChange,
  closeModal,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const [fullSrc, setFullSrc] = useState<string | null>(null);
  const thumbRefs = useRef<(HTMLDivElement | null)[]>([]);
  const total = screenshots.length;
  const current = screenshots[index];

  const go = (idx: number, moveFocus = true) => {
    const next = (idx + total) % total;
    setIndex(next);
    onIndexChange?.(next);
    if (moveFocus) {
      const el = thumbRefs.current[next];
      if (el) {
        el.focus();
        try {
          (window as any).FocusNavController?.FocusElement?.(el);
        } catch {}
      }
    }
  };

  // Lazy-load the full resolution print, keeping the thumbnail on screen meanwhile
  useEffect(() => {
    if (!current) return;
    const cached = getCachedFullScreenshot(pluginId, current.filename);
    setFullSrc(cached);
    if (cached) return;
    let alive = true;
    fetchFullScreenshot(pluginId, current.filename).then((src) => alive && src && setFullSrc(src));
    // Warm up the next print so paging feels instant
    const next = screenshots[(index + 1) % total];
    if (next) fetchFullScreenshot(pluginId, next.filename);
    return () => {
      alive = false;
    };
  }, [current?.filename]);

  useEffect(() => {
    const timer = setTimeout(() => go(initialIndex), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!current) return null;

  const onButtonDown = (evt: GamepadEvent) => {
    if (evt.detail.button === GamepadButton.BUMPER_LEFT) go(index - 1);
    else if (evt.detail.button === GamepadButton.BUMPER_RIGHT) go(index + 1);
  };

  const arrow = (dir: -1 | 1) => (
    <div
      onClick={() => go(index + dir)}
      style={{
        position: "absolute",
        top: "50%",
        [dir < 0 ? "left" : "right"]: "18px",
        transform: "translateY(-50%)",
        width: "46px",
        height: "46px",
        borderRadius: "50%",
        backgroundColor: "rgba(0,0,0,0.55)",
        border: "1px solid rgba(255,255,255,0.22)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {dir < 0 ? <FaChevronLeft size={16} /> : <FaChevronRight size={16} />}
    </div>
  );

  return (
    <Focusable
      flow-children="column"
      noFocusRing={true}
      onCancel={closeModal}
      onCancelButton={closeModal}
      onButtonDown={onButtonDown}
      className="tl-fade-in"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        backgroundColor: "rgba(3, 4, 8, 0.985)",
        display: "flex",
        flexDirection: "column",
        color: COLORS.text,
      }}
    >
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 28px" }}>
        <span style={{ width: "4px", height: "22px", borderRadius: "2px", backgroundColor: accent }} />
        <span style={{ fontSize: "16px", fontWeight: 800 }}>{pluginName}</span>
        <span style={{ fontSize: "14px", color: COLORS.textDim }}>{current.title}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: "13px", color: COLORS.textDim, fontWeight: 700 }}>
          {index + 1} / {total}
        </span>
        <div
          onClick={closeModal}
          style={{
            padding: "7px 13px",
            borderRadius: "9px",
            backgroundColor: COLORS.surfaceStrong,
            display: "flex",
            alignItems: "center",
            gap: "7px",
            fontSize: "12.5px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <FaTimes size={11} /> {t("gallery.close")}
        </div>
      </div>

      {/* Stage */}
      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 80px" }}>
        <img
          key={current.filename}
          className="tl-fade-in"
          src={fullSrc || current.thumbUrl}
          alt={current.title}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            borderRadius: "10px",
            boxShadow: "0 24px 60px rgba(0,0,0,0.8)",
          }}
        />
        {!fullSrc && (
          <div style={{ position: "absolute", top: "14px", right: "96px", color: COLORS.textDim }}>
            <FaSyncAlt className="tl-spin" size={14} />
          </div>
        )}
        {total > 1 && arrow(-1)}
        {total > 1 && arrow(1)}
      </div>

      {/* Filmstrip: D-pad left/right walks through the prints */}
      <Focusable
        flow-children="row"
        noFocusRing={true}
        className="tl-scroll"
        style={{ display: "flex", justifyContent: total > 9 ? "flex-start" : "center", gap: "10px", overflowX: "auto", padding: "14px 28px 10px" }}
      >
        {screenshots.map((shot, idx) => (
          <Focusable
            key={shot.filename}
            ref={(el: HTMLDivElement | null) => {
              thumbRefs.current[idx] = el;
            }}
            onGamepadFocus={() => idx !== index && go(idx, false)}
            onFocus={(e: FocusEvent<HTMLDivElement>) =>
              revealInParent(e.currentTarget, true)
            }
            onClick={() => go(idx, false)}
            onActivate={() => go(idx + 1)}
            className={`tl-thumb${idx === index ? " tl-active" : ""}`}
            focusClassName="tl-focused"
            noFocusRing={true}
            style={{
              flexShrink: 0,
              width: "104px",
              height: "65px",
              borderRadius: "8px",
              overflow: "hidden",
              border: idx === index ? `2px solid ${accent}` : `1px solid ${COLORS.border}`,
            }}
          >
            <img src={shot.thumbUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </Focusable>
        ))}
      </Focusable>

      <div style={{ display: "flex", gap: "20px", padding: "6px 28px 14px", fontSize: "12px", color: COLORS.textDim }}>
        <LegendItem glyph="←→ L1/R1">{t("legend.prints")}</LegendItem>
        <LegendItem glyph="B">{t("gallery.close")}</LegendItem>
      </div>
    </Focusable>
  );
};
