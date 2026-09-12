"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setStoryBlocks } from "@/app/admin/actions";
import { FormStatus } from "@/app/admin/FormStatus";
import { paragraphs } from "@/lib/format";
import type { Photo, StoryBlock } from "@/lib/types";

interface StoryArrangerProps {
  placeId: string;
  /** The story as visitors read it now, so a photo no block mentions is here too, at the end. */
  blocks: StoryBlock[];
  photos: Photo[];
}

/** A block with a key of its own, so React follows it as it moves rather than by position. */
interface Item {
  key: string;
  block: StoryBlock;
}

interface Arrangement {
  items: Item[];
  /** Where the next new block's key comes from. Keys are never reused, so moving a block keeps its identity. */
  nextKey: number;
  /** The saved story this was seeded from, so saving here or editing elsewhere seeds it again. */
  seeded: string;
}

const seed = (blocks: StoryBlock[], from = 0): Arrangement => ({
  items: blocks.map((block, i) => ({ key: `b${from + i}`, block })),
  nextKey: from + blocks.length,
  seeded: JSON.stringify(blocks),
});

/** The story in the owner's hands: passages and photos that move, split, appear and go. */
export function StoryArranger({ placeId, blocks, photos }: StoryArrangerProps) {
  const router = useRouter();
  const [arrangement, setArrangement] = useState<Arrangement>(() => seed(blocks));
  const [status, setStatus] = useState<{ error?: string; message?: string }>({});
  const [busy, setBusy] = useState(false);

  // Seeding again rather than remounting keeps the confirmation of the save that caused it on screen.
  const saved = JSON.stringify(blocks);
  if (arrangement.seeded !== saved) setArrangement(seed(blocks, arrangement.nextKey));
  const { items } = arrangement;

  /** Rearranges the story, handing the change a fresh key for any block it makes. */
  const arrange = (change: (items: Item[], key: string) => Item[]) =>
    setArrangement((current) => ({
      ...current,
      items: change(current.items, `b${current.nextKey}`),
      nextKey: current.nextKey + 1,
    }));

  const move = (index: number, by: number) =>
    arrange((current) => {
      const next = [...current];
      const to = index + by;
      if (to < 0 || to >= next.length) return current;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  const remove = (index: number) => arrange((current) => current.filter((_, i) => i !== index));

  const insertTextAfter = (index: number) =>
    arrange((current, key) => [...current.slice(0, index + 1), { key, block: { type: "text", text: "" } }, ...current.slice(index + 1)]);

  const write = (index: number, text: string) =>
    arrange((current) => current.map((item, i) => (i === index ? { key: item.key, block: { type: "text", text } } : item)));

  /** Cuts a passage in two at a paragraph break, so a photo can go between the halves. */
  const splitAfter = (index: number, paragraph: number) =>
    arrange((current, key) => {
      const item = current[index];
      if (item.block.type !== "text") return current;
      const parts = paragraphs(item.block.text);
      return [
        ...current.slice(0, index),
        { key: item.key, block: { type: "text", text: parts.slice(0, paragraph + 1).join("\n\n") } },
        { key, block: { type: "text", text: parts.slice(paragraph + 1).join("\n\n") } },
        ...current.slice(index + 1),
      ];
    });

  const photoById = new Map(photos.map((photo) => [photo.id, photo]));

  async function save() {
    setBusy(true);
    setStatus({});
    try {
      const result = await setStoryBlocks({ placeId, blocks: items.map((item) => item.block) });
      if (!result.ok) {
        setStatus({ error: result.error.message });
        return;
      }
      setStatus({ message: "Story saved." });
      // The page hands back the story visitors now read, which seeds the arranger again.
      router.refresh();
    } catch (error) {
      setStatus({ error: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form">
      <p className="hint">
        Photos you take out of the story stay in the journal: they move to the end. Deleting a photo for good comes later.
      </p>

      {items.length === 0 ? (
        <p className="muted">Nothing in the story yet.</p>
      ) : (
        <ol className="blocks">
          {items.map((item, index) => {
            const photo = item.block.type === "photo" ? photoById.get(item.block.photoId) : undefined;
            // What the buttons call this block, so each one says which block it acts on.
            const what = item.block.type === "text" ? `passage ${index + 1}` : `photo “${photo?.caption || index + 1}”`;
            const parts = item.block.type === "text" ? paragraphs(item.block.text) : [];

            return (
              <li key={item.key} className="block">
                {item.block.type === "text" ? (
                  <textarea
                    className="input"
                    value={item.block.text}
                    aria-label={`Text of ${what}`}
                    placeholder="Write here. A blank line starts a new paragraph."
                    onChange={(event) => write(index, event.target.value)}
                  />
                ) : (
                  <div className="block-photo">
                    {/* Photos come from storage at arbitrary sizes, so a plain img rather than next/image. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo?.url} alt="" />
                    <span>{photo?.caption || "No caption"}</span>
                  </div>
                )}

                {parts.length > 1 && (
                  <p className="block-split">
                    <span>Split after paragraph</span>
                    {parts.slice(0, -1).map((_, paragraph) => (
                      <button
                        key={paragraph}
                        type="button"
                        aria-label={`Split ${what} after paragraph ${paragraph + 1}`}
                        onClick={() => splitAfter(index, paragraph)}
                      >
                        {paragraph + 1}
                      </button>
                    ))}
                  </p>
                )}

                <div className="block-actions">
                  <button className="btn" type="button" aria-label={`Move ${what} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                    ↑ Up
                  </button>
                  <button
                    className="btn"
                    type="button"
                    aria-label={`Move ${what} down`}
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓ Down
                  </button>
                  <button className="btn" type="button" aria-label={`Insert text after ${what}`} onClick={() => insertTextAfter(index)}>
                    + Text below
                  </button>
                  <button className="btn btn-danger" type="button" aria-label={`Remove ${what}`} onClick={() => remove(index)}>
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <FormStatus {...status} />
      <div className="block-actions">
        <button className="btn" type="button" onClick={() => insertTextAfter(items.length - 1)}>
          + Text at the end
        </button>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save story"}
        </button>
      </div>
    </div>
  );
}
