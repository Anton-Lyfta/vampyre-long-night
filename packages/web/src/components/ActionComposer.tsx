/**
 * Den tomma bannern längst ned i listan. Klick öppnar en dropdown med alla
 * actions; kräver actionen mål följer en dropdown per mål tills actionen är klar.
 */
import { useState } from 'react';
import type { ActionChoice, DraftAction, Params, PlayerScreenPort } from '../screen/model';

type Mode = { kind: 'closed' } | { kind: 'choosing' } | { kind: 'building'; choice: ActionChoice; params: Params };

interface Props {
  port: PlayerScreenPort;
  draft: readonly DraftAction[];
  disabled?: boolean;
  onAdd: (choice: ActionChoice, params: Params) => void;
}

export function ActionComposer({ port, draft, disabled, onAdd }: Props) {
  const [mode, setMode] = useState<Mode>({ kind: 'closed' });
  const [numberValue, setNumberValue] = useState('');

  const advance = (choice: ActionChoice, params: Params) => {
    const step = port.nextStep(draft, choice.actionId, choice.performer, params);
    if (step === null) {
      onAdd(choice, params);
      setMode({ kind: 'closed' });
    } else {
      if (step.kind === 'number') setNumberValue(String(step.min));
      setMode({ kind: 'building', choice, params });
    }
  };

  if (mode.kind === 'closed') {
    return (
      <button type="button" className="action-banner empty" disabled={disabled} onClick={() => setMode({ kind: 'choosing' })}>
        + Lägg till action
      </button>
    );
  }

  const cancel = (
    <button type="button" className="link-button" onClick={() => setMode({ kind: 'closed' })}>
      Avbryt
    </button>
  );

  if (mode.kind === 'choosing') {
    const choices = port.actionChoices(draft);
    const vampire = choices.filter((c) => c.performerKind === 'vampire');
    const byMinion = new Map<string, ActionChoice[]>();
    for (const c of choices.filter((c) => c.performerKind === 'minion')) {
      byMinion.set(c.performerName, [...(byMinion.get(c.performerName) ?? []), c]);
    }
    const option = (c: ActionChoice) => (
      <option key={c.key} value={c.key} disabled={c.disabledReason !== undefined}>
        {c.name}
        {c.disabledReason ? ` (${c.disabledReason})` : ''}
      </option>
    );
    return (
      <div className="action-banner composing">
        <label>
          <span className="sr-only">Välj action</span>
          <select
            autoFocus
            aria-label="Välj action"
            defaultValue=""
            onChange={(e) => {
              const choice = choices.find((c) => c.key === e.target.value);
              if (choice) advance(choice, {});
            }}
          >
            <option value="" disabled>
              Välj action…
            </option>
            {vampire.length > 0 && <optgroup label={vampire[0]!.performerName}>{vampire.map(option)}</optgroup>}
            {[...byMinion].map(([name, list]) => (
              <optgroup key={name} label={`${name} (minion)`}>
                {list.map(option)}
              </optgroup>
            ))}
          </select>
        </label>
        {cancel}
      </div>
    );
  }

  const { choice, params } = mode;
  const step = port.nextStep(draft, choice.actionId, choice.performer, params);
  if (!step) return null;
  return (
    <div className="action-banner composing">
      <span className="composing-name">
        {choice.name}
        {choice.performerKind === 'minion' ? ` (${choice.performerName})` : ''}
      </span>
      {step.kind === 'select' ? (
        <select
          autoFocus
          aria-label={step.label}
          defaultValue=""
          key={step.param}
          onChange={(e) => e.target.value && advance(choice, { ...params, [step.param]: e.target.value })}
        >
          <option value="" disabled>
            {step.label}…
          </option>
          {step.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <form
          className="number-step"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(numberValue);
            if (Number.isInteger(n) && n >= step.min && n <= step.max) advance(choice, { ...params, [step.param]: n });
          }}
        >
          <input
            autoFocus
            type="number"
            aria-label={step.label}
            min={step.min}
            max={step.max}
            value={numberValue}
            onChange={(e) => setNumberValue(e.target.value)}
          />
          <button type="submit">OK</button>
        </form>
      )}
      {cancel}
    </div>
  );
}
