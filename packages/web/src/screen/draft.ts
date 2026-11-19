/** Rena operationer på spelarens lista. */
import type { DraftAction, Params, PerformerRef } from './model';

let counter = 0;
export const newUid = (): string => `d${++counter}`;

export function addAction(
  list: readonly DraftAction[],
  actionId: string,
  performer: PerformerRef,
  params: Params,
  paramLabels: Record<string, string> = {},
  uid: string = newUid(),
): DraftAction[] {
  return [...list, { uid, actionId, performer, params: { ...params }, paramLabels: { ...paramLabels } }];
}

export function removeAction(list: readonly DraftAction[], uid: string): DraftAction[] {
  return list.filter((a) => a.uid !== uid);
}

/** Flyttar raden `uid` till platsen där `overUid` står. */
export function moveAction(list: readonly DraftAction[], uid: string, overUid: string): DraftAction[] {
  const from = list.findIndex((a) => a.uid === uid);
  const to = list.findIndex((a) => a.uid === overUid);
  if (from < 0 || to < 0 || from === to) return [...list];
  const out = [...list];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item!);
  return out;
}

/** Flyttar raden ett steg upp (-1) eller ned (+1). */
export function shiftAction(list: readonly DraftAction[], uid: string, delta: -1 | 1): DraftAction[] {
  const i = list.findIndex((a) => a.uid === uid);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return [...list];
  return moveAction(list, uid, list[j]!.uid);
}
