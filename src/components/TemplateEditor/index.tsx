import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { TRAVEL_LIST_TEMPLATES, getTravelListTemplateItems, saveTravelListTemplateItems } from '../../utils/travelLists';

export const TemplateEditor: React.FC = () => {
  const [selectedId, setSelectedId] = useState('general');
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  const selected = TRAVEL_LIST_TEMPLATES.find((template) => template.id === selectedId) ?? TRAVEL_LIST_TEMPLATES[0];

  const load = (id: string) => {
    const template = TRAVEL_LIST_TEMPLATES.find((entry) => entry.id === id) ?? TRAVEL_LIST_TEMPLATES[0];
    setSelectedId(template.id);
    setItems(getTravelListTemplateItems(template));
    setDraft('');
  };

  useEffect(() => {
    load(selectedId);
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ templateId?: string }>).detail;
      if (!detail?.templateId || detail.templateId === selectedId) load(selectedId);
    };
    window.addEventListener('vela-template-updated', onUpdate);
    return () => window.removeEventListener('vela-template-updated', onUpdate);
  }, [selectedId]);

  const save = (next: string[]) => {
    const clean = Array.from(new Set(next.map((item) => item.trim()).filter(Boolean)));
    setItems(clean);
    saveTravelListTemplateItems(selected.id, clean);
  };

  return (
    <section className="template-editor">
      <div className="template-editor-head">
        <div>
          <span className="master-data-kicker">TRAVEL LIST TEMPLATES</span>
          <strong className="master-data-section-title">Templates</strong>
          <p className="template-editor-hint">Edit the reusable lists used for future trips. Existing trips are not changed.</p>
        </div>
      </div>
      <div className="template-editor-tabs">
        {TRAVEL_LIST_TEMPLATES.map((template) => (
          <button key={template.id} type="button" className={template.id === selected.id ? 'active' : ''} onClick={() => load(template.id)}>
            {template.name}
          </button>
        ))}
      </div>
      <div className="template-editor-card">
        <div className="template-editor-title">
          <div><strong>{selected.name}</strong><span>{selected.description}</span></div>
          <small>{items.length} items</small>
        </div>
        <div className="template-editor-items">
          {items.map((item, index) => (
            <div className="template-editor-item" key={item + index}>
              <span>{item}</span>
              <button type="button" aria-label={'Delete ' + item} onClick={() => save(items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <div className="template-editor-add">
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add item" onKeyDown={(event) => { if (event.key === 'Enter' && draft.trim()) { save([...items, draft]); setDraft(''); } }} />
          <button type="button" onClick={() => { if (!draft.trim()) return; save([...items, draft]); setDraft(''); }}><Plus size={15} /> Add</button>
        </div>
      </div>
    </section>
  );
};

export default TemplateEditor;
