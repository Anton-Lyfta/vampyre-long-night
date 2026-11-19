import type { Resources } from '../screen/model';

const ITEMS: { key: keyof Resources; label: string; icon: string }[] = [
  { key: 'blood', label: 'Blood', icon: '🩸' },
  { key: 'vp', label: 'Victory Points', icon: '✦' },
  { key: 'artifacts', label: 'Artefakter', icon: '🏺' },
  { key: 'minions', label: 'Minions', icon: '👥' },
  { key: 'votes', label: 'Röster i Ivory Tower', icon: '🗳' },
];

export function ResourceBar({ resources }: { resources: Resources }) {
  return (
    <ul className="resource-bar" aria-label="Resurser">
      {ITEMS.map((it) => (
        <li key={it.key} className="resource" title={it.label}>
          <span className="resource-icon" aria-hidden>
            {it.icon}
          </span>
          <span className="sr-only">{it.label}: </span>
          <span className="resource-value" data-testid={`resource-${it.key}`}>
            {resources[it.key]}
          </span>
        </li>
      ))}
    </ul>
  );
}
