import React, { useState } from 'react';
import { MenuCategory } from '../../../types';
import { Modal, Button } from '../../../components/shared';
import {
  Plus,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  Power,
  FolderTree,
} from 'lucide-react';

interface CategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: MenuCategory[];
  onCreateCategory: (data: { name: string; description?: string }) => void;
  onUpdateCategory: (id: string, data: { name: string; description?: string }) => void;
  onToggleCategoryStatus: (id: string) => void;
  onDeleteCategory: (id: string) => void;
  onMoveCategory: (id: string, direction: 'up' | 'down') => void;
}

export const CategoriesModal: React.FC<CategoriesModalProps> = ({
  isOpen,
  onClose,
  categories,
  onCreateCategory,
  onUpdateCategory,
  onToggleCategoryStatus,
  onDeleteCategory,
  onMoveCategory,
}) => {
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const startEdit = (cat: MenuCategory) => {
    setEditingCatId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description || '');
  };

  const cancelEdit = () => {
    setEditingCatId(null);
    setEditName('');
    setEditDesc('');
  };

  const handleSaveEdit = (catId: string) => {
    if (!editName.trim()) return;
    onUpdateCategory(catId, { name: editName.trim(), description: editDesc.trim() });
    cancelEdit();
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateCategory({ name: newName.trim(), description: newDesc.trim() });
    setNewName('');
    setNewDesc('');
    setIsCreating(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gerenciar Categorias"
      subtitle="Organize a estrutura do cardápio, ordem e visibilidade"
      maxWidth="md"
      footer={
        <div className="flex justify-end w-full">
          <Button variant="secondary" size="md" onClick={onClose}>
            Concluir
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-zinc-200">
        {/* Quick Add Form Trigger */}
        {!isCreating ? (
          <Button
            variant="outline"
            size="md"
            fullWidth
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreating(true)}
          >
            + Nova Categoria
          </Button>
        ) : (
          <form
            onSubmit={handleCreateSubmit}
            className="p-3.5 rounded-2xl bg-[#0F1117] border border-orange-500/30 space-y-2.5 animate-in fade-in"
          >
            <h4 className="text-xs font-bold text-white uppercase tracking-wider text-orange-400">
              Criar Nova Categoria
            </h4>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nome da categoria (ex: Sobremesas Artesanais)"
              className="w-full h-10 px-3 bg-[#13161D] border border-zinc-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-orange-500"
              autoFocus
            />
            <input
              type="text"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Descrição curta (opcional)"
              className="w-full h-9 px-3 bg-[#13161D] border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
            />
            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" variant="primary" size="sm">
                Salvar Categoria
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCreating(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {/* Categories List */}
        <div className="space-y-2">
          {categories.map((cat, index) => {
            const isEditing = editingCatId === cat.id;
            const isFirst = index === 0;
            const isLast = index === categories.length - 1;

            return (
              <div
                key={cat.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  cat.isActive
                    ? 'bg-[#13161D] border-zinc-800/90'
                    : 'bg-[#0E1015] border-zinc-850 opacity-60'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full h-9 px-2.5 bg-[#0A0C0F] border border-zinc-700 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-orange-500"
                    />
                    <input
                      type="text"
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      placeholder="Descrição da categoria"
                      className="w-full h-8 px-2.5 bg-[#0A0C0F] border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-orange-500"
                    />
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleSaveEdit(cat.id)}
                      >
                        Salvar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white truncate">
                          {cat.name}
                        </h4>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-800 text-zinc-400 font-mono">
                          {cat.itemCount || 0} {(cat.itemCount || 0) === 1 ? 'item' : 'itens'}
                        </span>
                        {!cat.isActive && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                            Pausada
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-xs text-zinc-400 truncate mt-0.5">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Active/Pause toggle */}
                      <button
                        type="button"
                        onClick={() => onToggleCategoryStatus(cat.id)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          cat.isActive
                            ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/40'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-750'
                        }`}
                        title={cat.isActive ? 'Pausar categoria' : 'Ativar categoria'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>

                      {/* Move up / down */}
                      <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => onMoveCategory(cat.id, 'up')}
                          className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 transition-colors"
                          title="Mover categoria para cima"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => onMoveCategory(cat.id, 'down')}
                          className="p-1 text-zinc-400 hover:text-white disabled:opacity-20 transition-colors"
                          title="Mover categoria para baixo"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
                        title="Editar nome"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-orange-400" />
                      </button>

                      {/* Delete */}
                      {deleteConfirmId === cat.id ? (
                        <div className="flex items-center gap-1 bg-rose-950 p-0.5 rounded-lg border border-rose-500/40">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteCategory(cat.id);
                              setDeleteConfirmId(null);
                            }}
                            className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded"
                          >
                            Excluir
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-1 py-0.5 text-zinc-400 text-[10px]"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(cat.id)}
                          className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition-colors"
                          title="Excluir categoria"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
